"""
Praxirence FastAPI Backend Application Entrypoint
Integrates Whisper LoRA ASR, Mistral QLoRA Care-Plan LLM, Celery,
Meta WhatsApp Cloud API, and Fast2SMS OTP.
"""

import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.patient import Patient
from app.models.audit_log import AuditLog
from app import auth
from app.routes import visits, patients, recordings, chat
from ml.inference import model_loader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("praxirence.main")


from sqlalchemy import text


def auto_migrate_schema():
    """
    Ensures missing columns and tables exist across PostgreSQL and SQLite.
    Runs on backend startup in lifespan before seeding.
    """
    logger.info("Executing database auto-migration...")
    try:
        dialect = engine.dialect.name
        if dialect == "postgresql":
            ddls = [
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty VARCHAR(255) DEFAULT 'General Physician';",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_name VARCHAR(255) DEFAULT 'Praxirence Clinical Centre';",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS reg_number VARCHAR(64) DEFAULT 'NMC-2024-84920';",
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone ON users (phone) WHERE phone IS NOT NULL;",
                "ALTER TABLE patients ADD COLUMN IF NOT EXISTS dob DATE;",
                "ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_status BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE patients ADD COLUMN IF NOT EXISTS consent_updated_at TIMESTAMP;",
                "ALTER TABLE patients ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(255);",
                "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_id VARCHAR(36);",
                "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_role VARCHAR(50);",
                "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource VARCHAR(100);",
                "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS resource_id VARCHAR(100);",
                "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action VARCHAR(100);",
                "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);",
                "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS details JSONB;",
                "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP;",
            ]
            for ddl in ddls:
                try:
                    with engine.connect() as conn:
                        conn.execute(text(ddl))
                        conn.commit()
                except Exception as e:
                    logger.warning(f"DDL execution notice ({ddl}): {e}")
            logger.info("PostgreSQL schema auto-migration completed successfully.")
        elif dialect == "sqlite":
            logger.info("SQLite schema verified.")
    except Exception as e:
        logger.error(f"Error during schema auto-migration: {e}", exc_info=True)


def seed_initial_data():
    """Seeds real doctor and initial patient record for instant clinical verification"""
    db = SessionLocal()
    try:
        doctor = db.query(User).filter(User.email == "doctor@praxirence.com").first()
        if not doctor:
            real_doctor = User(
                email="doctor@praxirence.com",
                hashed_password=get_password_hash("Doctor123!"),
                name="Dr. Mayank Raj",
                phone="+919876543210",
                specialty="Chief Medical Officer & Physician",
                clinic_name="Praxirence Clinical Centre",
                reg_number="NMC-2024-84920"
            )
            db.add(real_doctor)
            db.commit()
            logger.info("Initialized real doctor: Dr. Mayank Raj (doctor@praxirence.com / Doctor123!)")
        else:
            doctor.name = "Dr. Mayank Raj"
            doctor.specialty = "Chief Medical Officer & Physician"
            doctor.hashed_password = get_password_hash("Doctor123!")
            if hasattr(doctor, "phone") and not doctor.phone:
                doctor.phone = "+919876543210"
            if hasattr(doctor, "clinic_name") and not doctor.clinic_name:
                doctor.clinic_name = "Praxirence Clinical Centre"
            if hasattr(doctor, "reg_number") and not doctor.reg_number:
                doctor.reg_number = "NMC-2024-84920"
            db.commit()

        sample_patient = db.query(Patient).first()
        if not sample_patient:
            p = Patient(
                name="Mayank",
                consent_status=True
            )
            p.phone = "+919835139865"
            db.add(p)
            db.commit()
            logger.info("Initialized patient record: Mayank (+919835139865)")
        else:
            sample_patient.name = "Mayank"
            sample_patient.phone = "+919835139865"
            sample_patient.consent_status = True
            db.commit()

    except Exception as e:
        logger.warning(f"Seeding notice: {e}")
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Praxirence Healthcare Platform...")
    # Initialize database tables & run schema auto-migrations
    try:
        Base.metadata.create_all(bind=engine)
        auto_migrate_schema()
        logger.info("Database schema initialized and verified.")
        seed_initial_data()
    except Exception as e:
        logger.error(f"Database setup error: {e}")

    # Initialize AI Model Loader
    try:
        model_loader.load_models()
    except Exception as e:
        logger.warning(f"AI ModelLoader initialization warning: {e}")

    yield
    logger.info("Shutting down Praxirence Platform...")


app = FastAPI(
    title="Praxirence Healthcare Platform API",
    description="Full-stack AI Clinical Consultation, WhatsApp Care Plan Delivery & Patient Reminder System",
    version="2.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# OWASP & Cloud Cybersecurity Headers + Rate Limiting Middleware
_STARTUP_TIME = time.time()
_rate_limit_records: dict[str, list[float]] = {}
SENSITIVE_AUTH_PATHS = {
    "/auth/patient-otp",
    "/auth/doctor-otp",
    "/auth/otp/request",
    "/auth/doctor-login",
    "/auth/patient-login"
}
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 30  # Max 30 attempts per minute per IP for auth endpoints


@app.middleware("http")
async def security_and_rate_limit_middleware(request: Request, call_next):
    """
    Cloud Cybersecurity & SRE Middleware:
    1. Enforces Leaky-Bucket Rate Limiting on authentication endpoints to prevent OTP flooding and brute force.
    2. Injects OWASP Security Headers to harden against XSS, clickjacking, and MIME sniffing.
    """
    client_ip = request.client.host if request.client else "unknown"
    path = request.url.path

    # Check Rate Limiting for sensitive auth endpoints
    if any(path.startswith(p) for p in SENSITIVE_AUTH_PATHS):
        now = time.time()
        key = f"{client_ip}:{path}"
        timestamps = _rate_limit_records.get(key, [])
        # Expire older timestamps
        timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
        if len(timestamps) >= RATE_LIMIT_MAX_REQUESTS:
            from fastapi.responses import JSONResponse
            logger.warning(f"SECURITY ALERT: Rate limit exceeded for {key} ({len(timestamps)} requests in 60s)")
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. For patient safety and security, please wait 60 seconds.",
                    "error_code": "RATE_LIMIT_EXCEEDED",
                    "retry_after_seconds": 60
                },
                headers={"Retry-After": "60"}
            )
        timestamps.append(now)
        _rate_limit_records[key] = timestamps

    response = await call_next(request)

    # Inject OWASP Security Headers (Cybersecurity Hardening)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=('self'), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-DPDP-Compliance"] = "India-DPDP-Act-2023-Aligned"

    return response


@app.middleware("http")
async def audit_logging_middleware(request: Request, call_next):
    """Audit logging middleware tracking request paths, latency, and status"""
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time

    path = request.url.path
    if not (path.startswith("/health") or path.startswith("/docs") or path.startswith("/openapi.json")):
        client_ip = request.client.host if request.client else "unknown"
        logger.info(
            f"AUDIT {request.method} {path} - Status: {response.status_code} "
            f"- IP: {client_ip} - Latency: {duration:.3f}s"
        )

    return response


# Register API Routers
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(visits.router)
app.include_router(recordings.router)
app.include_router(chat.router)


@app.get("/health")
def health_check():
    """Enhanced SRE Health, Readiness, and Liveness Probe"""
    uptime = time.time() - _STARTUP_TIME
    db_status = "connected"
    db_latency_ms = 0.0
    try:
        t0 = time.time()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_latency_ms = round((time.time() - t0) * 1000, 2)
    except Exception as e:
        db_status = f"unhealthy: {e}"

    return {
        "status": "healthy" if "unhealthy" not in db_status else "degraded",
        "service": "Praxirence Backend API",
        "version": "2.0.0",
        "uptime_seconds": round(uptime, 1),
        "database": {
            "dialect": engine.dialect.name,
            "status": db_status,
            "latency_ms": db_latency_ms
        },
        "security": {
            "encryption": "AES-256 Fernet (At-Rest)",
            "compliance": "DPDP Act 2023 / ABDM FHIR Profile M2",
            "rate_limiting": "Enabled (30 req/min)",
            "owasp_headers": "Active"
        },
        "models_loaded": model_loader._models_loaded,
        "device": model_loader.device,
        "whatsapp_provider": "Meta WhatsApp Cloud API / Twilio Fallback",
        "otp_provider": "Fast2SMS / WhatsApp Multi-Channel"
    }


@app.api_route("/auth/migrate", methods=["GET", "POST"])
def trigger_migration():
    """Manual trigger to synchronize PostgreSQL schema and seed data"""
    try:
        auto_migrate_schema()
        seed_initial_data()
        return {
            "success": True,
            "message": "Schema auto-migration and initial seed executed successfully."
        }
    except Exception as e:
        logger.error(f"Manual migration error: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }


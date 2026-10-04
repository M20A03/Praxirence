"""
Praxirence FastAPI Backend Application Entrypoint
Integrates Whisper LoRA ASR, Mistral QLoRA Care-Plan LLM, and
In-App Native Care Plan Synchronization (100% Local, Zero External APIs).
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
from app.models.medicine import Medicine
from app import auth
from app.routes import visits, patients, recordings, chat, realtime, doctors, doctor_copilot, medicines
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
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty VARCHAR(255);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_name VARCHAR(255);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS reg_number VARCHAR(64);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS degree VARCHAR(255);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS qualifications VARCHAR(255);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(255);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS experience_years VARCHAR(50);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '[\"English\", \"Hindi\"]';",
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_phone ON users (phone) WHERE phone IS NOT NULL;",
                "ALTER TABLE patients ADD COLUMN IF NOT EXISTS dob DATE;",
                "ALTER TABLE patients ADD COLUMN IF NOT EXISTS abha_id VARCHAR(50);",
                "ALTER TABLE patients ADD COLUMN IF NOT EXISTS age INTEGER;",
                "ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender VARCHAR(20);",
                "ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(50);",
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
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_address VARCHAR(255);",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT 12.9716;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT 77.5946;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS available_days JSONB DEFAULT '[\"Mon\", \"Tue\", \"Wed\", \"Thu\", \"Fri\", \"Sat\"]';",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS working_hours_start VARCHAR(10) DEFAULT '09:00';",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS working_hours_end VARCHAR(10) DEFAULT '18:00';",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS slot_duration_mins INTEGER DEFAULT 30;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS unavailable_dates JSONB DEFAULT '[]';",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS consultation_fee INTEGER DEFAULT 500;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_slots JSONB DEFAULT '{}';",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS current_delay_mins INTEGER DEFAULT 0;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS delay_updated_at TIMESTAMP;",
                "ALTER TABLE patients ADD COLUMN IF NOT EXISTS primary_account_phone VARCHAR(32);",
                "ALTER TABLE patients ADD COLUMN IF NOT EXISTS family_relation VARCHAR(30) DEFAULT 'Self';",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS appointment_date VARCHAR(20);",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS time_slot VARCHAR(20);",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS booking_type VARCHAR(30) DEFAULT 'in_person';",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS chief_complaint TEXT;",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS token_number INTEGER;",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS triage_level VARCHAR(30) DEFAULT 'Routine';",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS skip_count INTEGER DEFAULT 0;",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS deferred_at TIMESTAMP;",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS signature_hash VARCHAR(64);",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS retention_until TIMESTAMP;",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255);",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS day3_followup_status VARCHAR(30) DEFAULT 'scheduled';",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS day3_followup_sent_at TIMESTAMP;",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS day3_followup_response JSONB;",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS day7_followup_status VARCHAR(30) DEFAULT 'scheduled';",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS day7_followup_sent_at TIMESTAMP;",
                "ALTER TABLE visits ADD COLUMN IF NOT EXISTS day7_followup_response JSONB;",
                """
                CREATE TABLE IF NOT EXISTS doctor_reviews (
                    id VARCHAR(36) PRIMARY KEY,
                    doctor_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    patient_id VARCHAR(36) REFERENCES patients(id) ON DELETE SET NULL,
                    visit_id VARCHAR(36) REFERENCES visits(id) ON DELETE SET NULL,
                    patient_name VARCHAR(255) NOT NULL,
                    rating INTEGER NOT NULL,
                    review_text TEXT NOT NULL,
                    word_count INTEGER NOT NULL DEFAULT 0,
                    is_first_visit BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """,
                "CREATE INDEX IF NOT EXISTS ix_doctor_reviews_doctor_id ON doctor_reviews (doctor_id);",
                "CREATE INDEX IF NOT EXISTS ix_doctor_reviews_patient_id ON doctor_reviews (patient_id);",
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
            with engine.connect() as conn:
                # check users columns
                user_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
                user_ddls = {
                    "city": "ALTER TABLE users ADD COLUMN city VARCHAR(100) DEFAULT 'Bangalore'",
                    "state": "ALTER TABLE users ADD COLUMN state VARCHAR(100) DEFAULT 'Karnataka'",
                    "pincode": "ALTER TABLE users ADD COLUMN pincode VARCHAR(20) DEFAULT '560038'",
                    "clinic_address": "ALTER TABLE users ADD COLUMN clinic_address VARCHAR(255) DEFAULT '12th Main, Indiranagar, Bangalore'",
                    "latitude": "ALTER TABLE users ADD COLUMN latitude FLOAT DEFAULT 12.9716",
                    "longitude": "ALTER TABLE users ADD COLUMN longitude FLOAT DEFAULT 77.5946",
                    "available_days": "ALTER TABLE users ADD COLUMN available_days JSON DEFAULT '[\"Mon\", \"Tue\", \"Wed\", \"Thu\", \"Fri\", \"Sat\"]'",
                    "working_hours_start": "ALTER TABLE users ADD COLUMN working_hours_start VARCHAR(10) DEFAULT '09:00'",
                    "working_hours_end": "ALTER TABLE users ADD COLUMN working_hours_end VARCHAR(10) DEFAULT '18:00'",
                    "slot_duration_mins": "ALTER TABLE users ADD COLUMN slot_duration_mins INTEGER DEFAULT 30",
                    "unavailable_dates": "ALTER TABLE users ADD COLUMN unavailable_dates JSON DEFAULT '[]'",
                    "custom_slots": "ALTER TABLE users ADD COLUMN custom_slots JSON DEFAULT '{}'",
                    "consultation_fee": "ALTER TABLE users ADD COLUMN consultation_fee INTEGER DEFAULT 500",
                    "current_delay_mins": "ALTER TABLE users ADD COLUMN current_delay_mins INTEGER DEFAULT 0",
                    "delay_updated_at": "ALTER TABLE users ADD COLUMN delay_updated_at TIMESTAMP",
                }
                for col, ddl in user_ddls.items():
                    if col not in user_cols:
                        conn.execute(text(ddl))

                # check patients columns
                patient_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(patients)")).fetchall()]
                patient_ddls = {
                    "primary_account_phone": "ALTER TABLE patients ADD COLUMN primary_account_phone VARCHAR(32)",
                    "family_relation": "ALTER TABLE patients ADD COLUMN family_relation VARCHAR(30) DEFAULT 'Self'",
                    "abha_id": "ALTER TABLE patients ADD COLUMN abha_id VARCHAR(50)",
                    "age": "ALTER TABLE patients ADD COLUMN age INTEGER",
                    "gender": "ALTER TABLE patients ADD COLUMN gender VARCHAR(20)",
                    "emergency_contact": "ALTER TABLE patients ADD COLUMN emergency_contact VARCHAR(50)",
                }
                for col, ddl in patient_ddls.items():
                    if col not in patient_cols:
                        conn.execute(text(ddl))

                # check visits columns
                visit_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(visits)")).fetchall()]
                visit_ddls = {
                    "appointment_date": "ALTER TABLE visits ADD COLUMN appointment_date VARCHAR(20)",
                    "time_slot": "ALTER TABLE visits ADD COLUMN time_slot VARCHAR(20)",
                    "booking_type": "ALTER TABLE visits ADD COLUMN booking_type VARCHAR(30) DEFAULT 'in_person'",
                    "chief_complaint": "ALTER TABLE visits ADD COLUMN chief_complaint TEXT",
                    "token_number": "ALTER TABLE visits ADD COLUMN token_number INTEGER",
                    "triage_level": "ALTER TABLE visits ADD COLUMN triage_level VARCHAR(30) DEFAULT 'Routine'",
                    "skip_count": "ALTER TABLE visits ADD COLUMN skip_count INTEGER DEFAULT 0",
                    "deferred_at": "ALTER TABLE visits ADD COLUMN deferred_at TIMESTAMP",
                    "signature_hash": "ALTER TABLE visits ADD COLUMN signature_hash VARCHAR(64)",
                    "retention_until": "ALTER TABLE visits ADD COLUMN retention_until TIMESTAMP",
                    "whatsapp_message_id": "ALTER TABLE visits ADD COLUMN whatsapp_message_id VARCHAR(255)",
                    "day3_followup_status": "ALTER TABLE visits ADD COLUMN day3_followup_status VARCHAR(30) DEFAULT 'scheduled'",
                    "day3_followup_sent_at": "ALTER TABLE visits ADD COLUMN day3_followup_sent_at TIMESTAMP",
                    "day3_followup_response": "ALTER TABLE visits ADD COLUMN day3_followup_response JSON",
                    "day7_followup_status": "ALTER TABLE visits ADD COLUMN day7_followup_status VARCHAR(30) DEFAULT 'scheduled'",
                    "day7_followup_sent_at": "ALTER TABLE visits ADD COLUMN day7_followup_sent_at TIMESTAMP",
                    "day7_followup_response": "ALTER TABLE visits ADD COLUMN day7_followup_response JSON",
                }
                for col, ddl in visit_ddls.items():
                    if col not in visit_cols:
                        conn.execute(text(ddl))

                # check doctor_reviews table
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS doctor_reviews (
                        id VARCHAR(36) PRIMARY KEY,
                        doctor_id VARCHAR(36) NOT NULL,
                        patient_id VARCHAR(36),
                        visit_id VARCHAR(36),
                        patient_name VARCHAR(255) NOT NULL,
                        rating INTEGER NOT NULL,
                        review_text TEXT NOT NULL,
                        word_count INTEGER NOT NULL DEFAULT 0,
                        is_first_visit BOOLEAN NOT NULL DEFAULT 0,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                """))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_doctor_reviews_doctor_id ON doctor_reviews (doctor_id);"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_doctor_reviews_patient_id ON doctor_reviews (patient_id);"))
                conn.commit()
            logger.info("SQLite schema auto-migration completed successfully.")
    except Exception as e:
        logger.error(f"Error during schema auto-migration: {e}", exc_info=True)


def seed_initial_data():
    """Production market launch: Zero initial seeding to maintain complete clean slate."""
    logger.info("Production clean slate active: Zero initial data seeding.")


def seed_formulary_if_needed():
    """Automatically seeds/updates verified Indian National Formulary & Jan Aushadhi database."""
    try:
        from scripts.seed_indian_formulary import seed_formulary
        seed_formulary()
    except Exception as e:
        logger.warning(f"Formulary auto-seeder notice: {e}")



async def automated_followup_cron_worker():
    """Background task running every 30 minutes to check and dispatch due Day 3 and Day 7 clinical follow-ups"""
    import asyncio
    logger.info("Automated clinical follow-up cron worker initialized.")
    while True:
        try:
            await asyncio.sleep(1800)  # Check every 30 minutes
            from app.services.followup_service import followup_service
            with SessionLocal() as db:
                followup_service.process_due_followups(db)
        except asyncio.CancelledError:
            logger.info("Automated clinical follow-up cron worker stopped.")
            break
        except Exception as e:
            logger.warning(f"Error in automated follow-up cron worker: {e}")
            await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    logger.info("Starting Praxirence Healthcare Platform...")
    # Initialize database tables & run schema auto-migrations
    try:
        Base.metadata.create_all(bind=engine)
        auto_migrate_schema()
        logger.info("Database schema initialized and verified.")
        seed_initial_data()
        seed_formulary_if_needed()
    except Exception as e:
        logger.error(f"Database setup error: {e}")

    # Initialize AI Model Loader
    try:
        model_loader.load_models()
    except Exception as e:
        logger.warning(f"AI ModelLoader initialization warning: {e}")

    followup_task = asyncio.create_task(automated_followup_cron_worker())

    yield

    followup_task.cancel()
    try:
        await followup_task
    except asyncio.CancelledError:
        pass
    logger.info("Shutting down Praxirence Platform...")


app = FastAPI(
    title="Praxirence Healthcare Platform API",
    description="Full-stack AI Clinical Consultation, In-App Care Plan Sync & Patient Medication Reminder System",
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
app.include_router(auth.router, prefix="/api/v1")
app.include_router(patients.router)
app.include_router(patients.router, prefix="/api/v1")
app.include_router(visits.router)
app.include_router(visits.router, prefix="/api/v1")
app.include_router(doctors.router)
app.include_router(doctors.router, prefix="/api/v1")
app.include_router(recordings.router)
app.include_router(recordings.router, prefix="/api/v1")
app.include_router(chat.router)
app.include_router(chat.router, prefix="/api/v1")
app.include_router(doctor_copilot.router)
app.include_router(doctor_copilot.router, prefix="/api/v1")
app.include_router(medicines.router)
app.include_router(medicines.router, prefix="/api/v1")
app.include_router(realtime.router)


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
        "care_plan_sync": "In-App Native Care Vault & WebSocket Gateway",
        "auth_provider": "Email OTP & Clinical Credentials"
    }


@app.api_route("/auth/migrate", methods=["GET", "POST"])
def trigger_migration():
    """Manual trigger to synchronize PostgreSQL schema and seed data"""
    try:
        auto_migrate_schema()
        seed_initial_data()
        seed_formulary_if_needed()
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


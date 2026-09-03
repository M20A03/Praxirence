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
from app.routes import visits, patients, recordings
from ml.inference import model_loader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("praxirence.main")


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
                specialty="Chief Medical Officer & Physician"
            )
            db.add(real_doctor)
            db.commit()
            logger.info("Initialized real doctor: Dr. Mayank Raj (doctor@praxirence.com / Doctor123!)")
        else:
            doctor.name = "Dr. Mayank Raj"
            doctor.specialty = "Chief Medical Officer & Physician"
            doctor.hashed_password = get_password_hash("Doctor123!")
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
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Praxirence Healthcare Platform...")
    # Initialize database tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database schema initialized.")
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


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Praxirence Backend API",
        "version": "2.0.0",
        "models_loaded": model_loader._models_loaded,
        "device": model_loader.device,
        "whatsapp_provider": "Meta WhatsApp Cloud API",
        "otp_provider": "Fast2SMS"
    }

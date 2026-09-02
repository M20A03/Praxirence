"""
Celery Background Task Queue for WhatsApp Delivery, Reminders & Audio Purge
Uses Redis as message broker and result backend.
"""

import os
import logging
import asyncio
from celery import Celery
from app.core.config import settings

logger = logging.getLogger("praxirence.celery")

# Initialize Celery app
REDIS_BROKER = os.getenv("CELERY_BROKER_URL", settings.REDIS_URL)

celery_app = Celery(
    "praxirence",
    broker=REDIS_BROKER,
    backend=REDIS_BROKER,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300,
)


@celery_app.task(name="tasks.send_whatsapp_care_plan", bind=True, max_retries=3)
def send_whatsapp_care_plan_celery(self, visit_id: str):
    """
    Celery task to dispatch approved care plan via Meta WhatsApp Cloud API.
    """
    from app.core.database import SessionLocal
    from app.models.visit import Visit
    from app.models.patient import Patient
    from app.models.user import User
    from app.models.audit_log import AuditLog
    from app.services.meta_whatsapp_service import meta_whatsapp_service

    db = SessionLocal()
    try:
        visit = db.query(Visit).filter(Visit.id == visit_id).first()
        if not visit:
            logger.error(f"Celery task error: Visit {visit_id} not found.")
            return {"success": False, "error": "Visit not found"}

        patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()
        if not patient:
            logger.error(f"Celery task error: Patient for visit {visit_id} not found.")
            return {"success": False, "error": "Patient not found"}

        doctor_name = "Care Team"
        if visit.doctor_id:
            doctor = db.query(User).filter(User.id == visit.doctor_id).first()
            if doctor:
                doctor_name = doctor.name

        patient_phone = patient.phone
        logger.info(f"Celery dispatching WhatsApp care plan for visit {visit_id} to {patient.name} ({patient_phone})")

        # Run async Meta WhatsApp call in sync event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            meta_whatsapp_service.send_care_plan_whatsapp(
                to_phone=patient_phone,
                patient_name=patient.name,
                doctor_name=doctor_name,
                diagnosis=visit.diagnosis or "Consultation Assessment",
                medicines=visit.medicines or [],
                reminders=visit.reminders or []
            )
        )
        loop.close()

        if result.get("success"):
            visit.status = "sent"
            visit.whatsapp_message_id = result.get("message_id")
            db.commit()

            audit = AuditLog(
                actor_id="celery_worker",
                actor_role="system",
                action="meta_whatsapp_dispatch",
                resource="visit",
                resource_id=visit.id,
                details=result
            )
            db.add(audit)
            db.commit()
            logger.info(f"Visit {visit_id} WhatsApp care plan delivered successfully.")

        return result

    except Exception as e:
        logger.error(f"Celery error in send_whatsapp_care_plan: {e}")
        db.rollback()
        raise self.retry(exc=e, countdown=10)
    finally:
        db.close()


@celery_app.task(name="tasks.send_medication_reminder", bind=True)
def send_medication_reminder_celery(self, patient_id: str, medicine_name: str, dosage: str, reminder_time: str, instructions: str):
    """
    Celery task to dispatch scheduled push notification / reminder to patient.
    """
    from app.core.database import SessionLocal
    from app.models.patient import Patient
    from app.models.audit_log import AuditLog
    from app.services.fcm_service import fcm_service

    db = SessionLocal()
    try:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            return {"success": False, "error": "Patient not found"}

        title = f"💊 Time for your {medicine_name}"
        body = f"Prescribed dose: {dosage}. {instructions or 'Take with water.'}"

        if patient.fcm_token:
            fcm_service.send_push_notification(
                token=patient.fcm_token,
                title=title,
                body=body,
                data={"type": "medication_reminder", "medicine": medicine_name, "time": reminder_time}
            )

        audit = AuditLog(
            actor_id="celery_worker",
            actor_role="system",
            action="celery_reminder_push",
            resource="patient",
            resource_id=patient_id,
            details={"medicine": medicine_name, "dosage": dosage, "time": reminder_time}
        )
        db.add(audit)
        db.commit()
        return {"success": True}

    except Exception as e:
        logger.error(f"Celery error in send_medication_reminder: {e}")
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()


@celery_app.task(name="tasks.purge_voice_recording")
def purge_voice_recording_celery(file_path: str):
    """
    Automatically purges temporary voice recording file from storage.
    """
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            logger.info(f"Celery purged temporary voice recording: {file_path}")
            return {"success": True, "deleted": file_path}
        except Exception as e:
            logger.error(f"Failed to purge audio file: {e}")
            return {"success": False, "error": str(e)}
    return {"success": False, "error": "File not found"}


def dispatch_task(task_func, *args, **kwargs):
    """
    Dispatches task via Celery. If Celery broker is unavailable or offline in local dev,
    runs inline to guarantee business continuity.
    """
    try:
        job = task_func.delay(*args, **kwargs)
        logger.info(f"Dispatched Celery task {task_func.name} (Task ID: {job.id})")
        return job.id
    except Exception as e:
        logger.warning(f"Celery dispatch failed: {e}. Executing inline.")
        try:
            return task_func(*args, **kwargs)
        except Exception as inline_err:
            logger.error(f"Inline task execution error: {inline_err}")
            return None

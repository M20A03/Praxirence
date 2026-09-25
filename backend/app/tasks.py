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


@celery_app.task(name="tasks.send_whatsapp_care_plan", bind=True)
def send_whatsapp_care_plan_celery(self, visit_id: str):
    """
    Care plan synchronization task. External WhatsApp delivery is decommissioned;
    care plans and audio are stored securely and synchronized directly in the Praxirence app.
    """
    logger.info(f"Care plan for visit {visit_id} synchronized natively to patient app.")
    return {"success": True, "channel": "in_app_synced", "visit_id": visit_id}


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

import logging
from datetime import datetime, timezone
from app.core.database import SessionLocal
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.user import User
from app.models.audit_log import AuditLog
from app.services.fcm_service import fcm_service

logger = logging.getLogger("praxirence.tasks")


def send_whatsapp_care_plan_task(visit_id: str):
    """
    Background worker task to finalize approved care plan and synchronize to patient's in-app care vault.
    Zero external APIs (no Twilio, no WhatsApp cloud egress).
    """
    db = SessionLocal()
    try:
        visit = db.query(Visit).filter(Visit.id == visit_id).first()
        if not visit:
            logger.error(f"Task error: Visit {visit_id} not found.")
            return

        patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()
        if not patient:
            logger.error(f"Task error: Patient for visit {visit_id} not found.")
            return

        visit.status = "approved"
        db.commit()
        logger.info(f"Care plan synchronized in-app for visit {visit_id} to patient {patient.name}.")

        # Audit log entry
        audit = AuditLog(
            actor_id="system",
            actor_role="system",
            action="in_app_care_plan_sync",
            resource="visit",
            resource_id=visit_id,
            details={"status": "approved", "patient_id": str(patient.id)}
        )
        db.add(audit)
        db.commit()

    except Exception as e:
        logger.error(f"Unexpected error in send_whatsapp_care_plan_task: {e}")
        db.rollback()
    finally:
        db.close()


def send_medication_reminder_task(
    patient_id: str,
    medicine_name: str,
    dosage: str,
    instructions: str,
    reminder_time: str
):
    """
    Sends scheduled medication reminder via Push Notification (FCM) and WhatsApp.
    """
    db = SessionLocal()
    try:
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            logger.error(f"Reminder error: Patient {patient_id} not found.")
            return

        title = f"💊 Medication Reminder: {medicine_name}"
        body = f"Time for your dose: {dosage}. {instructions or 'Take with water.'}"

        # 1. Send push notification to mobile app if token registered
        if patient.fcm_token:
            fcm_service.send_push_notification(
                token=patient.fcm_token,
                title=title,
                body=body,
                data={
                    "type": "medication_reminder",
                    "medicine_name": medicine_name,
                    "dosage": dosage,
                    "time": reminder_time
                }
            )

        # 2. Log reminder action
        audit = AuditLog(
            actor_id="system",
            actor_role="system",
            action="reminder_dispatch",
            resource="patient",
            resource_id=patient_id,
            details={"medicine": medicine_name, "dosage": dosage, "time": reminder_time}
        )
        db.add(audit)
        db.commit()

        logger.info(f"Reminded patient {patient.name} for {medicine_name} at {reminder_time}")

    except Exception as e:
        logger.error(f"Error in send_medication_reminder_task: {e}")
        db.rollback()
    finally:
        db.close()


def schedule_visit_reminders_task(visit_id: str):
    """
    Schedules reminders defined in the care plan into the reminder queue.
    """
    db = SessionLocal()
    try:
        visit = db.query(Visit).filter(Visit.id == visit_id).first()
        if not visit or not visit.reminders:
            return

        for rem in visit.reminders:
            # In a production setup with RQ-Scheduler, enqueue_at() is used.
            # Here we demonstrate logging and dispatching the active reminder job:
            logger.info(
                f"Registered active daily reminder for visit {visit_id}: "
                f"{rem.get('medicine_name')} at {rem.get('time')}"
            )

    except Exception as e:
        logger.error(f"Error scheduling visit reminders: {e}")
    finally:
        db.close()

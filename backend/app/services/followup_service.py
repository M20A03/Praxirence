"""
Praxirence Automated Clinical Follow-Up & Check-in Service
Dispatches automated check-ins:
- Day 3 (72 hours post-consultation): Symptom review & recovery check-in.
- Day 7 (168 hours post-consultation): 1-week recovery confirmation & follow-up evaluation.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.user import User
from app.models.audit_log import AuditLog
from app.services.fcm_service import fcm_service

logger = logging.getLogger("praxirence.followup")


class FollowUpService:
    @staticmethod
    def process_due_followups(db: Session) -> Dict[str, Any]:
        """
        Scans all approved/completed clinical visits and dispatches Day 3 and Day 7 follow-up check-ins.
        Day 3 Check-in: Sent >= 72 hours after consultation approval.
        Day 7 Check-in: Sent >= 168 hours after consultation approval.
        """
        now = datetime.now(timezone.utc)
        day3_cutoff = now - timedelta(days=3)
        day7_cutoff = now - timedelta(days=7)

        day3_sent = 0
        day7_sent = 0
        processed_visits: List[str] = []

        # 1. Process Day 3 Follow-ups
        # Approved at least 3 days ago and day3 status is still 'scheduled'
        due_day3_visits = db.query(Visit).filter(
            Visit.status.in_(["approved", "completed", "sent"]),
            Visit.approved_at.isnot(None),
            Visit.approved_at <= day3_cutoff,
            Visit.day3_followup_status == "scheduled"
        ).all()

        for visit in due_day3_visits:
            try:
                patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()
                doctor = db.query(User).filter(User.id == visit.doctor_id).first() if visit.doctor_id else None
                doctor_name = doctor.name if doctor else "your physician"
                doc_title = doctor_name if doctor_name.startswith("Dr.") else f"Dr. {doctor_name}"
                patient_first_name = (patient.name.split()[0]) if patient and patient.name else "there"

                title = f"🩺 Health Check-in: {doc_title}"
                body = (
                    f"Hi {patient_first_name}, it's been 3 days since your consultation with {doc_title}. "
                    f"How are you feeling today? Tap to share a quick recovery update or let us know if your symptoms have improved."
                )

                if patient and patient.fcm_token:
                    fcm_service.send_push_notification(
                        token=patient.fcm_token,
                        title=title,
                        body=body,
                        data={
                            "type": "health_checkin",
                            "visit_id": str(visit.id),
                            "day": "3",
                            "doctor_name": doc_title
                        }
                    )

                visit.day3_followup_status = "sent"
                visit.day3_followup_sent_at = now
                day3_sent += 1
                processed_visits.append(visit.id)

                audit = AuditLog(
                    actor_id="system_followup_service",
                    actor_role="system",
                    action="dispatch_day3_health_checkin",
                    resource="visit",
                    resource_id=visit.id,
                    details={"day": 3, "patient_id": visit.patient_id, "doctor_name": doctor_name}
                )
                db.add(audit)
            except Exception as e:
                logger.error(f"Error dispatching Day 3 follow-up for visit {visit.id}: {e}")

        # 2. Process Day 7 Follow-ups
        # Approved at least 7 days ago and day7 status is still 'scheduled'
        due_day7_visits = db.query(Visit).filter(
            Visit.status.in_(["approved", "completed", "sent"]),
            Visit.approved_at.isnot(None),
            Visit.approved_at <= day7_cutoff,
            Visit.day7_followup_status == "scheduled"
        ).all()

        for visit in due_day7_visits:
            try:
                patient = db.query(Patient).filter(Patient.id == visit.patient_id).first()
                doctor = db.query(User).filter(User.id == visit.doctor_id).first() if visit.doctor_id else None
                doctor_name = doctor.name if doctor else "your physician"
                doc_title = doctor_name if doctor_name.startswith("Dr.") else f"Dr. {doctor_name}"
                patient_first_name = (patient.name.split()[0]) if patient and patient.name else "there"

                title = f"🌱 1-Week Recovery Check-in: {doc_title}"
                body = (
                    f"Hi {patient_first_name}, 1 week has passed since your visit with {doc_title}. "
                    f"Are your symptoms resolving and health back to normal? Tap to confirm your recovery or book a follow-up if needed."
                )

                if patient and patient.fcm_token:
                    fcm_service.send_push_notification(
                        token=patient.fcm_token,
                        title=title,
                        body=body,
                        data={
                            "type": "health_checkin",
                            "visit_id": str(visit.id),
                            "day": "7",
                            "doctor_name": doc_title
                        }
                    )

                visit.day7_followup_status = "sent"
                visit.day7_followup_sent_at = now
                day7_sent += 1
                processed_visits.append(visit.id)

                audit = AuditLog(
                    actor_id="system_followup_service",
                    actor_role="system",
                    action="dispatch_day7_health_checkin",
                    resource="visit",
                    resource_id=visit.id,
                    details={"day": 7, "patient_id": visit.patient_id, "doctor_name": doc_title}
                )
                db.add(audit)
            except Exception as e:
                logger.error(f"Error dispatching Day 7 follow-up for visit {visit.id}: {e}")

        db.commit()
        logger.info(f"Follow-up check completed: {day3_sent} Day-3 dispatched, {day7_sent} Day-7 dispatched.")
        return {
            "success": True,
            "day3_sent": day3_sent,
            "day7_sent": day7_sent,
            "total_processed": day3_sent + day7_sent,
            "visit_ids": processed_visits,
            "processed_at": now.isoformat()
        }

    @staticmethod
    def get_pending_checkins_for_patient(db: Session, patient_id: str) -> List[Dict[str, Any]]:
        """
        Returns any active check-in prompts (Day 3 or Day 7) that the patient has not yet answered.
        Used by the patient mobile app to render an in-app check-in banner/modal.
        """
        now = datetime.now(timezone.utc)
        # Look at visits for this patient within the last 14 days
        cutoff = now - timedelta(days=14)

        visits = db.query(Visit).filter(
            Visit.patient_id == patient_id,
            Visit.status.in_(["approved", "completed", "sent"]),
            Visit.approved_at.isnot(None),
            Visit.approved_at >= cutoff
        ).order_by(Visit.approved_at.desc()).all()

        pending_checkins = []

        for v in visits:
            if not v.approved_at:
                continue

            appr_at = v.approved_at
            if appr_at.tzinfo is None:
                appr_at = appr_at.replace(tzinfo=timezone.utc)

            delta = now - appr_at
            days_elapsed = delta.total_seconds() / 86400.0

            doctor = db.query(User).filter(User.id == v.doctor_id).first() if v.doctor_id else None
            doctor_name = doctor.name if doctor else "Doctor"
            doc_title = doctor_name if doctor_name.startswith("Dr.") else f"Dr. {doctor_name}"

            # Check Day 3 prompt (between day 3 and day 7, if not yet responded)
            if days_elapsed >= 3.0 and days_elapsed < 7.0:
                if v.day3_followup_status in ["scheduled", "sent"] and not v.day3_followup_response:
                    pending_checkins.append({
                        "visit_id": v.id,
                        "day": 3,
                        "doctor_id": v.doctor_id,
                        "doctor_name": doc_title,
                        "specialty": doctor.specialty if doctor else "Physician",
                        "consultation_date": v.approved_at.isoformat(),
                        "days_ago": round(days_elapsed, 1),
                        "title": f"3-Day Health Check-in with {doc_title}",
                        "prompt": f"It's been 3 days since your consultation with {doc_title}. How is your health today? Are you taking your prescribed medications and feeling better?"
                    })

            # Check Day 7 prompt (at or after day 7, if not yet responded)
            if days_elapsed >= 7.0 and days_elapsed < 14.0:
                if v.day7_followup_status in ["scheduled", "sent"] and not v.day7_followup_response:
                    pending_checkins.append({
                        "visit_id": v.id,
                        "day": 7,
                        "doctor_id": v.doctor_id,
                        "doctor_name": doc_title,
                        "specialty": doctor.specialty if doctor else "Physician",
                        "consultation_date": v.approved_at.isoformat(),
                        "days_ago": round(days_elapsed, 1),
                        "title": f"1-Week Recovery Check-in with {doc_title}",
                        "prompt": f"It's been 1 week since your consultation with {doc_title}. Have your symptoms resolved completely? Let us know if you're fully recovered or need a follow-up."
                    })

        return pending_checkins

    @staticmethod
    def record_patient_response(
        db: Session,
        visit_id: str,
        day: int,
        health_status: str,
        notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Records patient's feedback on their health status ('feeling_better', 'recovering', 'same', 'worse')
        """
        visit = db.query(Visit).filter(Visit.id == visit_id).first()
        if not visit:
            return {"success": False, "error": "Visit not found"}

        now = datetime.now(timezone.utc)
        response_payload = {
            "health_status": health_status,  # "feeling_better", "recovering", "same", "worse"
            "notes": notes or "",
            "responded_at": now.isoformat(),
            "day": day
        }

        if day == 3:
            visit.day3_followup_status = "responded"
            visit.day3_followup_response = response_payload
        else:
            visit.day7_followup_status = "responded"
            visit.day7_followup_response = response_payload

        db.commit()

        audit = AuditLog(
            actor_id=visit.patient_id,
            actor_role="patient",
            action=f"record_day{day}_health_checkin_response",
            resource="visit",
            resource_id=visit.id,
            details=response_payload
        )
        db.add(audit)
        db.commit()

        return {
            "success": True,
            "message": "Health check-in response successfully recorded.",
            "response": response_payload
        }


followup_service = FollowUpService()

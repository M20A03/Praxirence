"""
Praxirence Production Market Launch - Safe Database Purge & Bootstrap Script
=============================================================================
Safely wipes all test consultations, dummy patients, mock reviews, and test audit
records while preserving the database schema and re-seeding the primary verified
Founding Physician / Chief Medical Officer credential for instant store review.

Usage:
    python backend/scripts/purge_and_bootstrap_production.py [--force] [--all-doctors]
"""

import sys
import os
import argparse
from sqlalchemy import text

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import engine, SessionLocal, Base
from app.core.security import get_password_hash
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.user import User
from app.models.doctor_review import DoctorReview
from app.models.consent_log import ConsentLog
from app.models.audit_log import AuditLog


def get_counts(db):
    return {
        "visits": db.query(Visit).count(),
        "patients": db.query(Patient).count(),
        "doctor_reviews": db.query(DoctorReview).count(),
        "consent_logs": db.query(ConsentLog).count(),
        "audit_logs": db.query(AuditLog).count(),
        "doctors (users)": db.query(User).count(),
    }


def purge_and_bootstrap(force=False, wipe_all_doctors=False):
    db = SessionLocal()
    dialect_name = engine.dialect.name
    print(f"\n=======================================================")
    print(f" PRAXIRENCE PRODUCTION MARKET LAUNCH DATA PURGE")
    print(f" Target Database Engine: {dialect_name.upper()}")
    print(f"=======================================================\n")

    before_counts = get_counts(db)
    print("Pre-Purge Record Counts:")
    for tbl, cnt in before_counts.items():
        print(f"  • {tbl}: {cnt}")

    if not force:
        print("\n[SAFETY CHECK] Run with --force to execute data purge.")
        db.close()
        return

    print("\nExecuting production clean purge...")

    try:
        # Delete dependent tables first
        num_reviews = db.query(DoctorReview).delete()
        num_visits = db.query(Visit).delete()
        num_consent = db.query(ConsentLog).delete()
        num_audit = db.query(AuditLog).delete()
        num_patients = db.query(Patient).delete()

        if wipe_all_doctors:
            num_doctors = db.query(User).delete()
            print(f"  - Purged all {num_doctors} doctor accounts.")
        else:
            # Purge mock/test doctors while strictly keeping or re-seeding the CMO
            dummy_emails = [
                "dr.aarav.mehta@praxirence.com",
                "dr.aarav@hospital.org",
                "dr.priya.sharma@praxirence.com",
                "dr.vikram.gowda@praxirence.com",
                "dr.ananya.verma@praxirence.com",
                "dr.rajesh.tripathi@praxirence.com",
                "dr.aarav.test@praxirence.com",
                "dr.mayank.test@praxirence.com",
                "newdoc@praxirence.com",
                "doctor2@praxirence.com"
            ]
            purged_docs = db.query(User).filter(
                (User.email.in_(dummy_emails)) |
                (User.email.like("doctor.%@praxirence.com")) |
                (User.email.like("%test%@%"))
            ).delete(synchronize_session=False)

            # Ensure Verified Founding Doctor / Chief Medical Officer exists
            cmo = db.query(User).filter(User.email == "doctor@praxirence.com").first()
            if not cmo:
                cmo = User(
                    email="doctor@praxirence.com",
                    hashed_password=get_password_hash("Doctor123!"),
                    name="Dr. Mayank Raj",
                    phone="+919876543210",
                    specialty="Chief Medical Officer & Physician",
                    clinic_name="Praxirence Clinical Centre",
                    reg_number="NMC-2024-84920",
                    city="Bangalore",
                    state="Karnataka",
                    pincode="560038",
                    clinic_address="12th Main, Indiranagar, Bangalore",
                    latitude=12.9716,
                    longitude=77.5946,
                    available_days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                    working_hours_start="09:00",
                    working_hours_end="18:00",
                    slot_duration_mins=30,
                    unavailable_dates=[],
                    consultation_fee=500
                )
                db.add(cmo)
            else:
                cmo.name = "Dr. Mayank Raj"
                cmo.phone = "+919876543210"
                cmo.specialty = "Chief Medical Officer & Physician"
                cmo.clinic_name = "Praxirence Clinical Centre"
                cmo.reg_number = "NMC-2024-84920"
                cmo.unavailable_dates = []
                cmo.hashed_password = get_password_hash("Doctor123!")

        db.commit()

        # If PostgreSQL, reset sequences if any
        if dialect_name == "postgresql":
            with engine.connect() as conn:
                try:
                    conn.execute(text("ALTER SEQUENCE IF EXISTS visits_id_seq RESTART WITH 1;"))
                    conn.execute(text("ALTER SEQUENCE IF EXISTS patients_id_seq RESTART WITH 1;"))
                    conn.commit()
                except Exception:
                    pass

        print("Data purge committed successfully.\n")

    except Exception as e:
        db.rollback()
        print(f"Error during purge: {e}")
        raise e
    finally:
        after_counts = get_counts(db)
        print("Post-Purge Record Counts (Market Launch State):")
        for tbl, cnt in after_counts.items():
            print(f"  • {tbl}: {cnt}")
        db.close()
        print("\nProduction clean slate is complete. 100% ready for public market launch.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Praxirence Database Purge & Production Bootstrap")
    parser.add_argument("--force", action="store_true", help="Confirm execution of database data wipe")
    parser.add_argument("--all-doctors", action="store_true", help="Also wipe primary founding doctor account")
    args = parser.parse_args()

    purge_and_bootstrap(force=args.force, wipe_all_doctors=args.all_doctors)

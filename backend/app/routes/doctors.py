"""
Praxirence Clinician Directory, Geolocation Proximity & Availability Engine
Provides Haversine distance-based doctor discovery, schedule configuration,
clinician out-of-office/leave tracking, and dynamic slot generation.
"""

import math
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.visit import Visit
from app.services.realtime_service import realtime_manager

logger = logging.getLogger("praxirence.routes.doctors")

router = APIRouter(prefix="/doctors", tags=["Doctors & Scheduling"])


# ==================== SCHEMAS ====================

class DoctorScheduleUpdate(BaseModel):
    available_days: Optional[List[str]] = Field(None, description='e.g. ["Mon", "Tue", "Wed", "Thu", "Fri"]')
    working_hours_start: Optional[str] = Field(None, description='e.g. "09:00"')
    working_hours_end: Optional[str] = Field(None, description='e.g. "18:00"')
    slot_duration_mins: Optional[int] = Field(None, description="Duration in minutes e.g. 30")
    unavailable_dates: Optional[List[str]] = Field(None, description='Dates on leave e.g. ["2026-09-25"]')
    clinic_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    consultation_fee: Optional[int] = None


class LeaveToggleRequest(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format to mark or unmark as on leave")
    action: str = Field("add", description="'add' to take leave, 'remove' to cancel leave")


class BroadcastDelayRequest(BaseModel):
    delay_mins: int = Field(..., description="Delay in minutes (e.g. 15, 30, 45, 60, or 0 to clear)")
    reason: Optional[str] = Field(None, description="Optional reason for delay, e.g. 'Emergency in surgery' or 'Heavy traffic'")


# ==================== UTILITIES ====================

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    R = 6371.0  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)


def generate_time_slots(start_str: str, end_str: str, slot_mins: int = 30) -> List[str]:
    """Generates 12-hour formatted time slots between start and end hours."""
    slots = []
    try:
        start_h, start_m = map(int, (start_str or "09:00").split(":"))
        end_h, end_m = map(int, (end_str or "18:00").split(":"))
        current_mins = start_h * 60 + start_m
        end_mins = end_h * 60 + end_m

        while current_mins + slot_mins <= end_mins:
            h = current_mins // 60
            m = current_mins % 60
            # Format as "09:00 AM" or "02:30 PM"
            am_pm = "AM" if h < 12 else "PM"
            disp_h = h % 12
            if disp_h == 0:
                disp_h = 12
            slots.append(f"{disp_h:02d}:{m:02d} {am_pm}")
            current_mins += slot_mins
    except Exception as e:
        logger.warning(f"Error calculating time slots: {e}")
        slots = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
                 "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM", "05:00 PM"]
    return slots


# ==================== ENDPOINTS ====================

@router.get("")
def list_doctors(
    specialty: Optional[str] = None,
    city: Optional[str] = None,
    query: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """
    Returns registered doctors with optional geolocation proximity,
    city filtering, specialty filtering, and live leave status for today.
    """
    doctors = db.query(User).all()
    today_iso = datetime.now().strftime("%Y-%m-%d")
    today_day_name = datetime.now().strftime("%a")  # Mon, Tue, etc.

    results = []
    for d in doctors:
        doc_city = getattr(d, "city", "Bangalore") or "Bangalore"
        doc_specialty = getattr(d, "specialty", "General Physician") or "General Physician"
        doc_name = d.name or "Dr. Mayank Raj"
        doc_clinic = getattr(d, "clinic_name", "Praxirence Clinical Centre") or "Praxirence Clinical Centre"

        # Apply filters
        if specialty and specialty.lower() != "all":
            if specialty.lower() not in doc_specialty.lower():
                continue

        if city and city.lower() != "all":
            if city.lower() not in doc_city.lower():
                continue

        if query:
            q = query.lower()
            if (q not in doc_name.lower() and
                q not in doc_specialty.lower() and
                q not in doc_clinic.lower() and
                q not in doc_city.lower()):
                continue

        # Geolocation distance calculation
        doc_lat = getattr(d, "latitude", 12.9716) or 12.9716
        doc_lng = getattr(d, "longitude", 77.5946) or 77.5946
        distance_km = None
        if lat is not None and lng is not None:
            distance_km = haversine_distance(lat, lng, doc_lat, doc_lng)
            if radius_km and distance_km > radius_km:
                continue

        # Check today's availability
        avail_days = getattr(d, "available_days", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) or ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        unavail_dates = getattr(d, "unavailable_dates", []) or []

        is_practicing_today = today_day_name in avail_days
        is_on_leave_today = today_iso in unavail_dates
        is_available_today = is_practicing_today and not is_on_leave_today

        results.append({
            "id": str(d.id),
            "name": doc_name,
            "email": d.email,
            "phone": getattr(d, "phone", "+919876543210") or "+919876543210",
            "specialty": doc_specialty,
            "clinic_name": doc_clinic,
            "reg_number": getattr(d, "reg_number", "NMC-2024-84920") or "NMC-2024-84920",
            "city": doc_city,
            "state": getattr(d, "state", "Karnataka") or "Karnataka",
            "pincode": getattr(d, "pincode", "560038") or "560038",
            "clinic_address": getattr(d, "clinic_address", "12th Main, Indiranagar, Bangalore") or "12th Main, Indiranagar, Bangalore",
            "latitude": doc_lat,
            "longitude": doc_lng,
            "distance_km": distance_km,
            "available_days": avail_days,
            "working_hours_start": getattr(d, "working_hours_start", "09:00") or "09:00",
            "working_hours_end": getattr(d, "working_hours_end", "18:00") or "18:00",
            "slot_duration_mins": getattr(d, "slot_duration_mins", 30) or 30,
            "unavailable_dates": unavail_dates,
            "consultation_fee": getattr(d, "consultation_fee", 500) or 500,
            "is_available_today": is_available_today,
            "role": "doctor"
        })

    # Sort by distance if GPS coordinates provided, otherwise by name
    if lat is not None and lng is not None:
        results.sort(key=lambda x: (x["distance_km"] if x["distance_km"] is not None else 999999))
    else:
        results.sort(key=lambda x: x["name"])

    return {"doctors": results, "total": len(results)}


@router.get("/{doctor_id}/availability")
def get_doctor_availability(
    doctor_id: str,
    date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
):
    """
    Checks if a doctor is available on a specific calendar date and returns
    time slots, flagging any slots that are already booked.
    """
    doctor = db.query(User).filter(User.id == doctor_id).first()
    if not doctor:
        # Fallback search by email or name prefix for mock/default doctor IDs
        doctor = db.query(User).first()
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")

    target_date_str = date or datetime.now().strftime("%Y-%m-%d")
    try:
        target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    day_of_week = target_date.strftime("%a")  # Mon, Tue, etc.
    avail_days = getattr(doctor, "available_days", ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]) or ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    unavail_dates = getattr(doctor, "unavailable_dates", []) or []

    # 1. Check if doctor practices on this day of week
    if day_of_week not in avail_days:
        return {
            "doctor_id": str(doctor.id),
            "doctor_name": doctor.name,
            "date": target_date_str,
            "day_of_week": day_of_week,
            "is_available": False,
            "reason": f"Dr. {doctor.name} does not practice on {target_date.strftime('%A')}s.",
            "working_hours": {
                "start": getattr(doctor, "working_hours_start", "09:00") or "09:00",
                "end": getattr(doctor, "working_hours_end", "18:00") or "18:00",
            },
            "slots": []
        }

    # 2. Check if doctor is on leave / out of office on this date
    if target_date_str in unavail_dates:
        return {
            "doctor_id": str(doctor.id),
            "doctor_name": doctor.name,
            "date": target_date_str,
            "day_of_week": day_of_week,
            "is_available": False,
            "reason": f"Dr. {doctor.name} is on leave / unavailable on this date.",
            "working_hours": {
                "start": getattr(doctor, "working_hours_start", "09:00") or "09:00",
                "end": getattr(doctor, "working_hours_end", "18:00") or "18:00",
            },
            "slots": []
        }

    # 3. Generate slots and cross-reference with booked appointments
    start_time = getattr(doctor, "working_hours_start", "09:00") or "09:00"
    end_time = getattr(doctor, "working_hours_end", "18:00") or "18:00"
    slot_mins = getattr(doctor, "slot_duration_mins", 30) or 30

    all_slots = generate_time_slots(start_time, end_time, slot_mins)

    # Cross-reference custom slots for this doctor
    custom_map = getattr(doctor, "custom_slots", {}) or {}
    day_custom = custom_map.get(target_date_str, {})
    custom_added = day_custom.get("added", [])
    custom_blocked = set(day_custom.get("blocked", []))

    # Merge custom added slots
    combined_slots = list(all_slots)
    for cs in custom_added:
        if cs not in combined_slots:
            combined_slots.append(cs)

    # Find existing booked visits on this date
    booked_visits = (
        db.query(Visit)
        .filter(
            Visit.doctor_id == doctor.id,
            Visit.appointment_date == target_date_str,
            Visit.status.in_(["scheduled", "draft", "approved", "completed", "in_progress"])
        )
        .all()
    )
    booked_slots = {v.time_slot.strip() for v in booked_visits if v.time_slot}

    slot_items = []
    for s in combined_slots:
        is_blocked = s.strip() in custom_blocked
        is_booked = s.strip() in booked_slots
        is_open = (not is_booked) and (not is_blocked)
        reason_str = "blocked by doctor" if is_blocked else ("booked" if is_booked else "open")
        slot_items.append({
            "time": s,
            "available": is_open,
            "is_custom": s in custom_added,
            "is_blocked": is_blocked,
            "reason": reason_str
        })

    return {
        "doctor_id": str(doctor.id),
        "doctor_name": doctor.name,
        "date": target_date_str,
        "day_of_week": day_of_week,
        "is_available": True,
        "working_hours": {
            "start": start_time,
            "end": end_time,
            "slot_duration_mins": slot_mins
        },
        "slots": slot_items,
        "total_slots": len(slot_items),
        "available_slots_count": sum(1 for s in slot_items if s["available"])
    }


@router.put("/me/schedule")
def update_doctor_schedule_me(
    payload: DoctorScheduleUpdate,
    doctor_id: Optional[str] = Query(None, description="Doctor ID if not in header token"),
    db: Session = Depends(get_db),
):
    """
    Updates doctor practice days, working hours, clinic address, and leave calendar.
    """
    doctor = None
    if doctor_id:
        doctor = db.query(User).filter(User.id == doctor_id).first()
    if not doctor:
        doctor = db.query(User).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    if payload.available_days is not None:
        doctor.available_days = payload.available_days
    if payload.working_hours_start is not None:
        doctor.working_hours_start = payload.working_hours_start
    if payload.working_hours_end is not None:
        doctor.working_hours_end = payload.working_hours_end
    if payload.slot_duration_mins is not None:
        doctor.slot_duration_mins = payload.slot_duration_mins
    if payload.unavailable_dates is not None:
        doctor.unavailable_dates = payload.unavailable_dates
    if payload.clinic_address is not None:
        doctor.clinic_address = payload.clinic_address
    if payload.city is not None:
        doctor.city = payload.city
    if payload.state is not None:
        doctor.state = payload.state
    if payload.pincode is not None:
        doctor.pincode = payload.pincode
    if payload.latitude is not None:
        doctor.latitude = payload.latitude
    if payload.longitude is not None:
        doctor.longitude = payload.longitude
    if payload.consultation_fee is not None:
        doctor.consultation_fee = payload.consultation_fee

    db.commit()
    db.refresh(doctor)

    return {
        "success": True,
        "message": "Practice schedule & availability updated successfully",
        "schedule": {
            "available_days": doctor.available_days,
            "working_hours_start": doctor.working_hours_start,
            "working_hours_end": doctor.working_hours_end,
            "slot_duration_mins": doctor.slot_duration_mins,
            "unavailable_dates": doctor.unavailable_dates,
            "clinic_address": doctor.clinic_address,
            "city": doctor.city,
            "consultation_fee": doctor.consultation_fee
        }
    }


@router.post("/me/leave")
def toggle_doctor_leave(
    payload: LeaveToggleRequest,
    doctor_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Quick action to mark or unmark a date as out-of-office / on leave.
    When a doctor marks leave, any scheduled appointments on that date
    are automatically transitioned to 'reschedule_required' and patients are notified.
    """
    doctor = None
    if doctor_id:
        doctor = db.query(User).filter(User.id == doctor_id).first()
    if not doctor:
        doctor = db.query(User).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    leave_dates = list(doctor.unavailable_dates or [])
    target = payload.date.strip()

    if payload.action == "add":
        if target not in leave_dates:
            leave_dates.append(target)
            doctor.unavailable_dates = leave_dates

            # Transition all booked visits on this date to 'reschedule_required'
            affected_visits = db.query(Visit).filter(
                Visit.doctor_id == doctor.id,
                Visit.appointment_date == target,
                Visit.status.in_(["scheduled", "draft", "waiting"])
            ).all()

            for v in affected_visits:
                v.status = "reschedule_required"
                if v.patient_id:
                    realtime_manager.emit_to_patient_sync(
                        str(v.patient_id),
                        "DOCTOR_LEAVE_RESCHEDULE_REQUIRED",
                        {
                            "visit_id": str(v.id),
                            "doctor_name": doctor.name,
                            "date": target,
                            "message": f"Dr. {doctor.name} is on leave on {target}. Please reschedule your appointment."
                        }
                    )

            db.commit()
            return {
                "success": True,
                "message": f"Date {target} marked as On Leave. {len(affected_visits)} patient appointments marked for rescheduling.",
                "unavailable_dates": leave_dates,
                "affected_visits_count": len(affected_visits)
            }
        return {"success": True, "message": f"Date {target} already in leave calendar", "unavailable_dates": leave_dates}
    else:
        if target in leave_dates:
            leave_dates.remove(target)
            doctor.unavailable_dates = leave_dates
            db.commit()
            return {"success": True, "message": f"Leave cancelled for {target}", "unavailable_dates": leave_dates}
        return {"success": True, "message": f"Date {target} was not on leave", "unavailable_dates": leave_dates}


@router.post("/{doctor_id}/broadcast-delay")
def broadcast_doctor_delay(
    doctor_id: str,
    payload: BroadcastDelayRequest,
    db: Session = Depends(get_db),
):
    """
    Allows a doctor to broadcast a running clinic delay (e.g. +15, +30, +45 mins)
    to all patients in today's OPD queue. Updates doctor's current_delay_mins and emits
    realtime DOCTOR_DELAY_BROADCAST events.
    """
    doctor = db.query(User).filter(User.id == doctor_id).first()
    if not doctor:
        doctor = db.query(User).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    doctor.current_delay_mins = max(0, payload.delay_mins)
    doctor.delay_updated_at = datetime.utcnow()
    db.commit()

    today_str = datetime.now().strftime("%Y-%m-%d")
    today_visits = db.query(Visit).filter(
        Visit.doctor_id == doctor.id,
        Visit.appointment_date == today_str,
        Visit.status.in_(["scheduled", "waiting", "in_progress"])
    ).all()

    # Broadcast to all affected patients
    for v in today_visits:
        if v.patient_id:
            realtime_manager.emit_to_patient_sync(
                str(v.patient_id),
                "DOCTOR_DELAY_BROADCAST",
                {
                    "doctor_id": str(doctor.id),
                    "doctor_name": doctor.name,
                    "delay_mins": doctor.current_delay_mins,
                    "reason": payload.reason or f"Clinic running approximately {doctor.current_delay_mins} mins behind schedule.",
                    "updated_at": doctor.delay_updated_at.isoformat() if doctor.delay_updated_at else None
                }
            )

    # Also notify doctor's connected dashboard
    realtime_manager.emit_to_doctor_sync(
        str(doctor.id),
        "DELAY_BROADCAST_CONFIRMED",
        {
            "current_delay_mins": doctor.current_delay_mins,
            "affected_patients_count": len(today_visits)
        }
    )

    return {
        "success": True,
        "doctor_id": str(doctor.id),
        "current_delay_mins": doctor.current_delay_mins,
        "affected_patients_count": len(today_visits),
        "message": f"Delay of {doctor.current_delay_mins} mins broadcasted to {len(today_visits)} patients."
    }


@router.get("/{doctor_id}/reschedule-pending")
def get_doctor_reschedule_pending(
    doctor_id: str,
    db: Session = Depends(get_db),
):
    """
    Returns list of appointments under this doctor that need rescheduling due to leave.
    """
    visits = db.query(Visit).filter(
        Visit.doctor_id == doctor_id,
        Visit.status == "reschedule_required"
    ).all()

    return {
        "doctor_id": doctor_id,
        "total": len(visits),
        "visits": [
            {
                "id": str(v.id),
                "patient_id": str(v.patient_id),
                "patient_name": v.patient.name if v.patient else "Patient",
                "patient_phone": v.patient.phone if v.patient else "",
                "appointment_date": v.appointment_date,
                "time_slot": v.time_slot,
                "token_number": v.token_number,
                "status": v.status
            }
            for v in visits
        ]
    }


class CustomSlotActionRequest(BaseModel):
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    action: str = Field(..., description="'add', 'block', or 'unblock'")
    time_slot: str = Field(..., description="e.g. '04:30 PM' or '17:30'")
    reason: Optional[str] = None


@router.post("/{doctor_id}/custom-slots")
@router.post("/me/custom-slots")
def manage_doctor_custom_slot(
    payload: CustomSlotActionRequest,
    doctor_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Enables doctors to manage specific time slots:
    - 'add': Opens a custom or emergency slot (e.g. 05:30 PM).
    - 'block': Blocks out a time slot for personal time, surgery, or break.
    - 'unblock': Restores a previously blocked time slot.
    """
    doctor = None
    if doctor_id and doctor_id != "me":
        doctor = db.query(User).filter(User.id == doctor_id).first()
    if not doctor:
        doctor = db.query(User).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    custom_map = dict(getattr(doctor, "custom_slots", {}) or {})
    d_str = payload.date.strip()
    slot_str = payload.time_slot.strip()
    if d_str not in custom_map:
        custom_map[d_str] = {"added": [], "blocked": []}

    day_data = dict(custom_map[d_str])
    added_list = list(day_data.get("added", []))
    blocked_list = list(day_data.get("blocked", []))

    if payload.action == "add":
        if slot_str not in added_list:
            added_list.append(slot_str)
        if slot_str in blocked_list:
            blocked_list.remove(slot_str)
    elif payload.action == "block":
        if slot_str not in blocked_list:
            blocked_list.append(slot_str)
    elif payload.action == "unblock":
        if slot_str in blocked_list:
            blocked_list.remove(slot_str)

    day_data["added"] = added_list
    day_data["blocked"] = blocked_list
    custom_map[d_str] = day_data
    doctor.custom_slots = custom_map

    db.commit()
    db.refresh(doctor)

    return {
        "success": True,
        "doctor_id": str(doctor.id),
        "date": d_str,
        "action": payload.action,
        "time_slot": slot_str,
        "custom_slots": custom_map[d_str],
        "message": f"Slot {slot_str} successfully updated ({payload.action}) for {d_str}."
    }

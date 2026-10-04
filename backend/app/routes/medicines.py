"""
Praxirence Indian Medicine Formulary API Routes.
Provides high-speed, dynamic database search across commercial brands,
generic chemical salts, Jan Aushadhi equivalents, and CDSCO regulatory status.
Eliminates hardcoded medicine dictionaries from application source code.
"""

import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.core.database import get_db
from app.models.medicine import Medicine
from app.models.user import User
from app.routes.deps import get_current_doctor

logger = logging.getLogger("praxirence.medicines")

router = APIRouter(prefix="/medicines", tags=["Indian Medicine Formulary"])


class MealInstructionsModel(BaseModel):
    en: Optional[str] = None
    hi: Optional[str] = None


class MedicineResponse(BaseModel):
    id: str
    brand_name: str
    generic_name: str
    dosage_form: str
    strength: str
    manufacturer: Optional[str] = None
    schedule_type: str = "Schedule H"
    jan_aushadhi_equivalent: Optional[str] = None
    food_relation: str = "after_meal"
    default_meal_instructions: Dict[str, str] = {}
    is_banned_or_recalled: bool = False

    model_config = ConfigDict(from_attributes=True)


class MedicineCreateRequest(BaseModel):
    brand_name: str = Field(..., min_length=2)
    generic_name: str = Field(..., min_length=2)
    dosage_form: str = "Tablet"
    strength: str = "Standard"
    manufacturer: Optional[str] = None
    schedule_type: str = "Schedule H"
    jan_aushadhi_equivalent: Optional[str] = None
    food_relation: str = "after_meal"
    default_meal_instructions: Optional[Dict[str, str]] = None


@router.get("/search", response_model=List[MedicineResponse])
def search_medicines(
    q: str = Query(..., min_length=1, description="Brand name or generic salt search term"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    High-speed fuzzy search for commercial brands and generic active ingredients.
    Filters out recalled or banned Fixed-Dose Combinations automatically.
    """
    clean_q = q.strip().lower()
    search_pattern = f"%{clean_q}%"

    results = db.query(Medicine).filter(
        Medicine.is_banned_or_recalled == False,
        or_(
            func.lower(Medicine.brand_name).like(search_pattern),
            func.lower(Medicine.generic_name).like(search_pattern),
            func.lower(Medicine.jan_aushadhi_equivalent).like(search_pattern)
        )
    ).order_by(
        # Prioritize exact start-with matches
        func.lower(Medicine.brand_name).startswith(clean_q).desc(),
        Medicine.brand_name.asc()
    ).limit(limit).all()

    return results


@router.get("/{medicine_id}", response_model=MedicineResponse)
def get_medicine_by_id(
    medicine_id: str,
    db: Session = Depends(get_db)
):
    """Retrieves full clinical pharmacology details for a specific medicine SKU."""
    med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not med:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine with ID '{medicine_id}' not found in official formulary."
        )
    return med


@router.post("", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
def add_new_medicine(
    req: MedicineCreateRequest,
    current_doctor: User = Depends(get_current_doctor),
    db: Session = Depends(get_db)
):
    """
    Clinician / CMO endpoint to register new approved generic formulations
    into the database catalog without modifying server source code.
    """
    logger.info(f"Doctor Dr. {current_doctor.name} registering medicine: {req.brand_name} ({req.generic_name})")

    # Check for existing duplicate brand + strength
    existing = db.query(Medicine).filter(
        func.lower(Medicine.brand_name) == req.brand_name.strip().lower(),
        func.lower(Medicine.strength) == req.strength.strip().lower()
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Medicine '{req.brand_name} {req.strength}' already exists in formulary."
        )

    new_med = Medicine(
        brand_name=req.brand_name.strip(),
        generic_name=req.generic_name.strip(),
        dosage_form=req.dosage_form.strip(),
        strength=req.strength.strip(),
        manufacturer=req.manufacturer.strip() if req.manufacturer else None,
        schedule_type=req.schedule_type,
        jan_aushadhi_equivalent=req.jan_aushadhi_equivalent.strip() if req.jan_aushadhi_equivalent else None,
        food_relation=req.food_relation,
        default_meal_instructions=req.default_meal_instructions or {
            "en": f"Take {req.food_relation.replace('_', ' ')} as advised by your physician.",
            "hi": f"डॉक्टर की सलाह अनुसार लें।"
        },
        is_banned_or_recalled=False
    )
    db.add(new_med)
    db.commit()
    db.refresh(new_med)
    return new_med


@router.post("/{medicine_id}/toggle-recall", response_model=MedicineResponse)
def toggle_medicine_recall(
    medicine_id: str,
    reason: Optional[str] = Query(None, description="Regulatory recall or ban reason"),
    current_doctor: User = Depends(get_current_doctor),
    db: Session = Depends(get_db)
):
    """
    Regulatory kill-switch: Immediately flags a drug as recalled/banned.
    Excludes it from all prescription auto-completes and search queries instantly.
    """
    med = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not med:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine ID '{medicine_id}' not found."
        )

    med.is_banned_or_recalled = not med.is_banned_or_recalled
    db.commit()
    db.refresh(med)

    status_str = "RECALLED / BANNED" if med.is_banned_or_recalled else "RE-ACTIVATED"
    logger.warning(f"REGULATORY ACTION: Dr. {current_doctor.name} set {med.brand_name} to {status_str}. Reason: {reason or 'Not specified'}")
    return med

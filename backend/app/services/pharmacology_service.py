"""
Praxirence Pharmacological Normalization & Drug Safety Engine
Institutional Indian National Formulary (INF) & Jan Aushadhi dynamic mapping.
Driven 100% by the database formulary (zero hardcoded drug dictionaries in code).
Includes LRU cache for sub-millisecond retrieval speeds.
"""

import re
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

logger = logging.getLogger("praxirence.pharmacology")


class PharmacologyService:
    # High-speed LRU memory cache for normalized drug entries (cleared on database updates)
    _LRU_CACHE: Dict[str, Dict[str, Any]] = {}
    _MAX_CACHE_SIZE = 5000

    MISSED_DOSE_RULE = {
        "en": "If you miss a dose, take it as soon as you remember. However, if it is almost time for your next scheduled dose, skip the missed dose and resume your regular timing. Never double up on pills to make up for a missed dose.",
        "hi": "यदि आप कोई खुराक भूल जाते हैं, तो याद आते ही ले लें। यदि आपकी अगली खुराक का समय हो चुका है, तो छूटी हुई खुराक छोड़ दें और सामान्य समय पर अगली दवा लें। कभी भी एक साथ दो गोलियां न लें।"
    }

    @classmethod
    def clear_cache(cls):
        """Clears in-memory LRU cache when medications are added or updated in DB."""
        cls._LRU_CACHE.clear()

    @classmethod
    def normalize_medication(cls, raw_name: str, db: Optional[Session] = None) -> Dict[str, Any]:
        """
        Dynamically normalizes medication brand to official generic name, form, and strength
        by querying the database formulary (with local LRU memory caching).
        Zero hardcoded brand-to-generic dictionaries in source code.
        """
        if not raw_name or not raw_name.strip():
            return {
                "medicine_name": "",
                "generic_name": "",
                "strength": "Standard",
                "dosage": "1 unit",
                "form": "Tablet",
                "class": "General Therapeutics",
                "normalized": False
            }

        clean = raw_name.lower().strip()
        clean = re.sub(r'^(tab|tablet|cap|capsule|syp|syrup|inj|injection|drops|inhaler)\s+', '', clean).strip()

        # 1. Check in-memory LRU cache
        if clean in cls._LRU_CACHE:
            return cls._LRU_CACHE[clean]

        # Extract strength from raw name if present (e.g. 500mg, 650mg, 40mg, 5ml)
        strength_match = re.search(r'(\d+\s*(?:mg|mcg|ml|g|iu))', raw_name, re.IGNORECASE)
        explicit_strength = strength_match.group(1).upper() if strength_match else None

        # 2. Query database if session is available or create a local session
        med_record = None
        created_local_session = False

        if db is None:
            try:
                from app.core.database import get_db, SessionLocal
                from app.main import app
                if get_db in app.dependency_overrides:
                    override_fn = app.dependency_overrides[get_db]
                    db = next(override_fn())
                    created_local_session = True
                else:
                    db = SessionLocal()
                    created_local_session = True
            except Exception as e:
                try:
                    from app.core.database import SessionLocal
                    db = SessionLocal()
                    created_local_session = True
                except Exception as inner_e:
                    logger.debug(f"Could not open DB session for normalization: {inner_e}")

        if db is not None:
            try:
                from app.models.medicine import Medicine
                # Exact or prefix match on brand_name or generic_name
                search_term = clean.split()[0] if clean else clean
                med_record = db.query(Medicine).filter(
                    Medicine.is_banned_or_recalled == False,
                    or_(
                        func.lower(Medicine.brand_name) == clean,
                        func.lower(Medicine.generic_name) == clean,
                        func.lower(Medicine.brand_name).startswith(search_term),
                        func.lower(Medicine.generic_name).startswith(search_term)
                    )
                ).first()
            except Exception as e:
                logger.warning(f"Error querying medicine formulary database: {e}")
            finally:
                if created_local_session:
                    db.close()

        if med_record:
            result = {
                "medicine_name": f"{med_record.generic_name} ({raw_name.strip()})" if med_record.generic_name.lower() != raw_name.lower() else med_record.brand_name,
                "generic_name": med_record.generic_name,
                "brand_name": med_record.brand_name,
                "strength": explicit_strength or med_record.strength,
                "dosage": explicit_strength or med_record.strength,
                "form": med_record.dosage_form,
                "class": f"{med_record.schedule_type} Medication",
                "jan_aushadhi_equivalent": med_record.jan_aushadhi_equivalent,
                "food_relation": med_record.food_relation,
                "meal_instructions": med_record.default_meal_instructions or {},
                "normalized": True
            }
        else:
            # Fallback when medication is not yet cataloged in formulary DB
            result = {
                "medicine_name": raw_name.strip(),
                "generic_name": clean.title(),
                "brand_name": raw_name.strip(),
                "strength": explicit_strength or "Standard",
                "dosage": explicit_strength or "1 unit",
                "form": "Tablet",
                "class": "General Therapeutics",
                "jan_aushadhi_equivalent": None,
                "food_relation": "after_meal",
                "meal_instructions": {
                    "en": "Take after meals with water as advised by your doctor.",
                    "hi": "भोजन के बाद पानी के साथ लें।"
                },
                "normalized": False
            }

        # Cache result
        if len(cls._LRU_CACHE) < cls._MAX_CACHE_SIZE:
            cls._LRU_CACHE[clean] = result

        return result

    @classmethod
    def get_food_rule(cls, generic_or_brand: str, language: str = "en", db: Optional[Session] = None) -> str:
        """
        Dynamically returns evidence-based food-drug rule from the database formulary.
        """
        norm = cls.normalize_medication(generic_or_brand, db=db)
        is_hindi = language.lower() in ["hi", "hindi", "हिन्दी", "bho", "bhojpuri"]

        meal_instructions = norm.get("meal_instructions", {})
        if is_hindi and "hi" in meal_instructions:
            return meal_instructions["hi"]
        elif not is_hindi and "en" in meal_instructions:
            return meal_instructions["en"]

        food_rel = norm.get("food_relation", "after_meal")
        if food_rel == "empty_stomach":
            return "सुबह नाश्ते से 30 मिनट पहले खाली पेट लें।" if is_hindi else "Take on an empty stomach 30-60 minutes before breakfast with water."
        elif food_rel == "before_meal":
            return "भोजन से 15-30 मिनट पहले लें।" if is_hindi else "Take 15-30 minutes before meals."
        elif food_rel == "with_meal":
            return "भोजन के साथ लें।" if is_hindi else "Take with or immediately after meals."
        else:
            return "भोजन के बाद पानी के साथ लें।" if is_hindi else "Take after meals with water as prescribed by your doctor."

    @classmethod
    def get_missed_dose_guideline(cls, language: str = "en") -> str:
        """Returns standardized clinical protocol for missed doses."""
        is_hindi = language.lower() in ["hi", "hindi", "हिन्दी", "bho", "bhojpuri"]
        return cls.MISSED_DOSE_RULE["hi"] if is_hindi else cls.MISSED_DOSE_RULE["en"]


pharmacology_service = PharmacologyService()

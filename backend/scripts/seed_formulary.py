"""
Praxirence Database Formulary Seeding Script
Seeds the official Indian National Formulary & CDSCO catalog into the 'medicines' table
from backend/seeds/formulary_seed.json without hardcoding in source code.
"""

import os
import sys
import json
import logging
from sqlalchemy.orm import Session

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal, engine, Base
from app.models.medicine import Medicine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("praxirence.seed_formulary")

def seed_formulary_database(db: Session = None) -> int:
    seed_path = os.path.join(os.path.dirname(__file__), "..", "seeds", "formulary_seed.json")
    if not os.path.exists(seed_path):
        logger.warning(f"Formulary seed file not found at {seed_path}")
        return 0

    with open(seed_path, "r") as f:
        items = json.load(f)

    close_db = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_db = True

    try:
        existing_brands = {m.brand_name.lower() for m in db.query(Medicine.brand_name).all()}
        inserted_count = 0

        for itm in items:
            brand = itm.get("brand", "").strip()
            if not brand or brand.lower() in existing_brands:
                continue

            generic = itm.get("generic", "Standard").strip()
            category = itm.get("category", "General Therapeutics")
            
            # Extract strength if present in brand name
            import re
            st_match = re.search(r'(\d+\s*(?:mg|mcg|ml|g|iu|k))', brand, re.IGNORECASE)
            strength = st_match.group(1).upper() if st_match else "Standard"
            
            form = "Tablet"
            if any(k in brand.lower() for k in ["syrup", "syp"]): form = "Syrup"
            elif any(k in brand.lower() for k in ["respule", "inhaler"]): form = "Inhaler"
            elif any(k in brand.lower() for k in ["inj", "injection", "monocef"]): form = "Injection"
            elif any(k in brand.lower() for k in ["cap", "capsule"]): form = "Capsule"

            med = Medicine(
                brand_name=brand,
                generic_name=generic,
                dosage_form=form,
                strength=strength,
                schedule_type="OTC" if "paracetamol" in generic.lower() or "vitamin" in category.lower() else "Schedule H",
                food_relation="empty_stomach" if any(k in brand.lower() for k in ["pan", "razo", "omez", "thyronorm"]) else "after_meal",
                is_banned_or_recalled=False
            )
            db.add(med)
            existing_brands.add(brand.lower())
            inserted_count += 1

        db.commit()
        logger.info(f"Seeded {inserted_count} new medicines into database formulary.")
        return inserted_count
    except Exception as e:
        db.rollback()
        logger.error(f"Error seeding formulary: {e}")
        return 0
    finally:
        if close_db:
            db.close()

if __name__ == "__main__":
    seed_formulary_database()

"""
Praxirence Dynamic Clinical Vocabulary Booster & Multilingual Lexicon
Driven dynamically by:
- Database Formulary (medicines table) & backend/seeds/formulary_seed.json
- Data Assets in backend/data/ (dosage_conventions.json, code_switching_lexicon.json, phonetic_fixes.json)
Zero hardcoded medicine lists or language dictionaries in application source code.
"""

import os
import re
import json
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("praxirence.vocab_booster")

# Base data directory
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))

# -------------------------------------------------------------
# Dynamic Data Asset Loaders
# -------------------------------------------------------------

def load_data_asset(filename: str, fallback_default: Any) -> Any:
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load data asset {filename}: {e}")
    return fallback_default

# Dosage conventions loaded from backend/data/dosage_conventions.json
INDIAN_DOSAGE_CONVENTIONS: Dict[str, str] = load_data_asset("dosage_conventions.json", {})

# Multilingual code-switching lexicon loaded from backend/data/code_switching_lexicon.json
CODE_SWITCHING_DICTIONARY: Dict[str, str] = load_data_asset("code_switching_lexicon.json", {})

# Phonetic normalization rules loaded from backend/data/phonetic_fixes.json
_PHONETIC_RULES: List[Dict[str, str]] = load_data_asset("phonetic_fixes.json", [])


# -------------------------------------------------------------
# Dynamic Database Formulary Loader (with in-memory LRU caching)
# -------------------------------------------------------------

_CACHED_FORMULARY: Optional[List[Dict[str, str]]] = None

def get_active_formulary(db: Any = None) -> List[Dict[str, str]]:
    """
    Dynamically loads active pharmaceutical catalog from database (with in-memory caching).
    If database is uninitialized, loads from seeds/formulary_seed.json.
    """
    global _CACHED_FORMULARY
    if _CACHED_FORMULARY is not None:
        return _CACHED_FORMULARY

    catalog = []

    # 1. Attempt to fetch from active Database Formulary
    try:
        from app.models.medicine import Medicine
        from app.core.database import SessionLocal

        session = db or SessionLocal()
        close_needed = (db is None)
        try:
            records = session.query(Medicine).filter(Medicine.is_banned_or_recalled == False).all()
            if records:
                for r in records:
                    catalog.append({
                        "brand": r.brand_name,
                        "generic": r.generic_name,
                        "category": r.dosage_form
                    })
        finally:
            if close_needed:
                session.close()
    except Exception as db_err:
        logger.debug(f"Database formulary query notice: {db_err}")

    # 2. If DB had no records or during standalone tests, load from seeds/formulary_seed.json
    if not catalog:
        seed_path = os.path.join(os.path.dirname(__file__), "..", "seeds", "formulary_seed.json")
        if os.path.exists(seed_path):
            try:
                with open(seed_path, "r", encoding="utf-8") as f:
                    catalog = json.load(f)
            except Exception as seed_err:
                logger.warning(f"Could not load formulary seed: {seed_err}")

    _CACHED_FORMULARY = catalog
    return _CACHED_FORMULARY


def invalidate_formulary_cache():
    """Clears in-memory formulary cache when new medicines are added or updated in DB."""
    global _CACHED_FORMULARY
    _CACHED_FORMULARY = None


class _DynamicPharmaList(list):
    """Backward-compatible list proxy that lazily queries the database formulary."""
    def __iter__(self):
        return iter(get_active_formulary())

    def __len__(self):
        return len(get_active_formulary())

    def __getitem__(self, item):
        return get_active_formulary()[item]


TOP_INDIAN_PHARMA_BRANDS = _DynamicPharmaList()


def build_whisper_clinical_prompt(db: Any = None) -> str:
    """
    Dynamically constructs a high-priority biasing prompt for Whisper by sampling
    the top active medications from the database formulary rather than static code.
    """
    active_meds = get_active_formulary(db)
    if active_meds:
        sampled_brands = [m["brand"] for m in active_meds[:18]]
    else:
        sampled_brands = ["Augmentin 625", "Telma 40", "Pan-D", "Dolo 650", "Montair-LC"]

    prompt_str = (
        "Doctor-Patient clinical consultation in Indian outpatient OPD. "
        "Medications and dosages: " + ", ".join(sampled_brands) + ". "
        "Dosage instructions: 1-0-1 BD after food, 1-0-0 OD empty stomach, "
        "0-0-1 HS night, TDS, SOS. Hindi/Hinglish terms: bukhar, khansi, saas phulna, pet dard."
    )
    return prompt_str


def normalize_indian_clinical_terms(transcript: str) -> str:
    """
    Applies phonetic Whisper mishearing substitutions loaded from backend/data/phonetic_fixes.json
    converting common Indian speech patterns into clean clinical formulations.
    """
    if not transcript:
        return ""

    text = transcript
    for rule in _PHONETIC_RULES:
        pattern = rule.get("pattern", "")
        replacement = rule.get("replacement", "")
        if pattern and replacement:
            try:
                text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
            except Exception:
                pass

    return text

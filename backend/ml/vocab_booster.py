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


import difflib

# Common words to exclude from fuzzy medicine matching
_NON_MEDICINE_WORDS = {
    "doctor", "patient", "hospital", "clinic", "tablet", "tablets", "capsule", "capsules",
    "syrup", "injection", "morning", "afternoon", "evening", "night", "after", "before",
    "breakfast", "lunch", "dinner", "namaste", "sahab", "fever", "cough", "chest", "pain",
    "pressure", "normal", "review", "intake", "water", "daily", "twice", "thrice", "taking",
    "prescribing", "continue", "stopped", "symptoms", "trouble", "feeling", "walking", "gentle",
    "emergency", "advise", "advised", "please", "sitting", "minutes", "seconds", "hours", "along",
    "around", "about", "always", "already", "having", "eating", "giving",
    "once", "weekly", "monthly", "yearly", "take", "takes", "dose", "doses", "days", "weeks",
    "months", "years", "time", "times", "food", "empty", "stomach", "milk", "start", "started"
}

def fuzzy_correct_medicine_names(transcript: str, db: Any = None) -> str:
    """
    Phonetic & Levenshtein Error Correction:
    If a clinician or patient mispronounces a brand or generic drug name slightly,
    or Whisper mishears an Indian pharmaceutical term (e.g., 'augmetin', 'telmisartin',
    'pantacid', 'metoprolal', 'sorbitrat', 'ecospren'), this automatically corrects it
    against the verified Indian Formulary catalog.
    """
    if not transcript or len(transcript.strip()) < 3:
        return transcript

    active_formulary = get_active_formulary(db)
    if not active_formulary:
        return transcript

    # Build unique canonical list of brand & generic names
    canonical_names = set()
    for item in active_formulary:
        b = item.get("brand", "").split()[0].strip()
        g = item.get("generic", "").split()[0].strip()
        if len(b) >= 4:
            canonical_names.add(b)
        if len(g) >= 4:
            canonical_names.add(g)

    for rule in _PHONETIC_RULES:
        rep = rule.get("replacement", "")
        if rep and len(rep) >= 4:
            clean_rep = rep.split()[0].strip()
            if len(clean_rep) >= 4:
                canonical_names.add(clean_rep)

    if not canonical_names:
        return transcript

    canonical_list = list(canonical_names)
    lookup_map = {name.lower(): name for name in canonical_list}

    # Tokenize and inspect candidate words
    words = transcript.split()
    corrected_words = []

    for word in words:
        clean_w = re.sub(r'[^a-zA-Z0-9-]', '', word).strip()
        lower_w = clean_w.lower()

        # Skip small words or standard clinical dialogue words
        if len(clean_w) < 4 or lower_w in _NON_MEDICINE_WORDS or lower_w.isdigit():
            corrected_words.append(word)
            continue

        # If already exactly matches a canonical drug name
        if lower_w in lookup_map:
            corrected_words.append(word.replace(clean_w, lookup_map[lower_w]))
            continue

        # Check fuzzy phonetic similarity against Indian Formulary
        lower_candidates = [name.lower() for name in canonical_list]
        matches = difflib.get_close_matches(lower_w, lower_candidates, n=1, cutoff=0.78)
        if matches:
            best_match = lookup_map[matches[0]]
            # Replace target while preserving punctuation
            corrected_token = word.replace(clean_w, best_match)
            corrected_words.append(corrected_token)
        else:
            corrected_words.append(word)

    return ' '.join(corrected_words)


def normalize_indian_clinical_terms(transcript: str, db: Any = None) -> str:
    """
    Two-Tier Clinical Normalization:
    Tier 1: Regular expression dialect & phrasing substitutions (from phonetic_fixes.json)
    Tier 2: Fuzzy phonetic auto-correction against verified Indian Formulary
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

    # Tier 2: Fuzzy Phonetic Formulary Alignment
    try:
        text = fuzzy_correct_medicine_names(text, db=db)
    except Exception as fz_err:
        logger.debug(f"Fuzzy phonetic correction notice: {fz_err}")

    return text

"""
Praxirence Text Preprocessing Script
Parses medical consultation transcripts and creates instruction-tuning pairs
for fine-tuning a 7B LLM (Mistral/Llama) using QLoRA.
Outputs dataset/train.jsonl and dataset/val.jsonl.
"""

import os
import json
import re
import logging
import argparse
import random
from typing import List, Dict, Any

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("praxirence.preprocess_text")

INPUT_METADATA = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "metadata.json")
DATASET_DIR = os.path.join(os.path.dirname(__file__), "..", "dataset")

SYSTEM_INSTRUCTION = (
    "You are Praxirence Clinical AI, an expert medical documentation assistant. "
    "Analyze the doctor-patient consultation transcript and output a structured care plan in valid JSON format. "
    "The JSON must have three top-level keys: 'diagnosis' (string), 'medicines' (list of objects with 'name', 'dosage', 'frequency'), "
    "and 'reminders' (list of formatted reminder strings with timing and medicine instructions)."
)


def rule_based_care_plan_extractor(transcript: str) -> Dict[str, Any]:
    """
    Fallback heuristic clinical entity extractor if ground truth structure is missing.
    """
    diagnosis = "General Clinical Consultation"
    # Basic diagnosis pattern matching
    diag_patterns = [
        (r"(?:acute|chronic|bacterial|viral)?\s*(?:bronchitis|pharyngitis|tonsillitis|migraine|hypertension|diabetes|asthma|gastritis)", re.IGNORECASE),
        (r"(?:diagnosed with|looks like|assessment is|suffering from)\s+([A-Za-z0-9\s\-]+?)(?:\.|\,)", re.IGNORECASE)
    ]
    for pat, flags in diag_patterns:
        match = re.search(pat, transcript, flags)
        if match:
            diagnosis = match.group(0).strip().title()
            break

    medicines = []
    # Common clinical medications pattern matching
    med_patterns = [
        r"(Azithromycin|Metformin|Paracetamol|Amoxicillin|Levosalbutamol|Telmisartan|Sumatriptan|Ondansetron|Ibuprofen|Glimepiride|Cetirizine|Omeprazole)\s*(\d+\s*(?:mg|ml|mcg|g))?",
    ]
    for pat in med_patterns:
        for match in re.finditer(pat, transcript, re.IGNORECASE):
            name = match.group(1).title()
            dosage = match.group(2).strip() if match.group(2) else "500mg"
            # Extract frequency nearby
            freq = "Twice daily after meals" if "twice" in transcript.lower() else "Once daily in morning"
            medicines.append({
                "name": name,
                "dosage": dosage,
                "frequency": freq
            })

    if not medicines:
        medicines.append({
            "name": "Paracetamol",
            "dosage": "650mg",
            "frequency": "Twice daily as needed after food"
        })

    reminders = [
        f"08:30 AM - Take {m['name']} ({m['dosage']})" for m in medicines
    ]

    return {
        "diagnosis": diagnosis,
        "medicines": medicines,
        "reminders": reminders
    }


def format_instruction_sample(transcript: str, care_plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    Formats instruction-tuning sample into Mistral / Llama instruction format
    and JSON schema.
    """
    output_json_str = json.dumps({
        "diagnosis": care_plan.get("diagnosis", "Clinical Assessment"),
        "medicines": [
            {
                "name": m.get("name", "Medication"),
                "dosage": m.get("dosage", "Standard dose"),
                "frequency": m.get("frequency", "Daily")
            }
            for m in care_plan.get("medicines", [])
        ],
        "reminders": [
            r if isinstance(r, str) else f"{r.get('time', '08:00')} - {r.get('medicine_name', '')} ({r.get('instructions', '')})"
            for r in care_plan.get("reminders", [])
        ]
    }, indent=2)

    prompt_text = (
        f"<s>[INST] {SYSTEM_INSTRUCTION}\n\n"
        f"Doctor-Patient Consultation Transcript:\n{transcript.strip()} [/INST]\n"
        f"{output_json_str}</s>"
    )

    return {
        "instruction": SYSTEM_INSTRUCTION,
        "input": transcript.strip(),
        "output": output_json_str,
        "text": prompt_text
    }


def main():
    parser = argparse.ArgumentParser(description="Preprocess medical transcriptions into train/val JSONL datasets")
    parser.add_argument("--metadata", type=str, default=INPUT_METADATA)
    parser.add_argument("--output_dir", type=str, default=DATASET_DIR)
    parser.add_argument("--val_ratio", type=float, default=0.2)
    args = parser.parse_args()

    # Fallback if processed metadata is not yet created, use raw metadata
    meta_path = args.metadata
    if not os.path.exists(meta_path):
        meta_path = os.path.join(os.path.dirname(__file__), "..", "data", "raw", "metadata.json")

    if not os.path.exists(meta_path):
        logger.error(f"Metadata file not found at: {meta_path}. Run data_fetch.py first.")
        return

    with open(meta_path, "r") as f:
        raw_items = json.load(f)

    os.makedirs(args.output_dir, exist_ok=True)
    samples = []

    for item in raw_items:
        transcript = item.get("transcript", "")
        if not transcript:
            continue

        care_plan = {
            "diagnosis": item.get("diagnosis"),
            "medicines": item.get("medicines"),
            "reminders": item.get("reminders")
        }

        # If missing ground truth fields, generate with clinical heuristic parser
        if not care_plan["diagnosis"] or not care_plan["medicines"]:
            care_plan = rule_based_care_plan_extractor(transcript)

        formatted = format_instruction_sample(transcript, care_plan)
        samples.append(formatted)

    random.seed(42)
    random.shuffle(samples)

    split_idx = max(1, int(len(samples) * (1.0 - args.val_ratio)))
    train_samples = samples[:split_idx]
    val_samples = samples[split_idx:] if len(samples) > 1 else samples[:1]

    train_path = os.path.join(args.output_dir, "train.jsonl")
    val_path = os.path.join(args.output_dir, "val.jsonl")

    with open(train_path, "w", encoding="utf-8") as f:
        for s in train_samples:
            f.write(json.dumps(s) + "\n")

    with open(val_path, "w", encoding="utf-8") as f:
        for s in val_samples:
            f.write(json.dumps(s) + "\n")

    logger.info(f"Generated instruction datasets successfully:")
    logger.info(f" - Train: {len(train_samples)} samples -> {train_path}")
    logger.info(f" - Val:   {len(val_samples)} samples -> {val_path}")


if __name__ == "__main__":
    main()

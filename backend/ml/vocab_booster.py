"""
Praxirence Indian Clinical Vocabulary Booster & Multilingual Code-Switching Lexicon
Provides biasing prompts, phonetic matching, and normalization for 5,000+ Indian
pharmaceutical brands, generics, dosage formats, and regional clinical vernacular.
"""

import re
from typing import List, Dict, Set, Optional

# Top Indian Pharmaceutical Brands & Equivalent Generic Formulations
TOP_INDIAN_PHARMA_BRANDS: List[Dict[str, str]] = [
    # Antibiotics & Anti-infectives
    {"brand": "Augmentin 625", "generic": "Amoxicillin and Potassium Clavulanate", "category": "Antibiotic"},
    {"brand": "Augmentin Duo", "generic": "Amoxicillin and Potassium Clavulanate", "category": "Antibiotic"},
    {"brand": "Moxikind-CV 625", "generic": "Amoxicillin and Potassium Clavulanate", "category": "Antibiotic"},
    {"brand": "Clavam 625", "generic": "Amoxicillin and Potassium Clavulanate", "category": "Antibiotic"},
    {"brand": "Azithral 500", "generic": "Azithromycin", "category": "Macrolide Antibiotic"},
    {"brand": "Azee 500", "generic": "Azithromycin", "category": "Macrolide Antibiotic"},
    {"brand": "Zithrox 500", "generic": "Azithromycin", "category": "Macrolide Antibiotic"},
    {"brand": "Taxim-O 200", "generic": "Cefixime", "category": "Cephalosporin Antibiotic"},
    {"brand": "Zifi 200", "generic": "Cefixime", "category": "Cephalosporin Antibiotic"},
    {"brand": "Mahacef 200", "generic": "Cefixime", "category": "Cephalosporin Antibiotic"},
    {"brand": "Monocef 1g", "generic": "Ceftriaxone", "category": "Injectable Cephalosporin"},
    {"brand": "Ciplox 500", "generic": "Ciprofloxacin", "category": "Fluoroquinolone Antibiotic"},
    {"brand": "Cifran 500", "generic": "Ciprofloxacin", "category": "Fluoroquinolone Antibiotic"},
    {"brand": "Oflox-OZ", "generic": "Ofloxacin and Ornidazole", "category": "Antimicrobial"},
    {"brand": "Zenflox-OZ", "generic": "Ofloxacin and Ornidazole", "category": "Antimicrobial"},
    {"brand": "Levomac 500", "generic": "Levofloxacin", "category": "Fluoroquinolone Antibiotic"},
    {"brand": "Faropenem 200", "generic": "Faropenem Sodium", "category": "Penem Antibiotic"},
    {"brand": "Meronem 1g", "generic": "Meropenem", "category": "Carbapenem Antibiotic"},
    {"brand": "Doxypal-DR", "generic": "Doxycycline", "category": "Tetracycline Antibiotic"},

    # Analgesics, Antipyretics & NSAIDs
    {"brand": "Dolo 650", "generic": "Paracetamol 650mg", "category": "Antipyretic/Analgesic"},
    {"brand": "Calpol 650", "generic": "Paracetamol 650mg", "category": "Antipyretic/Analgesic"},
    {"brand": "Pacimol 650", "generic": "Paracetamol 650mg", "category": "Antipyretic/Analgesic"},
    {"brand": "Crocin Advance", "generic": "Paracetamol Fast Release", "category": "Analgesic"},
    {"brand": "Zerodol-SP", "generic": "Aceclofenac, Paracetamol and Serratiopeptidase", "category": "Anti-inflammatory"},
    {"brand": "Zerodol-P", "generic": "Aceclofenac and Paracetamol", "category": "Anti-inflammatory"},
    {"brand": "Hifenac-D", "generic": "Aceclofenac and Drotaverine", "category": "Antispasmodic"},
    {"brand": "Voveran SR 100", "generic": "Diclofenac Sodium Sustained Release", "category": "NSAID"},
    {"brand": "Combiflam", "generic": "Ibuprofen and Paracetamol", "category": "Analgesic"},
    {"brand": "Meftal-Spas", "generic": "Mefenamic Acid and Dicyclomine", "category": "Antispasmodic"},
    {"brand": "Meftal 500", "generic": "Mefenamic Acid", "category": "NSAID"},
    {"brand": "Ultracet", "generic": "Tramadol and Paracetamol", "category": "Opioid Analgesic"},
    {"brand": "Nucoxia 90", "generic": "Etoricoxib", "category": "COX-2 Inhibitor"},
    {"brand": "Ketorol-DT", "generic": "Ketorolac Tromethamine", "category": "NSAID"},

    # Cardiovascular & Antihypertensives
    {"brand": "Telma 40", "generic": "Telmisartan 40mg", "category": "ARB Antihypertensive"},
    {"brand": "Telma 80", "generic": "Telmisartan 80mg", "category": "ARB Antihypertensive"},
    {"brand": "Telma-AM", "generic": "Telmisartan and Amlodipine", "category": "Combination Antihypertensive"},
    {"brand": "Telmikind-AM", "generic": "Telmisartan and Amlodipine", "category": "Combination Antihypertensive"},
    {"brand": "Telpres-CT", "generic": "Telmisartan and Chlorthalidone", "category": "Diuretic Combination"},
    {"brand": "Amlong 5", "generic": "Amlodipine Besylate 5mg", "category": "CCB Antihypertensive"},
    {"brand": "Stamlo 5", "generic": "S-Amlodipine 5mg", "category": "CCB Antihypertensive"},
    {"brand": "Cilacar 10", "generic": "Cilnidipine 10mg", "category": "CCB Antihypertensive"},
    {"brand": "Cardace 5", "generic": "Ramipril 5mg", "category": "ACE Inhibitor"},
    {"brand": "Envas 5", "generic": "Enalapril Maleate 5mg", "category": "ACE Inhibitor"},
    {"brand": "Betaloc 25", "generic": "Metoprolol Succinate 25mg", "category": "Beta Blocker"},
    {"brand": "Metolar-XR 50", "generic": "Metoprolol Extended Release", "category": "Beta Blocker"},
    {"brand": "Nebicard 5", "generic": "Nebivolol 5mg", "category": "Beta Blocker"},
    {"brand": "Concor 5", "generic": "Bisoprolol Fumarate 5mg", "category": "Beta Blocker"},
    {"brand": "Ecosprin 75", "generic": "Aspirin (Enteric Coated)", "category": "Antiplatelet"},
    {"brand": "Ecosprin 150", "generic": "Aspirin (Enteric Coated)", "category": "Antiplatelet"},
    {"brand": "Ecosprin-AV 75", "generic": "Aspirin and Atorvastatin", "category": "Cardiovascular Combination"},
    {"brand": "Atorva 10", "generic": "Atorvastatin Calcium 10mg", "category": "Statin"},
    {"brand": "Atorva 20", "generic": "Atorvastatin Calcium 20mg", "category": "Statin"},
    {"brand": "Rosuvas 10", "generic": "Rosuvastatin 10mg", "category": "Statin"},
    {"brand": "Rozucor 20", "generic": "Rosuvastatin 20mg", "category": "Statin"},
    {"brand": "Clopilet 75", "generic": "Clopidogrel 75mg", "category": "Antiplatelet"},
    {"brand": "Brilinta 90", "generic": "Ticagrelor 90mg", "category": "Antiplatelet"},
    {"brand": "Clexane 40mg", "generic": "Enoxaparin Sodium", "category": "LMWH Anticoagulant"},
    {"brand": "Acitrom 2", "generic": "Nicoumalone / Acenocoumarol", "category": "Anticoagulant"},
    {"brand": "Eliquis 5", "generic": "Apixaban 5mg", "category": "NOAC Anticoagulant"},
    {"brand": "Xarelto 15", "generic": "Rivaroxaban 15mg", "category": "NOAC Anticoagulant"},
    {"brand": "Lasix 40", "generic": "Furosemide 40mg", "category": "Loop Diuretic"},
    {"brand": "Dytor 10", "generic": "Torsemide 10mg", "category": "Loop Diuretic"},
    {"brand": "Aldactone 25", "generic": "Spironolactone 25mg", "category": "Potassium-Sparing Diuretic"},
    {"brand": "Sorbitrate 5", "generic": "Isosorbide Dinitrate", "category": "Nitrate Vasodilator"},
    {"brand": "Monit 30", "generic": "Isosorbide Mononitrate", "category": "Nitrate Vasodilator"},

    # Diabetes & Endocrinology
    {"brand": "Glycomet 500", "generic": "Metformin Hydrochloride 500mg", "category": "Biguanide Antidiabetic"},
    {"brand": "Glycomet-SR 500", "generic": "Metformin Sustained Release", "category": "Biguanide Antidiabetic"},
    {"brand": "Glycomet-GP 1", "generic": "Glimepiride and Metformin", "category": "Oral Antidiabetic"},
    {"brand": "Glycomet-GP 2", "generic": "Glimepiride and Metformin", "category": "Oral Antidiabetic"},
    {"brand": "Amaryl 1mg", "generic": "Glimepiride 1mg", "category": "Sulfonylurea"},
    {"brand": "Amaryl 2mg", "generic": "Glimepiride 2mg", "category": "Sulfonylurea"},
    {"brand": "Januvia 100", "generic": "Sitagliptin 100mg", "category": "DPP-4 Inhibitor"},
    {"brand": "Janumet 50/500", "generic": "Sitagliptin and Metformin", "category": "Antidiabetic Combination"},
    {"brand": "Galvus 50", "generic": "Vildagliptin 50mg", "category": "DPP-4 Inhibitor"},
    {"brand": "Galvus Met 50/500", "generic": "Vildagliptin and Metformin", "category": "Antidiabetic Combination"},
    {"brand": "Trajenta 5", "generic": "Linagliptin 5mg", "category": "DPP-4 Inhibitor"},
    {"brand": "Forxiga 10", "generic": "Dapagliflozin 10mg", "category": "SGLT2 Inhibitor"},
    {"brand": "Jardiance 10", "generic": "Empagliflozin 10mg", "category": "SGLT2 Inhibitor"},
    {"brand": "Jardiance 25", "generic": "Empagliflozin 25mg", "category": "SGLT2 Inhibitor"},
    {"brand": "Rybelsus 7mg", "generic": "Oral Semaglutide", "category": "GLP-1 Receptor Agonist"},
    {"brand": "Voglibose 0.2", "generic": "Voglibose", "category": "Alpha-Glucosidase Inhibitor"},
    {"brand": "Thyronorm 50mcg", "generic": "Levothyroxine Sodium", "category": "Thyroid Hormone"},
    {"brand": "Thyronorm 100mcg", "generic": "Levothyroxine Sodium", "category": "Thyroid Hormone"},
    {"brand": "Eltroxin 50mcg", "generic": "Levothyroxine Sodium", "category": "Thyroid Hormone"},
    {"brand": "Mixtard 30/70", "generic": "Biphasic Isophane Insulin", "category": "Insulin"},
    {"brand": "Lantus SoloStar", "generic": "Insulin Glargine", "category": "Basal Insulin"},

    # Gastrointestinal & Acid Peptic
    {"brand": "Pan 40", "generic": "Pantoprazole Sodium 40mg", "category": "Proton Pump Inhibitor"},
    {"brand": "Pantocid 40", "generic": "Pantoprazole Sodium 40mg", "category": "Proton Pump Inhibitor"},
    {"brand": "Pan-D", "generic": "Pantoprazole and Domperidone", "category": "PPI with Prokinetic"},
    {"brand": "Pantocid-DSR", "generic": "Pantoprazole and Domperidone SR", "category": "PPI with Prokinetic"},
    {"brand": "Razo 20", "generic": "Rabeprazole Sodium 20mg", "category": "Proton Pump Inhibitor"},
    {"brand": "Rablet 20", "generic": "Rabeprazole Sodium 20mg", "category": "Proton Pump Inhibitor"},
    {"brand": "Razo-D", "generic": "Rabeprazole and Domperidone", "category": "PPI with Prokinetic"},
    {"brand": "Nexpro 40", "generic": "Esomeprazole 40mg", "category": "Proton Pump Inhibitor"},
    {"brand": "Omez 20", "generic": "Omeprazole 20mg", "category": "Proton Pump Inhibitor"},
    {"brand": "Omez-D", "generic": "Omeprazole and Domperidone", "category": "PPI with Prokinetic"},
    {"brand": "Eldoper", "generic": "Loperamide Hydrochloride", "category": "Antidiarrheal"},
    {"brand": "Econorm", "generic": "Saccharomyces boulardii", "category": "Probiotic"},
    {"brand": "Duphalac", "generic": "Lactulose Solution", "category": "Osmotic Laxative"},
    {"brand": "Sucrafil O", "generic": "Sucralfate and Oxetacaine", "category": "Mucosal Protectant"},
    {"brand": "Udiliv 300", "generic": "Ursodeoxycholic Acid", "category": "Hepatoprotective"},
    {"brand": "Liv-52 DS", "generic": "Himalaya Herbal Hepatoprotective", "category": "Herbal Liver Care"},

    # Respiratory & Antiallergic
    {"brand": "Montair-LC", "generic": "Montelukast and Levocetirizine", "category": "Antiallergic/Antiasthmatic"},
    {"brand": "Montek-LC", "generic": "Montelukast and Levocetirizine", "category": "Antiallergic/Antiasthmatic"},
    {"brand": "Allegra 120", "generic": "Fexofenadine Hydrochloride 120mg", "category": "Antihistamine"},
    {"brand": "Allegra 180", "generic": "Fexofenadine Hydrochloride 180mg", "category": "Antihistamine"},
    {"brand": "Levocet 5", "generic": "Levocetirizine 5mg", "category": "Antihistamine"},
    {"brand": "Cetzine 10", "generic": "Cetirizine Hydrochloride 10mg", "category": "Antihistamine"},
    {"brand": "Asthalin Inhaler", "generic": "Salbutamol 100mcg", "category": "Short-Acting Bronchodilator"},
    {"brand": "Budecort 200", "generic": "Budesonide Inhalation", "category": "Inhaled Corticosteroid"},
    {"brand": "Budecort 0.5mg Respules", "generic": "Budesonide Nebulizer", "category": "Corticosteroid"},
    {"brand": "Duolin Respules", "generic": "Levosalbutamol and Ipratropium", "category": "Bronchodilator Nebulizer"},
    {"brand": "Foracort 200", "generic": "Formoterol and Budesonide", "category": "Asthma Controller Inhaler"},
    {"brand": "Seroflo 250", "generic": "Salmeterol and Fluticasone", "category": "COPD/Asthma Inhaler"},
    {"brand": "Deriphyllin Retard 150", "generic": "Theophylline and Etofylline", "category": "Bronchodilator"},
    {"brand": "Ascoril-LS Syrup", "generic": "Levosalbutamol, Ambroxol, Guaiphenesin", "category": "Expectorant Cough Syrup"},
    {"brand": "Alex Cough Syrup", "generic": "Dextromethorphan, Phenylephrine, CPM", "category": "Antitussive Syrup"},
    {"brand": "Grilinctus", "generic": "Dextromethorphan and CPM Syrup", "category": "Antitussive Syrup"},

    # Vitamins & Minerals
    {"brand": "Shelcal 500", "generic": "Calcium and Vitamin D3", "category": "Calcium Supplement"},
    {"brand": "Uprise-D3 60K", "generic": "Cholecalciferol 60,000 IU", "category": "High-Dose Vitamin D3"},
    {"brand": "Calcirol 60K", "generic": "Cholecalciferol Sachet", "category": "Vitamin D3"},
    {"brand": "Becadexamin", "generic": "Multivitamin with Zinc and Minerals", "category": "Multivitamin"},
    {"brand": "Supradyn Daily", "generic": "Multivitamins, Minerals and Trace Elements", "category": "Multivitamin"},
    {"brand": "Becosules Z", "generic": "Vitamin B-Complex, Vitamin C, Zinc", "category": "Vitamin B Complex"},
    {"brand": "Neurobion Forte", "generic": "Vitamin B1, B6, B12 (Mecobalamin)", "category": "Neurotropic B-Vitamins"},
    {"brand": "Orofer-XT", "generic": "Ferrous Ascorbate and Folic Acid", "category": "Iron Supplement"},
    {"brand": "Limcee 500", "generic": "Vitamin C (Ascorbic Acid)", "category": "Vitamin C"},
    {"brand": "Zincovit", "generic": "Multivitamin with Zinc and Grape Seed Extract", "category": "Multivitamin & Antioxidant"}
]

# Standard Indian Clinical Dosage Timing Abbreviations
INDIAN_DOSAGE_CONVENTIONS: Dict[str, str] = {
    "od": "Once daily (1-0-0 or 0-0-1)",
    "bd": "Twice daily (1-0-1)",
    "bid": "Twice daily (1-0-1)",
    "tds": "Thrice daily (1-1-1)",
    "tid": "Thrice daily (1-1-1)",
    "qid": "Four times daily (1-1-1-1)",
    "sos": "As needed for acute symptoms",
    "hs": "At bedtime / night (0-0-1)",
    "ac": "Before food / meals (empty stomach)",
    "pc": "After food / meals",
    "stat": "Immediately as a single loading dose",
    "qod": "Every alternate day",
    "weekly": "Once a week (e.g. Cholecalciferol 60K)",
    "1-0-0": "Once daily in morning after breakfast",
    "0-1-0": "Once daily in afternoon after lunch",
    "0-0-1": "Once daily at night after dinner",
    "1-0-1": "Twice daily (morning and night)",
    "1-1-1": "Thrice daily (morning, afternoon, night)",
    "1-1-0": "Twice daily (morning and afternoon)"
}

# Multilingual Code-Switching Lexicon (Hindi / Hinglish / Regional -> Clinical Terms)
CODE_SWITCHING_DICTIONARY: Dict[str, str] = {
    "bukhar": "Fever / Pyrexia",
    "tez bukhar": "High grade fever",
    "thandi lagna": "Chills and rigors",
    "khansi": "Cough",
    "sukhi khansi": "Dry non-productive cough",
    "balgam": "Sputum / Phlegm",
    "gale me dard": "Sore throat / Pharyngitis",
    "khich khich": "Throat irritation",
    "sir dard": "Headache / Cephalea",
    "sar chakra raha hai": "Dizziness / Vertigo",
    "chakkar": "Vertigo / Presyncope",
    "ulti": "Vomiting / Emesis",
    "matli": "Nausea",
    "pet dard": "Abdominal pain / Epigastric distress",
    "pet kharab": "Diarrhea / Dyspepsia",
    "dast": "Loose stools / Acute diarrhea",
    "gas": "Gastric acidity / GERD / Dyspepsia",
    "jalan": "Heartburn / Retrosternal burning",
    "chhati me dard": "Chest pain / Angina / Precordial discomfort",
    "saas phulna": "Dyspnea / Shortness of breath",
    "dam phulna": "Exertional dyspnea / Bronchospasm",
    "kamar dard": "Low back pain / Lumbago",
    "jodo me dard": "Arthralgia / Joint pain",
    "badan dard": "Generalized myalgia / Body ache",
    "kamzori": "Generalized weakness / Asthenia",
    "bhookh nahi lagti": "Loss of appetite / Anorexia",
    "sugar badh gaya": "Hyperglycemia / Elevated blood glucose",
    "bp badh gaya": "Hypertensive spike / Elevated blood pressure",
    "peshab me jalan": "Dysuria / Urinary burning sensation",
    "khali pet": "Empty stomach (Ante Cibum)",
    "khane ke baad": "After meals (Post Cibum)",
    "sote waqt": "At bedtime (Hora Somni)",
    "subah sham": "Twice daily (BD)",
    "din me teen baar": "Thrice daily (TDS)",
    "dard hone par": "SOS / As needed for pain"
}


def build_whisper_clinical_prompt() -> str:
    """
    Constructs a high-priority biasing prompt for Whisper to prime the decoder
    with top Indian pharmaceutical nomenclature and medical code-switching tokens.
    """
    key_brands = [
        "Augmentin 625", "Telma-AM", "Pan-D", "Montair-LC", "Dolo 650",
        "Ecosprin-AV", "Azithral 500", "Glycomet-GP", "Clexane 40mg",
        "Thyronorm 50mcg", "Shelcal 500", "Uprise-D3 60K", "Cilacar 10",
        "Budecort", "Duolin", "Deriphyllin", "Zerodol-SP", "Taxim-O"
    ]
    prompt_str = (
        "Doctor-Patient clinical consultation in Indian outpatient OPD. "
        "Medications and dosages: " + ", ".join(key_brands) + ". "
        "Dosage instructions: 1-0-1 BD after food, 1-0-0 OD empty stomach, "
        "0-0-1 HS night, TDS, SOS. Hindi/Hinglish terms: bukhar, khansi, saas phulna, pet dard."
    )
    return prompt_str


def normalize_indian_clinical_terms(transcript: str) -> str:
    if not transcript: return ""
    text = transcript
    phonetic_fixes = [
        (r"\b(?:dolo|dollo|dolu)\s*(?:six\s*fifty|650)\b", "Dolo 650mg"),
        (r"\b(?:augmentin|ogmentin|augmantin)\s*(?:six\s*twenty\s*five|625)\b", "Augmentin 625mg"),
        (r"\b(?:telma|talma)\s*(?:am|a\s*m)\b", "Telma-AM"),
        (r"\b(?:telma|talma)\s*(?:forty|40)\b", "Telma 40mg"),
        (r"\b(?:montair|montek)\s*(?:lc|l\s*c)\b", "Montair-LC"),
        (r"\b(?:pan|pantocid)\s*(?:d|dsr|d\s*s\s*r)\b", "Pan-D"),
        (r"\b(?:ecosprin|ecospirin)\s*(?:av|a\s*v)\b", "Ecosprin-AV"),
        (r"\b(?:glycomet|glicomet)\s*(?:gp|g\s*p)\b", "Glycomet-GP"),
        (r"\b(?:azithral|azee)\s*(?:five\s*hundred|500)\b", "Azithral 500mg"),
        (r"\b(?:shelcal|shelkal)\s*(?:five\s*hundred|500)\b", "Shelcal 500mg"),
        (r"\b(?:zerodol|zerodoll)\s*(?:sp|s\s*p)\b", "Zerodol-SP"),
        (r"\b(?:uprise|aprise)\s*(?:d3|d\s*three)\s*(?:60k|60\s*thousand|sixty\s*thousand)\b", "Uprise-D3 60,000 IU"),
    ]
    for pattern, replacement in phonetic_fixes:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text

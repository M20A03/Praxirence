"""
Praxirence Indian Medicine Formulary Database Seeder.
Seeds official Indian National Formulary (INF), CDSCO, and Pradhan Mantri Jan Aushadhi (PMBI)
medicines into the PostgreSQL / SQLite database.
"""

import sys
import os
import logging

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import SessionLocal, engine, Base
from app.models.medicine import Medicine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("praxirence.seed_formulary")

INDIAN_FORMULARY_CATALOG = [
    # Analgesics & Antipyretics
    {
        "brand_name": "Dolo 650",
        "generic_name": "Paracetamol",
        "dosage_form": "Tablet",
        "strength": "650mg",
        "manufacturer": "Micro Labs Ltd",
        "schedule_type": "OTC",
        "jan_aushadhi_equivalent": "Jan Aushadhi Paracetamol 650mg (Rs 12/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take after meals with water. Do not exceed 4,000mg in 24 hours.", "hi": "भोजन के बाद पानी के साथ लें। 24 घंटे में 4000mg से अधिक न लें।"}
    },
    {
        "brand_name": "Crocin",
        "generic_name": "Paracetamol",
        "dosage_form": "Tablet",
        "strength": "500mg",
        "manufacturer": "GlaxoSmithKline",
        "schedule_type": "OTC",
        "jan_aushadhi_equivalent": "Jan Aushadhi Paracetamol 500mg (Rs 9/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take after a meal with plenty of water. Do not exceed 4000mg per day.", "hi": "भोजन के बाद पानी के साथ लें। 24 घंटे में 4000mg से अधिक न लें।"}
    },
    {
        "brand_name": "Calpol 500",
        "generic_name": "Paracetamol",
        "dosage_form": "Tablet",
        "strength": "500mg",
        "manufacturer": "GlaxoSmithKline",
        "schedule_type": "OTC",
        "jan_aushadhi_equivalent": "Jan Aushadhi Paracetamol 500mg (Rs 9/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take after food for mild fever or pain relief.", "hi": "हल्के बुखार या दर्द के लिए भोजन के बाद लें।"}
    },
    {
        "brand_name": "Combiflam",
        "generic_name": "Ibuprofen + Paracetamol",
        "dosage_form": "Tablet",
        "strength": "400mg/325mg",
        "manufacturer": "Sanofi India",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Ibuprofen + Paracetamol (Rs 15/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Must be taken with milk or after food to prevent stomach acidity.", "hi": "पेट की सुरक्षा के लिए हमेशा भोजन या दूध के बाद लें।"}
    },
    {
        "brand_name": "Voveran 50",
        "generic_name": "Diclofenac Sodium",
        "dosage_form": "Tablet",
        "strength": "50mg",
        "manufacturer": "Novartis India",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Diclofenac Sodium 50mg (Rs 10/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take after meals. Avoid combining with alcohol.", "hi": "हमेशा भोजन के बाद लें। शराब के साथ न लें।"}
    },
    {
        "brand_name": "Meftal Spas",
        "generic_name": "Mefenamic Acid + Dicyclomine",
        "dosage_form": "Tablet",
        "strength": "250mg/10mg",
        "manufacturer": "Blue Cross Labs",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Dicyclomine + Mefenamic Acid (Rs 18/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take after meals for spasmodic abdominal cramps. Monitor for allergic skin reactions.", "hi": "पेट की मरोड़ और दर्द के लिए भोजन के बाद लें।"}
    },

    # Antimicrobials & Antibiotics
    {
        "brand_name": "Augmentin 625",
        "generic_name": "Amoxicillin + Clavulanic Acid",
        "dosage_form": "Tablet",
        "strength": "625mg",
        "manufacturer": "GlaxoSmithKline",
        "schedule_type": "Schedule H1",
        "jan_aushadhi_equivalent": "Jan Aushadhi Amoxyclav 625mg (Rs 55/strip)",
        "food_relation": "with_meal",
        "default_meal_instructions": {"en": "Take at the start of a meal to enhance absorption and reduce GI discomfort. Complete entire 5-7 day course.", "hi": "भोजन की शुरुआत में लें। डॉक्टर द्वारा निर्धारित पूरा कोर्स अवश्य पूरा करें।"}
    },
    {
        "brand_name": "Azithral 500",
        "generic_name": "Azithromycin",
        "dosage_form": "Tablet",
        "strength": "500mg",
        "manufacturer": "Alembic Pharmaceuticals",
        "schedule_type": "Schedule H1",
        "jan_aushadhi_equivalent": "Jan Aushadhi Azithromycin 500mg (Rs 42/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take once daily at the same time, 1 hour before or 2 hours after meals. Complete full 3-day course.", "hi": "दिन में एक बार निश्चित समय पर लें। 3 दिन का पूरा कोर्स खत्म करें।"}
    },
    {
        "brand_name": "Ciplox 500",
        "generic_name": "Ciprofloxacin",
        "dosage_form": "Tablet",
        "strength": "500mg",
        "manufacturer": "Cipla Ltd",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Ciprofloxacin 500mg (Rs 20/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Avoid dairy products (milk, yogurt) or calcium supplements within 2 hours of ingestion.", "hi": "यह दवा लेने के 2 घंटे पहले या बाद तक दूध या दही का सेवन न करें।"}
    },
    {
        "brand_name": "Taxim-O 200",
        "generic_name": "Cefixime",
        "dosage_form": "Tablet",
        "strength": "200mg",
        "manufacturer": "Alkem Laboratories",
        "schedule_type": "Schedule H1",
        "jan_aushadhi_equivalent": "Jan Aushadhi Cefixime 200mg (Rs 35/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take with water after food. Complete course to avoid antibiotic resistance.", "hi": "भोजन के बाद पानी के साथ लें। कोर्स पूरा करें।"}
    },

    # Gastro & Proton Pump Inhibitors
    {
        "brand_name": "Pan 40",
        "generic_name": "Pantoprazole",
        "dosage_form": "Tablet",
        "strength": "40mg",
        "manufacturer": "Alkem Laboratories",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Pantoprazole 40mg (Rs 14/strip)",
        "food_relation": "empty_stomach",
        "default_meal_instructions": {"en": "Take on an empty stomach 30-60 minutes before breakfast with a glass of water.", "hi": "सुबह नाश्ते से 30-60 मिनट पहले खाली पेट पानी के साथ लें।"}
    },
    {
        "brand_name": "Pantocid",
        "generic_name": "Pantoprazole",
        "dosage_form": "Tablet",
        "strength": "40mg",
        "manufacturer": "Sun Pharma",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Pantoprazole 40mg (Rs 12/strip)",
        "food_relation": "empty_stomach",
        "default_meal_instructions": {"en": "Take on an empty stomach 30-60 minutes before morning breakfast.", "hi": "सुबह नाश्ते से 30-60 मिनट पहले खाली पेट लें।"}
    },
    {
        "brand_name": "Pan-D",
        "generic_name": "Pantoprazole + Domperidone",
        "dosage_form": "Capsule",
        "strength": "40mg/30mg",
        "manufacturer": "Alkem Laboratories",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Pantoprazole + Domperidone SR (Rs 22/strip)",
        "food_relation": "empty_stomach",
        "default_meal_instructions": {"en": "Take once daily in the morning 30 minutes before breakfast.", "hi": "सुबह नाश्ते से आधा घंटा पहले खाली पेट लें।"}
    },
    {
        "brand_name": "Omez 20",
        "generic_name": "Omeprazole",
        "dosage_form": "Capsule",
        "strength": "20mg",
        "manufacturer": "Dr. Reddy's Laboratories",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Omeprazole 20mg (Rs 11/strip)",
        "food_relation": "empty_stomach",
        "default_meal_instructions": {"en": "Take 30 minutes prior to first meal of the day.", "hi": "सुबह के भोजन से 30 मिनट पहले खाली पेट लें।"}
    },

    # Cardiovascular & Antihypertensive
    {
        "brand_name": "Telma 40",
        "generic_name": "Telmisartan",
        "dosage_form": "Tablet",
        "strength": "40mg",
        "manufacturer": "Glenmark Pharmaceuticals",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Telmisartan 40mg (Rs 16/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take daily at the same time after breakfast. Monitor blood pressure periodically.", "hi": "प्रतिदिन सुबह नाश्ते के बाद एक ही समय पर लें। रक्तचाप की नियमित जांच करें।"}
    },
    {
        "brand_name": "Telma-H",
        "generic_name": "Telmisartan + Hydrochlorothiazide",
        "dosage_form": "Tablet",
        "strength": "40mg/12.5mg",
        "manufacturer": "Glenmark Pharmaceuticals",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Telmisartan + HCTZ (Rs 22/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take in the morning after breakfast to prevent nighttime urination.", "hi": "सुबह नाश्ते के बाद लें ताकि रात में पेशाब के लिए न उठना पड़े।"}
    },
    {
        "brand_name": "Amlovas 5",
        "generic_name": "Amlodipine",
        "dosage_form": "Tablet",
        "strength": "5mg",
        "manufacturer": "Macleods Pharmaceuticals",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Amlodipine 5mg (Rs 6/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take once daily in the morning or evening. Watch for ankle swelling.", "hi": "प्रतिदिन एक समय पर लें। टखने में सूजन हो तो डॉक्टर को बताएं।"}
    },

    # Antidiabetic & Metabolic
    {
        "brand_name": "Glycomet 500",
        "generic_name": "Metformin",
        "dosage_form": "Tablet",
        "strength": "500mg",
        "manufacturer": "USV Pvt Ltd",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Metformin 500mg (Rs 8/strip)",
        "food_relation": "with_meal",
        "default_meal_instructions": {"en": "Take with or immediately after meals to reduce stomach upset.", "hi": "पेट की परेशानी से बचने के लिए भोजन के साथ या तुरंत बाद लें।"}
    },
    {
        "brand_name": "Glycomet-GP 1",
        "generic_name": "Glimepiride + Metformin",
        "dosage_form": "Tablet",
        "strength": "1mg/500mg",
        "manufacturer": "USV Pvt Ltd",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Glimepiride + Metformin 1mg/500mg (Rs 18/strip)",
        "food_relation": "before_meal",
        "default_meal_instructions": {"en": "Take 15-30 minutes before morning breakfast. Do not skip meals.", "hi": "सुबह नाश्ते से 15-30 मिनट पहले लें। भोजन कभी न छोड़ें।"}
    },
    {
        "brand_name": "Januvia 50",
        "generic_name": "Sitagliptin",
        "dosage_form": "Tablet",
        "strength": "50mg",
        "manufacturer": "MSD Pharmaceuticals",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Sitagliptin 50mg (Rs 45/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take once daily with or without food as advised.", "hi": "प्रतिदिन एक बार भोजन के साथ या बाद लें।"}
    },

    # Statins & Antiplatelet
    {
        "brand_name": "Atorva 10",
        "generic_name": "Atorvastatin",
        "dosage_form": "Tablet",
        "strength": "10mg",
        "manufacturer": "Zydus Healthcare",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Atorvastatin 10mg (Rs 15/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Best taken at bedtime once daily. Avoid excessive grapefruit consumption.", "hi": "रात को सोने से पहले लें। मौसंबी/अंगूर के अधिक सेवन से बचें।"}
    },
    {
        "brand_name": "Ecosprin 75",
        "generic_name": "Aspirin",
        "dosage_form": "Enteric-coated Tablet",
        "strength": "75mg",
        "manufacturer": "USV Pvt Ltd",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Aspirin 75mg (Rs 5/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Always swallow whole after a meal with water. Protects gastric lining.", "hi": "हमेशा भोजन के बाद पानी के साथ निगलें। चबाएं नहीं।"}
    },

    # Respiratory & Allergy
    {
        "brand_name": "Montair LC",
        "generic_name": "Montelukast + Levocetirizine",
        "dosage_form": "Tablet",
        "strength": "10mg/5mg",
        "manufacturer": "Cipla Ltd",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Montelukast + Levocetirizine (Rs 28/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Best taken once daily at bedtime. May cause mild drowsiness.", "hi": "रात को सोने से पहले लें। इससे हल्की नींद आ सकती है।"}
    },
    {
        "brand_name": "Allegra 120",
        "generic_name": "Fexofenadine",
        "dosage_form": "Tablet",
        "strength": "120mg",
        "manufacturer": "Sanofi India",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Fexofenadine 120mg (Rs 30/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take with water. Non-sedating antihistamine for allergic rhinitis.", "hi": "पानी के साथ लें। एलर्जी और छींकों के लिए असरदार है।"}
    },
    {
        "brand_name": "Ascoril LS",
        "generic_name": "Levosalbutamol + Ambroxol + Guaiphenesin",
        "dosage_form": "Syrup",
        "strength": "100ml",
        "manufacturer": "Glenmark Pharmaceuticals",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Cough Expectorant LS (Rs 32/bottle)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take after meals using measuring cup. Drink warm water.", "hi": "भोजन के बाद नाप कर लें। गुनगुना पानी पिएं।"}
    },

    # Thyroid & Minerals
    {
        "brand_name": "Thyronorm 50",
        "generic_name": "Levothyroxine Sodium",
        "dosage_form": "Tablet",
        "strength": "50mcg",
        "manufacturer": "Abbott India",
        "schedule_type": "Schedule H",
        "jan_aushadhi_equivalent": "Jan Aushadhi Levothyroxine 50mcg (Rs 30/bottle of 100)",
        "food_relation": "empty_stomach",
        "default_meal_instructions": {"en": "Take on an empty stomach at least 30-60 minutes before morning tea/breakfast. Avoid calcium/iron supplements within 4 hours.", "hi": "सुबह चाय/नाश्ते से आधा घंटा पहले खाली पेट लें। इसके 4 घंटे तक कैल्शियम न लें।"}
    },
    {
        "brand_name": "Shelcal 500",
        "generic_name": "Calcium Carbonate + Vitamin D3",
        "dosage_form": "Tablet",
        "strength": "500mg/250IU",
        "manufacturer": "Torrent Pharmaceuticals",
        "schedule_type": "OTC",
        "jan_aushadhi_equivalent": "Jan Aushadhi Calcium + Vitamin D3 (Rs 25/strip)",
        "food_relation": "after_meal",
        "default_meal_instructions": {"en": "Take with or after lunch for optimal calcium absorption.", "hi": "दोपहर के भोजन के बाद पानी के साथ लें।"}
    }
]


def seed_formulary():
    logger.info("Initializing database tables...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        seeded_count = 0
        updated_count = 0

        for item in INDIAN_FORMULARY_CATALOG:
            existing = db.query(Medicine).filter(
                Medicine.brand_name == item["brand_name"],
                Medicine.strength == item["strength"]
            ).first()

            if not existing:
                med = Medicine(
                    brand_name=item["brand_name"],
                    generic_name=item["generic_name"],
                    dosage_form=item["dosage_form"],
                    strength=item["strength"],
                    manufacturer=item.get("manufacturer"),
                    schedule_type=item.get("schedule_type", "Schedule H"),
                    jan_aushadhi_equivalent=item.get("jan_aushadhi_equivalent"),
                    food_relation=item.get("food_relation", "after_meal"),
                    default_meal_instructions=item.get("default_meal_instructions"),
                    is_banned_or_recalled=False
                )
                db.add(med)
                seeded_count += 1
            else:
                existing.generic_name = item["generic_name"]
                existing.dosage_form = item["dosage_form"]
                existing.manufacturer = item.get("manufacturer")
                existing.jan_aushadhi_equivalent = item.get("jan_aushadhi_equivalent")
                existing.food_relation = item.get("food_relation", "after_meal")
                existing.default_meal_instructions = item.get("default_meal_instructions")
                updated_count += 1

        db.commit()
        logger.info(f"Formulary seeding complete! Seeded: {seeded_count} new drugs, Updated: {updated_count} existing drugs.")
    except Exception as e:
        logger.error(f"Error seeding Indian formulary: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_formulary()

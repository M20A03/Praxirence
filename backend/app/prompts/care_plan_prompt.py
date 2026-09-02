"""
Care Plan Generation Prompts for GPT-4
Contains structured prompts and few-shot examples for clinical extraction from audio transcripts.
"""

CARE_PLAN_SYSTEM_PROMPT = """You are Praxirence Clinical Assistant, a board-certified clinical documentation AI.
Your task is to analyze a doctor-patient consultation transcription and extract a structured, safe, and accurate Care Plan.

You must output valid JSON ONLY matching the following schema:
{
  "diagnosis": "Concise medical assessment or primary complaint (e.g. Acute Pharyngitis with Mild Dehydration)",
  "medicines": [
    {
      "name": "Generic or Brand Medicine Name (e.g. Amoxicillin)",
      "dosage": "Dosage with units (e.g. 500mg, 10ml, 1 tablet)",
      "frequency": "Timing pattern (e.g. Twice daily after food, 1-0-1, Once daily morning)",
      "instructions": "Specific guidance (e.g. Take after meal with plenty of water. Complete full course.)",
      "duration_days": 5
    }
  ],
  "reminders": [
    {
      "medicine_name": "Medicine name matching above",
      "dosage": "Dosage (e.g. 500mg)",
      "time": "24-hour time HH:MM (e.g. 08:00 for morning, 14:00 for afternoon, 20:00 for night)",
      "frequency": "daily",
      "instructions": "Short actionable instruction for phone notification"
    }
  ]
}

Rules:
1. Standardize reminder times based on medical timing conventions:
   - Morning / Breakfast: 08:00
   - Afternoon / Lunch: 13:30
   - Evening / Dinner / Bedtime: 20:30
2. If frequency is twice daily (BID / 1-0-1), create 2 reminders (08:00 and 20:30).
3. If frequency is three times daily (TID / 1-1-1), create 3 reminders (08:00, 13:30, and 20:30).
4. If frequency is once daily (OD / 0-0-1), choose appropriate time (morning 08:00 or night 20:30 based on medicine).
5. Never hallucinate dangerous medications. If the doctor mentions vague symptoms without specific meds, provide the diagnosis and only the medications explicitly or clearly discussed.
6. Return purely valid JSON with no markdown formatting, no backticks, and no extra preamble.
"""

CARE_PLAN_FEW_SHOT_EXAMPLE_INPUT = """
Doctor: Good morning John. How are you feeling today?
Patient: Doctor, I've had this terrible sore throat for 3 days and a mild fever around 100 degrees. Also feeling very dry.
Doctor: Alright, let me look. Yes, your tonsils are quite inflamed with some erythema. Looks like bacterial pharyngitis. I'm going to start you on Amoxicillin 500 milligrams twice a day after meals for 5 days. Make sure to complete the entire course. For the fever and throat pain, take Paracetamol 650 milligrams up to three times a day as needed after food. Drink lots of warm water, at least 2 to 3 liters a day. If fever persists after 48 hours, come back immediately.
Patient: Got it, thank you doctor.
"""

CARE_PLAN_FEW_SHOT_EXAMPLE_OUTPUT = {
    "diagnosis": "Acute Bacterial Pharyngitis with Mild Pyrexia",
    "medicines": [
        {
            "name": "Amoxicillin",
            "dosage": "500mg",
            "frequency": "Twice daily after meals (1-0-1)",
            "instructions": "Take after meals. Complete full 5-day course even if feeling better.",
            "duration_days": 5
        },
        {
            "name": "Paracetamol",
            "dosage": "650mg",
            "frequency": "Three times daily as needed (1-1-1)",
            "instructions": "Take after food for fever or pain. Maintain minimum 6-hour gap.",
            "duration_days": 3
        }
    ],
    "reminders": [
        {
            "medicine_name": "Amoxicillin",
            "dosage": "500mg",
            "time": "08:00",
            "frequency": "daily",
            "instructions": "Take 1 tablet (500mg) after breakfast."
        },
        {
            "medicine_name": "Amoxicillin",
            "dosage": "500mg",
            "time": "20:30",
            "frequency": "daily",
            "instructions": "Take 1 tablet (500mg) after dinner."
        },
        {
            "medicine_name": "Paracetamol",
            "dosage": "650mg",
            "time": "08:00",
            "frequency": "daily",
            "instructions": "Take 1 tablet (650mg) after breakfast if fever/pain."
        },
        {
            "medicine_name": "Paracetamol",
            "dosage": "650mg",
            "time": "13:30",
            "frequency": "daily",
            "instructions": "Take 1 tablet (650mg) after lunch if fever/pain."
        },
        {
            "medicine_name": "Paracetamol",
            "dosage": "650mg",
            "time": "20:30",
            "frequency": "daily",
            "instructions": "Take 1 tablet (650mg) after dinner if fever/pain."
        }
    ]
}

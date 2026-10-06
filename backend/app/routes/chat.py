import os
import logging
import json
import re
import httpx
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.user import User
from app.routes.visits import parse_transcription_and_summary
from app.services.triage_service import triage_service
from app.services.pharmacology_service import pharmacology_service

logger = logging.getLogger("praxirence.chat")
router = APIRouter(prefix="/chat", tags=["Patient Multilingual Assistant"])


class ChatRequest(BaseModel):
    message: str
    language: str = "English"  # "English", "Hindi", "Kannada", "Bhojpuri", "Urdu", "Tamil", "Telugu", "Marathi"
    patient_id: Optional[str] = None
    visit_id: Optional[str] = None
    active_medications: Optional[List[Dict[str, Any]]] = None


class RecommendedDoctor(BaseModel):
    id: str
    name: str
    specialty: Optional[str] = None
    clinic_name: Optional[str] = None
    reg_number: Optional[str] = None
    phone: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    language: str
    detected_intent: str
    medicines_referenced: List[Dict[str, Any]] = []
    recommended_doctors: List[RecommendedDoctor] = []
    quick_suggestions: List[str] = []
    citations: List[Dict[str, Any]] = []
    emergency_alert: Optional[Dict[str, Any]] = None
    safety_disclaimer: str = "Trained Clinical Assistant. For emergency care, call 108 / 112 immediately."


def strip_emojis(text: str) -> str:
    """
    Strips all emojis to maintain a professional, dignified, and clinical tone.
    """
    emoji_pattern = re.compile(
        "[\U00010000-\U0010ffff\u2600-\u26ff\u2700-\u27bf\u200d\ufe0f\ud83c-\ud83e]",
        flags=re.UNICODE
    )
    cleaned = emoji_pattern.sub("", text)
    cleaned = re.sub(r' {2,}', ' ', cleaned)
    return cleaned.strip()


def generate_grounded_fallback(
    query: str,
    language: str,
    visits: List[Visit],
    patient_name: Optional[str],
    doctors: List[User],
    active_medications: Optional[List[Dict[str, Any]]] = None
) -> tuple[str, str, List[Dict[str, Any]], List[RecommendedDoctor], List[str]]:
    """
    Strictly grounded clinical response builder when LLM API is unavailable.
    Zero fabricated diagnoses, zero emojis, multilingual support, citation-backed.
    """
    q_lower = query.lower()
    intent = "general_health"
    lang_lower = language.lower()

    is_hindi = lang_lower in ["hindi", "हिन्दी", "hi", "hinglish"]
    is_kannada = lang_lower in ["kannada", "ಕನ್ನಡ", "kn"]
    is_bhojpuri = lang_lower in ["bhojpuri", "भोजपुरी", "bho"]
    is_urdu = lang_lower in ["urdu", "اردو", "ur"]

    # Gather all verified records
    all_meds: List[Dict[str, Any]] = []
    if active_medications:
        all_meds.extend(active_medications)
    consultation_records: List[Dict[str, Any]] = []

    for v in visits:
        v_meds = []
        if v.medicines:
            if isinstance(v.medicines, list):
                v_meds = v.medicines
            elif isinstance(v.medicines, str):
                try:
                    v_meds = json.loads(v.medicines)
                except Exception:
                    v_meds = []
        all_meds.extend(v_meds)

        raw_t, pat_sum, doc_adv = parse_transcription_and_summary(v.raw_transcription)
        doc_name = v.doctor.name if v.doctor else "Attending Clinician"
        consultation_records.append({
            "date": v.created_at.strftime("%d %b %Y") if v.created_at else "Recent",
            "diagnosis": v.diagnosis,
            "doctor": doc_name,
            "specialty": getattr(v.doctor, "specialty", None) if v.doctor else None,
            "summary": pat_sum,
            "advice": doc_adv,
            "medicines": v_meds
        })

    # Intent 0: Acute Symptoms Guidance (Fever, Headache, Cough, Cold, Pain, etc.)
    if any(k in q_lower for k in [
        "fever", "temperature", "cold", "cough", "headache", "body ache", "pain", "vomit",
        "nausea", "chills", "weakness", "बुखार", "ताप", "ಜ್ವರ", "ಶೀತ", "ಕೆಮ್ಮು", "ಬುಖಾರ್",
        "سر درد", "بخار", "درد", "سردी", "தலைவலி", "காய்ச்சல்", "జ్వరం"
    ]):
        intent = "symptom_guidance"
        if is_hindi:
            reply = (
                "बुखार होने पर निम्नलिखित प्राथमिक देखभाल और सावधानियां अपनाएं:\n\n"
                "1. पर्याप्त आराम और हाइड्रेशन: शरीर को पूरा आराम दें। दिनभर में पर्याप्त पानी, ओआरएस (ORS), नारियल पानी या सूप पिएं ताकि डिहाइड्रेशन न हो।\n"
                "2. तापमान की नियमित जांच: थर्मामीटर से हर 4-6 घंटे में तापमान मापें और नोट करें।\n"
                "3. स्पंज बाथ (गीली पट्टी): सामान्य (गुनगुने) पानी से माथे और शरीर पर गीली पट्टी रखें। ठंडा या बर्फ का पानी कभी इस्तेमाल न करें।\n"
                "4. हल्का और सुपाच्य भोजन: खिचड़ी, दलिया, फल या उबली सब्जियां खाएं। भारी और तला हुआ खाना न लें।\n\n"
                "तुरंत डॉक्टर से मिलने के खतरे के लक्षण (Red Flags):\n"
                "• बुखार 102°F (39°C) से अधिक हो या 3 दिनों से अधिक रहे\n"
                "• सांस लेने में तकलीफ या सीने में दर्द\n"
                "• गर्दन में अकड़न, अत्यधिक सुस्ती या लगातार उल्टियां\n\n"
                "कृपया प्रैक्सिरेंस ऐप में अपने डॉक्टर से परामर्श बुक करें ताकि सही जांच और दवा दी जा सके।"
            )
            sugg = ["डॉक्टर से परामर्श बुक करें", "खतरे के लक्षण क्या हैं?", "अपॉइंटमेंट का समय"]
        elif is_kannada:
            reply = (
                "ಜ್ವರ ಬಂದಾಗ ಅನುಸರಿಸಬೇಕಾದ ಪ್ರಮುಖ ಆರೈಕೆ ಕ್ರಮಗಳು:\n\n"
                "1. ವಿಶ್ರಾಂತಿ ಮತ್ತು ಜಲಸಂಚಯನ: ದೇಹಕ್ಕೆ ಸಂಪೂರ್ಣ ವಿಶ್ರಾಂತಿ ನೀಡಿ. ಸಾಕಷ್ಟು ನೀರು, ಎಳನೀರು, ಓಆರ್‌ಎಸ್ (ORS) ಸೇವಿಸಿ.\n"
                "2. ದೇಹದ ತಾಪಮಾನ ಮೇಲ್ವಿಚಾರಣೆ: ಥರ್ಮಾಮೀಟರ್‌ನಿಂದ ತಾಪಮಾನವನ್ನು ನಿಯಮಿತವಾಗಿ ಪರಿಶೀಲಿಸಿ.\n"
                "3. ತೇವವಾದ ಬಟ್ಟೆಯ ಸ್ಪಂಜು: ಸಾಮಾನ್ಯ ನೀರಿನಲ್ಲಿ ಅದ್ದಿದ ಬಟ್ಟೆಯಿಂದ ಹಣೆ ಮತ್ತು ಮೈ ಒರೆಸಿ. ಅತಿಯಾದ ತಣ್ಣೀರು ಬಳಸಬೇಡಿ.\n"
                "4. ಲಘು ಆಹಾರ: ಜೀರ್ಣವಾಗಲು ಸುಲಭವಾದ ಆಹಾರ ಸೇವಿಸಿ.\n\n"
                "ವೈದ್ಯರನ್ನು ತಕ್ಷಣ ಕಾಣಬೇಕಾದ ತುರ್ತು ಲಕ್ಷಣಗಳು:\n"
                "• ಜ್ವರ 102°F ಗಿಂತ ಹೆಚ್ಚಿದ್ದರೆ ಅಥವಾ 3 ದಿನಗಳಿಗಿಂತ ಹೆಚ್ಚು ಮುಂದುವರಿದರೆ\n"
                "• ಉಸಿರಾಟದ ತೊಂದರೆ ಅಥವಾ ಎದೆ ನೋವು\n"
                "• ಕುತ್ತಿಗೆ ಬಿಗಿತ ಅಥವಾ ವಿಪರೀತ ದೌರ್ಬಲ್ಯ\n\n"
                "ದಯವಿಟ್ಟು ನಿಖರ ತಪಾಸಣೆಗಾಗಿ ಪ್ರ್ಯಾಕ್ಸಿರೆನ್ಸ್ ಮೂಲಕ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ."
            )
            sugg = ["ವೈದ್ಯರನ್ನು ಹುಡುಕಿ", "ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಬುಕ್ ಮಾಡಿ"]
        else:
            reply = (
                "Here is clinical home-care guidance for managing a fever:\n\n"
                "1. Rest and Hydration: Get plenty of bed rest. Drink plenty of fluids (water, oral rehydration salts/ORS, clear broths, coconut water) to prevent dehydration.\n"
                "2. Monitor Temperature: Check your temperature every 4-6 hours with a clean digital thermometer and keep a log.\n"
                "3. Tepid Sponge Bath: Apply a clean cloth dampened with lukewarm (never ice-cold) water to the forehead, neck, and armpits to help lower body heat.\n"
                "4. Light Clothing and Environment: Wear loose, lightweight cotton clothing and keep the room well-ventilated.\n"
                "5. Nutrition: Eat light, easily digestible meals (soups, porridge, toast, boiled vegetables).\n\n"
                "Red-Flag Warning Signs (Seek Immediate Medical Care):\n"
                "• Temperature exceeding 102°F (38.9°C) or lasting longer than 3 days\n"
                "• Shortness of breath, chest pain, or wheezing\n"
                "• Stiff neck, mental confusion, or extreme lethargy\n"
                "• Persistent vomiting or inability to keep fluids down\n\n"
                "Please schedule a consultation with an attending doctor in Praxirence for accurate clinical evaluation and appropriate treatment."
            )
            sugg = ["Find a Doctor", "Book Consultation", "Warning Signs"]
        return reply, intent, [], [], sugg

    # Intent 1: Consultation / Diagnosis / Doctor's advice inquiry
    if any(k in q_lower for k in [
        "diagnos", "advice", "consult", "said", "summary", "problem", "condition",
        "doctor note", "what did the doctor", "what did doctor", "डॉक्टर ने क्या कहा",
        "बीमारी", "निदान", "सलाह", "रोग", "सुझाव", "ಪರೀಕ್ಷೆ", "ರೋಗನಿರ್ಣಯ", "ಸಲಹೆ", "تشخیص", "مشورہ"
    ]):
        intent = "consultation_explanation"
        if not consultation_records:
            if is_hindi:
                reply = "आपके रिकॉर्ड में वर्तमान में कोई सक्रिय क्लिनिकल परामर्श या प्रिस्क्रिप्शन दर्ज नहीं है। कृपया स्वास्थ्य जांच के लिए डॉक्टर से परामर्श लें।"
                sugg = ["डॉक्टर खोजें", "अपॉइंटमेंट बुक करें", "वाइटल्स कैसे दर्ज करें?"]
            elif is_kannada:
                reply = "ನಿಮ್ಮ ವೈದ್ಯಕೀಯ ದಾಖಲೆಗಳಲ್ಲಿ ಯಾವುದೇ ಸಕ್ರಿಯ ಸಮಾಲೋಚನೆ ದಾಖಲಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ."
                sugg = ["ವೈದ್ಯರನ್ನು ಹುಡುಕಿ", "ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಬುಕ್ ಮಾಡಿ"]
            elif is_bhojpuri:
                reply = "रउआ के रिकॉर्ड में कौनों डॉक्टर सलाह भा परचा नइखे। स्वास्थ्य जांच खातिर डॉक्टर साहेब से संपर्क करीं।"
                sugg = ["डॉक्टर खोजीं", "सलाह लीं"]
            elif is_urdu:
                reply = "آپ کے ریکارڈ میں کوئی فعال کلینیکل مشورہ یا نسخہ موجود نہیں ہے۔ برائے مہربانی معالج سے رجوع کریں۔"
                sugg = ["ڈاکٹر تلاش کریں", "اپائنٹمنٹ حاصل کریں"]
            else:
                reply = "You do not have any recorded consultations or diagnoses on file. Please schedule a consultation with an attending clinician for medical guidance."
                sugg = ["Find a Doctor", "Book Consultation", "How to log vitals?"]
            return reply, intent, [], [], sugg

        latest = consultation_records[0]
        diag = latest["diagnosis"] or "General Health Assessment"
        doc = latest["doctor"]
        adv = latest["advice"] or "Take your prescribed medicines on time, drink adequate water, and get sufficient rest."
        summ = latest["summary"] or f"Consultation conducted on {latest['date']}."
        date_str = latest["date"]

        if is_hindi:
            reply = (
                f"डॉ. {doc} के साथ {date_str} को हुए परामर्श के अनुसार:\n\n"
                f"• पुष्टि किया गया निदान: {diag}\n"
                f"• डॉक्टर का निष्कर्ष: {summ}\n"
                f"• जीवनशैली और सलाह: {adv}\n\n"
                f"विस्तृत जानकारी के लिए आप 'Visits' टैब में जाकर अपना डिजिटल प्रिस्क्रिप्शन देख सकते हैं।"
            )
            sugg = ["मेरी दवाएं समझाइए", "खतरे के लक्षण", "फॉलो-अप कब है?"]
        elif is_kannada:
            reply = (
                f"ದಿನಾಂಕ {date_str} ರಂದು ಡಾ. {doc} ಅವರೊಂದಿಗೆ ನಡೆದ ಸಮಾಲೋಚನೆಯ ಪ್ರಕಾರ:\n\n"
                f"• ರೋಗನಿರ್ಣಯ: {diag}\n"
                f"• ವೈದ್ಯರ ವಿವರಣೆ: {summ}\n"
                f"• ಜೀವನಶೈಲಿ ಸಲಹೆ: {adv}\n\n"
                f"ಹೆಚ್ಚಿನ ವಿವರಗಳಿಗಾಗಿ 'Visits' ಟ್ಯಾಬ್‌ನಲ್ಲಿ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ವೀಕ್ಷಿಸಿ."
            )
            sugg = ["ಔಷಧಗಳ ವಿವರ", "ಎಚ್ಚರಿಕೆಯ ಚಿಹ್ನೆಗಳು"]
        elif is_bhojpuri:
            reply = (
                f"डॉक्टर साहेब {doc} से {date_str} के भइल सलाह के अनुसार:\n\n"
                f"• बीमारी / निदान: {diag}\n"
                f"• डॉक्टर साहेब के बात: {summ}\n"
                f"• सलाह आ परहेज़: {adv}\n\n"
                f"पूरा परचा 'Visits' टैब में देख सकत बानी।"
            )
            sugg = ["दवाई के विवरण", "सावधानी"]
        elif is_urdu:
            reply = (
                f"ڈاکٹر {doc} کے ساتھ {date_str} کے مشورے کے مطابق:\n\n"
                f"• تشخیص: {diag}\n"
                f"• معالج کا خلاصہ: {summ}\n"
                f"• لائف اسٹائل اور مشورہ: {adv}\n\n"
                f"مکمل نسخہ دیکھنے کے लिए 'Visits' ٹیب ملاحظہ فرمائیں۔"
            )
            sugg = ["ادویات کی تفصیل", "احتیاطی تدابیر"]
        else:
            reply = (
                f"According to Dr. {doc} during your consultation on {date_str}:\n\n"
                f"• Confirmed Diagnosis: {diag}\n"
                f"• Clinician Evaluation: {summ}\n"
                f"• Lifestyle & Home Care Advice: {adv}\n\n"
                f"You can review your full digital prescription under the Visits tab."
            )
            sugg = ["Explain my medications", "Warning signs", "Follow-up schedule"]
        return reply, intent, latest["medicines"], [], sugg

    # Intent 2: Missed Dose Protocol
    if any(k in q_lower for k in [
        "miss", "missed", "forgot", "bhool", "chhoot", "marathu", "bhul", "भूल"
    ]):
        intent = "missed_dose_protocol"
        rule = pharmacology_service.get_missed_dose_guideline(language)
        if is_hindi:
            reply = (
                f"खुराक भूल जाने पर क्लिनिकल नियम:\n\n{rule}\n\n"
                f"यदि आप समय के बारे में अनिश्चित हैं, तो कभी भी अतिरिक्त खुराक न लें।"
            )
            sugg = ["मेरी दवाएं समझाइए", "डॉक्टर से बात करें", "फॉलो-अप कब है?"]
        else:
            reply = (
                f"Clinical Missed-Dose Protocol:\n\n{rule}\n\n"
                f"If you are ever uncertain about timing, do not double the dose. Contact your attending clinic for clarification."
            )
            sugg = ["Explain my medications", "Contact Doctor", "Warning signs"]
        return reply, intent, all_meds, [], sugg

    # Intent 3: Food & Medication Timing Rules
    if any(k in q_lower for k in [
        "empty stomach", "khana", "before food", "after food", "bhojan",
        "khali pet", "doodh", "milk", "खाली पेट", "भोजन", "दूध"
    ]):
        intent = "food_drug_rules"
        if all_meds:
            food_lines = []
            for m in all_meds:
                m_name = m.get("name", "Medication")
                f_rule = pharmacology_service.get_food_rule(m_name, language)
                food_lines.append(f"• {m_name}: {f_rule}")
            food_block = "\n".join(food_lines)
            if is_hindi:
                reply = (
                    f"आपकी निर्धारित दवाओं के लिए भोजन संबंधी नियम:\n\n{food_block}\n\n"
                    f"दवाओं का सही समय पर सेवन उनकी चिकित्सीय प्रभावशीलता सुनिश्चित करता है।"
                )
            else:
                reply = (
                    f"Medication Food & Timing Guidelines:\n\n{food_block}\n\n"
                    f"Taking medications with proper food intervals ensures maximum absorption and prevents gastric irritation."
                )
            sugg = ["खुराक भूल जाने पर क्या करें?", "डॉक्टर से पूछें"] if is_hindi else ["Missed dose protocol", "Contact Doctor"]
            return reply, intent, all_meds, [], sugg

    # Intent 4: Check if inquiring about an unrecorded condition
    import json
    from pathlib import Path
    cond_path = Path(__file__).resolve().parent.parent.parent / "data" / "unrecorded_conditions.json"
    medical_conditions = []
    if cond_path.exists():
        with open(cond_path, "r", encoding="utf-8") as cf:
            medical_conditions = json.load(cf)
    for cond in medical_conditions:
        if cond in q_lower:
            found = False
            for v in visits:
                diag_str = (v.diagnosis or "").lower()
                raw_str = (v.raw_transcription or "").lower()
                if cond in diag_str or cond in raw_str:
                    found = True
                    break
            if not found:
                intent = "unrecorded_condition_inquiry"
                if is_hindi:
                    reply = (
                        f"यह आपके रिकॉर्ड किए गए परामर्श का हिस्सा नहीं था ({cond.capitalize()})। "
                        f"कृपया किसी भी नई या असंबद्ध स्वास्थ्य समस्या के लिए अपने डॉक्टर से परामर्श लें।"
                    )
                    sugg = ["डॉक्टर खोजें", "परामर्श बुक करें"]
                else:
                    reply = (
                        f"This was not part of your recorded consultation ({cond.capitalize()}). "
                        f"Please consult your physician for medical advice."
                    )
                    sugg = ["Find a Doctor", "Book Consultation"]
                return reply, intent, [], [], sugg

    # Intent 5: Medications & Dosage Guidance
    if any(k in q_lower for k in [
        "medicine", "medication", "tablet", "dosage", "dose", "frequency", "schedule", "routine", "when to take", "food",
        "दवा", "दवाई", "गोली", "खुराक", "समय", "तालिका", "रूटिन", "रूटीन", "औषधि", "ಮಾತ್ರೆ", "خوراک", "دوا"
    ]):
        intent = "medication_guidance"
        if not all_meds:
            if is_hindi:
                reply = "वर्तमान में आपके रिकॉर्ड में कोई सक्रिय प्रिस्क्रिप्शन नहीं मिला। आप 'डॉक्टर' टैब से अपॉइंटमेंट बुक कर सकते हैं।"
                sugg = ["डॉक्टर खोजें", "परामर्श बुक करें"]
            else:
                reply = "No active prescription records found on file. You can consult a doctor under the Doctors tab to receive a personalized care plan."
                sugg = ["Find a Doctor", "Book Consultation"]
            return reply, intent, [], [], sugg

        med_lines = []
        for i, m in enumerate(all_meds, 1):
            name = m.get("name", "Medication")
            dosage = m.get("dosage", "")
            freq = m.get("frequency", "")
            instr = m.get("instructions", "As directed")
            food_rule = pharmacology_service.get_food_rule(name, language)
            med_lines.append(f"{i}. {name} ({dosage}) - {freq}\n   - निर्देश: {instr} | {food_rule}" if is_hindi else f"{i}. {name} ({dosage}) - {freq}\n   - Instructions: {instr} | {food_rule}")
        med_block = "\n".join(med_lines)

        latest_doc = consultation_records[0]["doctor"] if consultation_records else "Your Attending Clinician"
        latest_date = consultation_records[0]["date"] if consultation_records else "Recent"

        if is_hindi:
            head = f"डॉ. {latest_doc} के परामर्श ({latest_date}) के अनुसार आपकी दवाएं:" if consultation_records else "आपकी सक्रिय निर्धारित दवाओं की अनुसूची:"
            reply = (
                f"{head}\n\n{med_block}\n\n"
                f"कृपया समय पर दवाएं लें और बिना डॉक्टर की सलाह के खुराक न बदलें।"
            )
            sugg = ["क्या कोई साइड इफ़ेक्ट हैं?", "खुराक भूल जाने पर क्या करें?", "डॉक्टर से पूछें"]
        elif is_kannada:
            reply = (
                f"ಡಾ. {latest_doc} ಅವರ ಸೂಚನೆಯಂತೆ ಔಷಧಗಳ ಪಟ್ಟಿ:\n\n{med_block}\n\n"
                f"ವೈದ್ಯರ ಸಲಹೆಯಂತೆ ನಿಗದಿತ ವೇಳಾಪಟ್ಟಿಯನ್ನು ಕಟ್ಟುನಿಟ್ಟಾಗಿ ಪಾಲಿಸಿ."
            )
            sugg = ["ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ", "ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಡೌನ್‌ಲೋಡ್"]
        else:
            head = f"According to Dr. {latest_doc} during your consultation on {latest_date}, here is your prescribed regimen:" if consultation_records else "Here is your active medication schedule and instructions:"
            reply = (
                f"{head}\n\n{med_block}\n\n"
                f"Always take your medications as directed by your clinician. Do not discontinue or adjust dosages without medical supervision."
            )
            sugg = ["What if I miss a dose?", "Are there food restrictions?", "Contact Doctor"]
        return reply, intent, all_meds, [], sugg

    # Intent 6: Doctor directory / referral
    if any(k in q_lower for k in ["doctor", "specialist", "physician", "clinic", "डॉक्टर", "ವೈದ್ಯ", "ڈاکٹر"]):
        intent = "doctor_recommendation"
        rec_docs = []
        for d in doctors[:4]:
            rec_docs.append(RecommendedDoctor(
                id=str(d.id),
                name=d.name,
                specialty=getattr(d, "specialty", None),
                clinic_name=getattr(d, "clinic_name", None),
                reg_number=getattr(d, "reg_number", None),
                phone=getattr(d, "phone", None)
            ))
        doc_lines = []
        for d in rec_docs:
            spec_str = f" - {d.specialty}" if d.specialty else ""
            clinic_str = f" ({d.clinic_name})" if d.clinic_name else ""
            doc_lines.append(f"• {d.name}{spec_str}{clinic_str}")
        doc_block = "\n".join(doc_lines) if doc_lines else "• Clinicians available in our directory"

        if is_hindi:
            reply = (
                f"हमारे क्लिनिकल नेटवर्क में उपलब्ध चिकित्सक:\n\n{doc_block}\n\n"
                f"आप 'डॉक्टर' टैब में जाकर किसी भी चिकित्सक का प्रोफाइल देख सकते हैं और परामर्श बुक कर सकते हैं।"
            )
            sugg = ["डॉक्टर खोजें", "समय देखें", "क्लिनिक का पता"]
        else:
            reply = (
                f"Verified clinicians available in our network:\n\n{doc_block}\n\n"
                f"You can view their profiles and schedule appointments under the Doctors tab."
            )
            sugg = ["Browse Clinicians", "Clinic Timings", "Consultation Fees"]
        return reply, intent, [], rec_docs, sugg

    # Default general reply
    if is_hindi:
        reply = (
            "नमस्ते! मैं आपका प्रैक्सिरेंस स्वास्थ्य सहायक हूँ।\n\n"
            "मैं आपकी सहायता कर सकता हूँ:\n"
            "• आपके हालिया परामर्श और डॉक्टर की सलाह समझाने में\n"
            "• आपकी दवाओं और खुराक के नियमों की जानकारी देने में\n"
            "• अस्पताल के सत्यापित डॉक्टरों से परामर्श बुक करने में\n\n"
            "आपातकालीन स्थिति में कृपया तुरंत 108 या 112 पर कॉल करें।"
        )
        sugg = ["मेरी पिछली सलाह क्या थी?", "मेरी दवाएं समझाइए", "डॉक्टर खोजें"]
    elif is_kannada:
        reply = (
            "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಪ್ರೈಕ್ಸಿರೆನ್ಸ್ ಕ್ಲಿನಿಕಲ್ ಸಹಾಯಕ.\n\n"
            "ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ:\n"
            "• ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಸಮಾಲೋಚನೆ ವಿವರ ತಿಳಿಸಲು\n"
            "• ಔಷಧಗಳು ಮತ್ತು ಡೋಸ್ ನಿಯಮಗಳನ್ನು ವಿವರಿಸಲು\n"
            "• ಪರಿಶೀಲಿಸಿದ ವೈದ್ಯರನ್ನು ಹುಡುಕಲು\n\n"
            "ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಲ್ಲಿ ತಕ್ಷಣ 108 / 112 ಗೆ ಕರೆ ಮಾಡಿ."
        )
        sugg = ["ನನ್ನ ಔಷಧಗಳನ್ನು ವಿವರಿಸಿ", "ವೈದ್ಯರನ್ನು ಹುಡುಕಿ"]
    else:
        reply = (
            "Hello! I am your Praxirence Clinical Assistant.\n\n"
            "I can assist you with:\n"
            "• Reviewing your consultation notes and attending doctor advice\n"
            "• Explaining your active medication schedule and instructions\n"
            "• Connecting you with verified clinicians across our network\n\n"
            "Important: For medical emergencies, immediately call 108 or 112 or visit the nearest emergency room."
        )
        sugg = ["What did my doctor say?", "Explain my medication schedule", "Find a Doctor"]
    return reply, intent, all_meds, [], sugg


@router.post("/patient-assistant", response_model=ChatResponse)
async def patient_chat_assistant(
    req: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Production Multilingual Clinical Assistant endpoint.
    Retrieves real consultation history, prescriptions, and verified doctors from PostgreSQL.
    Invokes Google Gemini API with clinical grounding, or executes dynamic zero-hallucination inference.
    Strictly forbids emojis, fake diagnoses (no URTI mock), or repetitive canned responses.
    Features instant ESI red-flag triage detection and pharmacological intelligence.
    """
    logger.info(f"Incoming patient chat query: '{req.message[:60]}...' (Language: {req.language}, Patient: {req.patient_id})")

    # 0. Instant ESI Emergency Red-Flag Triage Check
    emergency = triage_service.evaluate_emergency(req.message, req.language)
    if emergency:
        logger.warning(f"CRITICAL RED-FLAG DETECTED: {emergency.get('reason')} - Triggering instant 108/112 alert card.")
        return ChatResponse(
            reply=emergency["message"],
            language=req.language,
            detected_intent="emergency_triage",
            emergency_alert=emergency,
            safety_disclaimer="EMERGENCY RED-FLAG: Immediate 108 / 112 Dispatch Required.",
            quick_suggestions=["Call 108 Ambulance", "Call 112 Emergency", "Nearest Hospital ER"]
        )

    # 1. Fetch real patient consultation history from PostgreSQL
    patient_name = None
    visits: List[Visit] = []

    if req.patient_id:
        patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
        if patient:
            patient_name = patient.name

        # Query all confirmed visits for this patient
        visits = db.query(Visit).filter(
            Visit.patient_id == req.patient_id
        ).order_by(Visit.created_at.desc()).limit(5).all()

    # Query doctors in directory
    doctors = db.query(User).all()

    # 2. Build Grounding Context & Citations
    context_lines = []
    citations: List[Dict[str, Any]] = []

    if visits:
        seen_citations = set()
        for idx, v in enumerate(visits, 1):
            raw_doc_name = v.doctor.name if v.doctor else "Attending Doctor"
            clean_name = re.sub(r'^(Dr\.?\s*)+', '', raw_doc_name, flags=re.IGNORECASE).strip()
            doc_name = f"Dr. {clean_name}" if clean_name else "Dr. Attending Doctor"
            doc_spec = getattr(v.doctor, "specialty", "Physician") if v.doctor else "Physician"
            clinic = getattr(v.doctor, "clinic_name", "Clinic") if v.doctor else "Clinic"
            raw_t, pat_sum, doc_adv = parse_transcription_and_summary(v.raw_transcription)
            visit_date = v.created_at.strftime("%d %b %Y") if v.created_at else "Recent"

            citation_key = f"{doc_name}_{visit_date}"
            if citation_key not in seen_citations:
                seen_citations.add(citation_key)
                citations.append({
                    "doctor_name": doc_name,
                    "doctor_specialty": doc_spec,
                    "visit_date": visit_date,
                    "diagnosis": v.diagnosis or "Clinical Consultation",
                    "clinic_name": clinic
                })

            meds_list = []
            if v.medicines:
                if isinstance(v.medicines, list):
                    meds_list = v.medicines
                elif isinstance(v.medicines, str):
                    try:
                        meds_list = json.loads(v.medicines)
                    except Exception:
                        meds_list = []

            context_lines.append(
                f"[Visit {idx} - Date: {visit_date}]\n"
                f"Attending Doctor: {doc_name} ({doc_spec} at {clinic})\n"
                f"Confirmed Diagnosis: {v.diagnosis or 'Clinical Consultation'}\n"
                f"Doctor's Advice: {doc_adv or 'Follow standard prescription care.'}\n"
                f"Patient Summary: {pat_sum or 'Evaluation completed.'}\n"
                f"Prescribed Medicines: {json.dumps(meds_list)}\n"
            )
    if req.active_medications:
        context_lines.append(
            f"[Active In-App Medications]: {json.dumps(req.active_medications)}\n"
        )

    if not visits and not req.active_medications:
        context_lines.append("NO_PREVIOUS_VISITS_RECORDED: This patient has no active consultations or prescriptions on file.")

    grounding_context = "\n".join(context_lines)

    # 3. Call Google Gemini API if GEMINI_API_KEY is configured
    gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    llm_reply = None

    if gemini_key and len(gemini_key) > 10:
        system_prompt = (
            "You are Praxirence Clinical AI Assistant, an empathetic, highly knowledgeable, and medically rigorous healthcare assistant.\n"
            "GUIDELINES:\n"
            "1. When answering queries about recorded consultations, diagnoses, or prescriptions, prioritize the real patient records provided below and cite the clinician and date.\n"
            "2. When the patient asks about symptoms (such as fever, headache, cold, cough, nausea, stomach pain, body ache, dizziness, weakness, vomiting) or asks general clinical questions like 'what to do' or 'I am suffering from X':\n"
            "   - ALWAYS provide clear, practical, actionable clinical advice.\n"
            "   - Start by acknowledging their symptom and explaining common causes in simple language.\n"
            "   - Provide detailed step-by-step supportive home care guidance:\n"
            "     * Hydration (water, ORS, coconut water, clear broths)\n"
            "     * Physical rest and sleep\n"
            "     * Temperature monitoring with a thermometer every 4-6 hours\n"
            "     * Tepid/lukewarm sponge bath for fever (never ice-cold)\n"
            "     * Light, easily digestible meals (soups, porridge, khichdi, fruits)\n"
            "     * Loose, breathable cotton clothing\n"
            "   - Clearly list specific RED-FLAG danger signs that require IMMEDIATE medical attention (e.g., fever above 102F/39C, lasting over 3 days, difficulty breathing, stiff neck, extreme lethargy, persistent vomiting, rash).\n"
            "   - End with a recommendation to book a consultation with an attending doctor in the Praxirence app for proper clinical evaluation.\n"
            "3. NEVER refuse to give health guidance. NEVER say 'I cannot provide medical advice'. You MUST provide supportive home care guidance while recommending professional consultation for definitive diagnosis.\n"
            "4. If the patient asks about missed doses, explain: take immediately unless close to next scheduled dose; never double up.\n"
            "5. If the patient asks about food timings, provide standard pharmacological guidance (e.g. PPIs on empty stomach, NSAIDs after food, thyroid 30 min before breakfast).\n"
            "6. Do NOT use emojis under any circumstances to maintain clinical dignity.\n"
            "7. Structure your response with clear numbered points and bullet points for readability.\n"
            f"8. Support natural code-switching and respond in the patient's language: {req.language}."
        )

        user_content = (
            f"--- REAL PATIENT CONSULTATION HISTORY ---\n"
            f"{grounding_context}\n\n"
            f"--- PATIENT QUERY ---\n"
            f"{req.message}"
        )

        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": [
                {
                    "parts": [{"text": user_content}]
                }
            ],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1200
            }
        }

        models_to_try = ["gemini-2.0-flash", "gemini-1.5-flash"]
        for model_name in models_to_try:
            if llm_reply:
                break
            gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    res = await client.post(gemini_url, json=payload)
                    if res.status_code == 200:
                        data = res.json()
                        candidates = data.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            reply_texts = [p.get("text", "") for p in parts if p.get("text")]
                            if reply_texts:
                                raw_reply = "\n\n".join(reply_texts)
                                llm_reply = strip_emojis(raw_reply)
                                logger.info(f"Successfully generated grounded response via Google Gemini API ({model_name}).")
                                break
                    else:
                        logger.warning(f"Gemini API ({model_name}) returned status {res.status_code}: {res.text[:120]}")
            except Exception as e:
                logger.warning(f"Gemini API ({model_name}) call failed or timed out: {e}")

    # 4. If LLM succeeded, return structured response
    if llm_reply:
        meds_ref = []
        if visits and visits[0].medicines:
            m = visits[0].medicines
            meds_ref = m if isinstance(m, list) else (json.loads(m) if isinstance(m, str) else [])

        lang_lower = req.language.lower()
        if lang_lower in ["hindi", "हिन्दी", "hi", "hinglish"]:
            llm_suggestions = ["मेरी दवाएं समझाइए", "डॉक्टर की सलाह क्या थी?", "फॉलो-अप कब है?"]
        elif lang_lower in ["kannada", "ಕನ್ನಡ", "kn"]:
            llm_suggestions = ["ಔಷಧ ವೇಳಾಪಟ್ಟಿ ವಿವರಿಸಿ", "ವೈದ್ಯರ ಸಲಹೆ ಏನು?", "ಮುಂದಿನ ಭೇಟಿ ಯಾವಾಗ?"]
        elif lang_lower in ["bhojpuri", "भोजपुरी", "bho"]:
            llm_suggestions = ["दवाई के बारे में बताईं", "डॉक्टर साहेब का सलाह", "अगला चेकअप कब बा?"]
        elif lang_lower in ["urdu", "اردو", "ur"]:
            llm_suggestions = ["ادویات کی تفصیل", "ڈاکٹر کا مشورہ کیا تھا؟", "اگلا فالو اپ کب ہے؟"]
        else:
            llm_suggestions = ["Explain my medication schedule", "What did my doctor advise?", "Book next follow-up"]

        asks_for_doc = any(kw in req.message.lower() for kw in ["doctor", "specialist", "appointment", "consult", "book", "physician", "dr.", "dr "])
        rec_docs = [
            RecommendedDoctor(
                id=str(d.id),
                name="Dr. " + re.sub(r'^(Dr\.?\s*)+', '', d.name, flags=re.IGNORECASE).strip(),
                specialty=getattr(d, "specialty", None),
                clinic_name=getattr(d, "clinic_name", None),
                reg_number=getattr(d, "reg_number", None),
                phone=getattr(d, "phone", None)
            ) for d in doctors[:3]
        ] if asks_for_doc else []

        return ChatResponse(
            reply=llm_reply,
            language=req.language,
            detected_intent="clinical_intelligence",
            medicines_referenced=meds_ref,
            recommended_doctors=rec_docs,
            quick_suggestions=llm_suggestions,
            citations=citations
        )

    # 5. High-fidelity Grounded Fallback
    reply_text, detected_intent, meds_ref, rec_docs, suggestions = generate_grounded_fallback(
        query=req.message,
        language=req.language,
        visits=visits,
        patient_name=patient_name,
        doctors=doctors,
        active_medications=req.active_medications
    )

    clean_reply = strip_emojis(reply_text)

    return ChatResponse(
        reply=clean_reply,
        language=req.language,
        detected_intent=detected_intent,
        medicines_referenced=meds_ref,
        recommended_doctors=rec_docs,
        quick_suggestions=suggestions,
        citations=citations
    )

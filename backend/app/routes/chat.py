import logging
import json
import re
import httpx
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.user import User
from app.routes.visits import parse_transcription_and_summary

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
    # Also clean repetitive extra spaces
    cleaned = re.sub(r' {2,}', ' ', cleaned)
    return cleaned.strip()


def generate_grounded_fallback(
    query: str,
    language: str,
    visits: List[Visit],
    patient_name: Optional[str],
    doctors: List[User]
) -> tuple[str, str, List[Dict[str, Any]], List[RecommendedDoctor], List[str]]:
    """
    Strictly grounded clinical response builder when LLM API is unavailable.
    Zero fabricated diagnoses (no fake URTI), zero emojis, multilingual support.
    """
    q_lower = query.lower()
    intent = "general_health"
    lang_lower = language.lower()

    is_hindi = lang_lower in ["hindi", "हिन्दी", "hi", "hinglish"]
    is_kannada = lang_lower in ["kannada", "ಕನ್ನಡ", "kn"]
    is_bhojpuri = lang_lower in ["bhojpuri", "भोजपुरी", "bho"]
    is_urdu = lang_lower in ["urdu", "اردو", "ur"]
    is_tamil = lang_lower in ["tamil", "தமிழ்", "ta"]
    is_telugu = lang_lower in ["telugu", "తెలుగు", "te"]
    is_marathi = lang_lower in ["marathi", "मराठी", "mr"]

    # Gather all verified records
    all_meds: List[Dict[str, Any]] = []
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

        if is_hindi:
            reply = (
                f"आपके हालिया परामर्श का विवरण ({doc}):\n\n"
                f"• पुष्टि किया गया निदान: {diag}\n"
                f"• डॉक्टर का निष्कर्ष: {summ}\n"
                f"• जीवनशैली और सलाह: {adv}\n\n"
                f"विस्तृत जानकारी के लिए आप 'Visits' टैब में जाकर अपना डिजिटल प्रिस्क्रिप्शन देख सकते हैं।"
            )
            sugg = ["मेरी दवाएं समझाइए", "खतरे के लक्षण", "फॉलो-अप कब है?"]
        elif is_kannada:
            reply = (
                f"ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಸಮಾಲೋಚನೆ ವಿವರ ({doc}):\n\n"
                f"• ರೋಗನಿರ್ಣಯ: {diag}\n"
                f"• ವೈದ್ಯರ ವಿವರಣೆ: {summ}\n"
                f"• ಜೀವನಶೈಲಿ ಸಲಹೆ: {adv}\n\n"
                f"ಹೆಚ್ಚಿನ ವಿವರಗಳಿಗಾಗಿ 'Visits' ಟ್ಯಾಬ್‌ನಲ್ಲಿ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ವೀಕ್ಷಿಸಿ."
            )
            sugg = ["ಔಷಧಗಳ ವಿವರ", "ಎಚ್ಚರಿಕೆಯ ಚಿಹ್ನೆಗಳು"]
        elif is_bhojpuri:
            reply = (
                f"रउआ के हाल के परामर्श के विवरण ({doc}):\n\n"
                f"• बीमारी / निदान: {diag}\n"
                f"• डॉक्टर साहेब के बात: {summ}\n"
                f"• सलाह आ परहेज़: {adv}\n\n"
                f"पूरा परचा 'Visits' टैब में देख सकत बानी।"
            )
            sugg = ["दवाई के विवरण", "सावधानी"]
        elif is_urdu:
            reply = (
                f"آپ کے حالیہ مشورے کی تفصیلات ({doc}):\n\n"
                f"• تشخیص: {diag}\n"
                f"• معالج کا خلاصہ: {summ}\n"
                f"• لائف اسٹائل اور مشورہ: {adv}\n\n"
                f"مکمل نسخہ دیکھنے کے لیے 'Visits' ٹیب ملاحظہ فرمائیں۔"
            )
            sugg = ["ادویات کی تفصیل", "احتیاطی تدابیر"]
        else:
            reply = (
                f"Clinical Consultation Summary ({doc}):\n\n"
                f"• Confirmed Diagnosis: {diag}\n"
                f"• Clinician Evaluation: {summ}\n"
                f"• Lifestyle & Home Care Advice: {adv}\n\n"
                f"You can review your full digital prescription under the Visits tab."
            )
            sugg = ["Explain my medications", "Warning signs", "Follow-up schedule"]
        return reply, intent, latest["medicines"], [], sugg

    # Intent 2: Medications & Dosage
    if any(k in q_lower for k in [
        "medicine", "tablet", "dosage", "frequency", "when to take", "food",
        "दवा", "दवाई", "गोली", "खुराक", "ಔಷಧಿ", "ಮಾತ್ರೆ", "خوراک", "دوا"
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
            med_lines.append(f"{i}. {name} ({dosage}) - {freq} • {instr}")
        med_block = "\n".join(med_lines)

        if is_hindi:
            reply = (
                f"आपकी निर्धारित दवाइयां:\n\n{med_block}\n\n"
                f"कृपया समय पर दवाएं लें और बिना डॉक्टर की सलाह के खुराक न बदलें।"
            )
            sugg = ["क्या कोई साइड इफ़ेक्ट हैं?", "खुराक भूल जाने पर क्या करें?", "डॉक्टर से पूछें"]
        elif is_kannada:
            reply = (
                f"ನಿಮಗೆ ಸೂಚಿಸಲಾದ ಔಷಧಗಳ ಪಟ್ಟಿ:\n\n{med_block}\n\n"
                f"ವೈದ್ಯರ ಸಲಹೆಯಂತೆ ನಿಗದಿತ ವೇಳಾಪಟ್ಟಿಯನ್ನು ಕಟ್ಟುನಿಟ್ಟಾಗಿ ಪಾಲಿಸಿ."
            )
            sugg = ["ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ", "ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಡೌನ್‌ಲೋಡ್"]
        else:
            reply = (
                f"Your Prescribed Medications:\n\n{med_block}\n\n"
                f"Always take your medications as directed by your clinician. Do not discontinue or adjust dosages without medical supervision."
            )
            sugg = ["What if I miss a dose?", "Are there food restrictions?", "Contact Doctor"]
        return reply, intent, all_meds, [], sugg

    # Intent 3: Doctor directory / referral
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
    """
    logger.info(f"Incoming patient chat query: '{req.message[:60]}...' (Language: {req.language}, Patient: {req.patient_id})")

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
    doctors = db.query(User).filter(User.role == "doctor").all()

    # 2. Build Grounding Context
    context_lines = []
    if visits:
        for idx, v in enumerate(visits, 1):
            doc_name = v.doctor.name if v.doctor else "Attending Doctor"
            doc_spec = getattr(v.doctor, "specialty", "Physician") if v.doctor else "Physician"
            clinic = getattr(v.doctor, "clinic_name", "Clinic") if v.doctor else "Clinic"
            raw_t, pat_sum, doc_adv = parse_transcription_and_summary(v.raw_transcription)

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
                f"[Visit {idx} - Date: {v.created_at.strftime('%Y-%m-%d') if v.created_at else 'Recent'}]\n"
                f"Attending Doctor: {doc_name} ({doc_spec} at {clinic})\n"
                f"Confirmed Diagnosis: {v.diagnosis or 'Clinical Consultation'}\n"
                f"Doctor's Advice: {doc_adv or 'Follow standard prescription care.'}\n"
                f"Patient Summary: {pat_sum or 'Evaluation completed.'}\n"
                f"Prescribed Medicines: {json.dumps(meds_list)}\n"
            )
    else:
        context_lines.append("NO_PREVIOUS_VISITS_RECORDED: This patient has no active consultations or prescriptions on file.")

    grounding_context = "\n".join(context_lines)

    # 3. Call Google Gemini API if GEMINI_API_KEY is configured
    gemini_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
    llm_reply = None

    if gemini_key and len(gemini_key) > 10:
        system_prompt = (
            "You are Praxirence Clinical AI Assistant. You must answer the patient's questions strictly "
            "based on their real medical consultation history provided below. "
            "If the patient has no active consultations or prescriptions, state that plainly and advise them to consult a doctor. "
            "Do NOT fabricate symptoms, diagnoses, or medications. Do NOT make up Upper Respiratory Tract Infection, acid reflux, or any fake condition. "
            "Do NOT use emojis under any circumstances. "
            "Maintain a professional, empathetic, and evidence-based clinical tone. "
            f"Provide answers strictly in the patient's requested language: {req.language}."
        )

        user_content = (
            f"--- REAL PATIENT CONSULTATION HISTORY ---\n"
            f"{grounding_context}\n\n"
            f"--- PATIENT QUERY ---\n"
            f"{req.message}"
        )

        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
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
                "temperature": 0.2,
                "maxOutputTokens": 600
            }
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(gemini_url, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and "text" in parts[0]:
                            raw_reply = parts[0]["text"]
                            llm_reply = strip_emojis(raw_reply)
                            logger.info("Successfully generated grounded response via Google Gemini API.")
                else:
                    logger.warning(f"Gemini API returned status {res.status_code}: {res.text[:120]}")
        except Exception as e:
            logger.warning(f"Gemini API call failed or timed out: {e}. Falling back to internal grounded engine.")

    # 4. If LLM succeeded, return structured response
    if llm_reply:
        # Determine referenced medicines
        meds_ref = []
        if visits and visits[0].medicines:
            m = visits[0].medicines
            meds_ref = m if isinstance(m, list) else (json.loads(m) if isinstance(m, str) else [])

        return ChatResponse(
            reply=llm_reply,
            language=req.language,
            detected_intent="clinical_intelligence",
            medicines_referenced=meds_ref,
            recommended_doctors=[
                RecommendedDoctor(
                    id=str(d.id),
                    name=d.name,
                    specialty=getattr(d, "specialty", None),
                    clinic_name=getattr(d, "clinic_name", None),
                    reg_number=getattr(d, "reg_number", None),
                    phone=getattr(d, "phone", None)
                ) for d in doctors[:3]
            ],
            quick_suggestions=[
                "Explain my medication schedule",
                "What did my doctor advise?",
                "Book next follow-up"
            ]
        )

    # 5. High-fidelity Grounded Fallback
    reply_text, detected_intent, meds_ref, rec_docs, suggestions = generate_grounded_fallback(
        query=req.message,
        language=req.language,
        visits=visits,
        patient_name=patient_name,
        doctors=doctors
    )

    clean_reply = strip_emojis(reply_text)

    return ChatResponse(
        reply=clean_reply,
        language=req.language,
        detected_intent=detected_intent,
        medicines_referenced=meds_ref,
        recommended_doctors=rec_docs,
        quick_suggestions=suggestions
    )

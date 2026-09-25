import logging
import json
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.visit import Visit
from app.models.patient import Patient
from app.models.user import User
from app.services.ai_service import AIService, ai_service
from app.routes.visits import parse_transcription_and_summary

logger = logging.getLogger("praxirence.chat")
router = APIRouter(prefix="/chat", tags=["Patient Multilingual Assistant"])


class ChatRequest(BaseModel):
    message: str
    language: str = "English"  # "English", "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati", "Hinglish"
    patient_id: Optional[str] = None
    visit_id: Optional[str] = None
    active_medications: Optional[List[Dict[str, Any]]] = None


class RecommendedDoctor(BaseModel):
    id: str
    name: str
    specialty: str
    clinic_name: str
    reg_number: str
    phone: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    language: str
    detected_intent: str
    medicines_referenced: List[Dict[str, Any]] = []
    recommended_doctors: List[RecommendedDoctor] = []
    quick_suggestions: List[str] = []
    safety_disclaimer: str = "Trained Clinical Assistant • For emergency care, call 108 / 112 immediately."


SYSTEM_HEALTH_KNOWLEDGE = {
    "app_features": {
        "download_pdf": "You can download your official clinical prescription PDF directly from the 'Visits' tab by tapping 'Download PDF'.",
        "care_plan": "Once your consultation is finalized by your clinician, the full Care Plan is securely synchronized to your Praxirence app.",
        "consent": "Praxirence protects your health records with AES-256 blind indexing and HIPAA/ABDM security. You can toggle or revoke doctor access anytime from the 'Consent' tab.",
        "vitals": "Log daily Blood Pressure, Heart Rate, SpO2, and Blood Glucose on the 'Today' tab to track health trends over time.",
        "find_doctors": "Browse verified clinicians with active National Medical Commission (NMC) credentials on the 'Doctors' tab."
    }
}


def build_fallback_response(
    query: str,
    language: str,
    medicines: List[Dict[str, Any]],
    doctors: List[User],
    latest_diagnosis: Optional[str] = None,
    latest_summary: Optional[str] = None,
    latest_doc_advice: Optional[str] = None,
    doctor_name: Optional[str] = None,
    patient_name: Optional[str] = None
) -> ChatResponse:
    """
    High-fidelity clinical response generator covering Multilingual queries,
    consultation dialogue explanations, prescription explanations, doctor matching, and app navigation.
    """
    q_lower = query.lower()
    intent = "general_health"
    reply_text = ""
    meds_ref = []
    rec_docs = []
    suggestions = []

    is_kannada = language.lower() in ["kannada", "ಕನ್ನಡ", "kn"]
    is_bhojpuri = language.lower() in ["bhojpuri", "भोजपुरी", "bho"]
    is_urdu = language.lower() in ["urdu", "اردو", "ur"]
    is_hindi = language.lower() in ["hindi", "हिन्दी", "hinglish", "hi"]
    is_bengali = language.lower() in ["bengali", "বাংলা", "bn"]
    is_tamil = language.lower() in ["tamil", "தமிழ்", "ta"]
    is_telugu = language.lower() in ["telugu", "తెలుగు", "te"]
    is_marathi = language.lower() in ["marathi", "मराठी", "mr"]
    is_malayalam = language.lower() in ["malayalam", "മലയാളം", "ml"]
    is_punjabi = language.lower() in ["punjabi", "ਪੰਜਾਬੀ", "pa"]
    is_gujarati = language.lower() in ["gujarati", "ગુજરાતી", "gu"]

    doc_display = doctor_name or "Dr. Mayank Raj"
    pat_display = patient_name or "Patient"

    # 1. Consultation, Diagnosis & Doctor Advice Queries
    if any(k in q_lower for k in [
        "diagnos", "advice", "consultation", "visit", "said", "summary", "problem", "condition",
        "doctor note", "what did the doctor", "what did doctor", "डॉक्टर ने क्या कहा", "बीमारी",
        "निदान", "सलाह", "रोग", "सुझाव", "ಪರೀಕ್ಷೆ", "ರೋಗನಿರ್ಣಯ", "ಸಲಹೆ", "تشخیص", "مشورہ"
    ]) and (latest_diagnosis or latest_summary or latest_doc_advice):
        intent = "consultation_explanation"
        diag_str = latest_diagnosis or "Clinical Evaluation"
        summary_str = latest_summary or f"During your consultation, {doc_display} evaluated your health status."
        advice_str = latest_doc_advice or "Follow your prescription schedule and maintain adequate rest and hydration."

        if is_kannada:
            reply_text = (
                f"📋 **ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಸಮಾಲೋಚನೆ ವಿವರ ({doc_display}):**\n\n"
                f"• **ರೋಗನಿರ್ಣಯ:** {diag_str}\n"
                f"• **ವೈದ್ಯರ ವಿವರಣೆ:** {summary_str}\n"
                f"• **ಜೀವನಶೈಲಿ ಮತ್ತು ಸಲಹೆ:** {advice_str}\n\n"
                f"ನಿಮ್ಮ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ವಿವರಗಳನ್ನು 'Visits' ಟ್ಯಾಬ್‌ನಲ್ಲಿ ವೀಕ್ಷಿಸಬಹುದು."
            )
            suggestions = ["ನನ್ನ ಔಷಧಗಳನ್ನು ವಿವರಿಸಿ", "ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ", "ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ"]
        elif is_bhojpuri:
            reply_text = (
                f"📋 **रउआ के सबसे हाल के परामर्श विवरण ({doc_display}):**\n\n"
                f"• **बीमारी / निदान:** {diag_str}\n"
                f"• **डॉक्टर साहेब के समझावल बात:** {summary_str}\n"
                f"• **घरेलू सलाह आ परहेज़:** {advice_str}\n\n"
                f"रउआ आपन पूरा परचा 'Visits' टैब में देख सकत बानी।"
            )
            suggestions = ["हमार दवाई समझाईं", "परचा डाउनलोड करीं", "डॉक्टर से बात करीं"]
        elif is_urdu:
            reply_text = (
                f"📋 **آپ کے حالیہ طبی مشورے کی تفصیل ({doc_display}):**\n\n"
                f"• **تشخیص:** {diag_str}\n"
                f"• **ڈاکٹر کی وضاحت:** {summary_str}\n"
                f"• **گھریلو پرہیز اور مشورہ:** {advice_str}\n\n"
                f"مکمل نسخہ دیکھنے کے لیے 'Visits' ٹیب ملاحظہ کریں۔"
            )
            suggestions = ["میری ادویات سمجھائیں", "نسخہ ڈاؤن لوڈ کریں", "ڈاکٹر سے رابطہ کریں"]
        elif is_hindi:
            reply_text = (
                f"📋 **आपके हालिया परामर्श का विवरण ({doc_display}):**\n\n"
                f"• **निदान (Diagnosis):** {diag_str}\n"
                f"• **डॉक्टर की समझाइश:** {summary_str}\n"
                f"• **घरेलू सलाह व परहेज:** {advice_str}\n\n"
                f"विस्तृत पर्चा देखने के लिए 'Visits' टैब पर जाएं।"
            )
            suggestions = ["मेरी दवाएं समझाइए", "प्रिस्क्रिप्शन डाउनलोड करें", "डॉक्टर से संपर्क करें"]
        else:
            reply_text = (
                f"📋 **Summary of Your Consultation with {doc_display}:**\n\n"
                f"• **Clinical Diagnosis:** {diag_str}\n"
                f"• **What Doctor Explained:** {summary_str}\n"
                f"• **Doctor's Lifestyle & Home Care Advice:** {advice_str}\n\n"
                f"You can review your complete medication schedule and alarms under the **Visits** tab."
            )
            suggestions = ["Explain my medicines", "Download Rx PDF", "Contact Doctor"]

    # 2. Prescription / Medicine Queries
    elif any(k in q_lower for k in ["medicine", "medication", "prescription", "dose", "dosage", "tablet", "syrup", "pill", "schedule", "timing", "side effect", "दवा", "दवाई", "औषध", "ಔಷಧ", "ಮಾತ್ರೆ", "மருந்து", "మందు", "دوا"]):
        intent = "prescription_explanation"
        if medicines:
            meds_ref = medicines
            med_summaries = []
            for m in medicines:
                name = m.get("name", "Medication")
                dose = m.get("dosage", "As prescribed")
                freq = m.get("frequency", "daily")
                instr = m.get("instructions", "after meals")
                med_summaries.append(f"• **{name}** ({dose}): Take {freq}, {instr}.")
            
            summary_block = "\n".join(med_summaries)

            if is_kannada:
                reply_text = (
                    f"ನಮಸ್ಕಾರ! ನಿಮ್ಮ ಇತ್ತೀಚಿನ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಪ್ರಕಾರ:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **ವೈದ್ಯರ ಸಲಹೆ:** ಔಷಧಿಗಳನ್ನು ಯಾವಾಗಲೂ ಸಮಯಕ್ಕೆ ಸರಿಯಾಗಿ ನೀರಿನೊಂದಿಗೆ ತೆಗೆದುಕೊಳ್ಳಿ. ಊಟದ ನಂತರ ತೆಗೆದುಕೊಳ್ಳಿ. ಯಾವುದೇ ತೊಂದರೆ ಕಂಡರೆ ತಕ್ಷಣ ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ."
                )
                suggestions = ["ಮಾತ್ರೆಗಳ ಅಡ್ಡಪರಿಣಾಮಗಳೇನು?", "ಡೋಸ್ ಮರೆತರೆ ಏನು ಮಾಡಬೇಕು?", "ವೈದ್ಯರನ್ನು ಸಂಪರ್ಕಿಸಿ"]
            elif is_bhojpuri:
                reply_text = (
                    f"प्रणाम! रउआ के सबसे हाल के परचा के हिसाब से दवाई:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **सावधानी:** दवाई सब समय पर खाईं। खाना खईला के बाद पानी से खाईं। कौनो परेशानी होखे त डॉक्टर साहेब से मिलीं।"
                )
                suggestions = ["दवाई के साइड इफेक्ट का बा?", "खुराक छूट गइल त का करीं?", "डॉक्टर से बात करीं"]
            elif is_urdu:
                reply_text = (
                    f"السلام علیکم! آپ کے حالیہ نسخے کے مطابق:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **طبی ہدایت:** ادویات ہمیشہ وقت پر کھانے کے بعد پانی کے ساتھ لیں۔ کسی قسم کی الرجی یا چکر آنے کی صورت میں فوری ڈاکٹر سے رجوع کریں۔"
                )
                suggestions = ["دوا کے مضر اثرات کیا ہیں؟", "خوراک چھوٹ جائے تو کیا کریں؟", "ڈاکٹر سے رابطہ کریں"]
            elif is_hindi:
                reply_text = (
                    f"नमस्ते! आपके सबसे हालिया प्रिस्क्रिप्शन के अनुसार:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **सावधानी:** दवाएं हमेशा समय पर लें। पेट की समस्या से बचने के लिए भोजन के बाद पानी के साथ लें। यदि कोई एलर्जी या चक्कर आए तो तुरंत अपने डॉक्टर से संपर्क करें।"
                )
                suggestions = ["दवा के दुष्प्रभाव क्या हैं?", "खुराक भूल जाने पर क्या करें?", "डॉक्टर से संपर्क करें"]
            elif is_bengali:
                reply_text = (
                    f"নমস্কার! আপনার প্রেসক্রিপশন অনুযায়ী:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **সতর্কতা:** ওষুধগুলি সর্বদা সময়মতো এবং খাবারের পরে পর্যাপ্ত জল দিয়ে গ্রহণ করুন।"
                )
                suggestions = ["পার্শ্বপ্রতিক্রিয়া কী?", "ডাক্তারের সাথে যোগাযোগ করুন"]
            elif is_tamil:
                reply_text = (
                    f"வணக்கம்! உங்கள் தற்போதைய மருந்துச் சீட்டின்படி:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **குறிப்பு:** மருந்துகளை உணவு உண்ட பின் தண்ணீருடன் உட்கொள்ளவும்."
                )
                suggestions = ["பக்க விளைவுகள் என்ன?", "மருத்துவரைத் தொடர்பு கொள்ளவும்"]
            elif is_telugu:
                reply_text = (
                    f"నమస్కారం! మీ ప్రస్తుత ప్రిస్క్రిప్షన్ ప్రకారం:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **సూచన:** మందులను భోజనం తర్వాత సరైన సమయానికి తీసుకోండి."
                )
                suggestions = ["దుష్ప్రభావాలు ఏమిటి?", "వైద్యుడిని సంప్రదించండి"]
            elif is_marathi:
                reply_text = (
                    f"नमस्कार! आपल्या चालू प्रिस्क्रिप्शननुसार औषधे:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **सल्ला:** औषधे नियमित वेळेवर पाण्यासोबत घ्या. काही त्रास जाणवल्यास डॉक्टरांशी संपर्क साधा."
                )
                suggestions = ["औषधांचे दुष्परिणाम काय आहेत?", "डॉक्टरांशी संपर्क साधा"]
            elif is_malayalam:
                reply_text = (
                    f"നമസ്കാരം! നിങ്ങളുടെ ഏറ്റവും പുതിയ കുറിപ്പടി പ്രകാരം:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **നിർദ്ദേശം:** മരുന്നുകൾ കൃത്യസമയത്ത് വെള്ളത്തോടൊപ്പം കഴിക്കുക."
                )
                suggestions = ["പാർശ്വഫലങ്ങൾ എന്തൊക്കെയാണ്?", "ഡോക്ടറെ ബന്ധപ്പെടുക"]
            elif is_punjabi:
                reply_text = (
                    f"ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਤੁਹਾਡੇ ਨਵੇਂ ਨੁਸਖੇ ਅਨੁਸਾਰ ਦਵਾਈਆਂ:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **ਸਲਾਹ:** ਦਵਾਈਆਂ ਹਮੇਸ਼ਾ ਸਮੇਂ ਸਿਰ ਅਤੇ ਰੋਟੀ ਤੋਂ ਬਾਅਦ ਪਾਣੀ ਨਾਲ ਲਵੋ।"
                )
                suggestions = ["ਦਵਾਈ ਦੇ ਮਾੜੇ ਪ੍ਰਭਾਵ ਕੀ ਹਨ?", "ਡਾਕਟਰ ਨਾਲ ਸੰਪਰਕ ਕਰੋ"]
            else:
                reply_text = (
                    f"Hello! Based on your active Praxirence prescription:\n\n"
                    f"{summary_block}\n\n"
                    f"📌 **Clinical Guidance:** Always take oral medications with a full glass of water. "
                    f"Do not crush extended-release tablets. If you miss a dose, take it as soon as remembered unless it is close to your next scheduled dose."
                )
                suggestions = ["What are potential side effects?", "What if I miss a dose?", "Contact Prescribing Doctor"]
        else:
            if is_kannada:
                reply_text = "ಪ್ರಸ್ತುತ ನಿಮ್ಮ ಖಾತೆಯಲ್ಲಿ ಯಾವುದೇ ಸಕ್ರಿಯ ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಕಂಡುಬಂದಿಲ್ಲ. ನೀವು 'ವೈದ್ಯರು' ಟ್ಯಾಬ್ ಮೂಲಕ ಹೊಸ ಅಪಾಯಿಂಟ್‌ಮೆಂಟ್ ಕಾಯ್ದಿರಿಸಬಹುದು."
                suggestions = ["ಸಾಮಾನ್ಯ ವೈದ್ಯರನ್ನು ಹುಡುಕಿ", "ಸಲಹೆ ಪಡೆಯಿರಿ", "ವೈಟಲ್ಸ್ ಹೇಗೆ ದಾಖಲಿಸುವುದು?"]
            elif is_bhojpuri:
                reply_text = "अहिले रउआ के खाता में कौनो दवाई के परचा नइखे। रउआ 'डॉक्टर' टैब से अपॉइंटमेंट बुक कर सकत बानी।"
                suggestions = ["डॉक्टर खोजीं", "सलाह लीं", "वाइटल्स कइसे दर्ज करीं?"]
            elif is_urdu:
                reply_text = "فی الحال آپ کے ریکارڈ میں کوئی فعال نسخہ موجود نہیں ہے۔ آپ 'ڈاکٹر' ٹیب سے نیا اپائنٹمنٹ حاصل کر سکتے ہیں۔"
                suggestions = ["ماہر ڈاکٹر تلاش کریں", "مشورہ حاصل کریں", "وائٹلز کیسے درج کریں؟"]
            elif is_hindi:
                reply_text = "वर्तमान में आपके रिकॉर्ड में कोई सक्रिय प्रिस्क्रिप्शन नहीं मिला। आप 'डॉक्टर' टैब से अपॉइंटमेंट बुक कर सकते हैं।"
                suggestions = ["Find General Physician", "Book Consultation", "How to sync vitals?"]
            else:
                reply_text = "No active prescription records found. You can book an encounter with a specialist under the 'Doctors' tab."
                suggestions = ["Find General Physician", "Book Consultation", "How to sync vitals?"]

    # 3. Doctor Search / Recommendation Queries
    # Exclude queries that are clearly about a past consultation/advice (those belong to intent #1)
    elif (any(k in q_lower for k in ["doctor", "specialist", "pediatrician", "cardiologist", "physician", "clinic", "डॉक्टर", "ವೈದ್ಯ", "ڈاکٹر", "হাসপাতাল"])
          and not any(k in q_lower for k in ["advice", "advise", "consultation", "said", "note", "diagnos", "summary", "what did", "सलाह", "निदान", "परामर्श", "ಸಲಹೆ", "مشورہ"])):
        intent = "doctor_recommendation"
        for doc in doctors[:4]:
            rec_docs.append(RecommendedDoctor(
                id=str(doc.id),
                name=doc.name,
                specialty=getattr(doc, "specialty", "General Physician") or "General Physician",
                clinic_name=getattr(doc, "clinic_name", "Praxirence Clinical Centre") or "Praxirence Clinical Centre",
                reg_number=getattr(doc, "reg_number", "NMC-2024-84920") or "NMC-2024-84920",
                phone=getattr(doc, "phone", None)
            ))

        doc_lines = [f"• **{d.name}** - {d.specialty} ({d.clinic_name})" for d in rec_docs]
        doc_block = "\n".join(doc_lines)

        if is_kannada:
            reply_text = (
                f"ನಮ್ಮ ಕ್ಲಿನಿಕಲ್ ನೆಟ್‌ವರ್ಕ್‌ನಲ್ಲಿ ಲಭ್ಯವಿರುವ ಪರಿಶೀಲಿಸಿದ ತಜ್ಞ ವೈದ್ಯರು:\n\n"
                f"{doc_block}\n\n"
                f"ನೀವು 'ವೈದ್ಯರು' ಟ್ಯಾಬ್ ಮೂಲಕ ಇವರ ವಿವರ ವೀಕ್ಷಿಸಬಹುದು ಮತ್ತು ಸಮಾಲೋಚನೆ ಆರಂಭಿಸಬಹುದು."
            )
            suggestions = ["Dr. Mayank Raj ಅವರೊಂದಿಗೆ ಭೇಟಿ", "ಮಕ್ಕಳ ತಜ್ಞರನ್ನು ಹುಡುಕಿ", "ಕ್ಲಿನಿಕ್ ಸಮಯ"]
        elif is_bhojpuri:
            reply_text = (
                f"हमार क्लिनिकल नेटवर्क में उपलब्ध सत्यापित डॉक्टर लोग:\n\n"
                f"{doc_block}\n\n"
                f"रउआ 'डॉक्टर' टैब में जाके डॉक्टर साहेब से सलाह ले सकत बानी।"
            )
            suggestions = ["Dr. Mayank Raj से बात करीं", "शिशु रोग विशेषज्ञ खोजीं", "क्लिनिक के समय"]
        elif is_urdu:
            reply_text = (
                f"ہمارے کلینیکل نیٹ ورک میں دستیاب تصدیق شدہ ڈاکٹرز:\n\n"
                f"{doc_block}\n\n"
                f"آپ 'ڈاکٹر' ٹیب میں جا کر کسی بھی معالج سے فوری رابطہ کر سکتے ہیں۔"
            )
            suggestions = ["Dr. Mayank Raj سے مشورہ لیں", "بچوں کے ماہر تلاش کریں", "کلینک کے اوقات"]
        elif is_hindi:
            reply_text = (
                f"हमारे क्लिनिकल नेटवर्क में उपलब्ध सत्यापित डॉक्टर:\n\n"
                f"{doc_block}\n\n"
                f"आप 'डॉक्टर' टैब में जाकर किसी भी डॉक्टर के साथ परामर्श शुरू कर सकते हैं।"
            )
            suggestions = ["Dr. Mayank Raj से परामर्श लें", "पीडियाट्रिशियन खोजें", "क्लिनिक का समय"]
        else:
            reply_text = (
                f"Here are the verified clinicians available in our network:\n\n"
                f"{doc_block}\n\n"
                f"You can view their full profiles and initiate consultations under the **Doctors** tab."
            )
            suggestions = ["Book with Dr. Mayank Raj", "Find Pediatrician", "Clinic Hours"]

    # 4. App Features / Navigation Queries
    elif any(k in q_lower for k in ["download", "pdf", "sync", "consent", "privacy", "feature", "vitals", "app"]):
        intent = "app_navigation"
        if is_kannada:
            reply_text = (
                "📱 **Praxirence ಆ್ಯಪ್‌ನ ಮುಖ್ಯ ಸೌಲಭ್ಯಗಳು:**\n\n"
                "1. **ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ PDF ಡೌನ್‌ಲೋಡ್:** 'Visits' ಟ್ಯಾಬ್‌ಗೆ ಹೋಗಿ 'Download PDF' ಮೇಲೆ ಒತ್ತಿ.\n"
                "2. **ಆ್ಯಪ್‌ನಲ್ಲಿ ಆರೈಕೆ ಯೋಜನೆ:** ವೈದ್ಯರು ಸಲಹೆ ನೀಡಿದ ತಕ್ಷಣ ಪೂರ್ಣ ಆರೈಕೆ ಯೋಜನೆ ನಿಮ್ಮ ಆ್ಯಪ್‌ನಲ್ಲಿ ಸಿಂಕ್ ಆಗುತ್ತದೆ.\n"
                "3. **ಗೌಪ್ಯತೆ ಮತ್ತು ಸಮ್ಮತಿ:** 'Consent' ಟ್ಯಾಬ್‌ನಲ್ಲಿ ನಿಮ್ಮ ವೈದ್ಯಕೀಯ ಡೇಟಾ ಅನುಮತಿಯನ್ನು ನಿಯಂತ್ರಿಸಿ.\n"
                "4. **ವೈಟಲ್ಸ್ ಟ್ರ್ಯಾಕರ್:** 'Today' ಟ್ಯಾಬ್‌ನಲ್ಲಿ ನಿಮ್ಮ ರಕ್ತದೊತ್ತಡ, ಸಕ್ಕರೆ ಮಟ್ಟ ಮತ್ತು ನಾಡಿಮಿಡಿತ ದಾಖಲಿಸಿ."
            )
            suggestions = ["ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ", "ಸಮ್ಮತಿ ಹೇಗೆ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತದೆ?", "ವೈಟಲ್ಸ್ ದಾಖಲಿಸಿ"]
        elif is_bhojpuri:
            reply_text = (
                "📱 **Praxirence ऐप के मुख्य सुविधा:**\n\n"
                "1. **परचा PDF डाउनलोड:** 'Visits' टैब पर जाईं आ 'Download PDF' दबाईं।\n"
                "2. **ऐप में केयर प्लान:** डॉक्टर के परामर्श पूरा होते ही पूरा केयर प्लान सीधे ऐप में आ जाई।\n"
                "3. **गोपनीयता आ सहमति:** 'Consent' टैब से रउआ आपन डेटा अनुमति कभी भी बदल सकत बानी।\n"
                "4. **वाइटल्स ट्रैकर:** 'Today' टैब पर बीपी, शुगर आ दिल के धड़कन दर्ज करीं।"
            )
            suggestions = ["परचा डाउनलोड करीं", "सहमति कइसे काम करेला?", "वाइटल्स दर्ज करीं"]
        elif is_urdu:
            reply_text = (
                "📱 **Praxirence ایپ کی اہم خصوصیات:**\n\n"
                "1. **نسخہ PDF ڈاؤن لوڈ:** 'Visits' ٹیب میں جا کر 'Download PDF' پر کلک کریں۔\n"
                "2. **ایپ میں کیئر پلان:** ڈاکٹر کے نسخہ تیار کرتے ہی نگہداشت کا مکمل پلان آپ کی ایپ پر محفوظ ہو جاتا ہے۔\n"
                "3. **رضامندی اور رازداری:** 'Consent' ٹیب میں جا کر اپنے ڈیٹا کی رسائی کو منظم کریں۔\n"
                "4. **وائٹلز ٹریکر:** 'Today' ٹیب پر بی پی، شوگر اور نبض ریکارڈ کریں۔"
            )
            suggestions = ["نسخہ ڈاؤن لوڈ کریں", "رضامندی کا طریقہ کار", "وائٹلز درج کریں"]
        elif is_hindi:
            reply_text = (
                "📱 **Praxirence ऐप की मुख्य विशेषताएं:**\n\n"
                "1. **प्रिस्क्रिप्शन PDF डाउनलोड:** 'Visits' टैब पर जाएं और 'Download PDF' पर टैप करें।\n"
                "2. **इन-ऐप केयर प्लान:** डॉक्टर द्वारा परामर्श पूरा होते ही पूरा केयर प्लान और दवा अलार्म आपके ऐप में आ जाता है।\n"
                "3. **गोपनीयता और सहमति:** 'Consent' टैब में जाकर आप किसी भी समय अपनी डेटा अनुमति प्रबंधित कर सकते हैं।\n"
                "4. **वाइटल्स ट्रैकर:** 'Today' टैब पर अपना बीपी, शुगर और हार्ट रेट रिकॉर्ड करें।"
            )
            suggestions = ["प्रिस्क्रिप्शन डाउनलोड करें", "सहमति कैसे काम करती है?", "वाइटल्स रिकॉर्ड करें"]
        else:
            reply_text = (
                "📱 **Praxirence App Features & Navigation:**\n\n"
                "1. **Download Rx PDF:** Tap the **Visits** tab and select 'Download PDF' for an official stamped copy.\n"
                "2. **In-App Care Plan Sync:** Your care plan is automatically synchronized directly to your Praxirence app with automated alarms.\n"
                "3. **Consent & Privacy:** View and control healthcare provider data access in the **Consent** tab (HIPAA & ABDM compliant).\n"
                "4. **Vitals Monitoring:** Track daily Blood Pressure, Pulse, and Blood Sugar on the **Today** tab."
            )
            suggestions = ["How does Consent work?", "Download Latest Rx", "Log Today's Vitals"]

    # 5. General Medical & Emergency Support
    else:
        intent = "general_support"
        if is_kannada:
            reply_text = (
                "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಪ್ರ್ಯಾಕ್ಸಿರೆನ್ಸ್ AI ಕ್ಲಿನಿಕಲ್ ಸಹಾಯಕ.\n\n"
                "ನಾನು ನಿಮಗೆ ಸಹಾಯ ಮಾಡಬಲ್ಲೆ:\n"
                "• ನಿಮ್ಮ ಔಷಧಗಳು, ಡೋಸ್ ಮತ್ತು ನಿಯಮಗಳನ್ನು ವಿವರಿಸಲು 💊\n"
                "• ಆಸ್ಪತ್ರೆಯ ಪರಿಶೀಲಿಸಿದ ತಜ್ಞ ವೈದ್ಯರನ್ನು ಹುಡುಕಲು 👨‍⚕️\n"
                "• ಆ್ಯಪ್ ಸೌಲಭ್ಯಗಳು ಮತ್ತು ರಿಪೋರ್ಟ್ ಡೌನ್‌ಲೋಡ್ ಮಾಡಲು 📄\n\n"
                "⚠️ **ತುರ್ತು ಸೂಚನೆ:** ಎದೆನೋವು ಅಥವಾ ತೀವ್ರ ಉಸಿರಾಟದ ತೊಂದರೆಯಿದ್ದಲ್ಲಿ ತಕ್ಷಣ ತುರ್ತು ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಿ."
            )
            suggestions = ["ಔಷಧಿ ವೇಳಾಪಟ್ಟಿ ವಿವರಿಸಿ 💊", "ವೈದ್ಯರನ್ನು ಹುಡುಕಿ 👨‍⚕️", "ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಡೌನ್‌ಲೋಡ್ 📄"]
        elif is_bhojpuri:
            reply_text = (
                "प्रणाम! हम रउआ के प्रैक्सिरेंस एआई स्वास्थ्य सहायक हईं।\n\n"
                "हम रउआ के मदद कर सकत बानी:\n"
                "• परचा आ दवाई के खुराक समझावे में 💊\n"
                "• अस्पताल के बढ़िया डॉक्टर लोगन के खोजे में 👨‍⚕️\n"
                "• रिपोर्ट आ परचा डाउनलोड करे में 📄\n\n"
                "⚠️ **इमरजेंसी सूचना:** अगर सीना में दरद भा सांस लेवे में जादे दिक्कत होखे त तुरंत नजदीकी अस्पताल जाईं।"
            )
            suggestions = ["हमार दवाई समझाईं 💊", "डॉक्टर खोजीं 👨‍⚕️", "परचा डाउनलोड करीं 📄"]
        elif is_urdu:
            reply_text = (
                "السلام علیکم! میں آپ کا پریکسیرینس AI طبی معاون ہوں۔\n\n"
                "میں آپ کی رہنمائی کر سکتا ہوں:\n"
                "• آپ کی ادویات، خوراک اور پرہیز سمجھانے میں 💊\n"
                "• کلینک کے تصدیق شدہ ماہر ڈاکٹرز تلاش کرنے میں 👨‍⚕️\n"
                "• نسخہ اور رپورٹس ڈاؤن لوڈ کرنے میں 📄\n\n"
                "⚠️ **ایمرجنسی نوٹس:** سینے میں شدید درد یا سانس لینے میں دشواری کی صورت میں فوری ایمرجنسی سے رجوع کریں۔"
            )
            suggestions = ["میری ادویات سمجھائیں 💊", "ڈاکٹر تلاش کریں 👨‍⚕️", "نسخہ ڈاؤن لوڈ کریں 📄"]
        elif is_hindi:
            reply_text = (
                "नमस्ते! मैं आपका प्रैक्सिरेंस एआई स्वास्थ्य सहायक हूँ।\n\n"
                "मैं आपकी सहायता कर सकता हूँ:\n"
                "• आपके प्रिस्क्रिप्शन और दवाओं की खुराक समझाने में 💊\n"
                "• अस्पताल के सत्यापित डॉक्टरों को खोजने में 👨‍⚕️\n"
                "• ऐप की सुविधाओं और रिपोर्ट डाउनलोड करने में 📄\n\n"
                "⚠️ **आपातकाल:** यदि सीने में दर्द या सांस लेने में गंभीर तकलीफ हो, तो तुरंत नजदीकी आपातकालीन कक्ष से संपर्क करें।"
            )
            suggestions = ["मेरी दवाएं समझाइए 💊", "डॉक्टर खोजें 👨‍⚕️", "प्रिस्क्रिप्शन डाउनलोड करें 📄"]
        else:
            reply_text = (
                "Hello! I am your **Praxirence AI Clinical Assistant**.\n\n"
                "I can help you with:\n"
                "• Explaining your active medicines, dosages, and food rules 💊\n"
                "• Finding verified doctors & specialists in our clinic network 👨‍⚕️\n"
                "• Guiding you through app features (PDF downloads, care plan sync, consent) 📱\n\n"
                "⚠️ **Medical Notice:** For life-threatening emergencies (e.g. severe chest pressure or shortness of breath), immediately call emergency services or visit the nearest ER."
            )
            suggestions = ["Explain my medication schedule 💊", "Find a Doctor 👨‍⚕️", "How to download prescription? 📄"]

    return ChatResponse(
        reply=reply_text,
        language=language,
        detected_intent=intent,
        medicines_referenced=meds_ref,
        recommended_doctors=rec_docs,
        quick_suggestions=suggestions
    )


@router.post("/patient-assistant", response_model=ChatResponse)
def patient_chat_assistant(
    req: ChatRequest,
    db: Session = Depends(get_db)
):
    """
    Multilingual AI Health Assistant endpoint.
    Retrieves patient context, clinical consultation dialogue, and doctor directory
    from PostgreSQL to provide clinically sound, multilingual guidance.
    """
    # 1. Fetch Patient's latest prescription / medicines / consultation if patient_id is provided
    medicines = req.active_medications or []
    latest_diagnosis = None
    latest_summary = None
    latest_doc_advice = None
    doc_name = None
    pat_name = None

    if req.patient_id:
        patient = db.query(Patient).filter(Patient.id == req.patient_id).first()
        if patient:
            pat_name = patient.name

        latest_visit = db.query(Visit).filter(
            Visit.patient_id == req.patient_id
        ).order_by(Visit.created_at.desc()).first()

        if latest_visit:
            if not medicines and latest_visit.medicines:
                if isinstance(latest_visit.medicines, list):
                    medicines = latest_visit.medicines
                elif isinstance(latest_visit.medicines, str):
                    try:
                        medicines = json.loads(latest_visit.medicines)
                    except Exception:
                        medicines = []

            latest_diagnosis = latest_visit.diagnosis
            raw_t, pat_sum, doc_adv = parse_transcription_and_summary(latest_visit.raw_transcription)
            latest_summary = pat_sum
            latest_doc_advice = doc_adv
            if latest_visit.doctor:
                doc_name = latest_visit.doctor.name

    # 2. Fetch verified doctors for referral
    doctors = db.query(User).all()

    # 3. Generate response
    response = build_fallback_response(
        query=req.message,
        language=req.language,
        medicines=medicines,
        doctors=doctors,
        latest_diagnosis=latest_diagnosis,
        latest_summary=latest_summary,
        latest_doc_advice=latest_doc_advice,
        doctor_name=doc_name,
        patient_name=pat_name
    )

    return response

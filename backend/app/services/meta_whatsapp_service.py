"""
Meta WhatsApp Cloud API Service (Graph API v19.0)
Free tier compliant (1,000 free service conversations per month).
"""

import os
import logging
import httpx
from typing import Dict, Any, List, Optional
from app.core.config import settings

logger = logging.getLogger("praxirence.meta_whatsapp")

META_API_VERSION = "v19.0"
META_WHATSAPP_TOKEN = os.getenv("META_WHATSAPP_TOKEN", "")
META_PHONE_NUMBER_ID = os.getenv("META_PHONE_NUMBER_ID", "")


class MetaWhatsAppService:
    def __init__(self):
        self.token = getattr(settings, "META_WHATSAPP_TOKEN", "") or os.getenv("META_WHATSAPP_TOKEN", "")
        self.phone_number_id = getattr(settings, "META_PHONE_NUMBER_ID", "") or os.getenv("META_PHONE_NUMBER_ID", "")
        self.api_url = f"https://graph.facebook.com/{META_API_VERSION}/{self.phone_number_id}/messages" if self.phone_number_id else ""

    def format_care_plan_message(
        self,
        patient_name: str,
        doctor_name: str,
        diagnosis: str,
        medicines: List[Dict[str, Any]],
        reminders: List[Dict[str, Any]]
    ) -> str:
        """
        Formats structured care plan into a clean, patient-friendly WhatsApp message.
        """
        lines = [
            "🏥 *PRAXIRENCE HEALTHCARE CLINIC*",
            "📋 *Clinical Care Plan & Prescription*",
            "━━━━━━━━━━━━━━━━━━━━━━",
            f"👤 *Patient:* {patient_name}",
            f"🩺 *Doctor:* Dr. {doctor_name}",
            f"🔍 *Diagnosis:* {diagnosis}",
            "━━━━━━━━━━━━━━━━━━━━━━",
            "",
            "💊 *PRESCRIBED MEDICATIONS:*"
        ]

        for i, med in enumerate(medicines, 1):
            name = med.get("name", "Medication")
            dosage = med.get("dosage", "")
            freq = med.get("frequency", "")
            instructions = med.get("instructions", "As directed")
            duration = med.get("duration_days")
            dur_str = f" for {duration} days" if duration else ""

            lines.append(f"*{i}. {name}* ({dosage})")
            lines.append(f"   • Timing: {freq}{dur_str}")
            lines.append(f"   • Instructions: {instructions}")

        if reminders:
            lines.append("")
            lines.append("⏰ *SCHEDULED MEDICATION REMINDERS:*")
            for rem in reminders:
                if isinstance(rem, dict):
                    r_time = rem.get("time", "")
                    r_med = rem.get("medicine_name", "")
                    r_inst = rem.get("instructions", "")
                    lines.append(f"   🔔 *{r_time}* - {r_med} ({r_inst})")
                elif isinstance(rem, str):
                    lines.append(f"   🔔 {rem}")

        lines.append("")
        lines.append("━━━━━━━━━━━━━━━━━━━━━━")
        lines.append("📱 *Mobile App:* View live medication timers and history in the Praxirence patient app.")
        lines.append("⚠️ *Medical Emergency:* If symptoms rapidly worsen, visit nearest emergency room or dial emergency services.")
        lines.append("To opt out of automated messaging, reply STOP.")

        return "\n".join(lines)

    async def send_care_plan_whatsapp(
        self,
        to_phone: str,
        patient_name: str,
        doctor_name: str,
        diagnosis: str,
        medicines: List[Dict[str, Any]],
        reminders: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Sends the final care plan via Meta WhatsApp Cloud API.
        """
        message_body = self.format_care_plan_message(
            patient_name=patient_name,
            doctor_name=doctor_name,
            diagnosis=diagnosis,
            medicines=medicines,
            reminders=reminders
        )

        # Normalize phone: Meta expects international digits only (e.g. 919876543210 or 15551234567, no '+')
        clean_phone = "".join(c for c in to_phone if c.isdigit())

        # If Meta credentials configured, execute HTTP request
        if self.token and self.phone_number_id:
            try:
                headers = {
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": clean_phone,
                    "type": "text",
                    "text": {
                        "preview_url": False,
                        "body": message_body
                    }
                }

                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(self.api_url, json=payload, headers=headers)
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        message_id = data.get("messages", [{}])[0].get("id", "meta_msg_id")
                        logger.info(f"Meta WhatsApp Cloud API delivered message {message_id} to {clean_phone}")
                        return {"success": True, "message_id": message_id, "status": "sent"}
                    else:
                        logger.error(f"Meta WhatsApp API returned error {resp.status_code}: {resp.text}")
                        return {"success": False, "error": resp.text}

            except Exception as e:
                logger.error(f"Failed to send message via Meta WhatsApp Cloud API: {e}")
                return {"success": False, "error": str(e)}

        # Realistic Dev Mode Mock
        logger.info(
            f"[META WHATSAPP CLOUD API (DEV MOCK)]\n"
            f"To: +{clean_phone}\n"
            f"Body:\n{message_body}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        return {
            "success": True,
            "message_id": f"wamid.mock_meta_{clean_phone[-4:]}",
            "status": "delivered_mock",
            "provider": "Meta WhatsApp Cloud API"
        }


    async def send_otp_whatsapp(self, to_phone: str, otp_code: str) -> Dict[str, Any]:
        """
        Dispatches a secure 6-digit verification OTP directly to the patient's WhatsApp.
        """
        clean_phone = "".join(c for c in to_phone if c.isdigit())
        message_body = (
            "🔐 *PRAXIRENCE CLINICAL VERIFICATION*\n\n"
            f"Your one-time verification OTP is: *{otp_code}*\n\n"
            "⏳ This code is valid for 5 minutes.\n"
            "🔒 For your medical privacy, never share this code with anyone.\n\n"
            "🏥 _Praxirence Digital Health Platform_"
        )

        if self.token and self.phone_number_id:
            try:
                headers = {
                    "Authorization": f"Bearer {self.token}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "messaging_product": "whatsapp",
                    "recipient_type": "individual",
                    "to": clean_phone,
                    "type": "text",
                    "text": {
                        "preview_url": False,
                        "body": message_body
                    }
                }

                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(self.api_url, json=payload, headers=headers)
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        msg_id = data.get("messages", [{}])[0].get("id", "wamid.meta_otp")
                        logger.info(f"Meta WhatsApp OTP successfully delivered to {clean_phone}: {msg_id}")
                        return {"success": True, "message_id": msg_id, "provider": "Meta WhatsApp Cloud API", "status": "sent"}
                    else:
                        logger.error(f"Meta WhatsApp OTP error {resp.status_code}: {resp.text}")
                        return {"success": False, "error": resp.text}

            except Exception as e:
                logger.error(f"Failed to send WhatsApp OTP: {e}")
                return {"success": False, "error": str(e)}

        # Dev Mode Mock
        logger.info(
            f"[META WHATSAPP OTP (DEV MOCK)]\n"
            f"To: +{clean_phone}\n"
            f"OTP Code: {otp_code}\n"
            f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        return {
            "success": True,
            "message_id": f"wamid.mock_otp_{clean_phone[-4:]}",
            "status": "delivered_mock",
            "provider": "Meta WhatsApp Cloud API (Dev Mode)",
            "code": otp_code
        }


meta_whatsapp_service = MetaWhatsAppService()

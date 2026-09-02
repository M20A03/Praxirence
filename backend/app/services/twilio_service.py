import logging
from typing import Dict, Any, List, Optional
from app.core.config import settings

logger = logging.getLogger("praxirence.twilio")


class TwilioService:
    def __init__(self):
        self.account_sid = settings.TWILIO_ACCOUNT_SID
        self.auth_token = settings.TWILIO_AUTH_TOKEN
        self.whatsapp_from = settings.TWILIO_WHATSAPP_FROM
        self.verify_service_sid = settings.TWILIO_VERIFY_SERVICE_SID
        self._client = None

        if self.account_sid and self.auth_token:
            try:
                from twilio.rest import Client
                self._client = Client(self.account_sid, self.auth_token)
                logger.info("Twilio client initialized successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize Twilio client: {e}")

    def format_care_plan_whatsapp_message(
        self,
        patient_name: str,
        doctor_name: str,
        diagnosis: str,
        medicines: List[Dict[str, Any]],
        reminders: List[Dict[str, Any]]
    ) -> str:
        """
        Formats a clinically structured, patient-friendly WhatsApp message.
        """
        lines = [
            f"🏥 *PRAXIRENCE HEALTHCARE CLINIC*",
            f"📋 *Your Care Plan & Prescription*",
            f"━━━━━━━━━━━━━━━━━━━━━━",
            f"👤 *Patient:* {patient_name}",
            f"🩺 *Doctor:* Dr. {doctor_name}",
            f"🔍 *Diagnosis:* {diagnosis}",
            f"━━━━━━━━━━━━━━━━━━━━━━",
            f"",
            f"💊 *PRESCRIBED MEDICATIONS:*"
        ]

        for i, med in enumerate(medicines, 1):
            name = med.get("name", "Medication")
            dosage = med.get("dosage", "")
            freq = med.get("frequency", "")
            instructions = med.get("instructions", "As directed")
            duration = med.get("duration_days", "")
            duration_str = f" for {duration} days" if duration else ""

            lines.append(f"*{i}. {name}* ({dosage})")
            lines.append(f"   • Timing: {freq}{duration_str}")
            lines.append(f"   • Note: {instructions}")

        if reminders:
            lines.append("")
            lines.append("⏰ *SCHEDULED REMINDERS:*")
            # Group reminders by time
            for rem in reminders:
                r_time = rem.get("time", "")
                r_med = rem.get("medicine_name", "")
                r_inst = rem.get("instructions", "")
                lines.append(f"   🔔 *{r_time}* - {r_med} ({r_inst})")

        lines.append("")
        lines.append("━━━━━━━━━━━━━━━━━━━━━━")
        lines.append("📱 *View in Praxirence App:* Open your patient mobile app for live timers and dosage tracker.")
        lines.append("⚠️ *Emergency:* If symptoms worsen, please visit your nearest clinic or call emergency services.")
        lines.append("To opt out of messages, reply STOP.")

        return "\n".join(lines)

    def send_whatsapp_care_plan(
        self,
        to_phone: str,
        patient_name: str,
        doctor_name: str,
        diagnosis: str,
        medicines: List[Dict[str, Any]],
        reminders: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Sends the final care plan via Twilio WhatsApp API.
        """
        message_body = self.format_care_plan_whatsapp_message(
            patient_name=patient_name,
            doctor_name=doctor_name,
            diagnosis=diagnosis,
            medicines=medicines,
            reminders=reminders
        )

        formatted_to = to_phone if to_phone.startswith("+") else f"+{to_phone}"
        whatsapp_to = f"whatsapp:{formatted_to}"

        if self._client:
            try:
                logger.info(f"Sending WhatsApp care plan to {whatsapp_to}...")
                message = self._client.messages.create(
                    from_=self.whatsapp_from,
                    to=whatsapp_to,
                    body=message_body
                )
                logger.info(f"WhatsApp sent successfully. SID: {message.sid}")
                return {"success": True, "message_sid": message.sid, "status": message.status}
            except Exception as e:
                logger.error(f"Failed to send WhatsApp via Twilio: {e}")
                return {"success": False, "error": str(e)}

        # Mock / Simulation mode
        logger.info(
            f"[MOCK WHATSAPP DISPATCH]\n"
            f"To: {whatsapp_to}\n"
            f"From: {self.whatsapp_from}\n"
            f"Body Preview:\n{message_body}\n"
            f"----------------------------------------"
        )
        return {"success": True, "message_sid": "mock_whatsapp_sid_12345", "status": "delivered_mock"}

    def send_otp(self, phone: str) -> Dict[str, Any]:
        """
        Sends OTP for patient authentication via Twilio Verify or simulated code.
        """
        formatted_phone = phone if phone.startswith("+") else f"+{phone}"

        if self._client and self.verify_service_sid:
            try:
                verification = self._client.verify.v2.services(self.verify_service_sid) \
                    .verifications \
                    .create(to=formatted_phone, channel="sms")
                logger.info(f"OTP verification sent to {formatted_phone}: {verification.status}")
                return {"success": True, "status": verification.status}
            except Exception as e:
                logger.error(f"Twilio Verify error: {e}")
                return {"success": False, "error": str(e)}

        # Simulated OTP for development
        logger.info(f"[MOCK OTP GENERATION] OTP for {formatted_phone} is '123456'")
        return {"success": True, "status": "pending_mock", "demo_code": "123456"}

    def verify_otp(self, phone: str, code: str) -> bool:
        """
        Verifies OTP code.
        """
        formatted_phone = phone if phone.startswith("+") else f"+{phone}"

        if self._client and self.verify_service_sid:
            try:
                check = self._client.verify.v2.services(self.verify_service_sid) \
                    .verification_checks \
                    .create(to=formatted_phone, code=code)
                return check.status == "approved"
            except Exception as e:
                logger.error(f"Twilio Verify check error: {e}")
                return False

        # In mock mode, allow '123456' or any 6-digit code in debug
        if code == "123456" or (settings.DEBUG and len(code) == 6):
            logger.info(f"[MOCK OTP VERIFIED] Accepted code {code} for {formatted_phone}")
            return True

        return False


twilio_service = TwilioService()

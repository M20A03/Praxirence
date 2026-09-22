"""
Email Service for Praxirence Clinical Portal
Dispatches branded, high-security Email OTP verification codes to doctors and institutional users.
Supports standard SMTP, Gmail App Passwords, AWS SES, Resend, and simulated local dispatch.
"""

import smtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Tuple
from datetime import datetime, timedelta, timezone
from app.core.config import settings

logger = logging.getLogger("praxirence.email")

# In-memory OTP storage for email verification: {email: {"code": "123456", "expires_at": datetime}}
_email_otp_cache: Dict[str, Dict] = {}
_rate_limit_cache: Dict[str, list] = {}


def check_otp_rate_limit(identifier: str, max_requests: int = 3, window_seconds: int = 600) -> bool:
    """
    Returns True if request is allowed, False if rate limited (max 3 per 10 mins).
    Prevents mail/SMS server blacklisting and OTP flooding attacks.
    """
    import time
    now = time.time()
    clean_id = identifier.lower().strip()
    history = _rate_limit_cache.get(clean_id, [])
    # Filter out entries older than window
    valid_history = [t for t in history if now - t < window_seconds]
    if len(valid_history) >= max_requests:
        _rate_limit_cache[clean_id] = valid_history
        return False
    valid_history.append(now)
    _rate_limit_cache[clean_id] = valid_history
    return True


def generate_email_otp() -> str:
    """Generate cryptographically secure 6-digit verification code"""
    import secrets
    return f"{secrets.randbelow(900000) + 100000}"


def store_email_otp(email: str, code: str, name: Optional[str] = None, ttl_minutes: int = 10):
    """Store email OTP with expiry and optional recipient name"""
    clean_email = email.lower().strip()
    _email_otp_cache[clean_email] = {
        "code": code,
        "name": name,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    }


def get_stored_email_otp_name(email: str) -> Optional[str]:
    """Retrieve name provided when OTP was requested"""
    clean_email = email.lower().strip()
    record = _email_otp_cache.get(clean_email)
    if record and record.get("name"):
        return record["name"]
    return None


def verify_email_otp(email: str, code: str) -> bool:
    """Verify email OTP against cache or active demo code"""
    clean_email = email.lower().strip()

    record = _email_otp_cache.get(clean_email)
    if not record:
        return False

    if datetime.now(timezone.utc) > record["expires_at"]:
        _email_otp_cache.pop(clean_email, None)
        return False

    if record["code"] == code.strip():
        _email_otp_cache.pop(clean_email, None)
        return True

    return False


class EmailService:
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_user = settings.SMTP_USER
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.SMTP_FROM_EMAIL
        self.from_name = settings.SMTP_FROM_NAME
        self.gmail_webhook_url = getattr(settings, "GMAIL_WEBHOOK_URL", None)
        self.resend_api_key = getattr(settings, "RESEND_API_KEY", None)
        self.brevo_api_key = getattr(settings, "BREVO_API_KEY", None)

    def _send_mime_email(self, subject: str, plain_text: str, html_content: str, recipient_email: str) -> Tuple[bool, str]:
        """
        Dispatches email via HTTPS REST APIs (Port 443 - never blocked by cloud firewalls like Railway)
        with automated fallback to dual-port SMTP (Port 587 STARTTLS -> Port 465 SSL).
        
        Returns:
            Tuple[bool, str]: (is_success, delivery_info_or_failure_reason)
        """
        import urllib.request
        import urllib.error
        import json

        last_error = "No active email dispatch provider found"

        # 1. Google Apps Script Webhook (Port 443 HTTPS - Zero-Domain required, sends to ANY recipient from user's Gmail)
        if self.gmail_webhook_url:
            try:
                payload = {
                    "to": recipient_email,
                    "subject": subject,
                    "html": html_content,
                    "text": plain_text
                }
                webhook_sent = False
                try:
                    import httpx
                    with httpx.Client(follow_redirects=False, timeout=10.0) as client:
                        resp = client.post(
                            self.gmail_webhook_url,
                            json=payload,
                            headers={"Content-Type": "application/json"}
                        )
                        if resp.status_code in (200, 201, 302):
                            logger.info(f"Dispatched email to {recipient_email} via Google Apps Script Webhook (httpx in {resp.status_code})")
                            return True, "Google Apps Script Webhook"
                except ImportError:
                    pass

                if not webhook_sent:
                    req = urllib.request.Request(
                        self.gmail_webhook_url,
                        data=json.dumps(payload).encode("utf-8"),
                        headers={
                            "Content-Type": "application/json",
                            "User-Agent": "Mozilla/5.0 (compatible; PraxirenceCloud/2.0; +https://praxirence.com)"
                        }
                    )
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        if resp.status in (200, 201, 302):
                            logger.info(f"Dispatched email to {recipient_email} via Google Apps Script Webhook (urllib)")
                            return True, "Google Apps Script Webhook"
            except Exception as e:
                logger.warning(f"Google Apps Script Webhook dispatch notice: {e}")
                last_error = f"Google Webhook error: {e}"

        # 2. Resend HTTPS REST API (Port 443)
        if self.resend_api_key:
            try:
                resend_sender = "Praxirence <onboarding@resend.dev>" if "@gmail.com" in self.from_email.lower() else f"{self.from_name} <{self.from_email}>"
                req = urllib.request.Request(
                    "https://api.resend.com/emails",
                    data=json.dumps({
                        "from": resend_sender,
                        "to": [recipient_email],
                        "subject": subject,
                        "html": html_content,
                        "text": plain_text
                    }).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {self.resend_api_key}",
                        "Content-Type": "application/json",
                        "User-Agent": "Mozilla/5.0 (compatible; PraxirenceCloud/2.0; +https://praxirence.com)"
                    }
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status in (200, 201):
                        logger.info(f"Dispatched email to {recipient_email} via Resend HTTPS API")
                        return True, "Resend HTTPS API"
            except urllib.error.HTTPError as http_err:
                err_body = http_err.read().decode("utf-8", errors="ignore")
                logger.warning(f"Resend HTTPS HTTPError {http_err.code} for {recipient_email}: {err_body}")
                if http_err.code == 403 or "only send testing emails" in err_body:
                    last_error = f"Resend sandbox permits live delivery only to account owner ({self.from_email}) until custom domain DNS is configured"
                elif http_err.code == 422:
                    last_error = f"Resend validation error for {recipient_email}"
                else:
                    last_error = f"Resend HTTP {http_err.code}: {err_body}"
            except Exception as e:
                logger.warning(f"Resend HTTPS dispatch notice: {e}")
                last_error = f"Resend API error: {e}"

        # 3. Brevo (Sendinblue) HTTPS REST API (Port 443)
        if self.brevo_api_key:
            try:
                req = urllib.request.Request(
                    "https://api.brevo.com/v3/smtp/email",
                    data=json.dumps({
                        "sender": {"name": self.from_name, "email": self.from_email},
                        "to": [{"email": recipient_email}],
                        "subject": subject,
                        "htmlContent": html_content,
                        "textContent": plain_text
                    }).encode("utf-8"),
                    headers={
                        "api-key": self.brevo_api_key,
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "User-Agent": "Mozilla/5.0 (compatible; PraxirenceCloud/2.0; +https://praxirence.com)"
                    }
                )
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status in (200, 201):
                        logger.info(f"Dispatched email to {recipient_email} via Brevo HTTPS API")
                        return True, "Brevo HTTPS API"
            except urllib.error.HTTPError as http_err:
                err_body = http_err.read().decode("utf-8", errors="ignore")
                logger.warning(f"Brevo HTTPS HTTPError {http_err.code} for {recipient_email}: {err_body}")
                last_error = f"Brevo HTTP {http_err.code}: {err_body}"
            except Exception as e:
                logger.warning(f"Brevo HTTPS dispatch notice: {e}")
                last_error = f"Brevo API error: {e}"

        # 4. SMTP fallback (Dual-port 587 STARTTLS -> 465 SSL)
        if self.smtp_host and self.smtp_user and self.smtp_password:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = recipient_email
            msg["Reply-To"] = self.from_email
            msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            # Port 587
            try:
                context = ssl.create_default_context()
                with smtplib.SMTP(self.smtp_host, 587, timeout=10) as server:
                    server.starttls(context=context)
                    server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.from_email, recipient_email, msg.as_string())
                logger.info(f"Dispatched verification email to {recipient_email} via SMTP (Port 587 STARTTLS)")
                return True, "SMTP (Port 587 STARTTLS)"
            except Exception as e587:
                logger.warning(f"SMTP Port 587 STARTTLS notice for {recipient_email} ({e587}), attempting Port 465 SSL fallback...")
                last_error = f"SMTP 587 failed: {e587}"

            # Port 465
            try:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(self.smtp_host, 465, context=context, timeout=10) as server:
                    server.login(self.smtp_user, self.smtp_password)
                    server.sendmail(self.from_email, recipient_email, msg.as_string())
                logger.info(f"Dispatched verification email to {recipient_email} via SMTP_SSL (Port 465 SSL)")
                return True, "SMTP (Port 465 SSL)"
            except Exception as e465:
                logger.error(f"SMTP Port 465 SSL also failed for {recipient_email}: {e465}")
                last_error = f"SMTP 465 failed: {e465}"

        return False, last_error

    def send_doctor_verification_otp(
        self,
        recipient_email: str,
        otp_code: str,
        recipient_name: Optional[str] = None
    ) -> bool:
        """
        Sends an official verification email with 6-digit OTP code to a clinician.
        """
        name_display = recipient_name if recipient_name else "Doctor"
        if not name_display.startswith("Dr.") and "Doctor" not in name_display:
            name_display = f"Dr. {name_display}"

        subject = f"Praxirence: Your Verification Code is {otp_code}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }}
            .container {{ max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }}
            .header {{ background-color: #0f172a; padding: 24px; text-align: center; }}
            .header h1 {{ color: #ffffff; margin: 0; font-size: 20px; letter-spacing: -0.5px; font-weight: 700; }}
            .header p {{ color: #06b6d4; margin: 4px 0 0; font-size: 13px; font-weight: 500; }}
            .content {{ padding: 32px 28px; }}
            .greeting {{ font-size: 16px; font-weight: 600; margin-bottom: 12px; }}
            .otp-box {{ background-color: #f1f5f9; border: 2px dashed #0284c7; border-radius: 8px; text-align: center; padding: 18px; margin: 24px 0; }}
            .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: monospace; }}
            .badge {{ display: inline-block; background-color: #ecfdf5; color: #059669; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px; margin-top: 6px; }}
            .warning {{ font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 20px; }}
            .footer {{ background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>PRAXIRENCE</h1>
              <p>Healthcare & Care Consultation App</p>
            </div>
            <div class="content">
              <div class="greeting">Hello {name_display},</div>
              <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                We received a request to verify your account for the Praxirence app. Please use the verification code below:
              </p>
              
              <div class="otp-box">
                <div class="otp-code">{otp_code}</div>
                <div class="badge">Valid for 10 minutes</div>
              </div>

              <p class="warning">
                <strong>Security Notice:</strong> Never share this verification code with anyone. Praxirence staff will never ask for your authentication credentials. If you did not initiate this request, please disregard this email.
              </p>
            </div>
            <div class="footer">
              End-to-End Encrypted • DPDP Act 2023 Compliant • Praxirence App
            </div>
          </div>
        </body>
        </html>
        """

        plain_text = (
            f"Hello {name_display},\n\n"
            f"Your Praxirence verification code is: {otp_code}\n\n"
            f"This code will expire in 10 minutes. If you did not initiate this request, please disregard.\n\n"
            f"— Praxirence Team"
        )

        # Live Delivery via Webhook / Resend API / Brevo / Dual-Port SMTP
        success, info = self._send_mime_email(subject, plain_text, html_content, recipient_email)
        if success:
            logger.info(f"Successfully dispatched real verification email to {recipient_email} via {info}")
            return True, info
        
        # Simulated logging when delivery fails or sandbox is active
        logger.warning(
            f"\n"
            f"===============================================================\n"
            f"📧 PRAXIRENCE CLINICAL EMAIL NOTICE (noreply@praxirence.com)\n"
            f"To: {recipient_email} ({name_display})\n"
            f"Subject: {subject}\n"
            f"STATUS: Live delivery unavailable ({info})\n"
            f"FALLBACK OTP CODE: {otp_code} (10m TTL)\n"
            f"===============================================================\n"
        )
        return False, info

    def send_patient_verification_otp(
        self,
        recipient_email: str,
        otp_code: str,
        recipient_name: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Sends an official verification email with 6-digit OTP code to a patient.
        """
        name_display = recipient_name if recipient_name else "Patient"
        subject = f"Praxirence: Your Verification Code is {otp_code}"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f0fdf4; margin: 0; padding: 20px; color: #1e293b; }}
            .container {{ max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #bbf7d0; overflow: hidden; }}
            .header {{ background-color: #064e3b; padding: 24px; text-align: center; }}
            .header h1 {{ color: #ffffff; margin: 0; font-size: 20px; letter-spacing: -0.5px; font-weight: 700; }}
            .header p {{ color: #34d399; margin: 4px 0 0; font-size: 13px; font-weight: 500; }}
            .content {{ padding: 32px 28px; }}
            .greeting {{ font-size: 16px; font-weight: 600; margin-bottom: 12px; color: #065f46; }}
            .otp-box {{ background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 8px; text-align: center; padding: 18px; margin: 24px 0; }}
            .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #064e3b; font-family: monospace; }}
            .badge {{ display: inline-block; background-color: #d1fae5; color: #065f46; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 12px; margin-top: 6px; }}
            .warning {{ font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 20px; }}
            .footer {{ background-color: #f8fafc; padding: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>PRAXIRENCE</h1>
              <p>Healthcare & Care Consultation App</p>
            </div>
            <div class="content">
              <div class="greeting">Hello {name_display},</div>
              <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                Here is your single-use verification code to log in to the Praxirence app:
              </p>
              
              <div class="otp-box">
                <div class="otp-code">{otp_code}</div>
                <div class="badge">Valid for 10 minutes</div>
              </div>

              <p class="warning">
                <strong>Security Notice:</strong> Never share this verification code with anyone. Praxirence staff will never call or ask for this code.
              </p>
            </div>
            <div class="footer">
              End-to-End Encrypted • DPDP Act 2023 Compliant • Praxirence App
            </div>
          </div>
        </body>
        </html>
        """

        plain_text = (
            f"Hello {name_display},\n\n"
            f"Your Praxirence app login verification code is: {otp_code}\n\n"
            f"This code is valid for 10 minutes. Please enter it in the app to log in.\n\n"
            f"— Praxirence Team"
        )
        # Live Delivery via Webhook / Resend API / Brevo / Dual-Port SMTP
        success, info = self._send_mime_email(subject, plain_text, html_content, recipient_email)
        if success:
            logger.info(f"Successfully dispatched real patient verification email to {recipient_email} via {info}")
            return True, info

        logger.warning(
            f"\n"
            f"===============================================================\n"
            f"📧 PRAXIRENCE CARE PATIENT EMAIL NOTICE (noreply@praxirence.com)\n"
            f"To: {recipient_email} ({name_display})\n"
            f"Subject: {subject}\n"
            f"STATUS: Live delivery unavailable ({info})\n"
            f"FALLBACK OTP CODE: {otp_code} (10m TTL)\n"
            f"===============================================================\n"
        )
        return False, info


email_service = EmailService()

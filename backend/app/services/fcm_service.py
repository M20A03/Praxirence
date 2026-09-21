import logging
import os
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger("praxirence.fcm")


class FCMService:
    def __init__(self):
        self.credentials_path = settings.FIREBASE_CREDENTIALS_PATH
        self._app = None
        self._enabled = False

        # 1. Check for base64-encoded credentials (ideal for cloud hosts like Railway)
        b64_creds = getattr(settings, "FIREBASE_CREDENTIALS_BASE64", None) or os.getenv("FIREBASE_CREDENTIALS_BASE64")
        if b64_creds:
            try:
                import json
                import base64
                import firebase_admin
                from firebase_admin import credentials
                cert_dict = json.loads(base64.b64decode(b64_creds).decode("utf-8"))
                if not firebase_admin._apps:
                    self._app = firebase_admin.initialize_app(credentials.Certificate(cert_dict))
                else:
                    self._app = firebase_admin.get_app()
                self._enabled = True
                logger.info("Firebase Admin SDK initialized successfully via FIREBASE_CREDENTIALS_BASE64.")
                return
            except Exception as e:
                logger.warning(f"Failed to initialize Firebase Admin via base64: {e}")

        # 2. Check for inline JSON credentials
        raw_json_creds = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
        if raw_json_creds:
            try:
                import json
                import firebase_admin
                from firebase_admin import credentials
                cert_dict = json.loads(raw_json_creds)
                if not firebase_admin._apps:
                    self._app = firebase_admin.initialize_app(credentials.Certificate(cert_dict))
                else:
                    self._app = firebase_admin.get_app()
                self._enabled = True
                logger.info("Firebase Admin SDK initialized successfully via FIREBASE_SERVICE_ACCOUNT_JSON.")
                return
            except Exception as e:
                logger.warning(f"Failed to initialize Firebase Admin via raw JSON: {e}")

        # 3. File path credentials (local development fallback)
        cred_path = self.credentials_path
        if cred_path and not os.path.exists(cred_path):
            alt = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", cred_path))
            if os.path.exists(alt):
                cred_path = alt

        if cred_path and os.path.exists(cred_path):
            try:
                import firebase_admin
                from firebase_admin import credentials
                cred = credentials.Certificate(cred_path)
                if not firebase_admin._apps:
                    self._app = firebase_admin.initialize_app(cred)
                else:
                    self._app = firebase_admin.get_app()
                self._enabled = True
                logger.info("Firebase Admin SDK initialized successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize Firebase Admin: {e}")

    def send_push_notification(
        self,
        token: str,
        title: str,
        body: str,
        data: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Sends a push notification to patient's device via FCM.
        """
        if not token:
            return {"success": False, "error": "No FCM token provided"}

        if self._enabled:
            try:
                from firebase_admin import messaging
                message = messaging.Message(
                    notification=messaging.Notification(
                        title=title,
                        body=body,
                    ),
                    data=data or {},
                    token=token,
                )
                response = messaging.send(message)
                logger.info(f"FCM push notification sent successfully: {response}")
                return {"success": True, "message_id": response}
            except Exception as e:
                logger.error(f"FCM send error: {e}")
                return {"success": False, "error": str(e)}

        # Simulated push notification in development
        logger.info(
            f"[MOCK FCM NOTIFICATION]\n"
            f"Token: {token[:15]}...\n"
            f"Title: {title}\n"
            f"Body: {body}\n"
            f"Data: {data}\n"
            f"----------------------------------------"
        )
        return {"success": True, "message_id": "mock_fcm_msg_12345"}


fcm_service = FCMService()

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

        if self.credentials_path and os.path.exists(self.credentials_path):
            try:
                import firebase_admin
                from firebase_admin import credentials
                cred = credentials.Certificate(self.credentials_path)
                self._app = firebase_admin.initialize_app(cred)
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

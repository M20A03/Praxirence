"""
Realtime WebSocket Hub for Doctor and Patient Mobile Apps
Provides low-latency bidirectional WebSocket events between Doctor App and Patient App.
Handles live prescription delivery, pill adherence confirmations, vital alerts, and consult streaming.
"""

import json
import logging
from datetime import datetime
from typing import Dict, Set, Any
from fastapi import WebSocket

logger = logging.getLogger("praxirence.realtime")


class RealtimeConnectionManager:
    def __init__(self):
        # Maps user_id -> Set of active WebSocket connections
        self.patient_connections: Dict[str, Set[WebSocket]] = {}
        self.doctor_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, role: str, user_id: str):
        await websocket.accept()
        if role == "doctor":
            if user_id not in self.doctor_connections:
                self.doctor_connections[user_id] = set()
            self.doctor_connections[user_id].add(websocket)
            logger.info(f"👨‍⚕️ Doctor {user_id} connected via WebSocket. (Total active: {len(self.doctor_connections[user_id])})")
        elif role == "patient":
            if user_id not in self.patient_connections:
                self.patient_connections[user_id] = set()
            self.patient_connections[user_id].add(websocket)
            logger.info(f"👤 Patient {user_id} connected via WebSocket. (Total active: {len(self.patient_connections[user_id])})")

    def disconnect(self, websocket: WebSocket, role: str, user_id: str):
        if role == "doctor" and user_id in self.doctor_connections:
            self.doctor_connections[user_id].discard(websocket)
            if not self.doctor_connections[user_id]:
                del self.doctor_connections[user_id]
            logger.info(f"👨‍⚕️ Doctor {user_id} disconnected.")
        elif role == "patient" and user_id in self.patient_connections:
            self.patient_connections[user_id].discard(websocket)
            if not self.patient_connections[user_id]:
                del self.patient_connections[user_id]
            logger.info(f"👤 Patient {user_id} disconnected.")

    async def emit_to_patient(self, patient_id: str, event: str, payload: Any):
        """Sends instant real-time event to all active sessions of a patient."""
        message = json.dumps({"event": event, "payload": payload})
        targets = self.patient_connections.get(patient_id, set())
        dead_connections = set()
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception as e:
                logger.warning(f"Failed to send to patient {patient_id}: {e}")
                dead_connections.add(ws)
        for dead in dead_connections:
            targets.discard(dead)

    async def emit_to_doctor(self, doctor_id: str, event: str, payload: Any):
        """Sends instant real-time event to all active sessions of a doctor."""
        message = json.dumps({"event": event, "payload": payload})
        targets = self.doctor_connections.get(doctor_id, set())
        dead_connections = set()
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception as e:
                logger.warning(f"Failed to send to doctor {doctor_id}: {e}")
                dead_connections.add(ws)
        for dead in dead_connections:
            targets.discard(dead)

    def emit_to_doctor_sync(self, doctor_id: str, event: str, payload: Any):
        """Dispatches event to doctor from synchronous route handlers."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self.emit_to_doctor(doctor_id, event, payload))
            else:
                loop.run_until_complete(self.emit_to_doctor(doctor_id, event, payload))
        except Exception as e:
            logger.warning(f"Sync emit to doctor notice: {e}")

    def emit_to_patient_sync(self, patient_id: str, event: str, payload: Any):
        """Dispatches event to patient from synchronous route handlers."""
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                loop.create_task(self.emit_to_patient(patient_id, event, payload))
            else:
                loop.run_until_complete(self.emit_to_patient(patient_id, event, payload))
        except Exception as e:
            logger.warning(f"Sync emit to patient notice: {e}")

    async def broadcast_vital_alert(self, doctor_id: str, patient_name: str, metric: str, value: str):
        """Broadcasts critical vital spike alert to doctor's device."""
        await self.emit_to_doctor(doctor_id, "CRITICAL_VITAL_ALERT", {
            "patient_name": patient_name,
            "metric": metric,
            "value": value,
            "severity": "HIGH",
            "timestamp": str(datetime.utcnow())
        })


realtime_manager = RealtimeConnectionManager()

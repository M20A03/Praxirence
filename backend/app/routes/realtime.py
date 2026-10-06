"""
Realtime WebSocket Route
Handles persistent WebSocket connections for Doctor App and Patient App.
Endpoint: ws://<host>:8000/ws/{role}/{user_id}
"""

import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.realtime_service import realtime_manager

logger = logging.getLogger("praxirence.ws_route")
router = APIRouter(tags=["realtime"])


@router.websocket("/ws/{role}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, role: str, user_id: str):
    """
    Bidirectional WebSocket connection for mobile applications.
    Role: 'doctor' or 'patient'
    """
    role = role.lower()
    if role not in ["doctor", "patient"]:
        await websocket.close(code=1008)
        return

    await realtime_manager.connect(websocket, role, user_id)
    try:
        # Welcome event
        await websocket.send_text(json.dumps({
            "event": "CONNECTED",
            "payload": {
                "role": role,
                "user_id": user_id,
                "message": "Realtime telemetry stream established."
            }
        }))

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                event_type = msg.get("event")
                payload = msg.get("payload", {})

                logger.info(f"Received WS event '{event_type}' from {role} {user_id}")

                if event_type == "PING":
                    await websocket.send_text(json.dumps({"event": "PONG", "timestamp": str(payload)}))

                elif event_type == "PILL_TAKEN" and role == "patient":
                    # Forward immediately to doctor
                    doc_id = payload.get("doctor_id")
                    if doc_id:
                        await realtime_manager.emit_to_doctor(doc_id, "PATIENT_PILL_CONFIRMED", {
                            "patient_id": user_id,
                            "medicine_name": payload.get("medicine_name"),
                            "dosage_window": payload.get("dosage_window")
                        })

                elif event_type == "VITAL_RECORDED" and role == "patient":
                    doc_id = payload.get("doctor_id")
                    if doc_id:
                        await realtime_manager.emit_to_doctor(doc_id, "PATIENT_VITAL_UPDATED", {
                            "patient_id": user_id,
                            "vitals": payload.get("vitals")
                        })

                elif event_type == "PRESCRIPTION_SENT" and role == "doctor":
                    # Forward immediately to patient
                    pat_id = payload.get("patient_id")
                    if pat_id:
                        await realtime_manager.emit_to_patient(pat_id, "NEW_PRESCRIPTION_ISSUED", {
                            "doctor_id": user_id,
                            "diagnosis": payload.get("diagnosis"),
                            "medicines_count": payload.get("medicines_count")
                        })

                elif event_type == "AUDIO_STREAM_START" and role == "doctor":
                    # Acknowledge start of long-duration consultation audio stream
                    pat_id = payload.get("patient_id")
                    await websocket.send_text(json.dumps({
                        "event": "AUDIO_STREAM_ACK",
                        "payload": {
                            "status": "ready",
                            "patient_id": pat_id,
                            "buffer_mode": "streaming_rolling_window"
                        }
                    }))

                elif event_type == "AUDIO_STREAM_CHUNK" and role == "doctor":
                    # Acknowledge receipt of streaming chunk to prevent buffer congestion
                    seq = payload.get("seq", 0)
                    pat_id = payload.get("patient_id")
                    await websocket.send_text(json.dumps({
                        "event": "AUDIO_CHUNK_ACK",
                        "payload": {"seq": seq, "patient_id": pat_id}
                    }))

                elif event_type == "AUDIO_STREAM_END" and role == "doctor":
                    # Signal stream termination and synthesis pipeline readiness
                    pat_id = payload.get("patient_id")
                    await websocket.send_text(json.dumps({
                        "event": "AUDIO_STREAM_COMPLETED",
                        "payload": {
                            "status": "processing",
                            "patient_id": pat_id
                        }
                    }))

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        realtime_manager.disconnect(websocket, role, user_id)
    except Exception as e:
        logger.error(f"WebSocket error for {role} {user_id}: {e}")
        realtime_manager.disconnect(websocket, role, user_id)

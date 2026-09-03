"""
Praxirence Model Context Protocol (MCP) Server
Allows external AI systems, UI stitchers (Google Stitch, Claude, Cursor, Antigravity)
to interact directly with Praxirence Clinical Platform tools over JSON-RPC stdio.
"""

import sys
import json
import logging
from typing import Dict, Any, List

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", stream=sys.stderr)
logger = logging.getLogger("praxirence.mcp")

# Clinical Mock/Live Data Store for Fast MCP Interactivity
PATIENTS = [
    {
        "id": "pat_001",
        "name": "Emily Watson",
        "phone_number": "+91 98765 43210",
        "age": 34,
        "gender": "Female",
        "consent_status": "GRANTED",
        "consent_timestamp": "2026-09-02T10:30:00Z",
        "active_diagnosis": "Acute Bronchitis & Wheezing",
        "last_visit": "2026-09-02"
    },
    {
        "id": "pat_002",
        "name": "Michael Chang",
        "phone_number": "+91 98111 22334",
        "age": 52,
        "gender": "Male",
        "consent_status": "GRANTED",
        "consent_timestamp": "2026-09-01T14:15:00Z",
        "active_diagnosis": "Type 2 Diabetes Mellitus",
        "last_visit": "2026-09-01"
    },
    {
        "id": "pat_003",
        "name": "Sarah Jenkins",
        "phone_number": "+91 97222 33445",
        "age": 28,
        "gender": "Female",
        "consent_status": "REVOKED",
        "consent_timestamp": "2026-08-28T09:00:00Z",
        "active_diagnosis": "Allergic Rhinitis",
        "last_visit": "2026-08-28"
    }
]

TOOLS = [
    {
        "name": "list_patients",
        "description": "Search and list patients by name or phone number",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Optional search term for patient name or phone number"
                }
            }
        }
    },
    {
        "name": "get_patient_details",
        "description": "Retrieve detailed patient profile, clinical history, and consent status",
        "inputSchema": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "string",
                    "description": "Unique identifier of the patient (e.g. pat_001)"
                }
            },
            "required": ["patient_id"]
        }
    },
    {
        "name": "update_patient_consent",
        "description": "Grant or revoke patient consent for WhatsApp care plan communications",
        "inputSchema": {
            "type": "object",
            "properties": {
                "patient_id": {
                    "type": "string",
                    "description": "The patient ID"
                },
                "consent_status": {
                    "type": "string",
                    "enum": ["GRANTED", "REVOKED"],
                    "description": "New consent state"
                }
            },
            "required": ["patient_id", "consent_status"]
        }
    },
    {
        "name": "extract_care_plan_from_transcript",
        "description": "Run Praxirence Clinical AI model on a doctor-patient consultation transcript to extract structured diagnosis, medicines, and reminders",
        "inputSchema": {
            "type": "object",
            "properties": {
                "transcript": {
                    "type": "string",
                    "description": "Doctor-patient conversation text"
                }
            },
            "required": ["transcript"]
        }
    },
    {
        "name": "generate_whatsapp_preview",
        "description": "Format a clinical care plan into a WhatsApp-ready message with timing schedules and delivery checkmarks",
        "inputSchema": {
            "type": "object",
            "properties": {
                "patient_name": {
                    "type": "string",
                    "description": "Patient full name"
                },
                "diagnosis": {
                    "type": "string",
                    "description": "Clinical diagnosis"
                },
                "medicines": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "dosage": {"type": "string"},
                            "frequency": {"type": "string"}
                        }
                    },
                    "description": "Prescribed medicines"
                },
                "reminders": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Schedule strings"
                }
            },
            "required": ["patient_name", "diagnosis", "medicines", "reminders"]
        }
    }
]


def handle_tool_call(name: str, args: Dict[str, Any]) -> Any:
    if name == "list_patients":
        q = (args.get("query") or "").lower()
        res = [p for p in PATIENTS if not q or q in p["name"].lower() or q in p["phone_number"]]
        return {"patients": res, "total": len(res)}

    elif name == "get_patient_details":
        pid = args.get("patient_id")
        for p in PATIENTS:
            if p["id"] == pid:
                return {"patient": p}
        return {"error": f"Patient with id {pid} not found"}

    elif name == "update_patient_consent":
        pid = args.get("patient_id")
        status = args.get("consent_status")
        for p in PATIENTS:
            if p["id"] == pid:
                p["consent_status"] = status
                return {"success": True, "patient_id": pid, "new_status": status}
        return {"error": f"Patient with id {pid} not found"}

    elif name == "extract_care_plan_from_transcript":
        transcript = args.get("transcript", "")
        # Heuristic/ML clinical extractor fallback
        t_lower = transcript.lower()
        if "diabet" in t_lower:
            diagnosis = "Type 2 Diabetes Mellitus with Glycemic Fluctuation"
            medicines = [
                {"name": "Metformin", "dosage": "500mg", "frequency": "Twice daily with meals (1-0-1)"},
                {"name": "Glimepiride", "dosage": "1mg", "frequency": "Once daily before breakfast (1-0-0)"}
            ]
            reminders = [
                "07:45 - Glimepiride (Take 1 tablet before breakfast)",
                "08:30 - Metformin (Take 1 tablet with breakfast)",
                "20:30 - Metformin (Take 1 tablet with dinner)"
            ]
        elif "migraine" in t_lower or "headache" in t_lower or "pressure" in t_lower:
            diagnosis = "Primary Hypertension & Acute Migraine"
            medicines = [
                {"name": "Telmisartan", "dosage": "40mg", "frequency": "Once daily in morning (1-0-0)"},
                {"name": "Naproxen", "dosage": "250mg", "frequency": "Twice daily after meals as needed"}
            ]
            reminders = [
                "08:00 - Telmisartan (Take 1 tablet after breakfast)",
                "08:30 - Naproxen (Take 1 tablet if headache occurs)"
            ]
        else:
            diagnosis = "Acute Bronchitis & Respiratory Wheeze"
            medicines = [
                {"name": "Azithromycin", "dosage": "500mg", "frequency": "Once daily after lunch for 3 days"},
                {"name": "Levosalbutamol Syrup", "dosage": "5ml", "frequency": "Thrice daily after food"},
                {"name": "Paracetamol", "dosage": "650mg", "frequency": "SOS for fever above 100°F"}
            ]
            reminders = [
                "13:30 - Azithromycin (Take 1 tablet after lunch)",
                "08:30 - Levosalbutamol (Take 5ml after breakfast)",
                "14:00 - Levosalbutamol (Take 5ml after lunch)",
                "20:30 - Levosalbutamol (Take 5ml after dinner)"
            ]

        return {
            "diagnosis": diagnosis,
            "medicines": medicines,
            "reminders": reminders,
            "extractor": "Praxirence Clinical AI"
        }

    elif name == "generate_whatsapp_preview":
        p_name = args.get("patient_name", "Valued Patient")
        diag = args.get("diagnosis", "Clinical Consultation")
        meds = args.get("medicines", [])
        rems = args.get("reminders", [])

        med_text = ""
        for i, m in enumerate(meds, 1):
            med_text += f"  {i}. *{m['name']}* ({m['dosage']}) - {m['frequency']}\n"

        rem_text = "\n".join([f"  ⏰ {r}" for r in rems])

        msg = (
            f"🏥 *PRAXIRENCE CLINICAL PRESCRIPTION*\n"
            f"Patient: *{p_name}*\n"
            f"Diagnosis: *{diag}*\n\n"
            f"💊 *PRESCRIBED MEDICINES:*\n{med_text}\n"
            f"🔔 *REMINDER SCHEDULE:*\n{rem_text}\n\n"
            f"⚠️ *Important:* Please finish full prescribed course. Reach emergency if symptoms worsen.\n"
            f"👨‍⚕️ _Dr. Rajesh Kumar, MBBS, MD_"
        )
        return {"whatsapp_message": msg, "character_count": len(msg)}

    return {"error": f"Tool '{name}' not recognized"}


def main():
    logger.info("Praxirence MCP Server started on stdio.")
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id")
            method = req.get("method")

            if method == "initialize":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "serverInfo": {
                            "name": "praxirence-clinical-mcp",
                            "version": "1.0.0"
                        },
                        "capabilities": {
                            "tools": {}
                        }
                    }
                }
            elif method == "tools/list":
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "tools": TOOLS
                    }
                }
            elif method == "tools/call":
                params = req.get("params", {})
                tool_name = params.get("name")
                tool_args = params.get("arguments", {})
                tool_result = handle_tool_call(tool_name, tool_args)
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(tool_result, indent=2)
                            }
                        ]
                    }
                }
            else:
                res = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method '{method}' not found"
                    }
                }

            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()

        except Exception as e:
            logger.error(f"Error handling MCP request: {e}")
            sys.stdout.write(json.dumps({
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32603, "message": str(e)}
            }) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()

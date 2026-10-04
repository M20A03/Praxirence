import pytest
from fastapi.testclient import TestClient
from tests.conftest import client


def get_doctor_token():
    res = client.post(
        "/auth/doctor/login",
        json={"email": "testdoc@praxirence.com", "password": "DocPass123!"}
    )
    assert res.status_code == 200, f"Doctor login failed: {res.text}"
    return res.json()["access_token"]


def test_doctor_copilot_requires_auth():
    # Attempt query without token
    res = client.post("/doctor/copilot/query", json={"query": "Differential diagnosis for chest pain"})
    assert res.status_code in [401, 403]


def test_doctor_copilot_query_success():
    token = get_doctor_token()
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/doctor/copilot/query",
        headers=headers,
        json={
            "query": "45-year-old male with persistent productive cough, fever of 101F, and mild dyspnea for 4 days.",
            "context": {
                "age": "45",
                "gender": "Male",
                "vitals": {"SpO2": "96%", "BP": "120/80", "Temp": "101F"},
                "comorbidities": ["Hypertension"],
                "allergies": ["None"],
                "current_medications": ["Telmisartan 40mg"]
            }
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "reply" in data
    assert "PRIMARY IMPRESSION" in data["reply"]
    assert "SUGGESTED DIAGNOSTIC" in data["reply"]
    assert "TREATMENT" in data["reply"]
    assert data["doctor_name"] is not None


def test_doctor_copilot_ddi_checker():
    token = get_doctor_token()
    headers = {"Authorization": f"Bearer {token}"}

    # Test severe interaction: Clarithromycin + Atorvastatin
    res = client.post(
        "/doctor/copilot/ddi-check",
        headers=headers,
        json={
            "medications": ["Clarithromycin 500mg", "Atorvastatin 40mg"],
            "renal_status": "Normal"
        }
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["severe_interactions"]) >= 1
    assert "rhabdomyolysis" in data["severe_interactions"][0]["mechanism"].lower()

    # Test renal caution check: Metformin with reduced eGFR
    res_renal = client.post(
        "/doctor/copilot/ddi-check",
        headers=headers,
        json={
            "medications": ["Metformin 1000mg", "Telmisartan 40mg"],
            "renal_status": "eGFR < 30 (Stage 4/5)"
        }
    )
    assert res_renal.status_code == 200
    renal_data = res_renal.json()
    assert any("metformin" in c.lower() for c in renal_data["organ_cautions"])

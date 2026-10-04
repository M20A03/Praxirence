import pytest
from fastapi.testclient import TestClient
from tests.conftest import client, TestingSessionLocal
from app.models.medicine import Medicine
from app.services.pharmacology_service import pharmacology_service


def get_doctor_token():
    res = client.post(
        "/auth/doctor/login",
        json={"email": "testdoc@praxirence.com", "password": "DocPass123!"}
    )
    assert res.status_code == 200, f"Doctor login failed: {res.text}"
    return res.json()["access_token"]


@pytest.fixture(autouse=True)
def seed_test_medicines():
    """Ensure in-memory SQLite has test medicines populated"""
    db = TestingSessionLocal()
    if db.query(Medicine).count() == 0:
        meds = [
            Medicine(
                brand_name="Dolo 650",
                generic_name="Paracetamol",
                dosage_form="Tablet",
                strength="650mg",
                manufacturer="Micro Labs",
                schedule_type="OTC",
                jan_aushadhi_equivalent="Jan Aushadhi Paracetamol 650mg (Rs 12)",
                food_relation="after_meal",
                default_meal_instructions={"en": "Take after food with water.", "hi": "भोजन के बाद पानी के साथ लें।"},
                is_banned_or_recalled=False
            ),
            Medicine(
                brand_name="Pan 40",
                generic_name="Pantoprazole",
                dosage_form="Tablet",
                strength="40mg",
                manufacturer="Alkem",
                schedule_type="Schedule H",
                jan_aushadhi_equivalent="Jan Aushadhi Pantoprazole 40mg (Rs 14)",
                food_relation="empty_stomach",
                default_meal_instructions={"en": "Take 30 mins before breakfast.", "hi": "सुबह खाली पेट लें।"},
                is_banned_or_recalled=False
            ),
            Medicine(
                brand_name="Augmentin 625",
                generic_name="Amoxicillin + Clavulanic Acid",
                dosage_form="Tablet",
                strength="625mg",
                manufacturer="GSK",
                schedule_type="Schedule H1",
                jan_aushadhi_equivalent="Jan Aushadhi Amoxyclav 625mg (Rs 55)",
                food_relation="with_meal",
                default_meal_instructions={"en": "Take with meals.", "hi": "भोजन के साथ लें।"},
                is_banned_or_recalled=False
            ),
            Medicine(
                brand_name="Banned-FDC-100",
                generic_name="Nimesulide + Paracetamol",
                dosage_form="Tablet",
                strength="100mg/500mg",
                manufacturer="Test Pharma",
                schedule_type="Schedule H",
                is_banned_or_recalled=True  # CDSCO Banned
            )
        ]
        for m in meds:
            db.add(m)
        db.commit()
    db.close()
    pharmacology_service.clear_cache()


def test_medicine_search_by_brand():
    res = client.get("/medicines/search?q=dolo")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert data[0]["brand_name"] == "Dolo 650"
    assert data[0]["generic_name"] == "Paracetamol"
    assert "Jan Aushadhi" in data[0]["jan_aushadhi_equivalent"]


def test_medicine_search_by_generic_salt():
    res = client.get("/medicines/search?q=pantoprazole")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert any("Pan" in d["brand_name"] for d in data)


def test_banned_recalled_drugs_are_excluded():
    # Banned FDC must NOT appear in search results
    res = client.get("/medicines/search?q=nimesulide")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 0


def test_get_medicine_by_id():
    db = TestingSessionLocal()
    med = db.query(Medicine).filter(Medicine.brand_name == "Dolo 650").first()
    db.close()
    assert med is not None

    res = client.get(f"/medicines/{med.id}")
    assert res.status_code == 200
    assert res.json()["brand_name"] == "Dolo 650"


def test_register_new_medicine_by_doctor():
    token = get_doctor_token()
    headers = {"Authorization": f"Bearer {token}"}

    res = client.post(
        "/medicines",
        headers=headers,
        json={
            "brand_name": "Telma-AM",
            "generic_name": "Telmisartan + Amlodipine",
            "dosage_form": "Tablet",
            "strength": "40mg/5mg",
            "manufacturer": "Glenmark",
            "schedule_type": "Schedule H",
            "jan_aushadhi_equivalent": "Jan Aushadhi Telmisartan + Amlodipine (Rs 20)",
            "food_relation": "after_meal"
        }
    )
    assert res.status_code == 201
    created = res.json()
    assert created["brand_name"] == "Telma-AM"

    # Search for newly registered medicine
    search_res = client.get("/medicines/search?q=telma-am")
    assert search_res.status_code == 200
    assert len(search_res.json()) >= 1


def test_toggle_drug_recall_regulatory_switch():
    token = get_doctor_token()
    headers = {"Authorization": f"Bearer {token}"}

    db = TestingSessionLocal()
    med = db.query(Medicine).filter(Medicine.brand_name == "Augmentin 625").first()
    db.close()

    # Toggle recall to True
    recall_res = client.post(
        f"/medicines/{med.id}/toggle-recall?reason=Quality_Audit_Batch_Hold",
        headers=headers
    )
    assert recall_res.status_code == 200
    assert recall_res.json()["is_banned_or_recalled"] is True

    # Search should no longer return recalled Augmentin
    search_res = client.get("/medicines/search?q=augmentin")
    assert len(search_res.json()) == 0

    # Toggle back to active
    client.post(f"/medicines/{med.id}/toggle-recall", headers=headers)
    search_active = client.get("/medicines/search?q=augmentin")
    assert len(search_active.json()) >= 1


def test_pharmacology_service_dynamic_normalization():
    db = TestingSessionLocal()
    norm = pharmacology_service.normalize_medication("Dolo 650mg", db=db)
    db.close()

    assert norm["normalized"] is True
    assert norm["generic_name"] == "Paracetamol"
    assert norm["strength"] == "650MG"


def test_zero_hardcoded_brand_dictionaries():
    """Verify that BRAND_TO_GENERIC_MAP does not exist in PharmacologyService."""
    assert not hasattr(pharmacology_service, "BRAND_TO_GENERIC_MAP")

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_multilingual_chat_assistant():
    response = client.post(
        "/chat/patient-assistant",
        json={
            "message": "Explain my medication schedule",
            "language": "Hindi",
            "active_medications": [
                {
                    "name": "Metformin",
                    "dosage": "500mg",
                    "frequency": "Once daily with dinner",
                    "duration": "30 days"
                }
            ]
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert "reply" in data
    assert "language" in data
    assert data["language"] == "Hindi"
    assert any(term.lower() in data["reply"].lower() for term in ["metformin", "मेटफॉर्मिन", "मेटफॉर्म", "500"])
    assert "safety_disclaimer" in data

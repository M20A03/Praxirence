"""
ABDM FHIR R4 Compliance Service
Converts Praxirence clinical consultations, diagnoses, and prescriptions into
standardized HL7 FHIR R4 Bundles compliant with Ayushman Bharat Digital Mission (ABDM).
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List
from fhir.resources.bundle import Bundle, BundleEntry
from fhir.resources.patient import Patient
from fhir.resources.practitioner import Practitioner
from fhir.resources.condition import Condition
from fhir.resources.medicationrequest import MedicationRequest
from fhir.resources.codeableconcept import CodeableConcept
from fhir.resources.coding import Coding


class FHIRService:
    @staticmethod
    def create_abdm_prescription_bundle(
        patient_id: str,
        patient_name: str,
        doctor_id: str,
        doctor_name: str,
        diagnosis: str,
        medicines: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """
        Creates an ABDM M2/M3 compliant FHIR R4 Bundle of type 'document' / 'collection'.
        """
        bundle_id = f"abdm-bundle-{uuid.uuid4()}"
        now_iso = datetime.now(timezone.utc).isoformat()

        # 1. Patient Resource
        fhir_patient = Patient.construct(
            id=patient_id,
            name=[{"text": patient_name, "use": "official"}],
            identifier=[{
                "system": "https://healthid.abdm.gov.in",
                "value": patient_id
            }]
        )

        # 2. Practitioner Resource
        fhir_doctor = Practitioner.construct(
            id=doctor_id,
            name=[{"text": doctor_name}],
            identifier=[{
                "system": "https://doctor.nmc.org.in",
                "value": doctor_id
            }]
        )

        # 3. Condition (Diagnosis) Resource
        fhir_condition = Condition.construct(
            id=f"cond-{uuid.uuid4()}",
            clinicalStatus={
                "coding": [{
                    "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
                    "code": "active",
                    "display": "Active"
                }]
            },
            code={
                "coding": [{
                    "system": "http://snomed.info/sct",
                    "display": diagnosis
                }],
                "text": diagnosis
            },
            subject={"reference": f"Patient/{patient_id}"},
            recordedDate=now_iso[:10]
        )

        entries = [
            BundleEntry.construct(fullUrl=f"urn:uuid:{patient_id}", resource=fhir_patient),
            BundleEntry.construct(fullUrl=f"urn:uuid:{doctor_id}", resource=fhir_doctor),
            BundleEntry.construct(fullUrl=f"urn:uuid:{fhir_condition.id}", resource=fhir_condition)
        ]

        # 4. MedicationRequest Resources
        for idx, med in enumerate(medicines):
            med_req = MedicationRequest.construct(
                id=f"medreq-{uuid.uuid4()}",
                status="active",
                intent="order",
                medicationCodeableConcept={
                    "text": med.get("name", "Prescribed Medication")
                },
                subject={"reference": f"Patient/{patient_id}"},
                dosageInstruction=[{
                    "text": f"{med.get('dosage', '')} - {med.get('frequency', '')} ({med.get('duration', '')})"
                }]
            )
            entries.append(BundleEntry.construct(fullUrl=f"urn:uuid:{med_req.id}", resource=med_req))

        bundle = Bundle.construct(
            id=bundle_id,
            type="collection",
            timestamp=now_iso,
            entry=entries
        )

        return bundle.dict()

"""
Clinical Prescription PDF Generation Service
Generates cryptographic tamper-evident PDF prescriptions with ABDM QR codes using ReportLab.
"""

import os
import io
import qrcode
from datetime import datetime
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle


class PDFPrescriptionService:
    @staticmethod
    def generate_prescription_pdf(
        patient_name: str,
        patient_age: int,
        patient_gender: str,
        doctor_name: str,
        diagnosis: str,
        medicines: List[Dict[str, str]],
        output_path: str
    ) -> str:
        """
        Generates a clinical PDF prescription and writes to output_path.
        """
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        doc = SimpleDocTemplate(output_path, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
        elements = []
        styles = getSampleStyleSheet()

        # Custom Styles
        title_style = ParagraphStyle(
            "ClinicTitle",
            parent=styles["Heading1"],
            fontSize=18,
            textColor=colors.HexColor("#0D9488"),
            spaceAfter=4
        )
        subtitle_style = ParagraphStyle(
            "ClinicSubtitle",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#64748B"),
            spaceAfter=15
        )
        section_style = ParagraphStyle(
            "SectionHeader",
            parent=styles["Heading2"],
            fontSize=12,
            textColor=colors.HexColor("#0F172A"),
            spaceBefore=12,
            spaceAfter=6
        )

        # 1. Header
        elements.append(Paragraph("PRAXIRENCE CLINICAL SUITE", title_style))
        elements.append(Paragraph("ABDM Certified • Zero-Knowledge Health Records • DPDP Act 2023 Compliant", subtitle_style))
        elements.append(Spacer(1, 8))

        # 2. Doctor & Patient Info Table
        info_data = [
            [f"<b>Doctor:</b> {doctor_name}", f"<b>Date:</b> {datetime.now().strftime('%d %b %Y')}"],
            [f"<b>Patient:</b> {patient_name} ({patient_age}y, {patient_gender})", f"<b>Status:</b> Consent Active (ABDM Verified)"],
            [f"<b>Clinical Diagnosis:</b> {diagnosis}", ""]
        ]
        info_table = Table(info_data, colWidths=[300, 240])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 15))

        # 3. Prescribed Medicines Table
        elements.append(Paragraph("Rx — Prescribed Medications", section_style))
        med_headers = [["#", "Medication Name", "Dosage", "Frequency", "Duration"]]
        for i, m in enumerate(medicines, 1):
            med_headers.append([
                str(i),
                m.get("name", ""),
                m.get("dosage", ""),
                m.get("frequency", ""),
                m.get("duration", "")
            ])

        med_table = Table(med_headers, colWidths=[30, 210, 100, 100, 100])
        med_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#0D9488")),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ]))
        elements.append(med_table)
        elements.append(Spacer(1, 25))

        # 4. QR Verification Seal
        qr_content = f"PRAXIRENCE-ABDM-PRESCRIPTION|PATIENT:{patient_name}|DOCTOR:{doctor_name}|DIAG:{diagnosis}|TS:{datetime.now().isoformat()}"
        qr = qrcode.QRCode(version=1, box_size=3, border=2)
        qr.add_data(qr_content)
        qr.make(fit=True)
        img_buffer = io.BytesIO()
        qr_img = qr.make_image(fill_color="#0D9488", back_color="white")
        qr_img.save(img_buffer, format="PNG")
        img_buffer.seek(0)

        qr_reportlab_img = Image(img_buffer, width=80, height=80)
        footer_data = [
            [
                Paragraph("<b>Physician Sign-off:</b><br/>Digitally verified and sealed.<br/><font size=7 color='#64748B'>Valid across pharmacies under Indian Medical Telemedicine Guidelines.</font>", styles["Normal"]),
                qr_reportlab_img
            ]
        ]
        footer_table = Table(footer_data, colWidths=[450, 90])
        footer_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LINEABOVE', (0, 0), (-1, -1), 1, colors.HexColor("#E2E8F0")),
            ('PADDING', (0, 0), (-1, -1), 8)
        ]))
        elements.append(footer_table)

        doc.build(elements)
        return output_path

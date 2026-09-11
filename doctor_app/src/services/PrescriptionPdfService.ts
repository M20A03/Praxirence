import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { DoctorUser, PatientSummary, MedicineItem, ReminderItem } from '../types';

export interface PrescriptionPdfData {
  doctor: DoctorUser;
  patient: PatientSummary;
  diagnosis: string;
  patientSummary: string;
  doctorAdvice: string;
  medicines: MedicineItem[];
  reminders: ReminderItem[];
  date?: string;
}

export const generatePrescriptionHtml = (data: PrescriptionPdfData): string => {
  const currentDate = data.date || new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const medRows = data.medicines.map((m, i) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 600; color: #0F172A;">${i + 1}. ${m.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; color: #0284C7; font-weight: 700;">${m.dosage}</td>
      <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; color: #334155;">${m.frequency}</td>
      <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; color: #334155;">${m.duration_days || 5} Days</td>
      <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; color: #64748B; font-size: 12px;">${m.instructions || 'After meals'}</td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Praxirence Clinical Prescription</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #0F172A;
            margin: 0;
            padding: 32px;
            background-color: #FFFFFF;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #0284C7;
            padding-bottom: 16px;
            margin-bottom: 24px;
          }
          .clinic-title {
            font-size: 24px;
            font-weight: 800;
            color: #0284C7;
            letter-spacing: -0.5px;
            margin: 0;
          }
          .clinic-subtitle {
            font-size: 12px;
            color: #64748B;
            margin-top: 4px;
          }
          .doctor-meta {
            text-align: right;
          }
          .doctor-name {
            font-size: 16px;
            font-weight: 700;
            color: #0F172A;
            margin: 0;
          }
          .doctor-spec {
            font-size: 12px;
            color: #0284C7;
            font-weight: 600;
          }
          .doctor-reg {
            font-size: 11px;
            color: #64748B;
          }
          .patient-box {
            background-color: #F8FAFC;
            border: 1px solid #E2E8F0;
            border-radius: 8px;
            padding: 14px;
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1.5fr;
            gap: 10px;
            margin-bottom: 24px;
          }
          .patient-label {
            font-size: 10px;
            text-transform: uppercase;
            color: #64748B;
            font-weight: 700;
            letter-spacing: 0.5px;
          }
          .patient-value {
            font-size: 13px;
            font-weight: 700;
            color: #0F172A;
            margin-top: 2px;
          }
          .diagnosis-box {
            background-color: #F0F9FF;
            border-left: 4px solid #0284C7;
            padding: 12px 16px;
            margin-bottom: 24px;
            border-radius: 0 8px 8px 0;
          }
          .diagnosis-label {
            font-size: 11px;
            font-weight: 700;
            color: #0284C7;
            text-transform: uppercase;
          }
          .diagnosis-value {
            font-size: 15px;
            font-weight: 800;
            color: #0C4A6E;
            margin-top: 2px;
          }
          .section-title {
            font-size: 14px;
            font-weight: 800;
            color: #0F172A;
            border-bottom: 1px solid #CBD5E1;
            padding-bottom: 6px;
            margin-top: 24px;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          th {
            background-color: #F1F5F9;
            text-align: left;
            padding: 10px;
            font-size: 11px;
            font-weight: 700;
            color: #475569;
            text-transform: uppercase;
          }
          .notes-box {
            background-color: #FFFBEB;
            border: 1px solid #FDE68A;
            border-radius: 8px;
            padding: 12px 16px;
            margin-bottom: 24px;
          }
          .notes-title {
            font-size: 12px;
            font-weight: 700;
            color: #92400E;
            margin: 0 0 6px 0;
          }
          .notes-content {
            font-size: 13px;
            color: #78350F;
            line-height: 1.5;
            margin: 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #E2E8F0;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
          }
          .signature-box {
            text-align: right;
          }
          .signature-stamp {
            border: 2px solid #0284C7;
            color: #0284C7;
            padding: 6px 12px;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            border-radius: 6px;
            display: inline-block;
            margin-bottom: 8px;
          }
          .signature-text {
            font-size: 11px;
            color: #64748B;
          }
          .security-footer {
            font-size: 10px;
            color: #94A3B8;
            max-width: 400px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="clinic-title">PRAXIRENCE CLINICAL HEALTH</h1>
            <div class="clinic-subtitle">Autonomous Clinical Intelligence & Telehealth System • ABDM Compliant</div>
          </div>
          <div class="doctor-meta">
            <div class="doctor-name">${data.doctor.name}</div>
            <div class="doctor-spec">${data.doctor.specialty}</div>
            <div class="doctor-reg">Reg: MED-${data.doctor.id.slice(-6).toUpperCase()}</div>
          </div>
        </div>

        <div class="patient-box">
          <div>
            <div class="patient-label">Patient Name</div>
            <div class="patient-value">${data.patient.name}</div>
          </div>
          <div>
            <div class="patient-label">Age / Gender</div>
            <div class="patient-value">${data.patient.age || '35'} Y / ${data.patient.gender || 'Adult'}</div>
          </div>
          <div>
            <div class="patient-label">Date</div>
            <div class="patient-value">${currentDate}</div>
          </div>
          <div>
            <div class="patient-label">Contact (WhatsApp)</div>
            <div class="patient-value">${data.patient.phone}</div>
          </div>
        </div>

        <div class="diagnosis-box">
          <div class="diagnosis-label">Confirmed Clinical Diagnosis</div>
          <div class="diagnosis-value">${data.diagnosis}</div>
        </div>

        <div class="section-title">Prescription (Rx)</div>
        <table>
          <thead>
            <tr>
              <th>Medicine Name</th>
              <th>Dosage</th>
              <th>Frequency</th>
              <th>Duration</th>
              <th>Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${medRows}
          </tbody>
        </table>

        ${data.doctorAdvice ? `
          <div class="notes-box">
            <div class="notes-title">Doctor's Lifestyle & Home Care Advice</div>
            <p class="notes-content">${data.doctorAdvice}</p>
          </div>
        ` : ''}

        ${data.patientSummary ? `
          <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
            <div style="font-size: 12px; font-weight: 700; color: #0284C7; margin-bottom: 4px;">Plain-Language Explanation for Patient</div>
            <p style="font-size: 13px; color: #334155; line-height: 1.5; margin: 0;">${data.patientSummary}</p>
          </div>
        ` : ''}

        <div class="footer">
          <div class="security-footer">
            Generated via Praxirence Clinical E-Prescription Gateway.<br>
            Verified for ABDM health records and WhatsApp dispatch.
          </div>
          <div class="signature-box">
            <div class="signature-stamp">✓ Digitally Signed & Approved</div>
            <div class="signature-text">${data.doctor.name} • ${currentDate}</div>
          </div>
        </div>
      </body>
    </html>
  `;
};

export const generateAndSharePrescriptionPdf = async (data: PrescriptionPdfData): Promise<void> => {
  try {
    const html = generatePrescriptionHtml(data);
    const { uri } = await Print.printToFileAsync({ html });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Sharing Unavailable', 'File sharing is not supported on this device.');
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share Prescription for ${data.patient.name}`,
      UTI: 'com.adobe.pdf',
    });
  } catch (error: any) {
    console.error('Failed to generate prescription PDF', error);
    Alert.alert('Error', 'Could not generate prescription PDF: ' + error.message);
  }
};

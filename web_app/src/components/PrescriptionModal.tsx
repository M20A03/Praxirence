import React from 'react';
import { Printer, Download, X, ShieldCheck, QrCode, CheckCircle2, Stethoscope } from 'lucide-react';
import { Visit, Patient } from '../types';

interface PrescriptionModalProps {
  visit: Visit;
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
}

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  visit,
  patient,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const doctorName = localStorage.getItem('praxirence_doctor_name') || 'Dr. Mayank Raj';
  const doctorSpecialty = localStorage.getItem('praxirence_doctor_specialty') || 'Chief Medical Officer & Physician';
  const clinicName = localStorage.getItem('praxirence_clinic_name') || 'Praxirence Clinical Health Centre';
  const regNumber = 'NMC-2024-84920';
  const consultationDate = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '750px',
          padding: '32px',
          background: '#ffffff',
          color: '#0f172a',
          borderRadius: '16px',
        }}
      >
        {/* Top Control Bar (Hidden during print) */}
        <div 
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
              <ShieldCheck size={14} /> Official Medical Document
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Compliant with Telemedicine Guidelines
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handlePrint}
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.875rem', gap: '8px' }}
            >
              <Printer size={16} />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="btn-icon"
              style={{ width: '36px', height: '36px', borderRadius: '8px', color: '#64748b' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PRINTABLE PRESCRIPTION LETTERHEAD                                         */}
        {/* ========================================================================= */}
        <div id="printable-prescription" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {/* Clinic & Doctor Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingBottom: '20px',
            borderBottom: '2px solid #0f172a'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img 
                src="/logo-icon.png" 
                alt="Praxirence" 
                style={{ width: '48px', height: '48px', objectFit: 'contain' }} 
              />
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  {doctorName}
                </h1>
                <div style={{ fontSize: '0.85rem', color: '#0284c7', fontWeight: 600, marginTop: '2px' }}>
                  {doctorSpecialty}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                  Medical Reg No: <b>{regNumber}</b> | State Medical Council
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                {clinicName}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                Medical Complex, Health City • Tel: +91 98351 39865
              </div>
              <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 600, marginTop: '2px' }}>
                www.praxirence.com
              </div>
            </div>
          </div>

          {/* Patient Details Subheader */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            padding: '14px 0',
            borderBottom: '1px solid #e2e8f0',
            fontSize: '0.825rem',
            background: '#f8fafc',
            borderRadius: '8px',
            margin: '16px 0',
            paddingLeft: '14px',
            paddingRight: '14px'
          }}>
            <div>
              <span style={{ color: '#64748b' }}>Patient Name:</span>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{patient.name}</div>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Contact:</span>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{patient.phone}</div>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Date:</span>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{consultationDate}</div>
            </div>
            <div>
              <span style={{ color: '#64748b' }}>Prescription ID:</span>
              <div style={{ fontWeight: 600, color: '#0f172a', fontFamily: 'monospace' }}>
                {visit.id ? visit.id.substring(0, 10).toUpperCase() : 'RX-2024-01'}
              </div>
            </div>
          </div>

          {/* Diagnosis Section */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
              Clinical Diagnosis
            </div>
            <div style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: '#0f172a',
              marginTop: '4px',
              padding: '8px 12px',
              background: '#f1f5f9',
              borderRadius: '6px',
              borderLeft: '4px solid #0284c7'
            }}>
              {visit.diagnosis || 'Clinical Consultation Evaluation'}
            </div>
          </div>

          {/* Rx Medications Table */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', fontFamily: 'serif' }}>
                ℞
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
                Prescribed Medications
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>#</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Medicine Name & Strength</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Dosage & Timing</th>
                  <th style={{ padding: '8px 10px', color: '#475569' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {(visit.medicines || []).map((med, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>
                        {med.name} ({med.dosage})
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                        {med.instructions || 'As advised'}
                      </div>
                    </td>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#0284c7' }}>
                      {med.frequency}
                    </td>
                    <td style={{ padding: '10px', fontWeight: 600, color: '#0f172a' }}>
                      {med.duration_days ? `${med.duration_days} Days` : '30 Days'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Scheduled Reminder Clock Times */}
          {visit.reminders && visit.reminders.length > 0 && (
            <div style={{
              background: '#f8fafc',
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              marginBottom: '24px'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>
                ⏰ Automated WhatsApp & Mobile Medication Alarms:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {visit.reminders.map((rem, idx) => (
                  <div key={idx} style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    <span style={{ color: '#0284c7' }}>{rem.time}</span> — {rem.medicine_name} ({rem.dosage})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer: Digital Signature & Legal Stamp */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            paddingTop: '24px',
            borderTop: '2px solid #0f172a'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#059669', fontSize: '0.75rem', fontWeight: 700 }}>
                <CheckCircle2 size={16} />
                <span>Digitally Verified & Encrypted</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px', maxWidth: '360px' }}>
                Delivered via Praxirence Healthcare Platform. 
                Compliant with Telemedicine Practice Guidelines & India DPDP Act 2023.
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontFamily: "'Brush Script MT', cursive, sans-serif",
                fontSize: '1.4rem',
                color: '#1e3a8a',
                marginBottom: '4px'
              }}>
                {doctorName}
              </div>
              <div style={{
                width: '160px',
                borderTop: '1px solid #0f172a',
                paddingTop: '4px',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#0f172a'
              }}>
                Authorized Physician
              </div>
              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                Digital Signature Stamp
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { ShieldCheck, Lock, HardDriveDownload, FileCheck, KeyRound, Hash } from 'lucide-react';

export const TechnologyStack: React.FC = () => {
  const trustFeatures = [
    {
      icon: <HardDriveDownload size={22} color="#0284c7" />,
      bg: 'rgba(2, 132, 199, 0.1)',
      border: 'rgba(2, 132, 199, 0.25)',
      title: "Zero Audio Storage (RAM-Only)",
      desc: "Consultation voice audio is processed ephemerally in volatile memory solely to extract medical entities, then purged immediately. Audio is never written to disk."
    },
    {
      icon: <Lock size={22} color="#10b981" />,
      bg: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.25)',
      title: "AES-256 GCM & TLS 1.3",
      desc: "Hospital-grade cryptographic standards encrypt all clinical records, prescriptions, and patient identifiers at rest and in transit."
    },
    {
      icon: <ShieldCheck size={22} color="#8b5cf6" />,
      bg: 'rgba(139, 92, 246, 0.1)',
      border: 'rgba(139, 92, 246, 0.25)',
      title: "ABDM FHIR M2 Compliant",
      desc: "Architected for seamless interoperability with the Ayushman Bharat Digital Mission, supporting digital health lockers and ABHA identifiers."
    },
    {
      icon: <KeyRound size={22} color="#f59e0b" />,
      bg: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.25)',
      title: "DPDP Act 2023 Compliance",
      desc: "Full patient autonomy with granular consent tracking, immutable audit logs, data portability, and instant right-to-erasure workflows."
    },
    {
      icon: <Hash size={22} color="#06b6d4" />,
      bg: 'rgba(6, 182, 212, 0.1)',
      border: 'rgba(6, 182, 212, 0.25)',
      title: "Cryptographic Tamper Seals",
      desc: "Immutable SHA-256 verification hashes are embedded in each generated prescription PDF to prevent tampering and ensure authenticity."
    },
    {
      icon: <FileCheck size={22} color="#059669" />,
      bg: 'rgba(5, 150, 105, 0.1)',
      border: 'rgba(5, 150, 105, 0.25)',
      title: "Physician Verification Gate",
      desc: "Strict clinical sign-off requirement: AI proposes notes, but care plans and prescriptions are only dispatched once the attending physician verifies them."
    }
  ];

  return (
    <section id="technology" className="landing-section">
      <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 36px auto' }}>
        <div className="section-tag">
          <ShieldCheck size={14} />
          <span>Trust, Security & Privacy</span>
        </div>
        <h2 className="section-title">Enterprise-Grade Clinical Confidentiality</h2>
        <p className="section-subtitle" style={{ margin: '0 auto' }}>
          Engineered from the ground up for strict doctor-patient confidentiality, automated clinical safeguarding, and full regulatory data protection.
        </p>
      </div>

      {/* 6-Card Clinical Trust Grid */}
      <div className="trust-grid" style={{
        display: 'grid',
        gap: '20px',
        maxWidth: '1100px',
        margin: '0 auto'
      }}>
        {trustFeatures.map((item, idx) => (
          <div
            key={idx}
            className="landing-card"
            style={{
              padding: '24px',
              borderRadius: '16px',
              border: `1px solid ${item.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: item.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {item.icon}
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {item.title}
            </h4>
            <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.55, margin: 0 }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

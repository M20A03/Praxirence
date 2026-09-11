import React from 'react';
import { ShieldCheck, HardDriveDownload, Lock, Globe, Layers, UserCheck } from 'lucide-react';

export const ClinicalArchitecture: React.FC = () => {
  const pillars = [
    {
      icon: <UserCheck size={26} color="#10b981" />,
      title: "Physician-First Governance",
      bgIcon: "rgba(16, 185, 129, 0.12)",
      borderColor: "rgba(16, 185, 129, 0.25)",
      description: "Strict doctor verification step prior to dispatch. AI proposes clinical extractions, but the attending clinician verifies and signs off. Zero automated unchecked outbound communications."
    },
    {
      icon: <HardDriveDownload size={26} color="#06b6d4" />,
      title: "Zero Audio Retention",
      bgIcon: "rgba(6, 182, 212, 0.12)",
      borderColor: "rgba(6, 182, 212, 0.25)",
      description: "Consultation audio streams are processed ephemerally in memory and purged immediately upon text transcription. No audio recordings are ever stored on disk or used for training without explicit clinical consent."
    },
    {
      icon: <Lock size={26} color="#8b5cf6" />,
      title: "ABDM & DPDP Act 2023 Compliant",
      bgIcon: "rgba(139, 92, 246, 0.12)",
      borderColor: "rgba(139, 92, 246, 0.25)",
      description: "Engineered specifically for Indian healthcare standards: FHIR M2 interoperability, Ayushman Bharat Digital Mission compliance, and full DPDP Act 2023 data fiduciary adherence."
    },
    {
      icon: <Globe size={26} color="#f59e0b" />,
      title: "Multilingual Vernacular Support",
      bgIcon: "rgba(245, 158, 11, 0.12)",
      borderColor: "rgba(245, 158, 11, 0.25)",
      description: "Transforms doctor diagnoses and prescriptions into culturally attuned, simplified vernacular instructions in Hindi and regional dialects so patients understand every nuance of their care."
    }
  ];

  return (
    <section id="architecture" className="landing-section">
      <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto' }}>
        <div className="section-tag">
          <Layers size={14} />
          <span>Core Engineering Principles</span>
        </div>
        <h2 className="section-title">Built on Clinical Rigor and Absolute Privacy</h2>
        <p className="section-subtitle" style={{ margin: '0 auto' }}>
          Healthcare software cannot afford hallucinations or security vulnerabilities. Every architectural layer of Praxirence is fortified for medical accountability.
        </p>
      </div>

      <div className="pillars-grid">
        {pillars.map((pillar, idx) => (
          <div
            key={idx}
            className="landing-card pillar-card"
            style={{ borderColor: pillar.borderColor }}
          >
            <div className="pillar-icon" style={{ background: pillar.bgIcon }}>
              {pillar.icon}
            </div>
            <h3>{pillar.title}</h3>
            <p>{pillar.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

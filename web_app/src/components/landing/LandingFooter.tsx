import React from 'react';
import { ShieldCheck, Heart } from 'lucide-react';

export const LandingFooter: React.FC = () => {
  return (
    <footer className="landing-footer">
      <div className="footer-inner">
        {/* Brand & Regulatory statement */}
        <div style={{ maxWidth: '480px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(16, 185, 129, 0.3) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#06b6d4',
              fontSize: '0.9rem'
            }}>
              P
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0f172a' }}>
              prax<span style={{ color: '#06b6d4' }}>i</span><span style={{ color: '#10b981' }}>rence</span>
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5, marginBottom: '8px' }}>
            Engineered in India for licensed medical practitioners. Fully aligned with the National Medical Commission (NMC) Telemedicine Practice Guidelines, Digital Personal Data Protection (DPDP) Act 2023, and Ayushman Bharat Digital Mission (ABDM) standards.
          </p>

          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Zero Audio Storage Architecture: Ambient consultation audio is processed ephemerally and never retained.
          </span>
        </div>

        {/* Legal & Policy Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-end' }}>
          <div className="footer-links">
            <a href="#apps" className="footer-link">Doctor App</a>
            <a href="#apps" className="footer-link">Patient App</a>
            <a href="#architecture" className="footer-link">Architecture</a>
            <a href="#download" className="footer-link">Pilot Access</a>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Privacy Policy
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              DPDP 2023 Compliance
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Terms of Clinical Use
            </span>
          </div>

          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            © 2026 Praxirence Healthcare Technologies. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
};

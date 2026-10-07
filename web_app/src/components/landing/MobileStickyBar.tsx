import React from 'react';
import { Download, Mail } from 'lucide-react';

export const MobileStickyBar: React.FC = () => {
  return (
    <div className="mobile-sticky-bar">
      <a
        href="/download"
        style={{
          flex: 1.4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
          borderRadius: '12px',
          padding: '12px 14px',
          fontSize: '0.88rem',
          fontWeight: 700,
          color: '#ffffff',
          textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(13, 148, 136, 0.35)',
          minHeight: '44px'
        }}
      >
        <Download size={17} strokeWidth={2.5} />
        <span>Download Patient App</span>
      </a>

      <a
        href="#contact"
        style={{
          flex: 0.9,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '12px',
          padding: '12px 10px',
          fontSize: '0.84rem',
          fontWeight: 600,
          color: '#0f172a',
          textDecoration: 'none',
          minHeight: '44px'
        }}
      >
        <Mail size={15} color="#64748b" />
        <span>Contact Us</span>
      </a>
    </div>
  );
};

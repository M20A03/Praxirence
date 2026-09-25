import React from 'react';
import { Smartphone, Mail } from 'lucide-react';

export const MobileStickyBar: React.FC = () => {
  return (
    <div className="mobile-sticky-bar">
      <a
        href="#apps"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '10px',
          padding: '10px',
          fontSize: '0.84rem',
          fontWeight: 600,
          color: '#0f172a',
          textDecoration: 'none'
        }}
      >
        <Smartphone size={15} color="#0284c7" />
        <span>Explore Apps</span>
      </a>

      <a
        href="#contact"
        className="btn-primary"
        style={{
          flex: 1.2,
          justifyContent: 'center',
          padding: '10px',
          fontSize: '0.84rem',
          borderRadius: '10px',
          textDecoration: 'none',
          gap: '6px'
        }}
      >
        <Mail size={15} />
        <span>Contact Us</span>
      </a>
    </div>
  );
};


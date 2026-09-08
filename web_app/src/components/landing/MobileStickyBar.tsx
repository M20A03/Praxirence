import React from 'react';
import { Download, Lock, QrCode } from 'lucide-react';

interface MobileStickyBarProps {
  onOpenPortal?: () => void;
  onOpenQr?: () => void;
}

export const MobileStickyBar: React.FC<MobileStickyBarProps> = ({ onOpenPortal, onOpenQr }) => {
  return (
    <div className="mobile-sticky-bar">
      {onOpenPortal && (
        <button
          onClick={onOpenPortal}
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
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#0f172a',
            cursor: 'pointer'
          }}
        >
          <Lock size={14} color="#0284c7" />
          <span>Doctor Portal</span>
        </button>
      )}

      {onOpenQr && (
        <button
          onClick={onOpenQr}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            padding: '10px 14px',
            color: '#0284c7',
            cursor: 'pointer'
          }}
          title="Scan QR Code"
        >
          <QrCode size={18} />
        </button>
      )}

      <a
        href="#download"
        className="btn-primary"
        style={{
          flex: 1.2,
          justifyContent: 'center',
          padding: '10px',
          fontSize: '0.82rem',
          borderRadius: '10px'
        }}
      >
        <Download size={14} />
        <span>Install APK</span>
      </a>
    </div>
  );
};

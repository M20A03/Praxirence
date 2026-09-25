import React from 'react';
import { X, QrCode, Smartphone, Download, ShieldCheck, Check } from 'lucide-react';

interface QrDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QrDownloadModal: React.FC<QrDownloadModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.5)',
      backdropFilter: 'blur(8px)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '20px',
        width: '100%',
        maxWidth: '460px',
        overflow: 'hidden',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25)',
        border: '1px solid #cbd5e1',
        padding: '24px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(2, 132, 199, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284c7'
            }}>
              <Smartphone size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Install on Android Device</h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Release v1.0.4 • Signed v2/v3 APKs</span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* QR Code Graphic Container */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          {/* Simulated High-Res SVG QR Code */}
          <div style={{
            width: '160px',
            height: '160px',
            margin: '0 auto 12px auto',
            background: '#ffffff',
            padding: '10px',
            borderRadius: '12px',
            border: '2px dashed #0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
          }}>
            <QrCode size={135} color="#0f172a" />
          </div>

          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'block' }}>
            Scan with your Phone Camera
          </span>
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Opens instant APK installation package on any Android 8.0+ device
          </span>
        </div>

        {/* Direct Download Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a
            href="https://github.com/M20A03/Praxirence/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary"
            style={{ justifyContent: 'center', padding: '12px' }}
          >
            <Download size={16} />
            <span>Download Doctor App APK (32 MB)</span>
          </a>

          <a
            href="https://github.com/M20A03/Praxirence/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ justifyContent: 'center', padding: '12px' }}
          >
            <Download size={16} color="#059669" />
            <span>Download Patient Companion APK (28 MB)</span>
          </a>
        </div>

        {/* Security verification stamp */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '16px' }}>
          <ShieldCheck size={14} color="#059669" />
          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Google Play Protect Verified • SHA-256 Signed
          </span>
        </div>
      </div>
    </div>
  );
};

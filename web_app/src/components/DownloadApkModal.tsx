import React, { useEffect } from 'react';
import { Download, Smartphone, X, CheckCircle2, ShieldCheck, QrCode, ExternalLink, ArrowRight } from 'lucide-react';

interface DownloadApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadApkModal: React.FC<DownloadApkModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const githubReleaseUrl = 'https://github.com/M20A03/Praxirence/releases/tag/v1.0.0';

  const handleDownloadClick = () => {
    window.open(githubReleaseUrl, '_blank');
  };

  return (
    <div 
      className="modal-backdrop" 
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ 
          maxWidth: '520px', 
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          position: 'relative'
        }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'rgba(6, 182, 212, 0.12)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}>
              <img src="/logo-icon.svg" alt="Praxirence" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Patient Mobile App
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                  <ShieldCheck size={12} /> Android APK v1.0.0
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Android 7.0 to 14+
                </span>
              </div>
            </div>
          </div>
          
          {/* Prominent Top Close Button */}
          <button 
            onClick={onClose} 
            className="btn-icon" 
            aria-label="Close modal"
            style={{ 
              width: '40px', 
              height: '40px', 
              borderRadius: '10px', 
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Feature Highlights */}
        <div style={{
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '20px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Features Built for Patients:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>Daily Pill Timelines</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>WhatsApp OTP Login</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>Bilingual (हिंदी / Eng)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
              <CheckCircle2 size={16} color="#10b981" />
              <span>Offline Prescription Access</span>
            </div>
          </div>
        </div>

        {/* Download Action */}
        <div style={{ marginBottom: '16px' }}>
          <button
            onClick={handleDownloadClick}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '1rem',
              fontWeight: 700,
              justifyContent: 'center',
              boxShadow: '0 6px 20px rgba(6, 182, 212, 0.3)'
            }}
          >
            <Download size={20} />
            <span>Download Patient Android APK</span>
          </button>
        </div>

        {/* Quick 3-Step Install Guide */}
        <div style={{
          borderTop: '1px solid var(--border-color)',
          paddingTop: '16px',
          marginBottom: '20px',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
            Quick Installation Steps:
          </div>
          <ol style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>Download the APK file onto your Android device.</li>
            <li>Tap the downloaded file and select <b>"Install"</b>.</li>
            <li>Open Praxirence and enter your phone number to receive your OTP!</li>
          </ol>
        </div>

        {/* Dedicated Close Button at Bottom */}
        <button
          type="button"
          onClick={onClose}
          className="btn btn-secondary"
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '0.9rem',
            fontWeight: 600,
            justifyContent: 'center'
          }}
        >
          <span>Close Window</span>
        </button>
      </div>
    </div>
  );
};

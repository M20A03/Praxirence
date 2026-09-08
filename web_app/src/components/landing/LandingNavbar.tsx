import React from 'react';
import { ShieldCheck, Download, ArrowRight } from 'lucide-react';

interface LandingNavbarProps {
  onOpenPortal?: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ onOpenPortal }) => {
  return (
    <header className="landing-navbar">
      <div className="landing-nav-inner">
        {/* Brand Logo & Live Regulatory Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%)',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.2)'
            }}>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', color: '#06b6d4' }}>P</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 800, fontSize: '1.25rem', letterSpacing: '-0.03em', color: '#0f172a' }}>
                prax<span style={{ color: '#06b6d4' }}>i</span><span style={{ color: '#10b981' }}>rence</span>
              </span>
            </div>
          </a>

          {/* Live Regulatory Status */}
          <div className="badge-status" title="Compliant with National Medical Commission Guidelines & Digital Personal Data Protection Act 2023">
            <span className="status-dot"></span>
            <span>NMC & DPDP 2023 Compliant</span>
          </div>
        </div>

        {/* Navigation Anchors */}
        <nav className="nav-links">
          <a href="#apps" className="nav-link">Mobile Apps</a>
          <a href="#architecture" className="nav-link">Clinical Architecture</a>
          <a href="#technology" className="nav-link">Trust & Security</a>
          <a href="#download" className="nav-link">Downloads</a>
        </nav>

        {/* Action CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onOpenPortal && (
            <button
              onClick={onOpenPortal}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#0f172a';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#475569';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              Doctor Console
            </button>
          )}

          <a
            href="#download"
            className="btn-primary"
            style={{ padding: '8px 18px', fontSize: '0.875rem', borderRadius: '10px' }}
          >
            <Download size={15} />
            <span>Get Doctor App</span>
          </a>
        </div>
      </div>
    </header>
  );
};

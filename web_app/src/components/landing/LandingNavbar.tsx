import React, { useState } from 'react';
import { ShieldCheck, Download, Menu, X, Smartphone, Layers, HelpCircle, Lock } from 'lucide-react';

interface LandingNavbarProps {
  onOpenPortal?: () => void;
  onOpenQr?: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({ onOpenPortal, onOpenQr }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="landing-navbar">
      <div className="landing-nav-inner">
        {/* Brand Logo & Live Regulatory Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="#" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(2, 132, 199, 0.15)',
              flexShrink: 0
            }}>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0284c7' }}>P</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.03em', color: '#0f172a' }}>
              prax<span style={{ color: '#0284c7' }}>i</span><span style={{ color: '#059669' }}>rence</span>
            </span>
          </a>

          {/* Live Regulatory Status - Responsive text */}
          <div className="badge-status" title="Compliant with National Medical Commission Guidelines & Digital Personal Data Protection Act 2023">
            <span className="status-dot"></span>
            <span className="badge-text-desktop">NMC & DPDP 2023</span>
          </div>
        </div>

        {/* Desktop Navigation Anchors */}
        <nav className="nav-links">
          <a href="#apps" className="nav-link">Mobile Apps</a>
          <a href="#architecture" className="nav-link">Architecture</a>
          <a href="#technology" className="nav-link">Security</a>
          <a href="#faq" className="nav-link">FAQ</a>
          <a href="#download" className="nav-link">Downloads</a>
        </nav>

        {/* Action CTAs (Desktop & Mobile trigger) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onOpenPortal && (
            <button
              onClick={onOpenPortal}
              className="navbar-portal-btn"
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease'
              }}
            >
              Doctor Console
            </button>
          )}

          <a
            href="#download"
            className="btn-primary navbar-cta-btn"
            style={{ padding: '7px 14px', fontSize: '0.825rem', borderRadius: '10px' }}
          >
            <Download size={14} />
            <span>Get App</span>
          </a>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-menu-btn"
            aria-label="Toggle navigation menu"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: '#0f172a',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Menu Drawer */}
      {mobileMenuOpen && (
        <div style={{
          background: '#ffffff',
          borderBottom: '1px solid var(--landing-border)',
          padding: '16px 20px 24px 20px',
          boxShadow: '0 12px 24px -6px rgba(15, 23, 42, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <a
            href="#apps"
            onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' }}
          >
            <Smartphone size={16} color="#0284c7" />
            <span>Doctor & Patient Mobile Apps</span>
          </a>

          <a
            href="#architecture"
            onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' }}
          >
            <Layers size={16} color="#059669" />
            <span>Clinical Architecture & Privacy</span>
          </a>

          <a
            href="#technology"
            onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' }}
          >
            <ShieldCheck size={16} color="#0284c7" />
            <span>Trust & Security Stack</span>
          </a>

          <a
            href="#faq"
            onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem' }}
          >
            <HelpCircle size={16} color="#64748b" />
            <span>Frequently Asked Questions</span>
          </a>

          <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

          <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
            {onOpenPortal && (
              <button
                onClick={() => {
                  closeMenu();
                  onOpenPortal();
                }}
                className="btn-secondary"
                style={{ justifyContent: 'center', padding: '10px' }}
              >
                <Lock size={15} color="#0284c7" />
                <span>Open Doctor Console</span>
              </button>
            )}

            <a
              href="#download"
              onClick={closeMenu}
              className="btn-primary"
              style={{ justifyContent: 'center', padding: '10px' }}
            >
              <Download size={15} />
              <span>Download Android APKs</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

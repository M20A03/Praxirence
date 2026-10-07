import React, { useState } from 'react';
import { ShieldCheck, Menu, X, Smartphone, Layers, HelpCircle, Mail, Download } from 'lucide-react';

export const LandingNavbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="landing-navbar">
      <div className="landing-nav-inner">
        {/* Brand Logo & Regulatory Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
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

          {/* Compliance Status */}
          <div className="badge-status" title="Compliant with Digital Personal Data Protection Act 2023 and ABDM Standards">
            <span className="status-dot"></span>
            <span className="badge-text-desktop">DPDP 2023 & ABDM</span>
          </div>
        </div>

        {/* Desktop Navigation Anchors */}
        <nav className="nav-links">
          <a href="#apps" className="nav-link">Mobile Apps</a>
          <a href="#architecture" className="nav-link">Architecture</a>
          <a href="#technology" className="nav-link">Security</a>
          <a href="#faq" className="nav-link">FAQ</a>
          <a href="#contact" className="nav-link">Contact</a>
        </nav>

        {/* Action CTAs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a
            href="/download"
            className="navbar-cta-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '0.825rem',
              fontWeight: 700,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              color: '#ffffff',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)',
              minHeight: '44px'
            }}
          >
            <Download size={15} strokeWidth={2.5} />
            <span>Download Patient App</span>
          </a>

          <a
            href="#contact"
            className="navbar-cta-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '0.825rem',
              fontWeight: 600,
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              textDecoration: 'none',
              minHeight: '44px'
            }}
          >
            <Mail size={14} color="#64748b" />
            <span>Contact</span>
          </a>

          {/* Mobile Hamburger Toggle (Min 44x44px Touch Target) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-menu-btn"
            aria-label="Toggle navigation menu"
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              width: '44px',
              height: '44px',
              cursor: 'pointer',
              color: '#0f172a',
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
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
          gap: '12px'
        }}>
          {/* Prominent Patient App Download Action */}
          <a
            href="/download"
            onClick={closeMenu}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
              color: '#ffffff',
              padding: '14px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.95rem',
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
              minHeight: '48px'
            }}
          >
            <Download size={18} strokeWidth={2.5} />
            <span>Download Patient App (v2.1 APK)</span>
          </a>

          <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

          <a
            href="#apps"
            onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem', minHeight: '44px' }}
          >
            <Smartphone size={18} color="#0284c7" />
            <span>Explore Mobile Platforms</span>
          </a>

          <a
            href="#architecture"
            onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem', minHeight: '44px' }}
          >
            <Layers size={18} color="#059669" />
            <span>Clinical Architecture & Privacy</span>
          </a>

          <a
            href="#technology"
            onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem', minHeight: '44px' }}
          >
            <ShieldCheck size={18} color="#0284c7" />
            <span>Security & Compliance</span>
          </a>

          <a
            href="#faq"
            onClick={closeMenu}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', textDecoration: 'none', fontWeight: 600, fontSize: '0.95rem', minHeight: '44px' }}
          >
            <HelpCircle size={18} color="#64748b" />
            <span>Frequently Asked Questions</span>
          </a>

          <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />

          <a
            href="#contact"
            onClick={closeMenu}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
              minHeight: '44px'
            }}
          >
            <Mail size={16} color="#64748b" />
            <span>Get in Touch with Praxirence</span>
          </a>
        </div>
      )}
    </header>
  );
};

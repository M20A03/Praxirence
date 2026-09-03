import React, { useState, useEffect } from 'react';
import { Stethoscope, User, LogOut, ShieldCheck, Sun, Moon, Smartphone, Menu, X, Settings } from 'lucide-react';
import { DoctorUser } from '../types';
import { DownloadApkModal } from './DownloadApkModal';

interface NavbarProps {
  doctor: DoctorUser | null;
  onLogout: () => void;
  onOpenDoctorProfile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ doctor, onLogout, onOpenDoctorProfile }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('praxirence_theme') as 'light' | 'dark' | null;
    const initialTheme = saved || 'light';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('praxirence_theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <header style={{
      borderBottom: '1px solid var(--border-color)',
      background: 'var(--bg-header)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '12px 0',
      transition: 'background-color 0.3s ease, border-color 0.3s ease'
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
            boxShadow: '0 4px 16px rgba(6, 182, 212, 0.2)'
          }}>
            <img 
              src="/logo-icon.png" 
              alt="Praxirence Logo" 
              style={{ width: '32px', height: '32px', objectFit: 'contain' }} 
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                prax<span style={{ color: '#06b6d4' }}>i</span>rence
              </span>
              <span className="badge badge-success desktop-only" style={{ fontSize: '0.65rem' }}>
                <ShieldCheck size={12} /> Clinical Portal
              </span>
            </div>
            <p className="desktop-only" style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
              AI Clinical Consultation & WhatsApp Care Plan Platform
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <div className="desktop-only" style={{ alignItems: 'center', gap: '12px' }}>
          {/* Download Patient App Button */}
          <button
            onClick={() => setIsApkModalOpen(true)}
            className="btn btn-secondary"
            style={{
              padding: '7px 13px',
              fontSize: '0.825rem',
              fontWeight: 600,
              gap: '6px',
              border: '1px solid rgba(6, 182, 212, 0.4)',
              background: 'rgba(6, 182, 212, 0.08)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
            title="Download Patient Android APK"
          >
            <Smartphone size={16} color="#06b6d4" />
            <span>Patient App (APK)</span>
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="btn-icon"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)'
            }}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} color="#f59e0b" />}
          </button>

          {doctor && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                onClick={onOpenDoctorProfile}
                style={{
                  background: 'none',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  textAlign: 'right',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '10px',
                  transition: 'background 0.2s',
                }}
                title="Manage Clinic & Doctor Profile"
              >
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {doctor.name}
                  </div>
                  <div style={{ fontSize: '0.725rem', color: 'var(--emerald-600)', fontWeight: 600 }}>
                    {doctor.specialty || 'General Practitioner'}
                  </div>
                </div>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User size={18} color="var(--text-secondary)" />
                </div>
              </button>

              <button
                onClick={onLogout}
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.825rem' }}
                title="Sign Out"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Action Controls: Theme + Hamburger Drawer */}
        <div className="mobile-only" style={{ alignItems: 'center', gap: '8px' }}>
          <button
            onClick={toggleTheme}
            className="btn-icon"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)'
            }}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} color="#f59e0b" />}
          </button>

          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="btn-icon"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)'
            }}
            aria-label="Open Mobile Menu"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Mobile Slide-Out Drawer */}
      {isMobileDrawerOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setIsMobileDrawerOpen(false)}>
          <div className="mobile-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src="/logo-icon.png" alt="Logo" style={{ width: '28px', height: '28px' }} />
                <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>prax<span style={{ color: '#06b6d4' }}>i</span>rence</span>
              </div>
              <button
                onClick={() => setIsMobileDrawerOpen(false)}
                className="btn-icon"
                style={{ width: '32px', height: '32px', borderRadius: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {doctor && (
              <div style={{
                background: 'var(--bg-subtle)',
                padding: '14px',
                borderRadius: '12px',
                marginBottom: '20px',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'var(--bg-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <User size={18} color="var(--emerald-500)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{doctor.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{doctor.specialty}</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    if (onOpenDoctorProfile) onOpenDoctorProfile();
                  }}
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '8px', fontSize: '0.8rem', gap: '6px' }}
                >
                  <Settings size={14} />
                  <span>Clinic & Profile Settings</span>
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
              <button
                onClick={() => {
                  setIsMobileDrawerOpen(false);
                  setIsApkModalOpen(true);
                }}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px', gap: '10px' }}
              >
                <Smartphone size={18} color="#06b6d4" />
                <span>Download Patient APK</span>
              </button>

              <button
                onClick={toggleTheme}
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '12px', gap: '10px' }}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} color="#f59e0b" />}
                <span>{theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}</span>
              </button>
            </div>

            {doctor && (
              <div style={{ paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
                <button
                  onClick={() => {
                    setIsMobileDrawerOpen(false);
                    onLogout();
                  }}
                  className="btn btn-danger"
                  style={{ width: '100%', padding: '12px', gap: '8px' }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Patient App APK Modal */}
      <DownloadApkModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />
    </header>
  );
};

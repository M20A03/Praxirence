import React, { useState, useEffect } from 'react';
import { Stethoscope, User, LogOut, ShieldCheck, Sun, Moon, Smartphone } from 'lucide-react';
import { DoctorUser } from '../types';
import { DownloadApkModal } from './DownloadApkModal';

interface NavbarProps {
  doctor: DoctorUser | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ doctor, onLogout }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);

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
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 0',
      transition: 'background-color 0.3s ease, border-color 0.3s ease'
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
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
              style={{ width: '36px', height: '36px', objectFit: 'contain' }} 
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
                prax<span style={{ color: '#06b6d4' }}>i</span>rence
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                <ShieldCheck size={12} /> Clinical Portal
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              AI Clinical Consultation & WhatsApp Care Plan Platform
            </p>
          </div>
        </div>

        {/* Right Section: Theme Toggle & Doctor Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'right' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {doctor.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--emerald-600)', fontWeight: 600 }}>
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
              </div>

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
      </div>

      {/* Patient App APK Modal */}
      <DownloadApkModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />
    </header>
  );
};

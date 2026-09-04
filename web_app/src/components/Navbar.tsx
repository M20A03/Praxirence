import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  User, 
  LogOut, 
  ShieldCheck, 
  Sun, 
  Moon, 
  Smartphone, 
  Menu, 
  X, 
  Settings,
  ShieldAlert
} from 'lucide-react';
import { DownloadApkModal } from './DownloadApkModal';
import { BrandLogo } from './BrandLogo';

interface NavbarProps {
  user: any;
  role: 'doctor' | 'patient';
  onLogout: () => void;
  onOpenDoctorProfile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, role, onLogout, onOpenDoctorProfile }) => {
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

  const isDoctor = role === 'doctor';

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
          <BrandLogo size="md" showSubtitle={false} />
          <span className={`badge ${isDoctor ? 'badge-success' : 'badge-info'} desktop-only`} style={{ fontSize: '0.65rem' }}>
            <ShieldCheck size={12} /> {isDoctor ? 'Clinical Console' : 'Patient Health Portal'}
          </span>
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

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {isDoctor ? (
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
                      {user.name}
                    </div>
                    <div style={{ fontSize: '0.725rem', color: '#06b6d4', fontWeight: 600 }}>
                      {user.specialty || 'General Practitioner'}
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
                    <Stethoscope size={18} color="#06b6d4" />
                  </div>
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'right' }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: '0.725rem', color: '#10b981', fontWeight: 600 }}>
                      {user.phone}
                    </div>
                  </div>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <User size={18} color="#10b981" />
                  </div>
                </div>
              )}

              <button
                onClick={onLogout}
                className="btn btn-secondary"
                style={{ padding: '8px 14px', fontSize: '0.825rem' }}
                title="Sign Out"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Menu Toggle */}
        <div className="mobile-only" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
            className="btn-icon"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)'
            }}
          >
            {isMobileDrawerOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {isMobileDrawerOpen && (
        <div style={{
          position: 'fixed',
          top: '64px',
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 999,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            width: '80%',
            maxWidth: '320px',
            background: 'var(--bg-card)',
            height: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
            borderLeft: '1px solid var(--border-color)'
          }}>
            {user && (
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
                    {isDoctor ? <Stethoscope size={18} color="#06b6d4" /> : <User size={18} color="#10b981" />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{user.name}</div>
                    <div style={{ fontSize: '0.75rem', color: isDoctor ? '#06b6d4' : '#10b981' }}>
                      {isDoctor ? user.specialty : user.phone}
                    </div>
                  </div>
                </div>

                {isDoctor && onOpenDoctorProfile && (
                  <button
                    onClick={() => {
                      setIsMobileDrawerOpen(false);
                      onOpenDoctorProfile();
                    }}
                    className="btn btn-secondary"
                    style={{ width: '100%', padding: '8px', fontSize: '0.8rem', gap: '6px' }}
                  >
                    <Settings size={14} />
                    <span>Clinic & Profile Settings</span>
                  </button>
                )}
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

            {user && (
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

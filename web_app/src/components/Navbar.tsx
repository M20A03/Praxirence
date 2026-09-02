import React from 'react';
import { Stethoscope, User, LogOut, ShieldCheck } from 'lucide-react';
import { DoctorUser } from '../types';

interface NavbarProps {
  doctor: DoctorUser | null;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ doctor, onLogout }) => {
  return (
    <header style={{
      borderBottom: '1px solid var(--border-color)',
      background: 'rgba(17, 24, 39, 0.85)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '14px 0'
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #10b981, #06b6d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
          }}>
            <Stethoscope size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
                Praxirence
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

        {/* Doctor Info & Logout */}
        {doctor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', textAlign: 'right' }}>
              <div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {doctor.name}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--emerald-400)' }}>
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
    </header>
  );
};

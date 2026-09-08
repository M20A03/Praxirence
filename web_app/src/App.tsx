import React, { useState } from 'react';
import './styles/landing.css';
import { LandingNavbar } from './components/landing/LandingNavbar';
import { LandingHero } from './components/landing/LandingHero';
import { AppShowcase } from './components/landing/AppShowcase';
import { ClinicalArchitecture } from './components/landing/ClinicalArchitecture';
import { TechnologyStack } from './components/landing/TechnologyStack';
import { EarlyAccessForm } from './components/landing/EarlyAccessForm';
import { LandingFooter } from './components/landing/LandingFooter';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PatientPortalPage } from './pages/PatientPortalPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { X, Lock } from 'lucide-react';

const MainWebsite: React.FC = () => {
  const [showPortalModal, setShowPortalModal] = useState(false);
  const { isAuthenticated, user, role, logout } = useAuth();

  return (
    <div className="landing-container">
      {/* Ambient background glows */}
      <div className="landing-ambient-top"></div>
      <div className="landing-ambient-mid"></div>
      <div className="landing-ambient-bottom"></div>

      {/* 1. Header & Navigation */}
      <LandingNavbar onOpenPortal={() => setShowPortalModal(true)} />

      {/* 2. Hero Section */}
      <LandingHero />

      {/* 3. Dual Mobile App Showcase */}
      <AppShowcase />

      {/* 4. Company Pillars & Clinical Architecture */}
      <ClinicalArchitecture />

      {/* 5. Technology & Trust Stack */}
      <TechnologyStack />

      {/* 6. CTA & Early Access / APK Download */}
      <EarlyAccessForm />

      {/* 7. Footer */}
      <LandingFooter />

      {/* Optional Doctor / Clinic Portal Modal */}
      {showPortalModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            maxWidth: '1100px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={16} color="#06b6d4" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fff' }}>
                  Praxirence Clinical Portal
                </span>
              </div>
              <button
                onClick={() => setShowPortalModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Portal Body */}
            <div style={{ padding: '24px' }}>
              {!isAuthenticated ? (
                <LoginPage />
              ) : role === 'doctor' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>Logged in as Dr. {user?.name}</span>
                    <button onClick={logout} style={{ padding: '6px 12px', borderRadius: '8px', background: '#334155', color: '#fff', border: 'none', cursor: 'pointer' }}>
                      Sign Out
                    </button>
                  </div>
                  <DashboardPage />
                </div>
              ) : (
                <PatientPortalPage />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MainWebsite />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;

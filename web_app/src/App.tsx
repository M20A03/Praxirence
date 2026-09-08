import React, { useState } from 'react';
import './styles/landing.css';
import { LandingNavbar } from './components/landing/LandingNavbar';
import { LandingHero } from './components/landing/LandingHero';
import { InteractiveConsultDemo } from './components/landing/InteractiveConsultDemo';
import { AppShowcase } from './components/landing/AppShowcase';
import { ClinicalArchitecture } from './components/landing/ClinicalArchitecture';
import { TechnologyStack } from './components/landing/TechnologyStack';
import { FaqSection } from './components/landing/FaqSection';
import { EarlyAccessForm } from './components/landing/EarlyAccessForm';
import { LandingFooter } from './components/landing/LandingFooter';
import { MobileStickyBar } from './components/landing/MobileStickyBar';
import { WhatsAppPreviewModal } from './components/landing/WhatsAppPreviewModal';
import { QrDownloadModal } from './components/landing/QrDownloadModal';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PatientPortalPage } from './pages/PatientPortalPage';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { X, Lock } from 'lucide-react';

const MainWebsite: React.FC = () => {
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const { isAuthenticated, user, role, logout } = useAuth();

  return (
    <div className="landing-container">
      {/* Ambient background glows */}
      <div className="landing-ambient-top"></div>
      <div className="landing-ambient-mid"></div>
      <div className="landing-ambient-bottom"></div>

      {/* 1. Responsive Header & Navigation */}
      <LandingNavbar
        onOpenPortal={() => setShowPortalModal(true)}
        onOpenQr={() => setShowQrModal(true)}
      />

      {/* 2. Hero Section with Live Metrics */}
      <LandingHero />

      {/* 3. Interactive Ambient Clinical AI Simulator */}
      <InteractiveConsultDemo />

      {/* 4. Dual Mobile App Showcase with Phone Frame */}
      <AppShowcase
        onOpenWhatsAppPreview={() => setShowWhatsAppModal(true)}
        onOpenQrModal={() => setShowQrModal(true)}
      />

      {/* 5. Company Pillars & Clinical Architecture */}
      <ClinicalArchitecture />

      {/* 6. Technology & Trust Stack */}
      <TechnologyStack />

      {/* 7. Clinical & Technical FAQs */}
      <FaqSection />

      {/* 8. CTA, Clinic Onboarding & Direct APK Downloads */}
      <EarlyAccessForm />

      {/* 9. Compliance & Regulatory Footer */}
      <LandingFooter />

      {/* 10. Sticky Bottom Action Bar for Mobile Screens */}
      <MobileStickyBar
        onOpenPortal={() => setShowPortalModal(true)}
        onOpenQr={() => setShowQrModal(true)}
      />

      {/* WhatsApp Message Preview Modal */}
      <WhatsAppPreviewModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
      />

      {/* QR Code Phone Scan Modal */}
      <QrDownloadModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
      />

      {/* Optional Doctor / Clinic Portal Modal */}
      {showPortalModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '20px',
            maxWidth: '1100px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={16} color="#0284c7" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                  Praxirence Clinical Portal
                </span>
              </div>
              <button
                onClick={() => setShowPortalModal(false)}
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

            {/* Portal Body */}
            <div style={{ padding: '20px' }}>
              {!isAuthenticated ? (
                <LoginPage />
              ) : role === 'doctor' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ color: '#059669', fontWeight: 600 }}>Logged in as Dr. {user?.name}</span>
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

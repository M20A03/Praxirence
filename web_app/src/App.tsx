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
import { ErrorBoundary } from './components/ErrorBoundary';

const MainWebsite: React.FC = () => {
  return (
    <main id="main-content" className="landing-container" role="main">
      {/* Ambient background glows */}
      <div className="landing-ambient-top" aria-hidden="true"></div>
      <div className="landing-ambient-mid" aria-hidden="true"></div>
      <div className="landing-ambient-bottom" aria-hidden="true"></div>

      {/* 1. Responsive Header & Navigation */}
      <LandingNavbar />

      {/* 2. Hero Section Balanced for Clinicians & Patients */}
      <LandingHero />

      {/* 3. Interactive Ambient Clinical AI Simulator */}
      <InteractiveConsultDemo />

      {/* 4. Dual Mobile App Showcase with Phone Frame */}
      <AppShowcase />

      {/* 5. Company Pillars & Clinical Architecture */}
      <ClinicalArchitecture />

      {/* 6. Technology & Trust Stack */}
      <TechnologyStack />

      {/* 7. Clinical & Technical FAQs */}
      <FaqSection />

      {/* 8. Partner & Inquiries Section */}
      <EarlyAccessForm />

      {/* 9. Compliance & Company Footer */}
      <LandingFooter />

      {/* 10. Sticky Action Bar for Mobile Screens */}
      <MobileStickyBar />
    </main>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <MainWebsite />
    </ErrorBoundary>
  );
};

export default App;

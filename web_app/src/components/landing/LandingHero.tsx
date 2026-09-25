import React from 'react';
import { Smartphone, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export const LandingHero: React.FC = () => {
  return (
    <section className="hero-wrapper">
      {/* Pill Badge */}
      <div style={{ display: 'inline-flex', justifyContent: 'center' }}>
        <div className="section-tag">
          <Zap size={14} />
          <span>Next-Generation Ambient Clinical Ecosystem</span>
        </div>
      </div>

      {/* Main Headline */}
      <h1 className="hero-headline">
        Ambient Clinical Intelligence for <span>Doctors & Patients</span>.
      </h1>

      {/* Subtitle */}
      <p className="hero-sub">
        Praxirence bridges clinicians and patients seamlessly: ambiently structuring clinical notes and prescriptions for doctors, while delivering instant vernacular care plans, medication reminders, and synchronized in-app care plans directly to patients.
      </p>

      {/* Dual CTA Buttons */}
      <div className="hero-cta-group">
        <a href="#apps" className="btn-primary">
          <Smartphone size={18} />
          <span>Explore Doctor & Patient Apps</span>
          <ArrowRight size={16} />
        </a>

        <a href="#contact" className="btn-secondary">
          <ShieldCheck size={18} color="#10b981" />
          <span>Partner With Us</span>
        </a>
      </div>

      {/* Clinical Highlights Strip */}
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-number accent">Instant</div>
          <div className="stat-label">In-App Care Plan Sync</div>
        </div>

        <div className="stat-item">
          <div className="stat-number">Dual-App</div>
          <div className="stat-label">Doctor & Patient Platform</div>
        </div>

        <div className="stat-item">
          <div className="stat-number accent">0 KB</div>
          <div className="stat-label">Audio Retained (RAM-Only)</div>
        </div>

        <div className="stat-item">
          <div className="stat-number">ABDM & DPDP</div>
          <div className="stat-label">India Digital Health Standards</div>
        </div>
      </div>
    </section>
  );
};

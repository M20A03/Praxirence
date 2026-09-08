import React from 'react';
import { Smartphone, ArrowRight, ShieldCheck, Zap, Lock, Activity } from 'lucide-react';

export const LandingHero: React.FC = () => {
  return (
    <section className="hero-wrapper">
      {/* Pill Badge */}
      <div style={{ display: 'inline-flex', justifyContent: 'center' }}>
        <div className="section-tag">
          <Zap size={14} />
          <span>Next-Generation Ambient Clinical AI</span>
        </div>
      </div>

      {/* Main Headline */}
      <h1 className="hero-headline">
        Clinical Care Plans, <span>Ambiently Generated</span>. Zero Overhead.
      </h1>

      {/* Subtitle */}
      <p className="hero-sub">
        Praxirence listens to bilingual doctor-patient consultations, generates structured clinical care plans, mandates physician legal sign-off, and dispatches plain-language care instructions straight to WhatsApp.
      </p>

      {/* Dual CTA Buttons */}
      <div className="hero-cta-group">
        <a href="#apps" className="btn-primary">
          <Smartphone size={18} />
          <span>Explore Doctor App</span>
          <ArrowRight size={16} />
        </a>

        <a href="#download" className="btn-secondary">
          <ShieldCheck size={18} color="#10b981" />
          <span>Request Clinic Access</span>
        </a>
      </div>

      {/* Live Metrics Strip */}
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-number accent">&lt; 1.2s</div>
          <div className="stat-label">Synthesis Latency</div>
        </div>

        <div className="stat-item">
          <div className="stat-number">100%</div>
          <div className="stat-label">Physician-Verified Sign-Off</div>
        </div>

        <div className="stat-item">
          <div className="stat-number accent">0 KB</div>
          <div className="stat-label">Audio Retained (RAM-Only)</div>
        </div>

        <div className="stat-item">
          <div className="stat-number">ABDM</div>
          <div className="stat-label">FHIR M2 Interoperable</div>
        </div>
      </div>
    </section>
  );
};

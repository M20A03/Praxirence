import React from 'react';
import { Cpu, Database, MessageSquare, Smartphone, ArrowRight, ShieldCheck, KeyRound, Hash } from 'lucide-react';

export const TechnologyStack: React.FC = () => {
  return (
    <section id="technology" className="landing-section">
      <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto' }}>
        <div className="section-tag">
          <Cpu size={14} />
          <span>Technology & Trust Stack</span>
        </div>
        <h2 className="section-title">End-to-End Cryptographic Integrity</h2>
        <p className="section-subtitle" style={{ margin: '0 auto' }}>
          From the mobile microphone to the patient's WhatsApp screen, every consultation byte travels through a hardened, low-latency clinical pipeline.
        </p>
      </div>

      {/* Visual Pipeline Flow */}
      <div className="pipeline-flow">
        <div className="pipeline-node">
          <Smartphone size={24} color="#06b6d4" style={{ margin: '0 auto' }} />
          <h5>Mobile Apps</h5>
          <span>React Native Native Audio & AES Vault</span>
        </div>

        <div className="pipeline-arrow">
          <ArrowRight size={20} />
        </div>

        <div className="pipeline-node">
          <Database size={24} color="#10b981" style={{ margin: '0 auto' }} />
          <h5>FastAPI Cloud Core</h5>
          <span>Asynchronous Orchestration & Ephemeral Audio Stream</span>
        </div>

        <div className="pipeline-arrow">
          <ArrowRight size={20} />
        </div>

        <div className="pipeline-node">
          <Cpu size={24} color="#8b5cf6" style={{ margin: '0 auto' }} />
          <h5>Clinical LLM Pipeline</h5>
          <span>Fine-Tuned Medical Extraction & ICD-10 Coding</span>
        </div>

        <div className="pipeline-arrow">
          <ArrowRight size={20} />
        </div>

        <div className="pipeline-node">
          <MessageSquare size={24} color="#25D366" style={{ margin: '0 auto' }} />
          <h5>WhatsApp Meta API</h5>
          <span>Verified Business Delivery & Instant PDF Dispatch</span>
        </div>
      </div>

      {/* Security Badges Grid */}
      <div className="security-badges">
        <div className="badge-card">
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <KeyRound size={20} color="#06b6d4" />
          </div>
          <div className="badge-card-info">
            <h6>AES-256 GCM Encryption</h6>
            <p>At-rest and in-transit encryption for all clinical records and patient identifiers.</p>
          </div>
        </div>

        <div className="badge-card">
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldCheck size={20} color="#10b981" />
          </div>
          <div className="badge-card-info">
            <h6>NMC Registry Verification</h6>
            <p>OTP-authenticated doctor onboarding cross-referenced against National Medical Commission records.</p>
          </div>
        </div>

        <div className="badge-card">
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Hash size={20} color="#8b5cf6" />
          </div>
          <div className="badge-card-info">
            <h6>SHA-256 Tamper Seals</h6>
            <p>Immutable cryptographic hashes attached to each verified prescription for auditability.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

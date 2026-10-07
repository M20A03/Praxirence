import React, { useEffect, useState } from 'react';
import { Download, ShieldCheck, CheckCircle2, ArrowLeft, RefreshCw, Lock, Globe, FileCheck2, Smartphone } from 'lucide-react';

export const DownloadPage: React.FC = () => {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const patientApkUrl = '/downloads/Praxirence-Patient.apk';
  const patientApkSha256 = 'eb2447d336923c8ef815fa2b1e6ddc2bfb4af4b36cb488cd10475a4ba97b3862';

  const triggerDownload = () => {
    setDownloadStarted(true);
    const link = document.createElement('a');
    link.href = patientApkUrl;
    link.setAttribute('download', 'Praxirence-Patient.apk');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('auto') === 'true') {
      setCountdown(2);
      const timer = setTimeout(() => {
        triggerDownload();
        setCountdown(null);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="download-page-root">
      {/* 1. Header */}
      <header className="download-header">
        <div className="download-header-inner">
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.15) 0%, rgba(2, 132, 199, 0.15) 100%)',
              border: '1px solid rgba(13, 148, 136, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(13, 148, 136, 0.15)',
              flexShrink: 0
            }}>
              <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#0d9488' }}>P</span>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                prax<span style={{ color: '#0284c7' }}>i</span><span style={{ color: '#059669' }}>rence</span>
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(13, 148, 136, 0.1)', color: '#0f766e', fontWeight: 700, border: '1px solid rgba(13, 148, 136, 0.2)' }}>
                  Care
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Official Patient Portal</p>
            </div>
          </a>

          <a href="/" className="download-back-btn">
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </a>
        </div>
      </header>

      {/* 2. Main Content */}
      <main className="download-main-content">
        {/* Verification Badge */}
        <div className="download-badge">
          <ShieldCheck size={16} color="#0f766e" />
          <span>Official Release • Version 2.1 Production</span>
        </div>

        <h1 className="download-heading">
          Download Praxirence Patient App
        </h1>
        <p className="download-lead">
          Ambient clinical intelligence, vernacular medication timelines (Hindi & English), and end-to-end encrypted health record vault.
        </p>

        {/* Auto-download notice */}
        {countdown !== null && (
          <div style={{
            marginBottom: '20px',
            padding: '10px 18px',
            borderRadius: '12px',
            background: 'rgba(13, 148, 136, 0.08)',
            border: '1px solid rgba(13, 148, 136, 0.3)',
            color: '#0f766e',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <RefreshCw size={16} className="animate-spin" />
            <span>Automatic download starting momentarily...</span>
          </div>
        )}

        {/* Primary Download Card */}
        <div className="download-primary-card">
          <div className="download-app-identity">
            <div className="download-app-icon-box">
              <Smartphone size={32} color="#0d9488" />
            </div>
            <div>
              <h2 className="download-app-title">Praxirence Patient</h2>
              <p className="download-app-sub">Digital Health Locker & Daily Prescription Companion</p>
              <div className="download-tags-row">
                <span className="download-tag-badge">v2.1 Production</span>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>66 MB • Android 8.0 to 15+</span>
              </div>
            </div>
          </div>

          {/* 1-Click Large Download Action */}
          <a
            href={patientApkUrl}
            download="Praxirence-Patient.apk"
            onClick={() => setDownloadStarted(true)}
            className="download-cta-btn"
          >
            <Download size={20} strokeWidth={2.5} />
            <span>{downloadStarted ? 'Downloading Patient APK...' : 'Download APK (1-Click)'}</span>
          </a>

          {downloadStarted && (
            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: '#0d9488', marginTop: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} /> Download initiated in your browser. Tap 'Open' or check Downloads when finished.
            </p>
          )}

          {/* SHA-256 Checksum & VirusTotal Box */}
          <div className="download-checksum-box">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
              <span style={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <FileCheck2 size={14} color="#10b981" /> VirusTotal: 0/67 Clean (Verified Safe)
              </span>
              <a
                href={patientApkUrl}
                download="Praxirence-Patient.apk"
                style={{ color: '#0d9488', fontWeight: 600, textDecoration: 'none' }}
              >
                Direct File Link
              </a>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', wordBreak: 'break-all', fontFamily: 'monospace' }}>
              SHA-256: {patientApkSha256}
            </div>
          </div>
        </div>

        {/* 3-Step Installation Guide */}
        <div className="download-steps-container">
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: '16px' }}>
            Quick Installation in 3 Simple Steps
          </h3>

          <div className="download-steps-grid">
            <div className="download-step-card">
              <div className="download-step-number">1</div>
              <h4 className="download-step-title">Tap 'Download anyway'</h4>
              <p className="download-step-desc">
                Android displays a standard safety prompt for direct APK installations outside Google Play. Tap confirm.
              </p>
            </div>

            <div className="download-step-card">
              <div className="download-step-number">2</div>
              <h4 className="download-step-title">Open Downloaded File</h4>
              <p className="download-step-desc">
                Swipe down your notifications panel or open your browser's Downloads folder and tap Praxirence-Patient.apk.
              </p>
            </div>

            <div className="download-step-card">
              <div className="download-step-number">3</div>
              <h4 className="download-step-title">Tap 'Install' or 'Update'</h4>
              <p className="download-step-desc">
                Android securely installs the update. All your previous care plans, health records, and phone biometric settings remain intact.
              </p>
            </div>
          </div>
        </div>

        {/* Trust & Compliance Strip */}
        <div className="download-trust-strip">
          <div className="download-trust-item">
            <Lock size={16} color="#0d9488" />
            <span>Biometric AES-256 Vault</span>
          </div>
          <div className="download-trust-item">
            <ShieldCheck size={16} color="#0d9488" />
            <span>DPDP Act 2023 Compliant</span>
          </div>
          <div className="download-trust-item">
            <Globe size={16} color="#0d9488" />
            <span>Bilingual (हिंदी & English)</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #e2e8f0', padding: '16px 20px', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
        © 2026 Praxirence Healthcare Technologies. All rights reserved.
      </footer>
    </div>
  );
};

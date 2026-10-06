import React, { useEffect, useState } from 'react';
import { Download, ShieldCheck, Smartphone, CheckCircle, ArrowLeft, RefreshCw, FileText, Lock, Globe } from 'lucide-react';

export const DownloadPage: React.FC = () => {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const patientApkUrl = '/downloads/Praxirence-Patient-v2.1-Production.apk';

  const triggerDownload = () => {
    setDownloadStarted(true);
    const link = document.createElement('a');
    link.href = patientApkUrl;
    link.setAttribute('download', 'Praxirence-Patient-v2.1-Production.apk');
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
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-4 py-3 sm:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center p-1.5 shadow-sm group-hover:border-teal-500/60 transition-all">
              <img src="/logo-icon.png" alt="Praxirence" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                Praxirence <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30 font-medium">Care</span>
              </div>
              <p className="text-[11px] text-slate-400">Official Mobile App Portal</p>
            </div>
          </a>

          <a
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Website</span>
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 sm:py-14 w-full flex flex-col items-center">
        {/* Hero badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-medium mb-4">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>Official Production Build • Version 2.1</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-center tracking-tight text-white mb-3">
          Download & Update Praxirence
        </h1>
        <p className="text-slate-400 text-center max-w-xl text-sm sm:text-base mb-8">
          Instant 1-click APK direct update for patients. Secure biometric vault, offline care plan sync, and multilingual clinical AI.
        </p>

        {/* Auto download notice */}
        {countdown !== null && (
          <div className="mb-6 px-4 py-2.5 rounded-xl bg-teal-950/60 border border-teal-500/40 text-teal-200 text-xs flex items-center gap-2 animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
            <span>Automatic download starting in a moment...</span>
          </div>
        )}

        {/* Primary Download Card */}
        <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden mb-8">
          <div className="absolute top-0 right-0 w-36 h-36 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500/20 to-teal-500/5 border border-teal-500/30 flex items-center justify-center p-3 shadow-inner">
              <img src="/logo-icon.png" alt="Praxirence Care" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Praxirence Patient App
              </h2>
              <p className="text-xs text-slate-400">Digital Health Vault & Consultation Sync</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-semibold text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                  v2.1 Production
                </span>
                <span className="text-[11px] text-slate-400">66 MB • Android 8.0+</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={triggerDownload}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-slate-950 font-bold text-base flex items-center justify-center gap-3 shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Download className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            <span>{downloadStarted ? 'Downloading Patient APK...' : 'Download APK (1-Click)'}</span>
          </button>

          {downloadStarted && (
            <p className="text-center text-xs text-teal-400 mt-3 font-medium flex items-center justify-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> Download started in your browser. Tap "Open" when finished.
            </p>
          )}

          {/* Direct File Link Fallback */}
          <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Direct link:</span>
            <a
              href={patientApkUrl}
              download
              className="text-teal-400 hover:underline flex items-center gap-1 font-mono text-[11px]"
            >
              Praxirence-Patient-v2.1-Production.apk
            </a>
          </div>
        </div>

        {/* 3-Step Installation Guide */}
        <div className="w-full max-w-xl">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 text-center sm:text-left">
            How to Install / Update in 3 Simple Steps
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 flex flex-col">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold text-xs flex items-center justify-center mb-2.5">
                1
              </div>
              <h4 className="text-xs font-semibold text-white mb-1">Tap "Download anyway"</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Android displays a standard safety notice for APKs downloaded outside the Play Store. Tap confirm.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 flex flex-col">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold text-xs flex items-center justify-center mb-2.5">
                2
              </div>
              <h4 className="text-xs font-semibold text-white mb-1">Open Download</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Swipe down your notifications or open your browser's "Downloads" folder and tap the APK file.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 flex flex-col">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 font-bold text-xs flex items-center justify-center mb-2.5">
                3
              </div>
              <h4 className="text-xs font-semibold text-white mb-1">Tap "Update"</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Android will update your app. All your stored care plans, biometric keys, and PIN settings are safely preserved.
              </p>
            </div>
          </div>
        </div>

        {/* Security & Compliance Highlights */}
        <div className="mt-10 pt-6 border-t border-slate-800/80 w-full max-w-xl flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-teal-400" />
            <span>Biometric AES-256 Vault</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>DPDP Act 2023 Compliant</span>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-teal-400" />
            <span>Multilingual AI Support</span>
          </div>
        </div>
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-slate-800/60 py-4 text-center text-xs text-slate-500">
        © 2026 Praxirence Healthcare Technologies. All rights reserved.
      </footer>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Stethoscope, 
  Lock, 
  Mail, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  Building, 
  Award, 
  UserCheck, 
  Smartphone, 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DirectoryAccount, DirectoryResponse } from '../types';
import { BrandLogo } from '../components/BrandLogo';

type PersonaTab = 'doctor' | 'patient' | 'register';
type DoctorAuthMode = 'email_otp' | 'password' | 'google';
type RegisterPersona = 'doctor' | 'patient';

export const LoginPage: React.FC = () => {
  const { 
    loginDoctorPassword, 
    loginDoctorEmailOtp, 
    loginDoctorGoogle,
    loginPatientEmailOtp, 
    registerDoctor, 
    registerPatient 
  } = useAuth();

  // Active Navigation
  const [activeTab, setActiveTab] = useState<PersonaTab>('doctor');
  const [doctorMode, setDoctorAuthMode] = useState<DoctorAuthMode>('email_otp');
  const [registerPersona, setRegisterPersona] = useState<RegisterPersona>('doctor');

  // Form State - Doctor
  const [docEmail, setDocEmail] = useState('doctor@praxirence.com');
  const [docPassword, setDocPassword] = useState('Doctor123!');
  const [docOtpCode, setDocOtpCode] = useState('');
  const [docOtpSent, setDocOtpSent] = useState(false);
  const [docOtpCountdown, setDocOtpCountdown] = useState(0);

  // Form State - Patient
  const [patEmail, setPatEmail] = useState('patient.test@praxirence.com');
  const [patOtpCode, setPatOtpCode] = useState('');
  const [patOtpSent, setPatOtpSent] = useState(false);
  const [patOtpCountdown, setPatOtpCountdown] = useState(0);

  // Form State - Register Doctor
  const [regDocName, setRegDocName] = useState('');
  const [regDocEmail, setRegDocEmail] = useState('');
  const [regDocPhone, setRegDocPhone] = useState('');
  const [regDocPassword, setRegDocPassword] = useState('');
  const [regDocSpecialty, setRegDocSpecialty] = useState('General Physician');
  const [regDocClinic, setRegDocClinic] = useState('City Health Clinic');
  const [regDocRegNo, setRegDocRegNo] = useState('NMC-2024-9812');

  // Form State - Register Patient
  const [regPatName, setRegPatName] = useState('');
  const [regPatEmail, setRegPatEmail] = useState('');
  const [regPatPhone, setRegPatPhone] = useState('');
  const [regPatDob, setRegPatDob] = useState('1994-06-15');
  const [regPatGender, setRegPatGender] = useState('Male');

  // General State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [demoCodeHint, setDemoCodeHint] = useState<string | null>(null);

  // Directory Accounts
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(true);

  // Load registered directory on mount
  useEffect(() => {
    const fetchDirectory = async () => {
      try {
        const data = await api.getAuthDirectory();
        setDirectory(data);
      } catch (err) {
        console.warn('Unable to load directory:', err);
      }
    };
    fetchDirectory();
  }, []);

  // OTP Countdown Timers
  useEffect(() => {
    if (docOtpCountdown > 0) {
      const timer = setTimeout(() => setDocOtpCountdown(docOtpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [docOtpCountdown]);

  useEffect(() => {
    if (patOtpCountdown > 0) {
      const timer = setTimeout(() => setPatOtpCountdown(patOtpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [patOtpCountdown]);

  // Google Doctor Verification Login Handler
  const handleGoogleDoctorLogin = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      await loginDoctorGoogle({
        email: docEmail || 'doctor@praxirence.com',
        name: 'Dr. Mayank Raj',
        google_id: 'google-oauth2-verified-doc',
        avatar_url: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150'
      });
    } catch (err: any) {
      setError(err.message || 'Google Doctor verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Select from Registered Directory
  const handleSelectDirectoryAccount = (acc: DirectoryAccount) => {
    setError(null);
    setSuccessMsg(null);
    if (acc.role === 'doctor') {
      setActiveTab('doctor');
      setDoctorAuthMode('email_otp');
      if (acc.email) {
        setDocEmail(acc.email);
        setDocPassword('Doctor123!');
      }
      setSuccessMsg(`Selected clinician ${acc.name}. Ready for Email OTP or Password login.`);
    } else {
      setActiveTab('patient');
      if (acc.email) {
        setPatEmail(acc.email);
      } else {
        setPatEmail('patient.test@praxirence.com');
      }
      setSuccessMsg(`Selected patient ${acc.name}. Ready for Email OTP login.`);
    }
  };

  // ==================== SUBMIT HANDLERS ====================

  // 1. Doctor Email OTP - Request
  const handleDoctorRequestOtp = async () => {
    if (!docEmail || !docEmail.includes('@')) {
      setError('Please enter a valid doctor email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.requestDoctorEmailOtp(docEmail);
      setDocOtpSent(true);
      setDocOtpCountdown(60);
      setDemoCodeHint('987654');
      setSuccessMsg(res.message || `Access code dispatched to ${docEmail}. Dev Demo Code: 987654`);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch email access code.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Doctor Email OTP - Verify
  const handleDoctorVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docOtpCode) return;
    setError(null);
    setLoading(true);
    try {
      await loginDoctorEmailOtp(docEmail, docOtpCode);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired access code.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Doctor Password Login
  const handleDoctorPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginDoctorPassword(docEmail, docPassword);
    } catch (err: any) {
      setError(err.message || 'Login failed. Check doctor credentials.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Patient Email OTP - Request
  const handlePatientRequestOtp = async () => {
    if (!patEmail || !patEmail.includes('@')) {
      setError('Please enter a valid patient email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await api.requestPatientEmailOtp(patEmail);
      setPatOtpSent(true);
      setPatOtpCountdown(60);
      setDemoCodeHint('987654');
      setSuccessMsg(res.message || `Verification code sent to ${patEmail}. Dev Demo Code: 987654`);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch verification code.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Patient Email OTP - Verify
  const handlePatientVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patOtpCode) return;
    setError(null);
    setLoading(true);
    try {
      await loginPatientEmailOtp(patEmail, patOtpCode);
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  // 6. Register Doctor
  const handleRegisterDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerDoctor({
        name: regDocName,
        email: regDocEmail,
        phone: regDocPhone || undefined,
        password: regDocPassword,
        specialty: regDocSpecialty,
        clinic_name: regDocClinic,
        reg_number: regDocRegNo,
      });
    } catch (err: any) {
      setError(err.message || 'Doctor registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // 7. Register Patient
  const handleRegisterPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await registerPatient({
        name: regPatName,
        email: regPatEmail,
        phone: regPatPhone || regPatEmail,
        dob: regPatDob,
        gender: regPatGender,
      });
    } catch (err: any) {
      setError(err.message || 'Patient account creation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      background: 'radial-gradient(circle at 50% 15%, rgba(6, 182, 212, 0.12) 0%, transparent 65%)'
    }}>
      {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: '24px', maxWidth: '520px', width: '100%' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px'
        }}>
          <BrandLogo size="xl" showSubtitle={false} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', letterSpacing: '-0.02em' }}>
          Unified Clinical & Patient Access Portal
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
          Email OTP & Encrypted Clinical Records • DPDP 2023 Compliant
        </p>
      </div>

      {/* ==================== REGISTERED ACCOUNTS DIRECTORY INSPECTOR ==================== */}
      <div style={{ width: '100%', maxWidth: '500px', marginBottom: '16px' }}>
        <div style={{
          background: 'rgba(6, 182, 212, 0.06)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
        }}>
          <div 
            onClick={() => setIsDirectoryOpen(!isDirectoryOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} color="#06b6d4" />
              <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                REGISTERED CLINICIANS & PATIENTS
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                Live Cloud Sync
              </span>
            </div>
            {isDirectoryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {isDirectoryOpen && directory && (
            <div style={{ marginTop: '12px', borderTop: '1px solid rgba(6, 182, 212, 0.15)', paddingTop: '10px' }}>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Click any registered account below to auto-fill and sign in immediately:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                {/* Doctor Accounts */}
                {directory.doctors.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDirectoryAccount(doc)}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#06b6d4'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <Stethoscope size={13} color="#06b6d4" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {doc.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      🩺 {doc.specialty}
                    </div>
                    <div style={{ fontSize: '0.675rem', color: '#06b6d4', marginTop: '2px', fontWeight: 600 }}>
                      ✉️ {doc.email || 'doctor@praxirence.com'}
                    </div>
                  </div>
                ))}

                {/* Patient Accounts */}
                {directory.patients.map((pat) => (
                  <div
                    key={pat.id}
                    onClick={() => handleSelectDirectoryAccount(pat)}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = '#10b981'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <User size={13} color="#10b981" />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {pat.name} (Patient)
                      </span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      🛡️ DPDP Consent: {pat.consent_status ? 'Active' : 'Pending'}
                    </div>
                    <div style={{ fontSize: '0.675rem', color: '#10b981', marginTop: '2px', fontWeight: 600 }}>
                      ✉️ {pat.email || 'patient.test@praxirence.com'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== MAIN AUTH CARD ==================== */}
      <div className="card" style={{ width: '100%', maxWidth: '490px', padding: '24px 20px', margin: '0 auto' }}>
        
        {/* Main 3-Tab Persona Toggle */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
          marginBottom: '20px',
          border: '1px solid var(--border-color)'
        }}>
          <button
            type="button"
            onClick={() => { setActiveTab('doctor'); setError(null); setSuccessMsg(null); }}
            style={{
              padding: '10px 8px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'doctor' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'doctor' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'doctor' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <Stethoscope size={15} color={activeTab === 'doctor' ? '#06b6d4' : 'currentColor'} />
            <span>Doctor Login</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('patient'); setError(null); setSuccessMsg(null); }}
            style={{
              padding: '10px 8px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'patient' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'patient' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'patient' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <User size={15} color={activeTab === 'patient' ? '#10b981' : 'currentColor'} />
            <span>Patient Login</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('register'); setError(null); setSuccessMsg(null); }}
            style={{
              padding: '10px 8px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: activeTab === 'register' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'register' ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: '0.825rem',
              cursor: 'pointer',
              boxShadow: activeTab === 'register' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <UserCheck size={15} color={activeTab === 'register' ? '#8b5cf6' : 'currentColor'} />
            <span>Create Account</span>
          </button>
        </div>

        {/* Global Notifications */}
        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 1: DOCTOR LOGIN                                         */}
        {/* ============================================================ */}
        {activeTab === 'doctor' && (
          <div>
            {/* Doctor Auth Mode Selection Tabs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '6px',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '4px',
              marginBottom: '18px',
              border: '1px solid var(--border-color)'
            }}>
              <button
                type="button"
                onClick={() => { setDoctorAuthMode('email_otp'); setError(null); }}
                style={{
                  padding: '9px 4px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: doctorMode === 'email_otp' ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.18), rgba(16, 185, 129, 0.18))' : 'transparent',
                  color: doctorMode === 'email_otp' ? '#06b6d4' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  borderWidth: doctorMode === 'email_otp' ? '1px' : '0px',
                  borderStyle: 'solid',
                  borderColor: doctorMode === 'email_otp' ? 'rgba(6, 182, 212, 0.45)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: doctorMode === 'email_otp' ? '0 2px 8px rgba(6, 182, 212, 0.15)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <Mail size={14} color={doctorMode === 'email_otp' ? '#06b6d4' : 'currentColor'} />
                <span>Email OTP</span>
              </button>

              <button
                type="button"
                onClick={() => { setDoctorAuthMode('password'); setError(null); }}
                style={{
                  padding: '9px 4px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: doctorMode === 'password' ? 'var(--bg-card)' : 'transparent',
                  color: doctorMode === 'password' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  borderWidth: doctorMode === 'password' ? '1px' : '0px',
                  borderStyle: 'solid',
                  borderColor: doctorMode === 'password' ? 'var(--border-color)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: doctorMode === 'password' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <Lock size={14} color={doctorMode === 'password' ? '#06b6d4' : 'currentColor'} />
                <span>Password</span>
              </button>

              <button
                type="button"
                onClick={() => { setDoctorAuthMode('google'); setError(null); }}
                style={{
                  padding: '9px 4px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: doctorMode === 'google' ? 'var(--bg-card)' : 'transparent',
                  color: doctorMode === 'google' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  borderWidth: doctorMode === 'google' ? '1px' : '0px',
                  borderStyle: 'solid',
                  borderColor: doctorMode === 'google' ? 'var(--border-color)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: doctorMode === 'google' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google</span>
              </button>
            </div>

            {/* Sub-Mode 1: Doctor Email OTP Flow */}
            {doctorMode === 'email_otp' && (
              <div>
                <div style={{
                  background: 'rgba(6, 182, 212, 0.08)',
                  border: '1px solid rgba(6, 182, 212, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Mail size={16} color="#06b6d4" />
                  <span>
                    <strong>Doctor Email Verification:</strong> Enter your medical email to receive a secure 6-digit access code.
                  </span>
                </div>

                <form onSubmit={handleDoctorVerifyOtp}>
                  <div className="input-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="input-label" style={{ marginBottom: 0 }}>Doctor Email Address</label>
                      <button
                        type="button"
                        onClick={() => setDocEmail('doctor@praxirence.com')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#06b6d4',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Auto-fill Demo Doctor
                      </button>
                    </div>

                    <div style={{ position: 'relative' }}>
                      <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="email"
                        required
                        className="input-field"
                        style={{ paddingLeft: '42px' }}
                        placeholder="doctor@praxirence.com"
                        value={docEmail}
                        onChange={(e) => setDocEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  {!docOtpSent ? (
                    <button
                      type="button"
                      onClick={handleDoctorRequestOtp}
                      disabled={loading || !docEmail}
                      className="btn btn-primary"
                      style={{
                        width: '100%',
                        padding: '12px',
                        marginTop: '10px',
                        background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                        borderColor: '#0284c7'
                      }}
                    >
                      <Mail size={18} />
                      <span>{loading ? 'Sending Access Code...' : 'Send Doctor Access Code via Email'}</span>
                      <ArrowRight size={18} />
                    </button>
                  ) : (
                    <div>
                      <div className="input-group" style={{ marginTop: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <label className="input-label" style={{ marginBottom: 0 }}>Enter 6-Digit Email OTP</label>
                          {demoCodeHint && (
                            <button
                              type="button"
                              onClick={() => setDocOtpCode(demoCodeHint)}
                              style={{
                                background: 'rgba(6, 182, 212, 0.12)',
                                border: '1px solid rgba(6, 182, 212, 0.3)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                color: '#06b6d4',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                              }}
                            >
                              Auto-fill: {demoCodeHint}
                            </button>
                          )}
                        </div>
                        <div style={{ position: 'relative' }}>
                          <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                          <input
                            type="text"
                            required
                            maxLength={6}
                            autoFocus
                            className="input-field"
                            style={{ paddingLeft: '42px', letterSpacing: '4px', fontSize: '1.1rem', fontWeight: 700 }}
                            placeholder="987654"
                            value={docOtpCode}
                            onChange={(e) => setDocOtpCode(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 14px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {docOtpCountdown > 0 ? `Resend code in ${docOtpCountdown}s` : 'Did not receive code?'}
                        </span>
                        <button
                          type="button"
                          disabled={docOtpCountdown > 0 || loading}
                          onClick={handleDoctorRequestOtp}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: docOtpCountdown > 0 ? 'var(--text-muted)' : '#0284c7',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: docOtpCountdown > 0 ? 'not-allowed' : 'pointer'
                          }}
                        >
                          Resend Email Code
                        </button>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || docOtpCode.length < 4}
                        className="btn btn-primary"
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                          borderColor: '#0284c7'
                        }}
                      >
                        <span>{loading ? 'Authenticating Clinician...' : 'Verify Code & Open Dashboard'}</span>
                        <ArrowRight size={18} />
                      </button>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* Sub-Mode 2: Password Flow */}
            {doctorMode === 'password' && (
              <form onSubmit={handleDoctorPasswordSubmit}>
                <div className="input-group">
                  <label className="input-label">Official Doctor Email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email"
                      required
                      className="input-field"
                      style={{ paddingLeft: '42px' }}
                      placeholder="doctor@praxirence.com"
                      value={docEmail}
                      onChange={(e) => setDocEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Doctor Password</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="password"
                      required
                      className="input-field"
                      style={{ paddingLeft: '42px' }}
                      placeholder="••••••••"
                      value={docPassword}
                      onChange={(e) => setDocPassword(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '12px', padding: '12px' }}
                >
                  <span>{loading ? 'Signing in...' : 'Sign In to Clinical Console'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            )}

            {/* Sub-Mode 3: Google Flow */}
            {doctorMode === 'google' && (
              <div>
                <div style={{
                  background: 'rgba(66, 133, 244, 0.08)',
                  border: '1px solid rgba(66, 133, 244, 0.25)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  fontSize: '0.825rem',
                  color: 'var(--text-secondary)'
                }}>
                  🌐 <strong>Google Clinician Identity:</strong> Authenticate instantly with your institutional Google Workspace or medical profile.
                </div>

                <button
                  type="button"
                  onClick={handleGoogleDoctorLogin}
                  disabled={loading}
                  className="btn"
                  style={{
                    width: '100%',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    padding: '13px 16px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = '#4285F4'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    {loading ? 'Verifying with Google...' : 'Verify & Sign In with Google'}
                  </span>
                </button>
              </div>
            )}

            {/* Quick Demo Doctor Buttons */}
            <div style={{ position: 'relative', textAlign: 'center', margin: '20px 0 14px' }}>
              <hr style={{ borderColor: 'var(--border-color)' }} />
              <span style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'var(--bg-card)',
                padding: '0 12px',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.04em'
              }}>
                OR 1-CLICK CLINICAL DEMO
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
              <button
                type="button"
                onClick={() => loginDoctorEmailOtp('doctor@praxirence.com', '987654')}
                disabled={loading}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(16, 185, 129, 0.12))',
                  borderColor: 'rgba(6, 182, 212, 0.35)',
                  padding: '10px 8px',
                  fontSize: '0.78rem'
                }}
              >
                <Mail size={15} color="#06b6d4" />
                <span>1-Click Email OTP Demo</span>
              </button>

              <button
                type="button"
                onClick={() => loginDoctorPassword('doctor@praxirence.com', 'Doctor123!')}
                disabled={loading}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(139, 92, 246, 0.12))',
                  borderColor: 'rgba(6, 182, 212, 0.35)',
                  padding: '10px 8px',
                  fontSize: '0.78rem'
                }}
              >
                <Lock size={15} color="#06b6d4" />
                <span>1-Click Password Demo</span>
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: PATIENT LOGIN (EMAIL OTP)                             */}
        {/* ============================================================ */}
        {activeTab === 'patient' && (
          <div>
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: '16px',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)'
            }}>
              🔒 Patients sign in securely with their email address via Email OTP. No password required.
            </div>

            <form onSubmit={handlePatientVerifyOtp}>
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="input-label" style={{ marginBottom: 0 }}>Patient Email Address</label>
                  <button
                    type="button"
                    onClick={() => setPatEmail('patient.test@praxirence.com')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#10b981',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    Auto-fill Demo Patient
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    required
                    className="input-field"
                    style={{ paddingLeft: '42px' }}
                    placeholder="patient.test@praxirence.com"
                    value={patEmail}
                    onChange={(e) => setPatEmail(e.target.value)}
                  />
                </div>
              </div>

              {!patOtpSent ? (
                <button
                  type="button"
                  onClick={handlePatientRequestOtp}
                  disabled={loading || !patEmail}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginTop: '10px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderColor: '#10b981'
                  }}
                >
                  <Mail size={18} />
                  <span>{loading ? 'Sending Email Code...' : 'Send Access Code via Email'}</span>
                  <ArrowRight size={18} />
                </button>
              ) : (
                <div>
                  <div className="input-group" style={{ marginTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="input-label" style={{ marginBottom: 0 }}>Enter 6-Digit Email Code</label>
                      {demoCodeHint && (
                        <button
                          type="button"
                          onClick={() => setPatOtpCode(demoCodeHint)}
                          style={{
                            background: 'rgba(16, 185, 129, 0.12)',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '4px',
                            padding: '2px 6px',
                            color: '#10b981',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Auto-fill: {demoCodeHint}
                        </button>
                      )}
                    </div>
                    <div style={{ position: 'relative' }}>
                      <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        autoFocus
                        className="input-field"
                        style={{ paddingLeft: '42px', letterSpacing: '4px', fontSize: '1.1rem', fontWeight: 700 }}
                        placeholder="987654"
                        value={patOtpCode}
                        onChange={(e) => setPatOtpCode(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 14px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {patOtpCountdown > 0 ? `Resend in ${patOtpCountdown}s` : 'Did not receive code?'}
                    </span>
                    <button
                      type="button"
                      disabled={patOtpCountdown > 0 || loading}
                      onClick={handlePatientRequestOtp}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: patOtpCountdown > 0 ? 'var(--text-muted)' : '#10b981',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: patOtpCountdown > 0 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Resend Email Code
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || patOtpCode.length < 4}
                    className="btn btn-primary"
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      borderColor: '#10b981'
                    }}
                  >
                    <span>{loading ? 'Authenticating Patient...' : 'Open Patient Health Portal'}</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              )}
            </form>

            {/* Quick Demo Patient Button */}
            <div style={{ position: 'relative', textAlign: 'center', margin: '20px 0' }}>
              <hr style={{ borderColor: 'var(--border-color)' }} />
              <span style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'var(--bg-card)',
                padding: '0 12px',
                fontSize: '0.75rem',
                color: 'var(--text-muted)'
              }}>
                OR 1-CLICK ACCESS
              </span>
            </div>

            <button
              type="button"
              onClick={() => loginPatientEmailOtp('patient.test@praxirence.com', '987654')}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                width: '100%',
                background: 'rgba(16, 185, 129, 0.1)',
                borderColor: 'rgba(16, 185, 129, 0.35)',
                padding: '11px'
              }}
            >
              <Sparkles size={16} color="#10b981" />
              <span>Instant Patient Demo (patient.test@praxirence.com)</span>
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: CREATE ACCOUNT (DOCTOR KYC / PATIENT ONBOARDING)      */}
        {/* ============================================================ */}
        {activeTab === 'register' && (
          <div>
            {/* Persona Switch for Registration */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '18px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '12px'
            }}>
              <button
                type="button"
                onClick={() => setRegisterPersona('doctor')}
                style={{
                  background: registerPersona === 'doctor' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                  color: registerPersona === 'doctor' ? '#06b6d4' : 'var(--text-muted)',
                  border: registerPersona === 'doctor' ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
                  padding: '7px 12px',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Register as Doctor / Clinic
              </button>

              <button
                type="button"
                onClick={() => setRegisterPersona('patient')}
                style={{
                  background: registerPersona === 'patient' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: registerPersona === 'patient' ? '#10b981' : 'var(--text-muted)',
                  border: registerPersona === 'patient' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                  padding: '7px 12px',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Register as Patient
              </button>
            </div>

            {/* Form: Doctor KYC Registration */}
            {registerPersona === 'doctor' ? (
              <form onSubmit={handleRegisterDoctorSubmit}>
                <div className="input-group">
                  <label className="input-label">Doctor Full Name (with Title)</label>
                  <div style={{ position: 'relative' }}>
                    <UserCheck size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      required
                      className="input-field"
                      style={{ paddingLeft: '42px' }}
                      placeholder="Dr. Aryan Sharma"
                      value={regDocName}
                      onChange={(e) => setRegDocName(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="input-group">
                    <label className="input-label">Medical Reg / NMC No</label>
                    <div style={{ position: 'relative' }}>
                      <ShieldCheck size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        required
                        className="input-field"
                        style={{ paddingLeft: '42px' }}
                        placeholder="NMC-2024-84920"
                        value={regDocRegNo}
                        onChange={(e) => setRegDocRegNo(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Specialty</label>
                    <div style={{ position: 'relative' }}>
                      <Award size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        required
                        className="input-field"
                        style={{ paddingLeft: '42px' }}
                        placeholder="Physician / Cardiologist"
                        value={regDocSpecialty}
                        onChange={(e) => setRegDocSpecialty(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Clinic / Hospital Name</label>
                  <div style={{ position: 'relative' }}>
                    <Building size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      required
                      className="input-field"
                      style={{ paddingLeft: '42px' }}
                      placeholder="City Clinical Centre"
                      value={regDocClinic}
                      onChange={(e) => setRegDocClinic(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Official Email (for Sign In & Notifications)</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email"
                      required
                      className="input-field"
                      style={{ paddingLeft: '42px' }}
                      placeholder="doctor@clinic.com"
                      value={regDocEmail}
                      onChange={(e) => setRegDocEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="input-group">
                    <label className="input-label">Mobile (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <Smartphone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="tel"
                        className="input-field"
                        style={{ paddingLeft: '42px' }}
                        placeholder="+919876543210"
                        value={regDocPhone}
                        onChange={(e) => setRegDocPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Create Password</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="password"
                        required
                        className="input-field"
                        style={{ paddingLeft: '42px' }}
                        placeholder="Minimum 8 characters"
                        value={regDocPassword}
                        onChange={(e) => setRegDocPassword(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '12px', padding: '12px' }}
                >
                  <span>{loading ? 'Creating Clinic Account...' : 'Complete Doctor KYC & Register'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            ) : (
              /* Form: Patient Account Creation */
              <form onSubmit={handleRegisterPatientSubmit}>
                <div className="input-group">
                  <label className="input-label">Patient Full Name</label>
                  <div style={{ position: 'relative' }}>
                    <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      required
                      className="input-field"
                      style={{ paddingLeft: '42px' }}
                      placeholder="Rohan Verma"
                      value={regPatName}
                      onChange={(e) => setRegPatName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Patient Email Address (for Login OTP)</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="email"
                      required
                      className="input-field"
                      style={{ paddingLeft: '42px' }}
                      placeholder="patient.test@praxirence.com"
                      value={regPatEmail}
                      onChange={(e) => setRegPatEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Patient Mobile Number (Optional)</label>
                  <div style={{ position: 'relative' }}>
                    <Smartphone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="tel"
                      className="input-field"
                      style={{ paddingLeft: '42px' }}
                      placeholder="+919876543210"
                      value={regPatPhone}
                      onChange={(e) => setRegPatPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="input-group">
                    <label className="input-label">Date of Birth</label>
                    <div style={{ position: 'relative' }}>
                      <Calendar size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="date"
                        className="input-field"
                        style={{ paddingLeft: '42px' }}
                        value={regPatDob}
                        onChange={(e) => setRegPatDob(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Gender</label>
                    <select
                      className="input-field"
                      value={regPatGender}
                      onChange={(e) => setRegPatGender(e.target.value)}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    marginTop: '12px',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderColor: '#10b981'
                  }}
                >
                  <span>{loading ? 'Creating Patient Account...' : 'Create Patient Account & Sign In'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            )}
          </div>
        )}

      </div>

      {/* Footer Security Badge */}
      <div style={{ marginTop: '20px', textAlign: 'center' }}>
        <span className="badge badge-success" style={{ fontSize: '0.75rem', gap: '6px' }}>
          <ShieldCheck size={14} /> End-to-End 256-Bit Encrypted • Digital Personal Data Protection Act 2023
        </span>
      </div>
    </div>
  );
};

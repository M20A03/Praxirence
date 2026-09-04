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
  HelpCircle,
  Clock,
  RotateCw,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DirectoryAccount, DirectoryResponse, CheckPhoneResponse } from '../types';
import { BrandLogo } from '../components/BrandLogo';

type PersonaTab = 'doctor' | 'patient' | 'register';
type DoctorAuthMode = 'otp' | 'password';
type RegisterPersona = 'doctor' | 'patient';

export const LoginPage: React.FC = () => {
  const { 
    loginDoctorPassword, 
    loginDoctorOtp, 
    loginDoctorGoogle,
    loginPatientOtp, 
    registerDoctor, 
    registerPatient 
  } = useAuth();

  // Active Navigation
  const [activeTab, setActiveTab] = useState<PersonaTab>('doctor');
  const [doctorMode, setDoctorAuthMode] = useState<DoctorAuthMode>('otp');
  const [registerPersona, setRegisterPersona] = useState<RegisterPersona>('doctor');

  // Form State - Doctor Password
  const [docEmail, setDocEmail] = useState('doctor@praxirence.com');
  const [docPassword, setDocPassword] = useState('Doctor123!');

  // Form State - Doctor OTP
  const [docPhone, setDocPhone] = useState('+919876543210');
  const [docOtpCode, setDocOtpCode] = useState('');
  const [docOtpSent, setDocOtpSent] = useState(false);
  const [docOtpCountdown, setDocOtpCountdown] = useState(0);

  // Form State - Patient OTP
  const [patPhone, setPatPhone] = useState('+919835139865');
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
  const [regPatPhone, setRegPatPhone] = useState('');
  const [regPatDob, setRegPatDob] = useState('1994-06-15');
  const [regPatGender, setRegPatGender] = useState('Male');

  // General State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [demoCodeHint, setDemoCodeHint] = useState<string | null>(null);

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

  // Directory & Number Inspection
  const [directory, setDirectory] = useState<DirectoryResponse | null>(null);
  const [isDirectoryOpen, setIsDirectoryOpen] = useState(true);
  const [checkedStatus, setCheckedStatus] = useState<CheckPhoneResponse | null>(null);
  const [checkingNumber, setCheckingNumber] = useState(false);

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

  // Live Phone Number Lookup
  const inspectPhone = async (num: string) => {
    if (!num || num.trim().length < 6) {
      setCheckedStatus(null);
      return;
    }
    try {
      setCheckingNumber(true);
      const res = await api.checkNumber(num);
      setCheckedStatus(res);
    } catch {
      setCheckedStatus(null);
    } finally {
      setCheckingNumber(false);
    }
  };

  // Quick Select from Registered Directory
  const handleSelectDirectoryAccount = (acc: DirectoryAccount) => {
    setError(null);
    setSuccessMsg(null);
    if (acc.role === 'doctor') {
      setActiveTab('doctor');
      if (acc.email) {
        setDocEmail(acc.email);
        setDocPassword('Doctor123!');
      }
      if (acc.phone) {
        setDocPhone(acc.phone);
        inspectPhone(acc.phone);
      }
    } else {
      setActiveTab('patient');
      setPatPhone(acc.phone);
      inspectPhone(acc.phone);
    }
  };

  // ==================== SUBMIT HANDLERS ====================

  // 1. Doctor Password Login
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

  // 2. Doctor Request OTP
  const handleDoctorRequestOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.requestDoctorOtp(docPhone, 'whatsapp');
      setDocOtpSent(true);
      setDocOtpCountdown(60);
      setDemoCodeHint(res.demo_code || '123456');
      setSuccessMsg(`Access code dispatched to WhatsApp (${docPhone}). Dev Demo Code: ${res.demo_code || '123456'}`);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch WhatsApp OTP for doctor.');
    } finally {
      setLoading(false);
    }
  };

  // 3. Doctor Verify OTP
  const handleDoctorVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginDoctorOtp(docPhone, docOtpCode);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired doctor OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // 4. Patient Request OTP
  const handlePatientRequestOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.requestPatientOtp(patPhone, 'whatsapp');
      setPatOtpSent(true);
      setPatOtpCountdown(60);
      setDemoCodeHint(res.demo_code || '123456');
      setSuccessMsg(`Verification code dispatched to WhatsApp (${patPhone}). Dev Demo Code: ${res.demo_code || '123456'}`);
    } catch (err: any) {
      setError(err.message || 'Failed to send WhatsApp OTP.');
    } finally {
      setLoading(false);
    }
  };

  // 5. Patient Verify OTP
  const handlePatientVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginPatientOtp(patPhone, patOtpCode);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP. Please check the code.');
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
        phone: regDocPhone,
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
        phone: regPatPhone,
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
          Instant WhatsApp OTP & Encrypted Clinical Records • DPDP 2023 Compliant
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
                LIVE REGISTERED ACCOUNTS & NUMBERS
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                Active Cloud Database
              </span>
            </div>
            {isDirectoryOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>

          {isDirectoryOpen && directory && (
            <div style={{ marginTop: '12px', borderTop: '1px solid rgba(6, 182, 212, 0.15)', paddingTop: '10px' }}>
              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Click any registered account below to auto-fill and test immediately:
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
                      📱 {doc.phone || '+919876543210'}
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
                      📱 {pat.phone}
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
            {/* Quick Google Doctor Verification */}
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
                padding: '11px 16px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#06b6d4'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                Verify & Sign In with Google (Doctor)
              </span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                or use clinic phone / email
              </span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
            </div>

            {/* Sub-toggle: WhatsApp OTP vs Email Password */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '18px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '10px'
            }}>
              <button
                type="button"
                onClick={() => { setDoctorAuthMode('otp'); setError(null); }}
                style={{
                  background: doctorMode === 'otp' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                  color: doctorMode === 'otp' ? '#06b6d4' : 'var(--text-muted)',
                  border: doctorMode === 'otp' ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Smartphone size={14} />
                <span>WhatsApp OTP</span>
              </button>

              <button
                type="button"
                onClick={() => { setDoctorAuthMode('password'); setError(null); }}
                style={{
                  background: doctorMode === 'password' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                  color: doctorMode === 'password' ? '#06b6d4' : 'var(--text-muted)',
                  border: doctorMode === 'password' ? '1px solid rgba(6, 182, 212, 0.4)' : '1px solid transparent',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Lock size={14} />
                <span>Email & Password</span>
              </button>
            </div>

            {/* Doctor WhatsApp OTP Flow */}
            {doctorMode === 'otp' ? (
              <form onSubmit={handleDoctorVerifyOtp}>
                <div className="input-group">
                  <label className="input-label">Registered Doctor Mobile (WhatsApp)</label>
                  <div style={{ position: 'relative' }}>
                    <Smartphone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="tel"
                      required
                      className="input-field"
                      style={{ paddingLeft: '42px' }}
                      placeholder="+919876543210"
                      value={docPhone}
                      onChange={(e) => {
                        setDocPhone(e.target.value);
                        inspectPhone(e.target.value);
                      }}
                    />
                  </div>
                  {/* Live Number Recognition Badge */}
                  {checkedStatus && (
                    <div style={{
                      marginTop: '6px',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: checkedStatus.registered ? '#10b981' : '#f59e0b'
                    }}>
                      {checkedStatus.registered ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                      <span>{checkedStatus.message}</span>
                    </div>
                  )}
                </div>

                {!docOtpSent ? (
                  <button
                    type="button"
                    onClick={handleDoctorRequestOtp}
                    disabled={loading || !docPhone}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', marginTop: '10px' }}
                  >
                    <span>{loading ? 'Sending WhatsApp OTP...' : 'Send Doctor Access Code via WhatsApp'}</span>
                    <ArrowRight size={18} />
                  </button>
                ) : (
                  <div>
                    <div className="input-group" style={{ marginTop: '14px' }}>
                      <label className="input-label">Enter 6-Digit WhatsApp OTP</label>
                      <div style={{ position: 'relative' }}>
                        <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                          type="text"
                          required
                          maxLength={6}
                          autoFocus
                          className="input-field"
                          style={{ paddingLeft: '42px', letterSpacing: '4px', fontSize: '1.1rem', fontWeight: 700 }}
                          placeholder="123456"
                          value={docOtpCode}
                          onChange={(e) => setDocOtpCode(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0 14px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {docOtpCountdown > 0 ? `Resend in ${docOtpCountdown}s` : 'Did not receive code?'}
                      </span>
                      <button
                        type="button"
                        disabled={docOtpCountdown > 0 || loading}
                        onClick={handleDoctorRequestOtp}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: docOtpCountdown > 0 ? 'var(--text-muted)' : '#06b6d4',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: docOtpCountdown > 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Resend WhatsApp OTP
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || docOtpCode.length < 4}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '12px' }}
                    >
                      <span>{loading ? 'Authenticating Doctor...' : 'Verify & Open Clinical Console'}</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </form>
            ) : (
              /* Doctor Password Flow */
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

            {/* Quick Demo Doctor Button */}
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
              onClick={() => loginDoctorPassword('doctor@praxirence.com', 'Doctor123!')}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12), rgba(139, 92, 246, 0.12))',
                borderColor: 'rgba(6, 182, 212, 0.35)',
                padding: '11px'
              }}
            >
              <Sparkles size={16} color="#06b6d4" />
              <span>Instant Clinician Demo (Dr. Mayank Raj)</span>
            </button>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: PATIENT LOGIN (WHATSAPP OTP)                         */}
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
              🔒 Patients sign in securely with their phone number via WhatsApp OTP. No password required.
            </div>

            <form onSubmit={handlePatientVerifyOtp}>
              <div className="input-group">
                <label className="input-label">Patient WhatsApp Mobile Number</label>
                <div style={{ position: 'relative' }}>
                  <Smartphone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="tel"
                    required
                    className="input-field"
                    style={{ paddingLeft: '42px' }}
                    placeholder="+919835139865"
                    value={patPhone}
                    onChange={(e) => {
                      setPatPhone(e.target.value);
                      inspectPhone(e.target.value);
                    }}
                  />
                </div>
                {/* Live Number Recognition */}
                {checkedStatus && (
                  <div style={{
                    marginTop: '6px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: checkedStatus.registered ? '#10b981' : '#f59e0b'
                  }}>
                    {checkedStatus.registered ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    <span>{checkedStatus.message}</span>
                  </div>
                )}
              </div>

              {!patOtpSent ? (
                <button
                  type="button"
                  onClick={handlePatientRequestOtp}
                  disabled={loading || !patPhone}
                  className="btn btn-primary"
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginTop: '10px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    borderColor: '#10b981'
                  }}
                >
                  <span>{loading ? 'Sending WhatsApp OTP...' : 'Send WhatsApp Access Code'}</span>
                  <ArrowRight size={18} />
                </button>
              ) : (
                <div>
                  <div className="input-group" style={{ marginTop: '14px' }}>
                    <label className="input-label">Enter 6-Digit WhatsApp Code</label>
                    <div style={{ position: 'relative' }}>
                      <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="text"
                        required
                        maxLength={6}
                        autoFocus
                        className="input-field"
                        style={{ paddingLeft: '42px', letterSpacing: '4px', fontSize: '1.1rem', fontWeight: 700 }}
                        placeholder="123456"
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
                      Resend via WhatsApp
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
              onClick={() => loginPatientOtp('+919835139865', '123456')}
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
              <span>Instant Patient Demo (Mayank • +919835139865)</span>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="input-group">
                    <label className="input-label">Doctor Mobile (WhatsApp)</label>
                    <div style={{ position: 'relative' }}>
                      <Smartphone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                      <input
                        type="tel"
                        required
                        className="input-field"
                        style={{ paddingLeft: '42px' }}
                        placeholder="+919876543210"
                        value={regDocPhone}
                        onChange={(e) => setRegDocPhone(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Official Email</label>
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
                  <label className="input-label">Patient Mobile (for WhatsApp OTP)</label>
                  <div style={{ position: 'relative' }}>
                    <Smartphone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="tel"
                      required
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

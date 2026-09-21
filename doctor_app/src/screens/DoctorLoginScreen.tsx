import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { mobileApi } from '../services/api';
import { BrandLogoMobile } from '../components/BrandLogoMobile';
import { DoctorUser } from '../types';

interface DoctorLoginScreenProps {
  onAuthenticated: (doctor: DoctorUser) => void;
}

export const DoctorLoginScreen: React.FC<DoctorLoginScreenProps> = ({ onAuthenticated }) => {
  const [authMode, setAuthMode] = useState<'email' | 'phone' | 'register'>('email');

  // Hidden 5-Tap Pilot Testing Bypass
  const [logoTaps, setLogoTaps] = useState(0);
  const [showPilotModal, setShowPilotModal] = useState(false);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogoTap = () => {
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    const next = logoTaps + 1;
    setLogoTaps(next);

    if (next >= 5) {
      setLogoTaps(0);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch (_) {}
      const cur = mobileApi.getApiUrl();
      setActiveServerUrl(cur);
      setCustomServerInput(cur);
      testServerHealth(cur);
      setShowPilotModal(true);
    } else {
      tapTimeoutRef.current = setTimeout(() => {
        setLogoTaps(0);
      }, 2500);
    }
  };

  // Dynamic Backend Server Switcher
  const [activeServerUrl, setActiveServerUrl] = useState<string>(mobileApi.getApiUrl());
  const [customServerInput, setCustomServerInput] = useState<string>(mobileApi.getApiUrl());
  const [serverHealth, setServerHealth] = useState<'checking' | 'online' | 'offline' | null>(null);
  const [latencyMs, setLatencyMs] = useState<number>(-1);

  const testServerHealth = async (targetUrl?: string) => {
    setServerHealth('checking');
    try {
      const res = await mobileApi.checkHealth(targetUrl);
      if (res.healthy) {
        setServerHealth('online');
        setLatencyMs(res.latencyMs);
      } else {
        setServerHealth('offline');
        setLatencyMs(-1);
      }
    } catch {
      setServerHealth('offline');
      setLatencyMs(-1);
    }
  };

  const handleSelectPreset = async (url: string) => {
    try {
      Haptics.selectionAsync();
    } catch (_) {}
    await mobileApi.setServerUrl(url);
    const effective = mobileApi.getApiUrl();
    setActiveServerUrl(effective);
    setCustomServerInput(effective);
    testServerHealth(effective);
  };

  const handleSaveCustomUrl = async () => {
    if (!customServerInput.trim()) return;
    let clean = customServerInput.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean;
    }
    try {
      Haptics.selectionAsync();
    } catch (_) {}
    await mobileApi.setServerUrl(clean);
    const effective = mobileApi.getApiUrl();
    setActiveServerUrl(effective);
    setCustomServerInput(effective);
    testServerHealth(effective);
  };

  // First-Time Doctor Setup Modal
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [pendingDoctor, setPendingDoctor] = useState<DoctorUser | null>(null);
  const [onboardQualifications, setOnboardQualifications] = useState('');
  const [onboardRegNo, setOnboardRegNo] = useState('');
  const [onboardClinic, setOnboardClinic] = useState('');
  const [onboardSpecialty, setOnboardSpecialty] = useState('');

  // Email OTP States
  const [email, setEmail] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');

  // Phone OTP States
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);

  // Registration States
  const [regSpecialty, setRegSpecialty] = useState('');
  const [regClinic, setRegClinic] = useState('');
  const [regNumber, setRegNumber] = useState('');

  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Unified Auth Success Routing (Prompt Onboarding if clinic details missing)
  const handleAuthSuccess = async (user: DoctorUser) => {
    // Check if doctor profile has realistic credentials
    if (!user.reg_number || !user.clinic_name || user.clinic_name.includes('Clinical Centre')) {
      setPendingDoctor(user);
      setOnboardSpecialty(user.specialty || 'General Medicine / Pulmonology');
      setOnboardClinic(user.clinic_name || 'Sharma Health Clinic');
      setOnboardRegNo(user.reg_number || 'NMC-2024-8849');
      setShowOnboardingModal(true);
    } else {
      await AsyncStorage.setItem('praxirence_doctor_profile', JSON.stringify(user));
      onAuthenticated(user);
    }
  };

  const handleSaveOnboarding = async () => {
    if (!pendingDoctor) return;
    if (!onboardRegNo.trim()) {
      Alert.alert('Registration Required', 'Please provide your NMC or State Medical Council Registration Number.');
      return;
    }
    const updated: DoctorUser = {
      ...pendingDoctor,
      name: pendingDoctor.name.startsWith('Dr.') ? pendingDoctor.name : `Dr. ${pendingDoctor.name}`,
      specialty: onboardSpecialty.trim() || 'Internal Medicine',
      clinic_name: onboardClinic.trim() || 'Praxirence Clinical Practice',
      reg_number: onboardRegNo.trim(),
    };
    await AsyncStorage.setItem('praxirence_doctor_profile', JSON.stringify(updated));
    setShowOnboardingModal(false);
    onAuthenticated(updated);
  };

  // Pilot Testing Bypass (Hidden 5-Tap activation)
  const handlePilotBypass = async (profile: Partial<DoctorUser>) => {
    setShowPilotModal(false);
    setLoading(true);
    try {
      const loginRes = await mobileApi.loginDoctor('doctor@praxirence.com', 'Doctor123!');
      const base = loginRes.user || {
        id: 'doc_' + Date.now(),
        name: profile.name || 'Dr. Mayank Raj',
        email: profile.email || 'doctor@praxirence.com',
        phone: profile.phone || '+919876543210',
        specialty: profile.specialty || 'Chief Medical Officer & Pulmonology',
        clinic_name: profile.clinic_name || 'Praxirence Super-Speciality Clinic',
        reg_number: profile.reg_number || 'NMC-2024-8849',
        role: 'doctor' as const,
      };
      const finalDoc: DoctorUser = { ...base, ...profile };
      await AsyncStorage.setItem('praxirence_doctor_profile', JSON.stringify(finalDoc));
      onAuthenticated(finalDoc);
    } catch (e: any) {
      const fallback: DoctorUser = {
        id: 'doc_pilot',
        name: profile.name || 'Dr. Mayank Raj',
        email: profile.email || 'doctor@praxirence.com',
        phone: profile.phone || '+919876543210',
        specialty: profile.specialty || 'Chief Medical Officer',
        clinic_name: profile.clinic_name || 'Praxirence Super-Speciality Clinic',
        reg_number: profile.reg_number || 'NMC-2024-8849',
        role: 'doctor',
      };
      await AsyncStorage.setItem('praxirence_doctor_profile', JSON.stringify(fallback));
      onAuthenticated(fallback);
    } finally {
      setLoading(false);
    }
  };

  // Email OTP Request
  const handleRequestEmailOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid medical email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await mobileApi.requestDoctorEmailOtp(email.trim(), doctorName.trim());
      setEmailOtpSent(true);
      setEmailOtpCode('');
      setResendCooldown(60);
      setSuccessNotice(`Verification code sent to ${email.trim()}. Please check your inbox and spam folder.`);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout')) {
        setError('Connection timed out. Please check your internet connection and try again.');
      } else {
        setError(msg || 'Failed to dispatch verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Email OTP Verify
  const handleVerifyEmailOtp = async () => {
    if (!emailOtpCode.trim()) {
      setError('Please enter the 6-digit code received on your email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await mobileApi.verifyDoctorEmailOtp(email.trim(), emailOtpCode.trim());
      await handleAuthSuccess(res.user);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout')) {
        setError('Connection timed out. Please check your internet connection and try again.');
      } else {
        setError(msg || 'Invalid or expired verification code. Please request a new code.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Phone WhatsApp OTP Request
  const handleRequestPhoneOtp = async () => {
    if (phoneDigits.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError(null);
    setLoading(true);
    const fullPhone = `+91${phoneDigits}`;
    try {
      await mobileApi.requestDoctorOtp(fullPhone, 'whatsapp');
      setPhoneOtpSent(true);
      setPhoneOtpCode('');
      setResendCooldown(60);
      setSuccessNotice(`Verification code dispatched to ${fullPhone}. Please check your WhatsApp.`);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout')) {
        setError('Connection timed out. Please check your internet connection and try again.');
      } else {
        setError(msg || 'Failed to dispatch verification code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Phone OTP Verify
  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtpCode.trim()) {
      setError('Please enter the code sent via WhatsApp.');
      return;
    }
    setError(null);
    setLoading(true);
    const fullPhone = `+91${phoneDigits}`;
    try {
      const res = await mobileApi.verifyDoctorOtp(fullPhone, phoneOtpCode.trim());
      await handleAuthSuccess(res.user);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout')) {
        setError('Connection timed out. Please check your internet connection and try again.');
      } else {
        setError(msg || 'Invalid or expired verification code. Please request a new code.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Doctor Registration
  const handleRegisterDoctor = async () => {
    if (!doctorName.trim() || !email.trim() || phoneDigits.length < 10) {
      setError('Please fill all required physician credentials.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await mobileApi.registerDoctor({
        name: doctorName.trim().startsWith('Dr.') ? doctorName.trim() : `Dr. ${doctorName.trim()}`,
        email: email.trim(),
        phone: `+91${phoneDigits}`,
        specialty: regSpecialty.trim(),
        clinic_name: regClinic.trim(),
        reg_number: regNumber.trim(),
      });
      await handleAuthSuccess(res.user);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout')) {
        setError('Connection timed out. Please check your internet connection and try again.');
      } else {
        setError(msg || 'Doctor registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Brand Header (5-Tap Hidden Pilot Tester Trigger) */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleLogoTap}
          style={styles.brandContainer}
        >
          <BrandLogoMobile variant="hero" size="md" />
          <View style={styles.badgeContainer}>
            <View style={styles.doctorBadge}>
              <Ionicons name="medkit" size={14} color="#0ea5e9" />
              <Text style={styles.doctorBadgeText}>PRAXIRENCE DOCTOR APP</Text>
            </View>
          </View>
          <Text style={styles.title}>Clinician Workstation</Text>
          <Text style={styles.subtitle}>
            Secure clinical suite for verified medical practitioners
          </Text>
        </TouchableOpacity>

        {/* Auth Mode Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, authMode === 'email' && styles.tabBtnActive]}
            onPress={() => { setAuthMode('email'); setError(null); }}
          >
            <Ionicons name="mail" size={16} color={authMode === 'email' ? '#0ea5e9' : Colors.textSecondary} />
            <Text style={[styles.tabText, authMode === 'email' && styles.tabTextActive]}>Medical Email</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, authMode === 'phone' && styles.tabBtnActive]}
            onPress={() => { setAuthMode('phone'); setError(null); }}
          >
            <Ionicons name="logo-whatsapp" size={16} color={authMode === 'phone' ? '#25D366' : Colors.textSecondary} />
            <Text style={[styles.tabText, authMode === 'phone' && styles.tabTextActive]}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, authMode === 'register' && styles.tabBtnActive]}
            onPress={() => { setAuthMode('register'); setError(null); }}
          >
            <Ionicons name="person-add" size={16} color={authMode === 'register' ? '#10b981' : Colors.textSecondary} />
            <Text style={[styles.tabText, authMode === 'register' && styles.tabTextActive]}>Register</Text>
          </TouchableOpacity>
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {successNotice && (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={styles.successText}>{successNotice}</Text>
            </View>
          )}

          {authMode === 'email' && (
            <View>
              <Text style={styles.label}>Physician Name (Optional)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Dr. Mayank Raj"
                  placeholderTextColor={Colors.textSecondary}
                  value={doctorName}
                  onChangeText={setDoctorName}
                />
              </View>

              <Text style={styles.label}>Institutional Medical Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="doctor@hospital.org"
                  placeholderTextColor={Colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              {!emailOtpSent ? (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleRequestEmailOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#ffffff" />
                      <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.label}>Email Verification Code</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="key" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.input, { letterSpacing: 6, fontWeight: '700' }]}
                      placeholder="• • • • • •"
                      placeholderTextColor={Colors.textSecondary}
                      value={emailOtpCode}
                      onChangeText={setEmailOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4, marginBottom: 12 }}>
                    📬 Please check your Inbox and Spam/Junk folder. Code expires in 10 minutes.
                  </Text>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleVerifyEmailOtp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={18} color="#ffffff" />
                        <Text style={styles.primaryBtnText}>Verify Code & Sign In</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={handleRequestEmailOtp}
                    disabled={loading || resendCooldown > 0}
                  >
                    <Text style={[styles.resendText, resendCooldown > 0 && { color: Colors.textMuted }]}>
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {authMode === 'phone' && (
            <View>
              <Text style={styles.label}>Registered Doctor Mobile (India)</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="9876543210"
                  placeholderTextColor={Colors.textSecondary}
                  value={phoneDigits}
                  onChangeText={setPhoneDigits}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              {!phoneOtpSent ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#25D366' }]}
                  onPress={handleRequestPhoneOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="logo-whatsapp" size={18} color="#ffffff" />
                      <Text style={styles.primaryBtnText}>Get WhatsApp OTP</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.label}>WhatsApp Verification Code</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="key" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={[styles.input, { letterSpacing: 6, fontWeight: '700' }]}
                      placeholder="• • • • • •"
                      placeholderTextColor={Colors.textSecondary}
                      value={phoneOtpCode}
                      onChangeText={setPhoneOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 4, marginBottom: 12 }}>
                    📬 Please check your WhatsApp messages. Code expires in 10 minutes.
                  </Text>

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: '#25D366' }]}
                    onPress={handleVerifyPhoneOtp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={18} color="#ffffff" />
                        <Text style={styles.primaryBtnText}>Verify OTP & Sign In</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={handleRequestPhoneOtp}
                    disabled={loading || resendCooldown > 0}
                  >
                    <Text style={[styles.resendText, resendCooldown > 0 && { color: Colors.textMuted }]}>
                      {resendCooldown > 0 ? `Resend WhatsApp OTP in ${resendCooldown}s` : "Didn't receive OTP? Resend"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {authMode === 'register' && (
            <View>
              <Text style={styles.label}>Full Name (with Dr. prefix)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Dr. Sunita Sharma"
                  placeholderTextColor={Colors.textSecondary}
                  value={doctorName}
                  onChangeText={setDoctorName}
                />
              </View>

              <Text style={styles.label}>Medical Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="doctor@hospital.org"
                  placeholderTextColor={Colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="9876543210"
                  placeholderTextColor={Colors.textSecondary}
                  value={phoneDigits}
                  onChangeText={setPhoneDigits}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              <Text style={styles.label}>Medical Specialty</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="fitness" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Pulmonology / Internal Medicine"
                  placeholderTextColor={Colors.textSecondary}
                  value={regSpecialty}
                  onChangeText={setRegSpecialty}
                />
              </View>

              <Text style={styles.label}>Medical Registration Number (NMC / State)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="id-card" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. NMC-2024-84920"
                  placeholderTextColor={Colors.textSecondary}
                  value={regNumber}
                  onChangeText={setRegNumber}
                />
              </View>

              <Text style={styles.label}>Clinic / Hospital Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Sharma Health Clinic, New Delhi"
                  placeholderTextColor={Colors.textSecondary}
                  value={regClinic}
                  onChangeText={setRegClinic}
                />
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleRegisterDoctor}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="create" size={18} color="#ffffff" />
                    <Text style={styles.primaryBtnText}>Register Doctor Profile</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Legal & Security Compliance Footer */}
        <View style={styles.complianceFooter}>
          <Ionicons name="shield-checkmark" size={14} color="#10b981" />
          <Text style={styles.complianceText}>
            DPDP Act 2023 Compliant • Zero Audio Retention • End-to-End Encrypted
          </Text>
        </View>

        {/* Hidden Developer/Pilot Testing Modal (5-Tap Brand Logo Trigger) */}
        <Modal visible={showPilotModal} animationType="fade" transparent onRequestClose={() => setShowPilotModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '88%' }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="build" size={20} color={Colors.primary} />
                  <Text style={styles.modalTitle}>Pilot Tester Console</Text>
                </View>
                <TouchableOpacity onPress={() => setShowPilotModal(false)}>
                  <Ionicons name="close" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
                {/* 1. Backend Server Environment Switcher */}
                <View style={styles.serverSection}>
                  <View style={styles.serverSectionHeader}>
                    <Text style={styles.serverSectionTitle}>Backend Server</Text>
                    <View style={[
                      styles.healthBadge,
                      serverHealth === 'online' ? styles.healthBadgeOnline : (serverHealth === 'checking' ? styles.healthBadgeChecking : styles.healthBadgeOffline)
                    ]}>
                      <View style={[
                        styles.healthDot,
                        { backgroundColor: serverHealth === 'online' ? '#16a34a' : (serverHealth === 'checking' ? '#eab308' : '#dc2626') }
                      ]} />
                      <Text style={styles.healthBadgeText}>
                        {serverHealth === 'checking' ? 'Testing...' : (serverHealth === 'online' ? `Online (${latencyMs}ms)` : 'Offline (502)')}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.serverActiveUrlText} numberOfLines={1}>
                    Active: {activeServerUrl}
                  </Text>

                  {/* 1-Tap Preset Switchers */}
                  <View style={styles.presetRow}>
                    <TouchableOpacity
                      style={[styles.presetBtn, activeServerUrl.includes('railway') && styles.presetBtnActive]}
                      onPress={() => handleSelectPreset('https://praxirence-production.up.railway.app')}
                    >
                      <Ionicons name="cloud-outline" size={13} color={activeServerUrl.includes('railway') ? '#FFFFFF' : Colors.textPrimary} />
                      <Text style={[styles.presetBtnText, activeServerUrl.includes('railway') && styles.presetBtnTextActive]}>
                        Railway
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.presetBtn,
                        (activeServerUrl.includes('192.168.') || activeServerUrl.includes('localhost')) && !activeServerUrl.includes('10.0.2.2') && styles.presetBtnActive
                      ]}
                      onPress={() => handleSelectPreset('http://192.168.0.8:8001')}
                    >
                      <Ionicons name="wifi-outline" size={13} color={(activeServerUrl.includes('192.168.') || activeServerUrl.includes('localhost')) && !activeServerUrl.includes('10.0.2.2') ? '#FFFFFF' : Colors.textPrimary} />
                      <Text style={[
                        styles.presetBtnText,
                        (activeServerUrl.includes('192.168.') || activeServerUrl.includes('localhost')) && !activeServerUrl.includes('10.0.2.2') && styles.presetBtnTextActive
                      ]}>
                        Local Wi-Fi
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.presetBtn, activeServerUrl.includes('10.0.2.2') && styles.presetBtnActive]}
                      onPress={() => handleSelectPreset('http://10.0.2.2:8001')}
                    >
                      <Ionicons name="phone-portrait-outline" size={13} color={activeServerUrl.includes('10.0.2.2') ? '#FFFFFF' : Colors.textPrimary} />
                      <Text style={[styles.presetBtnText, activeServerUrl.includes('10.0.2.2') && styles.presetBtnTextActive]}>
                        Emulator
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Custom IP & Port Input */}
                  <View style={styles.customUrlRow}>
                    <TextInput
                      style={styles.customUrlInput}
                      value={customServerInput}
                      onChangeText={setCustomServerInput}
                      placeholder="http://192.168.x.x:8001"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.customUrlSaveBtn}
                      onPress={handleSaveCustomUrl}
                    >
                      <Text style={styles.customUrlSaveBtnText}>Apply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pingTestBtn}
                      onPress={() => testServerHealth(activeServerUrl)}
                    >
                      <Ionicons name="refresh" size={15} color={Colors.primary} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 2. Doctor Quick Access Section */}
                <Text style={styles.sectionDividerLabel}>Doctor Evaluation Profiles</Text>

                <TouchableOpacity
                  style={styles.pilotOptionBtn}
                  onPress={() => handlePilotBypass({
                    name: 'Dr. Mayank Raj',
                    email: 'doctor@praxirence.com',
                    specialty: 'Chief Medical Officer & Pulmonology',
                    clinic_name: 'Praxirence Super-Speciality Clinic',
                    reg_number: 'NMC-2024-8849',
                  })}
                >
                  <View style={styles.pilotIconBox}>
                    <Ionicons name="shield-checkmark" size={18} color="#0284c7" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pilotOptionTitle}>Dr. Mayank Raj (CMO)</Text>
                    <Text style={styles.pilotOptionSub}>Super-Speciality Clinic • NMC-2024-8849</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pilotOptionBtn}
                  onPress={() => handlePilotBypass({
                    name: 'Dr. Sunita Sharma',
                    email: 'sunita.sharma@delhiclinic.org',
                    specialty: 'Consultant Physician & Diabetologist',
                    clinic_name: 'Sharma Health Care & Diagnostics',
                    reg_number: 'DMC-2021-4921',
                  })}
                >
                  <View style={styles.pilotIconBox}>
                    <Ionicons name="fitness" size={18} color="#16a34a" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pilotOptionTitle}>Dr. Sunita Sharma (Internal Med)</Text>
                    <Text style={styles.pilotOptionSub}>Diagnostics & OPD • DMC-2021-4921</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
                </TouchableOpacity>
              </ScrollView>

              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowPilotModal(false)}
              >
                <Text style={styles.modalCloseBtnText}>Close Console</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Doctor First-Time Clinic Setup Modal */}
        <Modal visible={showOnboardingModal} animationType="slide" transparent onRequestClose={() => setShowOnboardingModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="business" size={20} color={Colors.primary} />
                  <Text style={styles.modalTitle}>Set Up Clinic Letterhead</Text>
                </View>
              </View>

              <Text style={styles.modalSubtitle}>
                Your clinic name and registration will appear on all prescriptions and patient summaries.
              </Text>

              <Text style={styles.label}>Medical Registration Number (NMC / SMC)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="id-card" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. NMC-2024-8849"
                  placeholderTextColor={Colors.textSecondary}
                  value={onboardRegNo}
                  onChangeText={setOnboardRegNo}
                />
              </View>

              <Text style={styles.label}>Clinic / Hospital Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Sharma Health Clinic"
                  placeholderTextColor={Colors.textSecondary}
                  value={onboardClinic}
                  onChangeText={setOnboardClinic}
                />
              </View>

              <Text style={styles.label}>Specialty & Qualifications</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="fitness" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. MBBS, MD - General Medicine"
                  placeholderTextColor={Colors.textSecondary}
                  value={onboardSpecialty}
                  onChangeText={setOnboardSpecialty}
                />
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleSaveOnboarding}
              >
                <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                <Text style={styles.primaryBtnText}>Save & Launch Workstation</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  badgeContainer: {
    marginTop: 10,
    marginBottom: 4,
  },
  doctorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  doctorBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: '#0284C7',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    marginTop: 6,
  },
  subtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 5,
    marginTop: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  countryCodeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  countryCodeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  input: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    flex: 1,
    paddingVertical: 2,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  primaryBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: '#ffffff',
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 2,
  },
  resendText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  demoNotice: {
    backgroundColor: '#F0F9FF',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  demoNoticeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#0284C7',
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
  },
  demoLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  demoLoginBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#DC2626',
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#16A34A',
    flex: 1,
  },
  complianceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  complianceText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  pilotOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  pilotIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pilotOptionTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  pilotOptionSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 6,
  },
  modalCloseBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  serverSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
  },
  serverSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  serverSectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  healthBadgeOnline: {
    backgroundColor: '#DCFCE7',
  },
  healthBadgeOffline: {
    backgroundColor: '#FEE2E2',
  },
  healthBadgeChecking: {
    backgroundColor: '#FEF3C7',
  },
  healthDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  healthBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: 10.5,
    color: '#0F172A',
  },
  serverActiveUrlText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  presetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  presetBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: 10.5,
    color: Colors.textPrimary,
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  customUrlRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  customUrlInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    color: Colors.textPrimary,
  },
  customUrlSaveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  customUrlSaveBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  pingTestBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 7,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionDividerLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 2,
  },
});

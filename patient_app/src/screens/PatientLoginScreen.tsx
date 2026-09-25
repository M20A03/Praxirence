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
import { PatientUser } from '../types';

interface PatientLoginScreenProps {
  onAuthenticated: (patient: PatientUser) => void;
}

export const PatientLoginScreen: React.FC<PatientLoginScreenProps> = ({ onAuthenticated }) => {
  const [authMode, setAuthMode] = useState<'email' | 'register'>('email');

  // Server connection check
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

  // First-Time Patient Demographics Modal
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [pendingPatient, setPendingPatient] = useState<PatientUser | null>(null);
  const [onboardName, setOnboardName] = useState('');
  const [onboardAge, setOnboardAge] = useState('');
  const [onboardGender, setOnboardGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [onboardLanguage, setOnboardLanguage] = useState('Hindi');
  const [onboardEmergency, setOnboardEmergency] = useState('');

  // Email OTP States
  const [email, setEmail] = useState('');
  const [patientName, setPatientName] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);




  // Handle Auth Success & Check Demographic Onboarding
  const handleAuthSuccess = async (user: PatientUser) => {
    try {
      const stored = await AsyncStorage.getItem('praxirence_patient_profile');
      let profile = stored ? JSON.parse(stored) : null;
      if (profile && (profile.id === user.id || profile.phone === user.phone)) {
        const merged: PatientUser = { ...user, ...profile };
        await AsyncStorage.setItem('praxirence_patient_profile', JSON.stringify(merged));
        onAuthenticated(merged);
        return;
      }
      if (!user.age || !user.language) {
        setPendingPatient(user);
        setOnboardName(user.name || patientName || '');
        setShowOnboardingModal(true);
      } else {
        await AsyncStorage.setItem('praxirence_patient_profile', JSON.stringify(user));
        onAuthenticated(user);
      }
    } catch (_) {
      await AsyncStorage.setItem('praxirence_patient_profile', JSON.stringify(user));
      onAuthenticated(user);
    }
  };

  const handleSaveOnboarding = async () => {
    if (!pendingPatient) return;
    if (!onboardName.trim()) {
      Alert.alert('Name Required', 'Please enter your full name to set up your clinical record.');
      return;
    }
    const updated: PatientUser = {
      ...pendingPatient,
      name: onboardName.trim(),
      age: onboardAge.trim() || undefined,
      gender: onboardGender,
      language: onboardLanguage,
      emergency_contact: onboardEmergency.trim() || undefined,
    };
    await AsyncStorage.setItem('praxirence_patient_profile', JSON.stringify(updated));
    setShowOnboardingModal(false);
    onAuthenticated(updated);
  };


  // Patient Registration States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAge, setRegAge] = useState('');
  const [regGender, setRegGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [regLanguage, setRegLanguage] = useState('Hindi');

  // Request Email OTP
  const handleRequestEmailOtp = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await mobileApi.requestPatientEmailOtp(email.trim(), patientName.trim());
      setEmailOtpSent(true);
      setEmailOtpCode('');
      setResendCooldown(60);
      const notice = res?.message || `Verification code sent to ${email.trim()}. Please check your inbox and spam folder.`;
      setSuccessNotice(notice);
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

  // Verify Email OTP
  const handleVerifyEmailOtp = async () => {
    if (!emailOtpCode.trim()) {
      setError('Please enter the 6-digit code received in your email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await mobileApi.verifyPatientEmailOtp(email.trim(), emailOtpCode.trim());
      await handleAuthSuccess(res.user);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout')) {
        setError('Connection timed out. Please check your internet connection and try again.');
      } else {
        setError(msg || 'Invalid or expired verification code');
      }
    } finally {
      setLoading(false);
    }
  };

  // Patient Registration Handler
  const handleRegisterPatient = async () => {
    if (!regName.trim() || !regEmail.trim() || !regEmail.includes('@')) {
      setError('Please enter your full name and a valid email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await mobileApi.registerPatient({
        name: regName.trim(),
        email: regEmail.trim(),
        phone: regPhone.trim() ? (regPhone.startsWith('+') ? regPhone.trim() : `+91${regPhone.trim()}`) : undefined,
        age: regAge.trim() || undefined,
        gender: regGender,
        language: regLanguage,
      });
      await handleAuthSuccess(res.user);
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.toLowerCase().includes('abort') || msg.toLowerCase().includes('timeout')) {
        setError('Connection timed out. Please check your internet connection and try again.');
      } else {
        setError(msg || 'Registration failed. Please try again.');
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
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <BrandLogoMobile variant="hero" size="md" />
          <View style={styles.badgeContainer}>
            <View style={styles.patientBadge}>
              <Ionicons name="heart" size={14} color="#10b981" />
              <Text style={styles.patientBadgeText}>PRAXIRENCE CARE • PATIENT PORTAL</Text>
            </View>
          </View>
          <Text style={styles.title}>Your Health & Care Vault</Text>
          <Text style={styles.subtitle}>
            Access your doctor's prescriptions, medication timing reminders, and care plans
          </Text>
        </View>

        {/* Auth Mode Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, authMode === 'email' && styles.tabBtnActive]}
            onPress={() => { setAuthMode('email'); setError(null); setSuccessNotice(null); }}
          >
            <Ionicons name="mail" size={16} color={authMode === 'email' ? '#10b981' : Colors.textSecondary} />
            <Text style={[styles.tabText, authMode === 'email' && styles.tabTextActive]}>Email Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, authMode === 'register' && styles.tabBtnActive]}
            onPress={() => { setAuthMode('register'); setError(null); setSuccessNotice(null); }}
          >
            <Ionicons name="person-add" size={16} color={authMode === 'register' ? '#10b981' : Colors.textSecondary} />
            <Text style={[styles.tabText, authMode === 'register' && styles.tabTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Notices */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {successNotice ? (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.successText}>{successNotice}</Text>
          </View>
        ) : null}

        {/* Main Card */}
        <View style={styles.card}>
          {authMode === 'email' ? (
            /* EMAIL OTP FLOW */
            <View>
              <Text style={styles.label}>Your Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={Colors.textSecondary}
                  value={patientName}
                  onChangeText={setPatientName}
                />
              </View>

              <Text style={styles.label}>Your Email Address</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="at-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="name@gmail.com"
                  placeholderTextColor={Colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {!emailOtpSent ? (
                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#10b981' }]}
                  onPress={handleRequestEmailOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <>
                      <Ionicons name="mail-outline" size={18} color="#ffffff" />
                      <Text style={styles.primaryBtnText}>Send Verification Code to Email</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={{ marginTop: 12 }}>
                  <View style={styles.emailInstructionBox}>
                    <Ionicons name="information-circle" size={18} color="#047857" />
                    <Text style={styles.emailInstructionText}>
                      We sent a 6-digit OTP to <Text style={{ fontWeight: '700' }}>{email}</Text>. Copy the code from your inbox and paste it below.
                    </Text>
                  </View>

                  <Text style={styles.label}>Enter 6-Digit Email Code</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="key-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 12 }}>
                    <Ionicons name="mail-outline" size={13} color={Colors.textSecondary} />
                    <Text style={{ fontSize: 12, color: Colors.textSecondary, flex: 1 }}>
                      Please check your Inbox and Spam/Junk folder. Code expires in 10 minutes.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: '#10b981' }]}
                    onPress={handleVerifyEmailOtp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={18} color="#ffffff" />
                        <Text style={styles.primaryBtnText}>Verify OTP & Access Health Vault</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={handleRequestEmailOtp}
                      disabled={loading || resendCooldown > 0}
                      style={{ paddingVertical: 8 }}
                    >
                      <Text style={[styles.resendText, resendCooldown > 0 && { color: Colors.textSecondary }]}>
                        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setEmailOtpSent(false)} style={{ paddingVertical: 8 }}>
                      <Text style={styles.resendText}>Change email</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ) : (
            /* PATIENT REGISTRATION FLOW */
            <View>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={Colors.textSecondary}
                  value={regName}
                  onChangeText={setRegName}
                />
              </View>

              <Text style={styles.label}>Email Address (for Login & Care Plan Access)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="at-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="name@gmail.com"
                  placeholderTextColor={Colors.textSecondary}
                  value={regEmail}
                  onChangeText={setRegEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <Text style={styles.label}>Mobile Phone Number (Optional)</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="9876543210"
                  placeholderTextColor={Colors.textSecondary}
                  value={regPhone}
                  onChangeText={setRegPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Age</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 45"
                      placeholderTextColor={Colors.textSecondary}
                      value={regAge}
                      onChangeText={setRegAge}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>
                </View>

                <View style={{ flex: 1.5 }}>
                  <Text style={styles.label}>Gender</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    {(['Male', 'Female', 'Other'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.pillSelect,
                          regGender === g && styles.pillSelectActive,
                        ]}
                        onPress={() => setRegGender(g)}
                      >
                        <Text
                          style={[
                            styles.pillSelectText,
                            regGender === g && styles.pillSelectTextActive,
                          ]}
                        >
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={[styles.label, { marginTop: 8 }]}>Preferred Language</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 12 }}>
                {['Kannada', 'Hindi', 'English', 'Bhojpuri', 'Urdu', 'Telugu', 'Tamil', 'Marathi', 'Malayalam', 'Punjabi', 'Bengali', 'Gujarati'].map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[
                      styles.pillSelect,
                      regLanguage === lang && styles.pillSelectActive,
                    ]}
                    onPress={() => setRegLanguage(lang)}
                  >
                    <Text
                      style={[
                        styles.pillSelectText,
                        regLanguage === lang && styles.pillSelectTextActive,
                      ]}
                    >
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#10b981' }]}
                onPress={handleRegisterPatient}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#ffffff" />
                    <Text style={styles.primaryBtnText}>Create Patient Health Vault</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { setAuthMode('email'); setError(null); setSuccessNotice(null); }}
                style={[styles.resendBtn, { marginTop: 12 }]}
              >
                <Text style={styles.resendText}>Already have an account? Sign in with Email</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Security & DPDP Compliance Guarantee */}
        <View style={styles.complianceFooter}>
          <Ionicons name="shield-checkmark" size={14} color="#10b981" />
          <Text style={styles.complianceText}>
            DPDP Act 2023 Compliant • Zero Audio Retention • 100% Encrypted
          </Text>
        </View>

        {/* First-Time Patient Demographics Onboarding Modal */}
        <Modal visible={showOnboardingModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="person-circle" size={22} color="#10b981" />
                  <Text style={styles.modalTitle}>Set Up Patient Profile</Text>
                </View>
              </View>

              <Text style={styles.modalSubtitle}>
                Please confirm your clinical details so your doctor's care instructions and dosage schedules are accurate.
              </Text>

              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={Colors.textSecondary}
                  value={onboardName}
                  onChangeText={setOnboardName}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Age (Years)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 35"
                      placeholderTextColor={Colors.textSecondary}
                      value={onboardAge}
                      onChangeText={setOnboardAge}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <View style={{ flex: 1.5 }}>
                  <Text style={styles.label}>Gender</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    {(['Male', 'Female', 'Other'] as const).map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[
                          styles.pillSelect,
                          onboardGender === g && styles.pillSelectActive,
                        ]}
                        onPress={() => setOnboardGender(g)}
                      >
                        <Text
                          style={[
                            styles.pillSelectText,
                            onboardGender === g && styles.pillSelectTextActive,
                          ]}
                        >
                          {g}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Preferred Language (for Medication Reminders)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4, marginBottom: 8 }}>
                {['Kannada', 'Hindi', 'English', 'Bhojpuri', 'Urdu', 'Telugu', 'Tamil', 'Marathi', 'Malayalam', 'Punjabi', 'Bengali', 'Gujarati'].map((lang) => (
                  <TouchableOpacity
                    key={lang}
                    style={[
                      styles.pillSelect,
                      onboardLanguage === lang && styles.pillSelectActive,
                    ]}
                    onPress={() => setOnboardLanguage(lang)}
                  >
                    <Text
                      style={[
                        styles.pillSelectText,
                        onboardLanguage === lang && styles.pillSelectTextActive,
                      ]}
                    >
                      {lang}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Emergency Contact Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. +91 9876543211"
                  placeholderTextColor={Colors.textSecondary}
                  value={onboardEmergency}
                  onChangeText={setOnboardEmergency}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#10b981' }]}
                onPress={handleSaveOnboarding}
              >
                <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                <Text style={styles.primaryBtnText}>Save & Access My Vault</Text>
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
  patientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  patientBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: '#166534',
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
  emailInstructionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  emailInstructionText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#166534',
    flex: 1,
    lineHeight: 18,
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
    backgroundColor: '#10b981',
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
    backgroundColor: '#F0FDF4',
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  demoNoticeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#166534',
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
    backgroundColor: '#F0FDF4',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  demoLoginBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: '#166534',
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
    color: '#166534',
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
    backgroundColor: '#10B981',
    borderColor: '#10B981',
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
    backgroundColor: '#10B981',
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
  pillSelect: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  pillSelectActive: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  pillSelectText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  pillSelectTextActive: {
    color: '#166534',
    fontFamily: FontFamily.semiBold,
  },
});

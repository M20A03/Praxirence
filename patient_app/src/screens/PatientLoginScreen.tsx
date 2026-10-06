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
  StatusBar,
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

  // First-Time Patient Demographics Modal (Compulsory Phone + Optional Demographics)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [pendingPatient, setPendingPatient] = useState<PatientUser | null>(null);
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardName, setOnboardName] = useState('');
  const [onboardAge, setOnboardAge] = useState('');
  const [onboardGender, setOnboardGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [onboardLanguage, setOnboardLanguage] = useState('English');
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




  // Handle Auth Success & Check Demographic Onboarding (Compulsory Indian phone number +91)
  const handleAuthSuccess = async (user: PatientUser) => {
    try {
      const rawDigits = (user.phone || '').replace(/\D/g, '');
      const hasValidPhone = Boolean(
        user.phone &&
        !user.phone.includes('@') &&
        ((user.phone.startsWith('+91') && rawDigits.length === 12 && rawDigits.startsWith('91')) ||
         (rawDigits.length === 10 && /^[6-9]/.test(rawDigits)))
      );

      if (!hasValidPhone) {
        setPendingPatient(user);
        const clean10 = rawDigits.length === 10 ? rawDigits : (rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : '');
        setOnboardPhone(clean10);
        const enteredName = patientName.trim();
        const emailUserPart = (user.email || email || '').split('@')[0].replace(/\./g, ' ').toLowerCase();
        const userClean = (user.name || '').trim().toLowerCase();
        const isAutoFromEmail = userClean === emailUserPart;
        const resolvedName = enteredName || (!isAutoFromEmail && user.name ? user.name : '') || '';
        setOnboardName(resolvedName);
        setOnboardAge(user.age ? String(user.age) : '');
        setOnboardGender((user.gender as any) || '');
        setOnboardLanguage(user.language || 'English');
        setOnboardEmergency(user.emergency_contact || '');
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
    const phoneDigits = onboardPhone.replace(/\D/g, '');
    if (phoneDigits.length !== 10 || !/^[6-9]/.test(phoneDigits)) {
      Alert.alert(
        'Phone Number Compulsory',
        'Please enter a valid 10-digit Indian mobile number (+91) starting with 6, 7, 8, or 9.'
      );
      return;
    }
    const formattedPhone = `+91${phoneDigits}`;
    setLoading(true);
    try {
      const payload: any = {
        phone: formattedPhone,
      };
      if (onboardName.trim()) payload.name = onboardName.trim();
      if (onboardAge.trim()) payload.age = parseInt(onboardAge.trim(), 10);
      if (onboardGender) payload.gender = onboardGender;
      if (onboardEmergency.trim()) {
        const emDigits = onboardEmergency.replace(/\D/g, '');
        payload.emergency_contact = emDigits.length === 10 ? `+91${emDigits}` : onboardEmergency.trim();
      }

      const res = await mobileApi.updatePatientProfile(pendingPatient.id, payload);
      const updated: PatientUser = {
        ...pendingPatient,
        ...payload,
        ...(res.user || {}),
        phone: formattedPhone,
        language: onboardLanguage || pendingPatient.language || 'English',
      };
      await AsyncStorage.setItem('praxirence_patient_profile', JSON.stringify(updated));
      setShowOnboardingModal(false);
      onAuthenticated(updated);
    } catch (err: any) {
      Alert.alert('Profile Setup Notice', err?.message || 'Failed to update patient profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };


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
      const res = await mobileApi.verifyPatientEmailOtp(email.trim(), emailOtpCode.trim(), patientName.trim());
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
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
            Direct passwordless access to prescriptions, medication timing reminders, and care plans. Instant setup for new patients.
          </Text>
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
                editable={!loading && !emailOtpSent}
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
                editable={!loading && !emailOtpSent}
              />
            </View>

            {!emailOtpSent ? (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#10b981' }, loading && { opacity: 0.8 }]}
                activeOpacity={0.7}
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
                    editable={!loading}
                  />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, marginBottom: 12 }}>
                  <Ionicons name="mail-outline" size={13} color={Colors.textSecondary} />
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, flex: 1 }}>
                    Please check your Inbox and Spam/Junk folder. Code expires in 10 minutes.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, { backgroundColor: '#10b981' }, loading && { opacity: 0.8 }]}
                  activeOpacity={0.7}
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
                    activeOpacity={0.7}
                    disabled={loading || resendCooldown > 0}
                    style={{ paddingVertical: 8 }}
                  >
                    <Text style={[styles.resendText, resendCooldown > 0 && { color: Colors.textSecondary }]}>
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => { setEmailOtpSent(false); setEmailOtpCode(''); setError(null); }}
                    activeOpacity={0.7}
                    style={{ paddingVertical: 8 }}
                  >
                    <Text style={styles.resendText}>Change email</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
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
                A valid Indian mobile number (+91) is compulsory for health alerts and emergency care. Personal details can be provided now or updated anytime in Settings.
              </Text>

              {/* Compulsory Indian Mobile Number */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.label}>
                  Mobile Number <Text style={{ color: '#EF4444' }}>* (Compulsory)</Text>
                </Text>
                <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '700' }}>Indian Format (+91)</Text>
              </View>
              <View style={[styles.inputContainer, { paddingLeft: 0, paddingRight: 8 }]}>
                <View style={styles.phonePrefixPill}>
                  <Text style={styles.flagIcon}>🇮🇳</Text>
                  <Text style={styles.phonePrefixText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, { flex: 1, paddingLeft: 10 }]}
                  placeholder="10-digit mobile number"
                  placeholderTextColor={Colors.textSecondary}
                  value={onboardPhone}
                  onChangeText={(val) => setOnboardPhone(val.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>

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
                  placeholder="Enter 10-digit emergency contact"
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
    fontWeight: '600',
    fontSize: FontSize.caption,
    color: '#166534',
  },
  title: {
    fontFamily: FontFamily.display,
    fontWeight: '700',
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
    fontWeight: '500',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
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
  phonePrefixPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    gap: 4,
  },
  flagIcon: {
    fontSize: 16,
  },
  phonePrefixText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  label: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
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
    fontWeight: '500',
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
    fontWeight: '600',
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
    fontWeight: '500',
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
    fontWeight: '500',
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
    fontWeight: '500',
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
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '500',
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
    fontWeight: '700',
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
    fontWeight: '500',
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
    fontWeight: '500',
    fontSize: 10.5,
    color: Colors.textPrimary,
  },
  presetBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '500',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  pillSelectTextActive: {
    color: '#166534',
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
  },
});

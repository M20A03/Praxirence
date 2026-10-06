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
import { DoctorUser } from '../types';

interface DoctorLoginScreenProps {
  onAuthenticated: (doctor: DoctorUser) => void;
}

export const DoctorLoginScreen: React.FC<DoctorLoginScreenProps> = ({ onAuthenticated }) => {
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

  // First-Time Doctor Setup Modal (Compulsory Phone + Optional Practice Details)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [pendingDoctor, setPendingDoctor] = useState<DoctorUser | null>(null);
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardDoctorName, setOnboardDoctorName] = useState('');
  const [onboardQualifications, setOnboardQualifications] = useState('');
  const [onboardRegNo, setOnboardRegNo] = useState('');
  const [onboardClinic, setOnboardClinic] = useState('');
  const [onboardSpecialty, setOnboardSpecialty] = useState('');

  // Email OTP States
  const [email, setEmail] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');
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

  // Unified Auth Success Routing (Enforce compulsory Indian phone number +91)
  const handleAuthSuccess = async (user: DoctorUser) => {
    const rawDigits = (user.phone || '').replace(/\D/g, '');
    const hasValidPhone = Boolean(
      user.phone &&
      ((user.phone.startsWith('+91') && rawDigits.length === 12 && rawDigits.startsWith('91')) ||
       (rawDigits.length === 10 && /^[6-9]/.test(rawDigits)))
    );

    if (!hasValidPhone) {
      setPendingDoctor(user);
      const clean10 = rawDigits.length === 10 ? rawDigits : (rawDigits.length === 12 && rawDigits.startsWith('91') ? rawDigits.slice(2) : '');
      setOnboardPhone(clean10);
      const enteredName = doctorName.trim();
      const formattedEntered = enteredName ? (enteredName.startsWith('Dr.') ? enteredName : `Dr. ${enteredName}`) : '';
      const emailUserPart = (user.email || email || '').split('@')[0].replace(/\./g, ' ').toLowerCase();
      const userClean = (user.name || '').replace(/^(Dr\.?\s*)/i, '').trim().toLowerCase();
      const isAutoFromEmail = userClean === emailUserPart;
      const resolvedName = formattedEntered || (!isAutoFromEmail && user.name ? user.name : '') || '';
      setOnboardDoctorName(resolvedName);
      setOnboardSpecialty(user.specialty || '');
      setOnboardClinic(user.clinic_name || '');
      setOnboardRegNo(user.reg_number || '');
      setShowOnboardingModal(true);
    } else {
      await AsyncStorage.setItem('praxirence_doctor_profile', JSON.stringify(user));
      await AsyncStorage.setItem('praxirence_user', JSON.stringify(user));
      onAuthenticated(user);
    }
  };

  const handleSaveOnboarding = async () => {
    if (!pendingDoctor) return;
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
      if (onboardDoctorName.trim()) {
        const raw = onboardDoctorName.trim();
        payload.name = raw.startsWith('Dr.') ? raw : `Dr. ${raw}`;
      }
      if (onboardSpecialty.trim()) payload.specialty = onboardSpecialty.trim();
      if (onboardClinic.trim()) payload.clinic_name = onboardClinic.trim();
      if (onboardRegNo.trim()) payload.reg_number = onboardRegNo.trim();

      const res = await mobileApi.updateDoctorProfile(payload, pendingDoctor.id);
      const updated: DoctorUser = {
        ...pendingDoctor,
        ...payload,
        ...(res.doctor || {}),
        phone: formattedPhone,
      };
      await AsyncStorage.setItem('praxirence_doctor_profile', JSON.stringify(updated));
      await AsyncStorage.setItem('praxirence_user', JSON.stringify(updated));
      setShowOnboardingModal(false);
      onAuthenticated(updated);
    } catch (err: any) {
      Alert.alert('Setup Error', err?.message || 'Failed to save doctor details. Please try again.');
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
      const res = await mobileApi.requestDoctorEmailOtp(email.trim(), doctorName.trim());
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

  // Email OTP Verify
  const handleVerifyEmailOtp = async () => {
    if (!emailOtpCode.trim()) {
      setError('Please enter the 6-digit code received on your email.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await mobileApi.verifyDoctorEmailOtp(email.trim(), emailOtpCode.trim(), doctorName.trim());
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
            <View style={styles.doctorBadge}>
              <Ionicons name="medkit" size={14} color="#0ea5e9" />
              <Text style={styles.doctorBadgeText}>PRAXIRENCE DOCTOR APP</Text>
            </View>
          </View>
          <Text style={styles.title}>Clinician Workstation</Text>
          <Text style={styles.subtitle}>
            Direct passwordless access for clinicians. Instant setup for new medical practitioners.
          </Text>
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

          <View>
            <Text style={styles.label}>Physician Full Name</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="person" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.input}
                placeholder="Dr. Full Name"
                placeholderTextColor={Colors.textSecondary}
                value={doctorName}
                onChangeText={setDoctorName}
                editable={!loading && !emailOtpSent}
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
                editable={!loading && !emailOtpSent}
              />
            </View>

            {!emailOtpSent ? (
              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.8 }]}
                activeOpacity={0.7}
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
                  style={[styles.primaryBtn, loading && { opacity: 0.8 }]}
                  activeOpacity={0.7}
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

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <TouchableOpacity
                    style={styles.resendBtn}
                    activeOpacity={0.7}
                    onPress={handleRequestEmailOtp}
                    disabled={loading || resendCooldown > 0}
                  >
                    <Text style={[styles.resendText, resendCooldown > 0 && { color: Colors.textMuted }]}>
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => { setEmailOtpSent(false); setEmailOtpCode(''); setError(null); }}
                    style={{ paddingVertical: 8 }}
                  >
                    <Text style={styles.resendText}>Change email</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Legal & Security Compliance Footer */}
        <View style={styles.complianceFooter}>
          <Ionicons name="shield-checkmark" size={14} color="#10b981" />
          <Text style={styles.complianceText}>
            DPDP Act 2023 Compliant • Zero Audio Retention • End-to-End Encrypted
          </Text>
        </View>

        {/* Doctor First-Time Profile Setup Modal (Compulsory Phone + Optional Details) */}
        <Modal visible={showOnboardingModal} animationType="slide" transparent onRequestClose={() => {}}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
                  <Text style={styles.modalTitle}>Set Up Doctor Profile</Text>
                </View>
              </View>

              <Text style={styles.modalSubtitle}>
                A valid Indian mobile number (+91) is compulsory for clinical security and verification. You can fill your profile details now or update anytime in Settings.
              </Text>

              {/* Compulsory Indian Mobile Number */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={styles.label}>
                  Mobile Number <Text style={{ color: '#EF4444' }}>* (Compulsory)</Text>
                </Text>
                <Text style={{ fontSize: 11, color: '#0284C7', fontWeight: '700' }}>Indian Format (+91)</Text>
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

              {/* Optional Clinician Name */}
              <Text style={styles.label}>Clinician Full Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Dr. Rajesh Sharma"
                  placeholderTextColor={Colors.textSecondary}
                  value={onboardDoctorName}
                  onChangeText={setOnboardDoctorName}
                />
              </View>

              {/* Optional Registration Number */}
              <Text style={styles.label}>Medical Registration Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="id-card-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. NMC/12345/2023"
                  placeholderTextColor={Colors.textSecondary}
                  value={onboardRegNo}
                  onChangeText={setOnboardRegNo}
                />
              </View>

              {/* Optional Clinic / Hospital Name */}
              <Text style={styles.label}>Clinic / Hospital Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="business-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. City Health Clinic"
                  placeholderTextColor={Colors.textSecondary}
                  value={onboardClinic}
                  onChangeText={setOnboardClinic}
                />
              </View>

              {/* Optional Specialty */}
              <Text style={styles.label}>Specialty & Qualifications</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="fitness-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. General Medicine, Cardiology"
                  placeholderTextColor={Colors.textSecondary}
                  value={onboardSpecialty}
                  onChangeText={setOnboardSpecialty}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { marginTop: 16 }]}
                onPress={handleSaveOnboarding}
                disabled={loading}
              >
                <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                <Text style={styles.primaryBtnText}>
                  {loading ? 'Saving...' : 'Save & Launch Workstation'}
                </Text>
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

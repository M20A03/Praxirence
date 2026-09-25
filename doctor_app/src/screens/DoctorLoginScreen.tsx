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

  const [phoneDigits, setPhoneDigits] = useState('');

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
      setOnboardSpecialty(user.specialty || '');
      setOnboardClinic(user.clinic_name && !user.clinic_name.includes('Clinical Centre') ? user.clinic_name : '');
      setOnboardRegNo(user.reg_number || '');
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
      clinic_name: onboardClinic.trim() || 'Private Clinical Practice',
      reg_number: onboardRegNo.trim(),
    };
    await AsyncStorage.setItem('praxirence_doctor_profile', JSON.stringify(updated));
    setShowOnboardingModal(false);
    onAuthenticated(updated);
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

  // Doctor Registration
  const handleRegisterDoctor = async () => {
    if (!doctorName.trim() || !email.trim()) {
      setError('Please provide your name and email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await mobileApi.registerDoctor({
        name: doctorName.trim().startsWith('Dr.') ? doctorName.trim() : `Dr. ${doctorName.trim()}`,
        email: email.trim(),
        phone: phoneDigits ? `+91${phoneDigits}` : undefined,
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
            Secure clinical suite for verified medical practitioners
          </Text>
        </View>

        {/* Auth Mode Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, authMode === 'email' && styles.tabBtnActive]}
            onPress={() => { setAuthMode('email'); setError(null); }}
          >
            <Ionicons name="mail" size={16} color={authMode === 'email' ? '#0ea5e9' : Colors.textSecondary} />
            <Text style={[styles.tabText, authMode === 'email' && styles.tabTextActive]}>Medical Email OTP</Text>
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
                  placeholder="Dr. Full Name"
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



          {authMode === 'register' && (
            <View>
              <Text style={styles.label}>Full Name (with Dr. prefix)</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="Dr. Full Name"
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
                  placeholder="e.g. Metro Care Clinic & Hospital"
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
                  placeholder="e.g. NMC/12345/2023"
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
                  placeholder="e.g. City Health Clinic & Hospital"
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

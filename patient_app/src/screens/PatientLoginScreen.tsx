import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { mobileApi } from '../services/api';
import { BrandLogoMobile } from '../components/BrandLogoMobile';
import { PatientUser } from '../types';

interface PatientLoginScreenProps {
  onAuthenticated: (patient: PatientUser) => void;
}

export const PatientLoginScreen: React.FC<PatientLoginScreenProps> = ({ onAuthenticated }) => {
  const [authMode, setAuthMode] = useState<'email' | 'phone'>('email');

  // Email OTP States
  const [email, setEmail] = useState('');
  const [patientName, setPatientName] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');

  // Phone WhatsApp States
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const fullPhone = `+91${phoneDigits}`;

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
      setSuccessNotice(res.message || `Verification code sent to ${email}`);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch email verification code');
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
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code');
    } finally {
      setLoading(false);
    }
  };

  // Request WhatsApp OTP
  const handleRequestPhoneOtp = async () => {
    if (phoneDigits.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res: any = await mobileApi.requestPatientOtp(fullPhone, 'whatsapp');
      setPhoneOtpSent(true);
      const code = res?.otp_code || res?.demo_code;
      if (code) {
        setDemoCode(code);
        setPhoneOtpCode(code);
      }
      setSuccessNotice(`WhatsApp verification code sent to ${fullPhone}`);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch WhatsApp OTP. Check your network.');
    } finally {
      setLoading(false);
    }
  };

  // Verify WhatsApp OTP
  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtpCode.trim()) {
      setError('Please enter the 6-digit code received on WhatsApp.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await mobileApi.verifyPatientOtp(fullPhone, phoneOtpCode.trim());
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
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
            <Text style={[styles.tabText, authMode === 'email' && styles.tabTextActive]}>Email OTP</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, authMode === 'phone' && styles.tabBtnActive]}
            onPress={() => { setAuthMode('phone'); setError(null); setSuccessNotice(null); }}
          >
            <Ionicons name="logo-whatsapp" size={16} color={authMode === 'phone' ? '#25D366' : Colors.textSecondary} />
            <Text style={[styles.tabText, authMode === 'phone' && styles.tabTextActive]}>WhatsApp</Text>
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
                  placeholder="e.g. Aarav Sharma"
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
                      style={[styles.input, { letterSpacing: 4, fontWeight: '700' }]}
                      placeholder="123456"
                      placeholderTextColor={Colors.textSecondary}
                      value={emailOtpCode}
                      onChangeText={setEmailOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
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

                  <TouchableOpacity onPress={() => setEmailOtpSent(false)} style={styles.resendBtn}>
                    <Text style={styles.resendText}>Change email address</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            /* WHATSAPP PHONE OTP FLOW */
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

              <Text style={styles.label}>Mobile Phone Number (for WhatsApp Reminders)</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.countryCodeText}>🇮🇳 +91</Text>
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
                  style={styles.primaryBtn}
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
                  {demoCode && (
                    <View style={styles.demoNotice}>
                      <Text style={styles.demoNoticeText}>
                        WhatsApp Demo Code: <Text style={{ fontWeight: '800' }}>{demoCode}</Text>
                      </Text>
                    </View>
                  )}

                  <Text style={styles.label}>Enter 6-Digit WhatsApp Code</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="key-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 123456"
                      placeholderTextColor={Colors.textSecondary}
                      value={phoneOtpCode}
                      onChangeText={setPhoneOtpCode}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleVerifyPhoneOtp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-done" size={18} color="#ffffff" />
                        <Text style={styles.primaryBtnText}>Verify & Access My Health Vault</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setPhoneOtpSent(false)} style={styles.resendBtn}>
                    <Text style={styles.resendText}>Change mobile number</Text>
                  </TouchableOpacity>
                </View>
              )}
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
    marginBottom: 24,
  },
  badgeContainer: {
    marginTop: 12,
    marginBottom: 6,
  },
  patientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  patientBadgeText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: '#10b981',
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    fontWeight: '800',
    marginTop: 8,
  },
  subtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  emailInstructionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  emailInstructionText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#065f46',
    flex: 1,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  countryCodeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  countryCodeText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
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
    backgroundColor: '#25D366',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 14,
  },
  primaryBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: '#ffffff',
    fontWeight: '700',
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  resendText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#0ea5e9',
  },
  demoNotice: {
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.25)',
  },
  demoNoticeText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: '#10b981',
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  demoLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  demoLoginBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#10b981',
    fontWeight: '700',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#ef4444',
    flex: 1,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  successText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#10b981',
    flex: 1,
  },
  complianceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  complianceText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});

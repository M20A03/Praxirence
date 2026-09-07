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
import { DoctorUser } from '../types';

interface DoctorLoginScreenProps {
  onAuthenticated: (doctor: DoctorUser) => void;
}

export const DoctorLoginScreen: React.FC<DoctorLoginScreenProps> = ({ onAuthenticated }) => {
  const [authMode, setAuthMode] = useState<'email' | 'phone' | 'register'>('email');

  // Email OTP States
  const [email, setEmail] = useState('doctor@praxirence.com');
  const [doctorName, setDoctorName] = useState('Dr. Mayank Raj');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState('');

  // Phone OTP States
  const [phoneDigits, setPhoneDigits] = useState('9876543210');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);

  // Registration States
  const [regSpecialty, setRegSpecialty] = useState('General Medicine & Pulmonology');
  const [regClinic, setRegClinic] = useState('Praxirence Clinical Centre');
  const [regNumber, setRegNumber] = useState('NMC-2024-84920');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // 1-Click Demo Login
  const handleQuickDemoDoctor = async () => {
    setLoading(true);
    setError(null);
    try {
      const demoDoctor: DoctorUser = {
        id: '15a1fef3-d264-4d37-b981-f7a10a683fb8',
        name: 'Dr. Mayank Raj',
        email: 'doctor@praxirence.com',
        phone: '+919876543210',
        specialty: 'Chief Medical Officer & Physician',
        clinic_name: 'Praxirence Clinical Centre',
        reg_number: 'NMC-2024-84920',
        role: 'doctor',
      };
      await mobileApi.saveSession('doctor', 'token_doctor_verified_session', demoDoctor);
      onAuthenticated(demoDoctor);
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
      setSuccessNotice(res.message || `Verification code sent to ${email}`);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch email verification code');
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
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code');
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
      const res: any = await mobileApi.requestDoctorOtp(fullPhone, 'whatsapp');
      setPhoneOtpSent(true);
      const code = res?.otp_code || res?.demo_code;
      if (code) {
        setDemoCode(code);
        setPhoneOtpCode(code);
      }
      setSuccessNotice(`WhatsApp code sent to ${fullPhone}`);
    } catch (err: any) {
      setError(err.message || 'Failed to send WhatsApp verification code');
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
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid code');
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
      onAuthenticated(res.user);
    } catch (err: any) {
      setError(err.message || 'Doctor registration failed');
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
            Secure NMC-compliant clinical suite for verified medical practitioners
          </Text>
        </View>

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

        {/* Form Card */}
        <View style={styles.card}>
          {authMode === 'email' && (
            <View>
              <Text style={styles.label}>Official Medical Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="at" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="doctor@praxirence.com"
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
                      <Ionicons name="paper-plane" size={18} color="#ffffff" />
                      <Text style={styles.primaryBtnText}>Send Email Verification Code</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={{ marginTop: 12 }}>
                  <Text style={styles.label}>Enter 6-Digit Email Code</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="key" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 849201"
                      placeholderTextColor={Colors.textSecondary}
                      value={emailOtpCode}
                      onChangeText={setEmailOtpCode}
                      keyboardType="number-pad"
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={handleVerifyEmailOtp}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <>
                        <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
                        <Text style={styles.primaryBtnText}>Verify & Open Clinician Portal</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => setEmailOtpSent(false)} style={styles.resendBtn}>
                    <Text style={styles.resendText}>Change email address</Text>
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
                  {demoCode && (
                    <View style={styles.demoNotice}>
                      <Text style={styles.demoNoticeText}>Demo OTP Code: <Text style={{ fontWeight: '800' }}>{demoCode}</Text></Text>
                    </View>
                  )}
                  <Text style={styles.label}>WhatsApp Verification Code</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="key" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.input}
                      placeholder="6-digit code"
                      placeholderTextColor={Colors.textSecondary}
                      value={phoneOtpCode}
                      onChangeText={setPhoneOtpCode}
                      keyboardType="number-pad"
                    />
                  </View>

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
                  placeholder="Dr. Mayank Raj"
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

              <Text style={styles.label}>NMC Registration Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="id-card" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.input}
                  placeholder="NMC-2024-84920"
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
                  placeholder="Praxirence Clinical Centre"
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

          {/* Quick Demo Login Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR QUICK SIGN-IN</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.demoLoginBtn}
            onPress={handleQuickDemoDoctor}
            disabled={loading}
          >
            <Ionicons name="flash" size={18} color="#0ea5e9" />
            <Text style={styles.demoLoginBtnText}>Instant Access: Dr. Mayank Raj (CMO)</Text>
          </TouchableOpacity>
        </View>

        {/* Legal & Security Compliance Footer */}
        <View style={styles.complianceFooter}>
          <Ionicons name="shield-checkmark" size={14} color="#10b981" />
          <Text style={styles.complianceText}>
            DPDP Act 2023 Compliant • Zero Audio Retention • End-to-End Encrypted
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
  doctorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  doctorBadgeText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: '#0ea5e9',
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
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
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
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  countryCodeBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: '#0ea5e9',
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
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.25)',
  },
  demoNoticeText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: '#0ea5e9',
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  demoLoginBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#0ea5e9',
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

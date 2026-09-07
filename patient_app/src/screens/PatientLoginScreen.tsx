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
  const [phoneDigits, setPhoneDigits] = useState('9876543210');
  const [name, setName] = useState('Aarav Sharma');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [demoCode, setDemoCode] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const fullPhone = `+91${phoneDigits}`;

  // Quick Demo Access
  const handleQuickDemoPatient = async () => {
    setLoading(true);
    setError(null);
    try {
      const demoPatient: PatientUser = {
        id: 'pat_live_01',
        name: 'Aarav Sharma',
        phone: '+919876543210',
        consent_status: true,
        role: 'patient',
      };
      await mobileApi.saveSession('patient', 'token_patient_verified_session', demoPatient);
      onAuthenticated(demoPatient);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Request WhatsApp OTP
  const handleRequestOtp = async () => {
    if (phoneDigits.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res: any = await mobileApi.requestPatientOtp(fullPhone, 'whatsapp');
      setOtpSent(true);
      const code = res?.otp_code || res?.demo_code;
      if (code) {
        setDemoCode(code);
        setOtpCode(code);
      }
      setSuccessNotice(`WhatsApp verification code sent to ${fullPhone}`);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch WhatsApp OTP. Check your network.');
    } finally {
      setLoading(false);
    }
  };

  // Verify WhatsApp OTP
  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      setError('Please enter the 6-digit code received on WhatsApp.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await mobileApi.verifyPatientOtp(fullPhone, otpCode.trim());
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

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Your Full Name</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="e.g. Aarav Sharma"
              placeholderTextColor={Colors.textSecondary}
              value={name}
              onChangeText={setName}
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

          {!otpSent ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleRequestOtp}
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
                  value={otpCode}
                  onChangeText={setOtpCode}
                  keyboardType="number-pad"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleVerifyOtp}
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

              <TouchableOpacity onPress={() => setOtpSent(false)} style={styles.resendBtn}>
                <Text style={styles.resendText}>Change mobile number</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Quick Demo Login Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR INSTANT ACCESS</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.demoLoginBtn}
            onPress={handleQuickDemoPatient}
            disabled={loading}
          >
            <Ionicons name="flash" size={18} color="#10b981" />
            <Text style={styles.demoLoginBtnText}>Instant Demo: Aarav Sharma (Patient)</Text>
          </TouchableOpacity>
        </View>

        {/* Security & Zero Audio Retention Guarantee */}
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

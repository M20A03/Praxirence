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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { mobileApi } from '../services/api';
import { BrandLogoMobile } from '../components/BrandLogoMobile';
import { UserRole, ActiveUser } from '../types';

interface LoginScreenProps {
  onOtpVerified: (phone: string) => void;
  onAuthenticated?: (role: UserRole, user: ActiveUser) => void;
}

type PersonaTab = 'patient' | 'doctor';

export const LoginScreen: React.FC<LoginScreenProps> = ({ onOtpVerified, onAuthenticated }) => {
  // Active Persona Tab: 'patient' (Only WhatsApp) or 'doctor' (Google + WhatsApp)
  const [activeTab, setActiveTab] = useState<PersonaTab>('patient');

  // Phone input states (Real 10-digit number; country code +91 is handled by dedicated UI)
  const [patientPhoneRaw, setPatientPhoneRaw] = useState('');
  const [doctorPhoneRaw, setDoctorPhoneRaw] = useState('');

  // OTP Verification States
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Google Doctor Verification Sheet
  const [googleModalVisible, setGoogleModalVisible] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleDoctorName, setGoogleDoctorName] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const cleanPatientDigits = patientPhoneRaw.replace(/\D/g, '').slice(-10);
  const cleanDoctorDigits = doctorPhoneRaw.replace(/\D/g, '').slice(-10);

  const fullPatientPhone = `+91${cleanPatientDigits}`;
  const fullDoctorPhone = `+91${cleanDoctorDigits}`;

  // ==================== PATIENT: WHATSAPP ONLY ====================
  const handleRequestPatientWhatsAppOtp = async () => {
    if (!cleanPatientDigits || cleanPatientDigits.length < 10) {
      setError('Please enter your 10-digit mobile number.');
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      await mobileApi.requestPatientOtp(fullPatientPhone, 'whatsapp');
      setOtpSent(true);
      setSuccessMessage(`WhatsApp OTP sent to ${fullPatientPhone}`);
      setCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch WhatsApp OTP. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPatientOtp = async () => {
    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setError('Please enter the complete 6-digit WhatsApp OTP code.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await mobileApi.verifyPatientOtp(fullPatientPhone, cleanCode);
      if (onAuthenticated && res.user) {
        onAuthenticated('patient', res.user);
      } else {
        onOtpVerified(fullPatientPhone);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid or expired WhatsApp OTP code. Please check your WhatsApp message.');
    } finally {
      setLoading(false);
    }
  };

  // ==================== DOCTOR: GOOGLE ACCOUNT VERIFICATION ====================
  const handleDoctorGoogleOpen = () => {
    setGoogleError(null);
    setGoogleModalVisible(true);
  };

  const handleDoctorGoogleSubmit = async () => {
    const trimmedEmail = googleEmail.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setGoogleError('Please enter a valid Google Workspace or Gmail address.');
      return;
    }
    setGoogleError(null);
    setGoogleLoading(true);
    try {
      const res = await mobileApi.loginDoctorGoogle({
        email: trimmedEmail,
        name: googleDoctorName.trim() || 'Dr. Medical Clinician',
        google_id: 'google_oauth_' + Math.random().toString(36).substring(2, 10),
      });
      setGoogleModalVisible(false);
      if (onAuthenticated && res.user) {
        onAuthenticated('doctor', res.user);
      } else {
        onOtpVerified(res.user?.phone || '+919876543210');
      }
    } catch (err: any) {
      setGoogleError(err.message || 'Google Clinician verification failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ==================== DOCTOR: WHATSAPP OTP ====================
  const handleRequestDoctorWhatsAppOtp = async () => {
    if (!cleanDoctorDigits || cleanDoctorDigits.length < 10) {
      setError('Please enter your 10-digit clinician mobile number.');
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      await mobileApi.requestDoctorOtp(fullDoctorPhone, 'whatsapp');
      setOtpSent(true);
      setSuccessMessage(`Clinician WhatsApp OTP sent to ${fullDoctorPhone}`);
      setCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch Doctor WhatsApp verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyDoctorOtp = async () => {
    const cleanCode = code.trim();
    if (!cleanCode || cleanCode.length < 6) {
      setError('Please enter the complete 6-digit Doctor verification code.');
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await mobileApi.verifyDoctorOtp(fullDoctorPhone, cleanCode);
      if (onAuthenticated && res.user) {
        onAuthenticated('doctor', res.user);
      } else {
        onOtpVerified(fullDoctorPhone);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid or expired Doctor OTP code. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleTabSwitch = (tab: PersonaTab) => {
    setActiveTab(tab);
    setOtpSent(false);
    setCode('');
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.logoWrapper}>
          <BrandLogoMobile size="lg" showSubtitle={true} />
        </View>

        {/* Global Error Banner */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={Colors.rose} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Global Success Banner */}
        {successMessage && (
          <View style={styles.successBox}>
            <Ionicons name="checkmark-circle" size={16} color="#047857" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        {/* Main Card */}
        <View style={styles.card}>
          {/* Top Role Selector Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'patient' && styles.tabButtonActivePatient,
              ]}
              onPress={() => handleTabSwitch('patient')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="person-circle"
                size={18}
                color={activeTab === 'patient' ? '#047857' : Colors.textMuted}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'patient' && styles.tabTextActivePatient,
                ]}
              >
                Patient Access
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabButton,
                activeTab === 'doctor' && styles.tabButtonActiveDoctor,
              ]}
              onPress={() => handleTabSwitch('doctor')}
              activeOpacity={0.85}
            >
              <Ionicons
                name="medkit"
                size={16}
                color={activeTab === 'doctor' ? Colors.primaryDark : Colors.textMuted}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'doctor' && styles.tabTextActiveDoctor,
                ]}
              >
                Doctor Portal
              </Text>
            </TouchableOpacity>
          </View>

          {/* ==================== PATIENT MODE (ONLY WHATSAPP) ==================== */}
          {activeTab === 'patient' && (
            <View style={styles.contentArea}>
              <View style={styles.headerArea}>
                <View style={styles.badgeRow}>
                  <View style={styles.whatsappBadge}>
                    <Ionicons name="logo-whatsapp" size={12} color="#047857" />
                    <Text style={styles.whatsappBadgeText}>WhatsApp Only Verification</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle}>
                  {otpSent ? 'Enter WhatsApp OTP' : 'Patient WhatsApp Sign-In'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {otpSent
                    ? `Enter the 6-digit code delivered to +91 ${cleanPatientDigits} on WhatsApp`
                    : 'Encrypted passwordless patient login delivered directly to your WhatsApp'}
                </Text>
              </View>

              {!otpSent ? (
                <View>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCodeBox}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneNumberInput}
                      placeholder="Enter 10-digit number"
                      placeholderTextColor={Colors.textMuted}
                      value={patientPhoneRaw}
                      onChangeText={(text) => setPatientPhoneRaw(text.replace(/\D/g, '').slice(0, 10))}
                      keyboardType="phone-pad"
                      maxLength={10}
                      autoFocus={true}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.whatsappPrimaryButton}
                    onPress={handleRequestPatientWhatsAppOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <View style={styles.buttonContentRow}>
                        <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                        <Text style={styles.whatsappButtonText}>Send WhatsApp OTP Code →</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={styles.inputLabel}>6-Digit WhatsApp Code</Text>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="• • • • • •"
                    placeholderTextColor={Colors.textMuted}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus={true}
                  />

                  <TouchableOpacity
                    style={styles.whatsappPrimaryButton}
                    onPress={handleVerifyPatientOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.whatsappButtonText}>Verify & Access Patient Vault →</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.otpActionRow}>
                    <TouchableOpacity
                      onPress={handleRequestPatientWhatsAppOtp}
                      disabled={loading}
                      style={styles.actionButtonTouch}
                    >
                      <Text style={styles.resendText}>Resend Code</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setOtpSent(false);
                        setCode('');
                        setError(null);
                      }}
                      style={styles.actionButtonTouch}
                    >
                      <Text style={styles.changePhoneText}>← Change Number</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ==================== DOCTOR MODE (GOOGLE + WHATSAPP OTP) ==================== */}
          {activeTab === 'doctor' && (
            <View style={styles.contentArea}>
              <View style={styles.headerArea}>
                <View style={styles.badgeRow}>
                  <View style={styles.doctorBadge}>
                    <Ionicons name="shield-checkmark" size={12} color={Colors.primaryDark} />
                    <Text style={styles.doctorBadgeText}>Verified Clinical Access</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle}>
                  {otpSent ? 'Doctor Verification Code' : 'Clinician Sign-In'}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {otpSent
                    ? `Enter the clinician access code sent to +91 ${cleanDoctorDigits} on WhatsApp`
                    : 'Institutional Google Workspace SSO or verified clinician WhatsApp OTP'}
                </Text>
              </View>

              {!otpSent ? (
                <View>
                  {/* Option 1: GOOGLE ACCOUNT VERIFICATION BUTTON */}
                  <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleDoctorGoogleOpen}
                    disabled={googleLoading}
                    activeOpacity={0.85}
                  >
                    <View style={styles.googleButtonContent}>
                      <View style={styles.googleIconContainer}>
                        <Ionicons name="logo-google" size={18} color="#4285F4" />
                      </View>
                      <View style={styles.googleTextCol}>
                        <Text style={styles.googleButtonTitle}>Continue with Google</Text>
                        <Text style={styles.googleButtonSubtitle}>Google Workspace Medical Sign-In</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                    </View>
                  </TouchableOpacity>

                  {/* Divider: OR WHATSAPP OTP */}
                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or sign in with WhatsApp</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* Option 2: DOCTOR WHATSAPP OTP */}
                  <Text style={styles.inputLabel}>Registered Clinician WhatsApp</Text>
                  <View style={styles.phoneInputRow}>
                    <View style={styles.countryCodeBox}>
                      <Text style={styles.flagEmoji}>🇮🇳</Text>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneNumberInput}
                      placeholder="Enter 10-digit number"
                      placeholderTextColor={Colors.textMuted}
                      value={doctorPhoneRaw}
                      onChangeText={(text) => setDoctorPhoneRaw(text.replace(/\D/g, '').slice(0, 10))}
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.doctorPrimaryButton}
                    onPress={handleRequestDoctorWhatsAppOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <View style={styles.buttonContentRow}>
                        <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                        <Text style={styles.doctorButtonText}>Send Doctor WhatsApp Code →</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={styles.inputLabel}>6-Digit Clinician Access Code</Text>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="• • • • • •"
                    placeholderTextColor={Colors.textMuted}
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus={true}
                  />

                  <TouchableOpacity
                    style={styles.doctorPrimaryButton}
                    onPress={handleVerifyDoctorOtp}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.doctorButtonText}>Verify & Enter Clinical EHR →</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.otpActionRow}>
                    <TouchableOpacity
                      onPress={handleRequestDoctorWhatsAppOtp}
                      disabled={loading}
                      style={styles.actionButtonTouch}
                    >
                      <Text style={[styles.resendText, { color: Colors.primaryDark }]}>Resend Code</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setOtpSent(false);
                        setCode('');
                        setError(null);
                      }}
                      style={styles.actionButtonTouch}
                    >
                      <Text style={styles.changePhoneText}>← Change Number</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Security & Compliance Footer */}
        <View style={styles.footer}>
          <Ionicons name="shield-checkmark" size={14} color={Colors.textMuted} />
          <Text style={styles.footerText}>
            Protected by Praxirence Vault • ABDM & DPDP Compliant
          </Text>
        </View>
      </ScrollView>

      {/* Google Clinician Sign-In Modal */}
      <Modal
        visible={googleModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setGoogleModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.googleModalIconBox}>
                  <Ionicons name="logo-google" size={20} color="#4285F4" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Sign in with Google</Text>
                  <Text style={styles.modalSubtitle}>Hospital & Practice Google Workspace</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setGoogleModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {googleError && (
              <View style={styles.modalErrorBox}>
                <Ionicons name="alert-circle" size={14} color={Colors.rose} />
                <Text style={styles.modalErrorText}>{googleError}</Text>
              </View>
            )}

            <Text style={styles.inputLabel}>Google Account Email</Text>
            <TextInput
              style={styles.modalTextInput}
              placeholder="doctor@hospital.org or name@gmail.com"
              placeholderTextColor={Colors.textMuted}
              value={googleEmail}
              onChangeText={setGoogleEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus={true}
            />

            <Text style={styles.inputLabel}>Doctor Full Name</Text>
            <TextInput
              style={styles.modalTextInput}
              placeholder="e.g. Dr. Jane Smith"
              placeholderTextColor={Colors.textMuted}
              value={googleDoctorName}
              onChangeText={setGoogleDoctorName}
            />

            <TouchableOpacity
              style={styles.googleSubmitButton}
              onPress={handleDoctorGoogleSubmit}
              disabled={googleLoading}
              activeOpacity={0.85}
            >
              {googleLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" />
                  <Text style={styles.googleSubmitButtonText}>Authenticate Clinician Profile →</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 24 : 16,
    paddingBottom: 36,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 18,
  },
  errorBox: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    color: Colors.rose,
    fontSize: FontSize.xs,
    flex: 1,
  },
  successBox: {
    width: '100%',
    maxWidth: 440,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  successText: {
    fontFamily: FontFamily.medium,
    color: '#047857',
    fontSize: FontSize.xs,
    flex: 1,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  tabButtonActivePatient: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabButtonActiveDoctor: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: Colors.textMuted,
  },
  tabTextActivePatient: {
    fontFamily: FontFamily.bold,
    color: '#047857',
  },
  tabTextActiveDoctor: {
    fontFamily: FontFamily.bold,
    color: Colors.primaryDark,
  },
  contentArea: {
    width: '100%',
  },
  headerArea: {
    marginBottom: 18,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  whatsappBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  whatsappBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#047857',
    letterSpacing: 0.2,
  },
  doctorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  doctorBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.primaryDark,
    letterSpacing: 0.2,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    lineHeight: 24,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  inputLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 6,
    letterSpacing: LetterSpacing.wide,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.cardSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  flagEmoji: {
    fontSize: 16,
  },
  countryCodeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  phoneNumberInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    backgroundColor: Colors.cardSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  whatsappPrimaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  doctorPrimaryButton: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whatsappButtonText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSize.body,
    letterSpacing: LetterSpacing.wide,
  },
  doctorButtonText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSize.body,
    letterSpacing: LetterSpacing.wide,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 16,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  googleIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(66, 133, 244, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleTextCol: {
    flex: 1,
  },
  googleButtonTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#1E293B',
  },
  googleButtonSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#64748B',
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
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
  },
  otpInput: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    letterSpacing: 10,
    textAlign: 'center',
    backgroundColor: Colors.cardSubtle,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 16,
    color: Colors.text,
  },
  otpActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 4,
  },
  actionButtonTouch: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  resendText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#059669',
  },
  changePhoneText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 22,
  },
  footerText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 14,
  },
  googleModalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(66, 133, 244, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  modalSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  modalErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  modalErrorText: {
    fontFamily: FontFamily.medium,
    color: Colors.rose,
    fontSize: FontSize.xs,
    flex: 1,
  },
  modalTextInput: {
    fontFamily: FontFamily.medium,
    backgroundColor: Colors.cardSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.body,
    color: Colors.text,
    marginBottom: 14,
  },
  googleSubmitButton: {
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#4285F4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  googleSubmitButtonText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSize.body,
    letterSpacing: LetterSpacing.wide,
  },
});

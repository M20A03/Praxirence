import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { Ionicons } from '@expo/vector-icons';
import { UserRole, DoctorUser, PatientUser } from '../types';
import { mobileApi } from '../services/api';

interface RoleSelectScreenProps {
  verifiedPhone: string;
  onRoleSelected: (role: UserRole, user: DoctorUser | PatientUser) => void;
  onBackToLogin: () => void;
}

export const RoleSelectScreen: React.FC<RoleSelectScreenProps> = ({
  verifiedPhone,
  onRoleSelected,
  onBackToLogin,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);

  // Doctor Profile Form
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [regNumber, setRegNumber] = useState('');

  // Patient Profile Form
  const [patientName, setPatientName] = useState('');

  const handleProceedDoctor = async () => {
    if (!doctorName.trim()) {
      Alert.alert('Required', 'Please enter your full name');
      return;
    }
    if (!specialty.trim()) {
      Alert.alert('Required', 'Please enter your medical specialty');
      return;
    }
    if (!regNumber.trim()) {
      Alert.alert('Required', 'Please enter your NMC / Medical Registration Number');
      return;
    }
    setLoading(true);
    try {
      const registered = await mobileApi.registerDoctor({
        name: doctorName.trim(),
        email: `${doctorName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '.') || 'doctor'}@praxirence.com`,
        phone: verifiedPhone,
        specialty: specialty.trim(),
        clinic_name: clinicName.trim() || 'Independent Practice',
        reg_number: regNumber.trim(),
      });
      onRoleSelected('doctor', registered.user);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Unable to register your doctor profile. Please try again or sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleProceedPatient = async () => {
    if (!patientName.trim()) {
      Alert.alert('Required', 'Please enter your name');
      return;
    }
    setLoading(true);
    try {
      // Patient was already OTP-verified to reach this screen, create profile on backend
      const patRes = await mobileApi.createPatient({
        name: patientName.trim(),
        phone: verifiedPhone,
      });
      if (patRes) {
        const patientUser: PatientUser = {
          id: patRes.id || `pat-${Date.now()}`,
          name: patientName.trim(),
          phone: verifiedPhone,
          consent_status: false,
          role: 'patient',
        };
        await mobileApi.saveSession('patient', `pat_session_${Date.now()}`, patientUser);
        onRoleSelected('patient', patientUser);
      } else {
        Alert.alert('Error', 'Unable to create patient profile. Please try again.');
      }
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message || 'Unable to register your patient profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.badge}>VERIFIED: {verifiedPhone}</Text>
        <Text style={styles.title}>Select Your Account Type</Text>
        <Text style={styles.subtitle}>
          Choose how you want to use Praxirence Clinical Intelligence today.
        </Text>
      </View>

      {/* Role Selection Cards */}
      <View style={styles.roleSelectionContainer}>
        {/* Doctor Card */}
        <TouchableOpacity
          style={[
            styles.roleCard,
            selectedRole === 'doctor' && styles.roleCardSelected,
          ]}
          onPress={() => setSelectedRole('doctor')}
          activeOpacity={0.85}
        >
          <View style={styles.roleIconCircle}>
            <Ionicons name="medkit" size={24} color={Colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.roleTitleRow}>
              <Text style={styles.roleTitle}>Doctor / Clinician</Text>
              <Text style={styles.roleTag}>Provider Portal</Text>
            </View>
            <Text style={styles.roleDesc}>
              Manage patients, create consultation care plans, prescribe medicines & send WhatsApp notifications.
            </Text>
          </View>
        </TouchableOpacity>

        {/* Patient Card */}
        <TouchableOpacity
          style={[
            styles.roleCard,
            selectedRole === 'patient' && styles.roleCardSelected,
          ]}
          onPress={() => setSelectedRole('patient')}
          activeOpacity={0.85}
        >
          <View style={[styles.roleIconCircle, { backgroundColor: 'rgba(2, 132, 199, 0.1)' }]}>
            <Ionicons name="person" size={24} color={Colors.cyan} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.roleTitleRow}>
              <Text style={styles.roleTitle}>Patient</Text>
              <Text style={[styles.roleTag, { backgroundColor: 'rgba(2, 132, 199, 0.1)', color: Colors.cyan }]}>
                Personal Vault
              </Text>
            </View>
            <Text style={styles.roleDesc}>
              Track daily medication doses, review doctor prescriptions & manage DPDP digital consent.
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Doctor Profile Details Form */}
      {selectedRole === 'doctor' && (
        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Doctor Clinical Credentials</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Doctor Name</Text>
            <TextInput
              style={styles.input}
              value={doctorName}
              onChangeText={setDoctorName}
              placeholder="e.g. Dr. Mayank Raj"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Medical Specialty</Text>
            <TextInput
              style={styles.input}
              value={specialty}
              onChangeText={setSpecialty}
              placeholder="e.g. Chief Medical Officer, General Physician"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Clinic or Hospital Name</Text>
            <TextInput
              style={styles.input}
              value={clinicName}
              onChangeText={setClinicName}
              placeholder="e.g. Praxirence Clinical Centre"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Medical Registration / NMC Number</Text>
            <TextInput
              style={styles.input}
              value={regNumber}
              onChangeText={setRegNumber}
              placeholder="e.g. NMC-2024-84920"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleProceedDoctor}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>Enter Doctor Clinical Portal →</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Patient Profile Form */}
      {selectedRole === 'patient' && (
        <View style={styles.formSection}>
          <Text style={styles.formSectionTitle}>Patient Profile Details</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={patientName}
              onChangeText={setPatientName}
              placeholder="e.g. Mayank"
              placeholderTextColor={Colors.textMuted}
            />
          </View>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: Colors.cyan }]}
            onPress={handleProceedPatient}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>Enter Patient Vault →</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Back to Login */}
      <TouchableOpacity style={styles.backButton} onPress={onBackToLogin}>
        <Text style={styles.backButtonText}>← Sign in with a different phone number</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    maxWidth: 580,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  badge: {
    fontFamily: FontFamily.bold,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    color: Colors.primary,
    fontSize: FontSize.caption,
    letterSpacing: LetterSpacing.wider,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    lineHeight: 30,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    letterSpacing: LetterSpacing.normal,
  },
  roleSelectionContainer: {
    gap: 14,
    marginBottom: 20,
  },
  roleCard: {
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  roleCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySurface,
  },
  roleIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleIcon: {
    fontSize: 26,
  },
  roleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  roleTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  roleTag: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.primary,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    letterSpacing: LetterSpacing.wide,
  },
  roleDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  formSection: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formSectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    letterSpacing: LetterSpacing.wide,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    fontFamily: FontFamily.medium,
    backgroundColor: Colors.cardSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.base,
    color: Colors.text,
  },
  actionButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSize.body,
    letterSpacing: LetterSpacing.wide,
  },
  backButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  backButtonText: {
    fontFamily: FontFamily.semiBold,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
});

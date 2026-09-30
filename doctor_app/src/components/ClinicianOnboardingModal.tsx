import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize } from '../theme/typography';
import { DoctorUser } from '../types';
import { mobileApi } from '../services/api';

interface ClinicianOnboardingModalProps {
  visible: boolean;
  doctor: DoctorUser;
  onComplete: (updatedDoctor: DoctorUser) => void;
  onLogout: () => void;
}

export const ClinicianOnboardingModal: React.FC<ClinicianOnboardingModalProps> = ({
  visible,
  doctor,
  onComplete,
  onLogout,
}) => {
  const [name, setName] = useState<string>(doctor.name || '');
  const [regNumber, setRegNumber] = useState<string>(doctor.reg_number || '');
  const [degree, setDegree] = useState<string>(doctor.degree || '');
  const [specialty, setSpecialty] = useState<string>(doctor.specialty || '');
  const [clinicName, setClinicName] = useState<string>(doctor.clinic_name || '');
  const [clinicAddress, setClinicAddress] = useState<string>(doctor.clinic_address || '');
  const [expYears, setExpYears] = useState<string>(
    doctor.experience_years ? String(doctor.experience_years) : ''
  );
  const [saving, setSaving] = useState<boolean>(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter your full clinician name.');
      return;
    }
    if (!regNumber.trim()) {
      Alert.alert('Required', 'Medical Council / NMC Registration Number is mandatory for legal prescription issuance.');
      return;
    }
    if (!degree.trim()) {
      Alert.alert('Required', 'Please enter your primary medical degrees (e.g. MBBS, MD).');
      return;
    }
    if (!specialty.trim()) {
      Alert.alert('Required', 'Please specify your primary clinical specialty.');
      return;
    }
    if (!clinicName.trim()) {
      Alert.alert('Required', 'Please enter your primary clinic or hospital name.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<DoctorUser> = {
        name: name.trim(),
        reg_number: regNumber.trim(),
        degree: degree.trim(),
        specialty: specialty.trim(),
        clinic_name: clinicName.trim(),
        clinic_address: clinicAddress.trim() || undefined,
        experience_years: expYears.trim() || undefined,
      };

      const res = await mobileApi.updateDoctorProfile(payload, doctor.id);
      const updated: DoctorUser = {
        ...doctor,
        ...payload,
        ...(res.doctor || {}),
      };

      Alert.alert(
        'Credentials Verified',
        'Your medical credentials have been registered. Welcome to your clinical workspace.',
        [{ text: 'Enter Workspace', onPress: () => onComplete(updated) }]
      );
    } catch (err: any) {
      Alert.alert('Verification Notice', err.message || 'Failed to save medical credentials. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={() => {}}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Banner */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Ionicons name="shield-checkmark" size={16} color={Colors.primary} />
              <Text style={styles.badgeText}>MANDATORY CLINICIAN ONBOARDING</Text>
            </View>
            <Text style={styles.title}>Verified Medical Profile</Text>
            <Text style={styles.subtitle}>
              National Medical Commission (NMC) regulations require verified qualification and registration details before prescribing medications or managing OPD consultations.
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>
              Clinician Full Name <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Dr. Jane Smith"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>
              Medical Council / NMC Reg. No. <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={regNumber}
              onChangeText={setRegNumber}
              placeholder="e.g. 54321-KA-2018 or NMC-2024-XXXX"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>
              Primary Degrees <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={degree}
              onChangeText={setDegree}
              placeholder="e.g. MBBS, MD (General Medicine)"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>
              Clinical Specialty <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={specialty}
              onChangeText={setSpecialty}
              placeholder="e.g. Internal Medicine, Pediatrics, Cardiology"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>
              Clinic or Hospital Practice Name <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={clinicName}
              onChangeText={setClinicName}
              placeholder="e.g. Care Plus Clinic / City Hospital"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Clinic Address / City</Text>
            <TextInput
              style={styles.input}
              value={clinicAddress}
              onChangeText={setClinicAddress}
              placeholder="e.g. 42 MG Road, Bangalore"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.fieldLabel}>Years of Experience</Text>
            <TextInput
              style={styles.input}
              value={expYears}
              onChangeText={setExpYears}
              placeholder="e.g. 8 Years"
              placeholderTextColor="#94A3B8"
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Verify & Activate Clinical Workspace</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={onLogout} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={16} color="#64748B" />
              <Text style={styles.logoutBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(2, 132, 199, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.35)',
  },
  badgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    color: '#F8FAFC',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#94A3B8',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fieldLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#CBD5E1',
    marginTop: 12,
    marginBottom: 6,
  },
  requiredStar: {
    color: '#F43F5E',
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#475569',
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
  },
  logoutBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#94A3B8',
  },
});

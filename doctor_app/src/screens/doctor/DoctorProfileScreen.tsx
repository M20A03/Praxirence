import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { DoctorUser } from '../../types';
import { BrandLogoMobile } from '../../components/BrandLogoMobile';
import { mobileApi } from '../../services/api';

interface DoctorProfileScreenProps {
  doctor: DoctorUser;
  onLogout: () => void;
}

export const DoctorProfileScreen: React.FC<DoctorProfileScreenProps> = ({
  doctor,
  onLogout,
}) => {
  const [latencyMs, setLatencyMs] = useState<number>(55);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);

  useEffect(() => {
    checkHealth();
    loadBiometricSetting();
  }, []);

  const loadBiometricSetting = async () => {
    try {
      const val = await AsyncStorage.getItem('praxirence_biometric_enabled');
      if (val === 'true') setBiometricEnabled(true);
    } catch (e) {}
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (!hasHardware || !isEnrolled) {
          Alert.alert(
            'Biometrics Unavailable',
            'Your device does not have fingerprint or face authentication enrolled in system settings.'
          );
          return;
        }

        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify Biometric to Enable Doctor App Lock',
        });

        if (res.success) {
          setBiometricEnabled(true);
          await AsyncStorage.setItem('praxirence_biometric_enabled', 'true');
          Alert.alert('Lock Enabled', 'Biometric protection is now active for doctor consultations.');
        }
      } catch (err: any) {
        Alert.alert('Notice', 'Biometric setup: ' + err.message);
      }
    } else {
      setBiometricEnabled(false);
      await AsyncStorage.setItem('praxirence_biometric_enabled', 'false');
    }
  };

  const checkHealth = async () => {
    setChecking(true);
    try {
      const health = await mobileApi.checkHealth();
      setIsLive(health.healthy);
      setLatencyMs(health.latencyMs);
    } catch {
      setIsLive(false);
    } finally {
      setChecking(false);
    }
  };

  const handleLogoutPress = () => {
    Alert.alert(
      'Sign Out of Clinician Workspace',
      'Are you sure you want to log out? Any offline consultation drafts will remain encrypted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: onLogout },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Brand Header */}
      <View style={{ marginBottom: 16 }}>
        <BrandLogoMobile variant="header" size="sm" subtitleText="Clinician Intelligence Suite" />
      </View>

      {/* Doctor Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {doctor.name.replace('Dr. ', '').charAt(0)}
          </Text>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={13} color="#10b981" />
            <Text style={styles.verifiedText}>VERIFIED CLINICAL PRACTITIONER</Text>
          </View>
        </View>

        <Text style={styles.doctorName}>{doctor.name}</Text>
        <Text style={styles.specialtyText}>{doctor.specialty}</Text>
        <Text style={styles.clinicText}>{doctor.clinic_name}</Text>
      </View>

      {/* Clinical Credentials Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Physician Credentials</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="id-card-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Medical Registration Number</Text>
            <Text style={styles.infoValue}>{doctor.reg_number}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="mail-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Official Medical Email</Text>
            <Text style={styles.infoValue}>{doctor.email || 'doctor@praxirence.com'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="call-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Mobile Number</Text>
            <Text style={styles.infoValue}>{doctor.phone}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="business-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Primary Clinic / Hospital</Text>
            <Text style={styles.infoValue}>{doctor.clinic_name}</Text>
          </View>
        </View>
      </View>

      {/* Security & Zero Audio Retention Card */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Clinical Security & Privacy</Text>

        <View style={styles.securityRow}>
          <Ionicons name="trash-bin-outline" size={18} color="#10b981" />
          <View style={{ flex: 1 }}>
            <Text style={styles.securityHeading}>Zero Audio Retention Policy</Text>
            <Text style={styles.securityDesc}>
              Audio recordings are shredded from server memory immediately after transcription. No voice files are stored on disk.
            </Text>
          </View>
        </View>

        <View style={styles.securityRow}>
          <Ionicons name="lock-closed-outline" size={18} color="#10b981" />
          <View style={{ flex: 1 }}>
            <Text style={styles.securityHeading}>AES-256 Patient Data Encryption</Text>
            <Text style={styles.securityDesc}>
              All patient phone numbers, clinical summaries, and prescriptions are encrypted at rest using AES-256.
            </Text>
          </View>
        </View>

        <View style={styles.securityRow}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" />
          <View style={{ flex: 1 }}>
            <Text style={styles.securityHeading}>DPDP Act 2023 & ABDM Compliant</Text>
            <Text style={styles.securityDesc}>
              Full adherence to India Digital Personal Data Protection Act 2023 and Ayushman Bharat Digital Mission guidelines.
            </Text>
          </View>
        </View>

        <View style={[styles.securityRow, { alignItems: 'center', justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
            <Ionicons name="finger-print-outline" size={22} color="#0284C7" />
            <View style={{ flex: 1 }}>
              <Text style={styles.securityHeading}>Biometric Fingerprint / Face ID</Text>
              <Text style={styles.securityDesc}>
                Require biometric authentication before opening clinician workspace.
              </Text>
            </View>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={handleToggleBiometric}
            trackColor={{ false: '#E2E8F0', true: '#BAE6FD' }}
            thumbColor={biometricEnabled ? '#0284C7' : '#94A3B8'}
          />
        </View>
      </View>

      {/* Hospital Clinical System Status */}
      <View style={styles.sectionCard}>
        <View style={styles.telemetryHeader}>
          <Text style={styles.sectionTitle}>Hospital Network & ABDM Status</Text>
          <TouchableOpacity onPress={checkHealth} disabled={checking}>
            {checking ? (
              <ActivityIndicator size="small" color="#0ea5e9" />
            ) : (
              <Text style={styles.pingBtnText}>Refresh</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.telemetryBox}>
          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryLabel}>Clinical Cloud Server</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={[styles.statusDot, { backgroundColor: isLive ? '#10b981' : '#f59e0b' }]} />
              <Text style={[styles.telemetryVal, { color: isLive ? '#10b981' : '#f59e0b' }]}>
                {isLive ? 'Operational' : 'Offline Vault'}
              </Text>
            </View>
          </View>

          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryLabel}>ABDM Health Gateway</Text>
            <Text style={[styles.telemetryVal, { color: '#0284C7' }]}>Connected</Text>
          </View>

          <View style={styles.telemetryItem}>
            <Text style={styles.telemetryLabel}>Prescription Dispatch (WhatsApp)</Text>
            <Text style={[styles.telemetryVal, { color: '#25D366' }]}>Active</Text>
          </View>
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogoutPress}>
        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
        <Text style={styles.logoutBtnText}>Sign Out of Clinician Workspace</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>Praxirence Clinician Suite v1.0.0 (Build 2026.09)</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 50,
  },
  profileCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#0ea5e9',
  },
  avatarText: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    color: '#0ea5e9',
    fontWeight: '800',
  },
  badgeRow: {
    marginBottom: 8,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  verifiedText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: '#10b981',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  doctorName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    fontWeight: '800',
    textAlign: 'center',
  },
  specialtyText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: '#0ea5e9',
    marginTop: 2,
    fontWeight: '600',
  },
  clinicText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
    marginTop: 1,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  securityHeading: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  securityDesc: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  telemetryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pingBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#0ea5e9',
    fontWeight: '600',
  },
  telemetryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  telemetryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetryLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  telemetryVal: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginTop: 8,
  },
  logoutBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: '#ef4444',
    fontWeight: '700',
  },
  versionText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
});

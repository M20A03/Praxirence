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
  const [availableDays, setAvailableDays] = useState<string[]>(
    doctor.available_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  );
  const [startTime, setStartTime] = useState<string>(doctor.working_hours_start || '09:00');
  const [endTime, setEndTime] = useState<string>(doctor.working_hours_end || '18:00');
  const [unavailableDates, setUnavailableDates] = useState<string[]>(
    doctor.unavailable_dates || []
  );
  const [savingSchedule, setSavingSchedule] = useState<boolean>(false);

  useEffect(() => {
    checkHealth();
    loadBiometricSetting();
  }, []);

  const toggleDay = (day: string) => {
    if (availableDays.includes(day)) {
      if (availableDays.length === 1) {
        Alert.alert('Notice', 'At least one practicing day is required.');
        return;
      }
      setAvailableDays(availableDays.filter((d) => d !== day));
    } else {
      setAvailableDays([...availableDays, day]);
    }
  };

  const handleMarkLeaveToday = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (unavailableDates.includes(today)) {
      Alert.alert('Notice', 'Today is already marked as on leave.');
      return;
    }
    const updated = [...unavailableDates, today];
    setUnavailableDates(updated);
    await mobileApi.toggleDoctorLeave(today, 'add', doctor.id);
    Alert.alert('Leave Activated', `Marked ${today} as On Leave. Patients cannot book slots on this date.`);
  };

  const handleMarkLeaveTomorrow = async () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const tomorrow = d.toISOString().split('T')[0];
    if (unavailableDates.includes(tomorrow)) {
      Alert.alert('Notice', 'Tomorrow is already marked as on leave.');
      return;
    }
    const updated = [...unavailableDates, tomorrow];
    setUnavailableDates(updated);
    await mobileApi.toggleDoctorLeave(tomorrow, 'add', doctor.id);
    Alert.alert('Leave Activated', `Marked ${tomorrow} as On Leave. Patients cannot book slots on this date.`);
  };

  const handleCancelLeave = async (dateStr: string) => {
    const updated = unavailableDates.filter((d) => d !== dateStr);
    setUnavailableDates(updated);
    await mobileApi.toggleDoctorLeave(dateStr, 'remove', doctor.id);
    Alert.alert('Leave Cancelled', `Dr. ${doctor.name} is now available on ${dateStr}.`);
  };

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await mobileApi.updateDoctorSchedule(
        {
          available_days: availableDays,
          working_hours_start: startTime,
          working_hours_end: endTime,
          unavailable_dates: unavailableDates,
          clinic_address: doctor.clinic_address,
          city: doctor.city,
        },
        doctor.id
      );
      Alert.alert('Practice Schedule Saved', 'Your available days and consultation hours have been updated in the cloud.');
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save schedule: ' + e.message);
    } finally {
      setSavingSchedule(false);
    }
  };

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

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="location-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Clinic Location & Area</Text>
            <Text style={styles.infoValue}>
              {doctor.clinic_address || '12th Main, Indiranagar'}, {doctor.city || 'Bangalore'} ({doctor.state || 'Karnataka'})
            </Text>
          </View>
        </View>
      </View>

      {/* Practice Schedule & Availability Card */}
      <View style={styles.sectionCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={styles.sectionTitle}>Practice Schedule & Leave Calendar</Text>
          <View style={styles.liveSyncBadge}>
            <Ionicons name="cloud-done-outline" size={12} color="#059669" />
            <Text style={styles.liveSyncText}>Live Cloud Sync</Text>
          </View>
        </View>
        <Text style={styles.scheduleSubtitle}>
          Configure practice days, working hours, and out-of-office dates. Patients cannot book slots on leave days.
        </Text>

        {/* Practicing Days Toggle */}
        <Text style={styles.subHeadingLabel}>Weekly Practicing Days</Text>
        <View style={styles.daysRow}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
            const isActive = availableDays.includes(day);
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayPill, isActive && styles.dayPillActive]}
                onPress={() => toggleDay(day)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayPillText, isActive && styles.dayPillTextActive]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Working Hours */}
        <Text style={[styles.subHeadingLabel, { marginTop: 14 }]}>Clinic Consultation Hours</Text>
        <View style={styles.hoursRow}>
          <View style={styles.hourBox}>
            <Ionicons name="time-outline" size={16} color={Colors.primary} />
            <Text style={styles.hourBoxLabel}>Start: {startTime}</Text>
          </View>
          <Text style={{ color: Colors.textSecondary, fontWeight: '700' }}>→</Text>
          <View style={styles.hourBox}>
            <Ionicons name="time-outline" size={16} color={Colors.primary} />
            <Text style={styles.hourBoxLabel}>End: {endTime}</Text>
          </View>
        </View>

        {/* Leave / Out of Office Section */}
        <View style={styles.leaveSectionBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Ionicons name="calendar-outline" size={16} color="#d97706" />
            <Text style={styles.leaveSectionTitle}>Mark Out-of-Office / On Leave</Text>
          </View>
          <Text style={styles.leaveSectionDesc}>
            Quickly mark dates as unavailable. When marked on leave, patients attempting to book will see you are unavailable.
          </Text>

          <View style={styles.leaveQuickActionsRow}>
            <TouchableOpacity style={styles.quickLeaveBtn} onPress={handleMarkLeaveToday} activeOpacity={0.7}>
              <Ionicons name="airplane-outline" size={13} color="#b45309" />
              <Text style={styles.quickLeaveBtnText}>Mark Today On Leave</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickLeaveBtn} onPress={handleMarkLeaveTomorrow} activeOpacity={0.7}>
              <Ionicons name="calendar-clear-outline" size={13} color="#b45309" />
              <Text style={styles.quickLeaveBtnText}>Mark Tomorrow</Text>
            </TouchableOpacity>
          </View>

          {unavailableDates.length > 0 ? (
            <View style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6 }}>
                Active Leave Dates ({unavailableDates.length}):
              </Text>
              {unavailableDates.map((dt) => (
                <View key={dt} style={styles.leaveDateItem}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="close-circle" size={14} color="#ef4444" />
                    <Text style={styles.leaveDateText}>{dt} (Unavailable / On Leave)</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleCancelLeave(dt)}>
                    <Text style={styles.cancelLeaveText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noLeaveBox}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#10b981" />
              <Text style={styles.noLeaveText}>No active leaves scheduled • Practicing as normal</Text>
            </View>
          )}
        </View>

        {/* Save Schedule Button */}
        <TouchableOpacity
          style={[styles.saveScheduleBtn, savingSchedule && { opacity: 0.7 }]}
          onPress={handleSaveSchedule}
          disabled={savingSchedule}
          activeOpacity={0.8}
        >
          {savingSchedule ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="save-outline" size={16} color="#ffffff" />
              <Text style={styles.saveScheduleBtnText}>Save Practice Schedule</Text>
            </View>
          )}
        </TouchableOpacity>
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
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  verifiedText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: '#166534',
    letterSpacing: 0.2,
  },
  doctorName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  specialtyText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.primary,
    marginTop: 2,
  },
  clinicText: {
    fontFamily: FontFamily.regular,
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
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
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
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginTop: 1,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8,
  },
  securityHeading: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  securityDesc: {
    fontFamily: FontFamily.regular,
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
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
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
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  telemetryVal: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
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
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: '#ef4444',
  },
  versionText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  liveSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveSyncText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#059669',
  },
  scheduleSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 12,
    lineHeight: 16,
  },
  subHeadingLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  dayPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  dayPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayPillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  dayPillTextActive: {
    color: '#FFFFFF',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hourBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  hourBoxLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  leaveSectionBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  leaveSectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#92400E',
  },
  leaveSectionDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#78350F',
    lineHeight: 15,
    marginBottom: 8,
  },
  leaveQuickActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickLeaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingVertical: 7,
    borderRadius: 8,
  },
  quickLeaveBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#92400E',
  },
  leaveDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 4,
  },
  leaveDateText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#B91C1C',
  },
  cancelLeaveText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.primary,
  },
  noLeaveBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  noLeaveText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#047857',
  },
  saveScheduleBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  saveScheduleBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
});

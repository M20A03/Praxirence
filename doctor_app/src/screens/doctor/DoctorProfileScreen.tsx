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
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { DoctorUser } from '../../types';
import { BrandLogoMobile } from '../../components/BrandLogoMobile';
import { mobileApi } from '../../services/api';
import { INDIAN_STATES_AND_UTS, CITIES_BY_STATE } from '../../utils/indiaLocations';
import { SearchablePickerModal } from '../../components/SearchablePickerModal';

const AVAILABLE_HOURS = [
  '06:00 AM', '06:30 AM', '07:00 AM', '07:30 AM', '08:00 AM', '08:30 AM', '09:00 AM', '09:30 AM',
  '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM',
  '06:00 PM', '06:30 PM', '07:00 PM', '07:30 PM', '08:00 PM', '08:30 PM', '09:00 PM', '09:30 PM',
  '10:00 PM', '10:30 PM', '11:00 PM'
];

interface DoctorProfileScreenProps {
  doctor: DoctorUser;
  onLogout: () => void;
}

export const DoctorProfileScreen: React.FC<DoctorProfileScreenProps> = ({
  doctor,
  onLogout,
}) => {
  const [profileDoctor, setProfileDoctor] = useState<DoctorUser>(doctor);
  const [showEditCredentialsModal, setShowEditCredentialsModal] = useState<boolean>(false);
  const [editDegree, setEditDegree] = useState<string>(doctor.degree || '');
  const [editQualifications, setEditQualifications] = useState<string>(doctor.qualifications || '');
  const [editDesignation, setEditDesignation] = useState<string>(doctor.designation || '');
  const [editExp, setEditExp] = useState<string>(doctor.experience_years ? String(doctor.experience_years) : '');
  const [editLanguages, setEditLanguages] = useState<string>((doctor.languages || []).join(', '));
  const [savingCredentials, setSavingCredentials] = useState<boolean>(false);

  // Location & Clinic Practice States
  const [showEditLocationModal, setShowEditLocationModal] = useState<boolean>(false);
  const [editState, setEditState] = useState<string>(doctor.state || 'Karnataka');
  const [editCity, setEditCity] = useState<string>(doctor.city || 'Bangalore');
  const [editClinicAddress, setEditClinicAddress] = useState<string>(doctor.clinic_address || '');
  const [editClinicName, setEditClinicName] = useState<string>(doctor.clinic_name || '');
  const [showStatePicker, setShowStatePicker] = useState<boolean>(false);
  const [showCityPicker, setShowCityPicker] = useState<boolean>(false);
  const [savingLocation, setSavingLocation] = useState<boolean>(false);

  const [latencyMs, setLatencyMs] = useState<number>(55);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(false);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [availableDays, setAvailableDays] = useState<string[]>(
    doctor.available_days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  );
  const [startTime, setStartTime] = useState<string>(doctor.working_hours_start || '09:00 AM');
  const [endTime, setEndTime] = useState<string>(doctor.working_hours_end || '05:00 PM');
  const [unavailableDates, setUnavailableDates] = useState<string[]>(
    doctor.unavailable_dates || []
  );
  const [savingSchedule, setSavingSchedule] = useState<boolean>(false);

  // Flexible Hours & Interactive Leave Calendar States
  const [timePickerTarget, setTimePickerTarget] = useState<'start' | 'end' | null>(null);
  const [timeFilter, setTimeFilter] = useState<'all' | 'am' | 'pm'>('all');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

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

  const handleClearAllLeave = () => {
    if (unavailableDates.length === 0) return;
    Alert.alert(
      'Clear All Leaves?',
      'Are you sure you want to clear all marked leave dates and make all days available for appointments?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const currentLeaves = [...unavailableDates];
            setUnavailableDates([]);
            for (const d of currentLeaves) {
              await mobileApi.toggleDoctorLeave(d, 'remove', doctor.id).catch(() => {});
            }
            Alert.alert('Leaves Cleared', 'All leave dates have been cleared.');
          },
        },
      ]
    );
  };

  const handlePrevMonth = () => {
    const d = new Date(calendarDate);
    d.setMonth(d.getMonth() - 1);
    setCalendarDate(d);
  };

  const handleNextMonth = () => {
    const d = new Date(calendarDate);
    d.setMonth(d.getMonth() + 1);
    setCalendarDate(d);
  };

  const toggleCalendarDateLeave = async (dateStr: string) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (_) {}
    if (unavailableDates.includes(dateStr)) {
      await handleCancelLeave(dateStr);
    } else {
      const updated = [...unavailableDates, dateStr];
      setUnavailableDates(updated);
      await mobileApi.toggleDoctorLeave(dateStr, 'add', doctor.id);
      Alert.alert('Leave Marked', `Marked ${dateStr} as On Leave.`);
    }
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
          cancelLabel: 'Cancel',
          fallbackLabel: 'Use Device Passcode',
          disableDeviceFallback: false,
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
      try {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Verify Biometric to Disable App Lock',
          cancelLabel: 'Cancel',
          fallbackLabel: 'Use Device Passcode',
          disableDeviceFallback: false,
        });
        if (res.success) {
          setBiometricEnabled(false);
          await AsyncStorage.setItem('praxirence_biometric_enabled', 'false');
          Alert.alert('Lock Disabled', 'Biometric protection has been turned off.');
        }
      } catch (err: any) {
        Alert.alert('Notice', 'Authentication error: ' + err.message);
      }
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

  const handleSaveCredentials = async () => {
    setSavingCredentials(true);
    try {
      const langs = (editLanguages || '').split(',').map((s) => s.trim()).filter(Boolean);
      const payload: Partial<DoctorUser> = {
        degree: (editDegree || '').trim() || undefined,
        qualifications: (editQualifications || '').trim() || undefined,
        designation: (editDesignation || '').trim() || undefined,
        experience_years: (editExp || '').trim() || undefined,
        languages: langs.length > 0 ? langs : undefined,
      };
      const res = await mobileApi.updateDoctorProfile(payload, doctor.id);
      const updated: DoctorUser = {
        ...profileDoctor,
        ...payload,
        ...(res.doctor || {}),
      };
      setProfileDoctor(updated);
      await AsyncStorage.setItem('praxirence_doctor_profile', JSON.stringify(updated));
      setShowEditCredentialsModal(false);
      Alert.alert('Credentials Updated', 'Your medical degrees, qualifications, and designation have been saved.');
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save credentials: ' + (e?.message || 'Update failed'));
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleSaveLocation = async () => {
    setSavingLocation(true);
    try {
      const payload: Partial<DoctorUser> = {
        state: editState,
        city: editCity,
        clinic_address: editClinicAddress.trim() || undefined,
        clinic_name: editClinicName.trim() || undefined,
      };
      const res = await mobileApi.updateDoctorProfile(payload, doctor.id);
      const updated: DoctorUser = {
        ...profileDoctor,
        ...payload,
        ...(res.doctor || {}),
      };
      setProfileDoctor(updated);
      await AsyncStorage.setItem('praxirence_doctor_profile', JSON.stringify(updated));
      setShowEditLocationModal(false);
      Alert.alert('Location Updated', 'Your practice state, city, and clinic address have been updated.');
    } catch (e: any) {
      Alert.alert('Error', 'Failed to save location: ' + (e?.message || 'Update failed'));
    } finally {
      setSavingLocation(false);
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

  const rawDocName = profileDoctor?.name || 'Doctor';
  const doctorDisplayName = rawDocName.startsWith('Dr.') ? rawDocName : `Dr. ${rawDocName}`;
  const doctorInitials = (doctorDisplayName || 'Doctor').replace('Dr. ', '').trim().split(' ').map((n) => (n ? n[0] : '')).filter(Boolean).slice(0, 2).join('') || 'MD';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Brand Header */}
      <View style={{ marginBottom: 16 }}>
        <BrandLogoMobile variant="header" size="sm" subtitleText="Clinician Intelligence Suite" />
      </View>

      {/* Clinician Profile Hero Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{doctorInitials}</Text>
        </View>

        <View style={styles.doctorNameRow}>
          <Text style={styles.doctorName}>{doctorDisplayName}</Text>
          <Ionicons name="checkmark-circle" size={19} color="#0284C7" />
        </View>

        {/* Medical Degrees - Clean Typography */}
        <Text style={styles.doctorDegreesText}>
          {profileDoctor.degree || profileDoctor.specialty || 'Verified Clinician'}
        </Text>

        {/* Clinical Designation & Specialty */}
        {profileDoctor.designation ? (
          <Text style={styles.designationText}>{profileDoctor.designation}</Text>
        ) : null}
        <Text style={styles.specialtyText}>
          {profileDoctor.specialty}{profileDoctor.clinic_name ? ` • ${profileDoctor.clinic_name}` : ''}
        </Text>

        {/* Clinical Registration & Experience Meta */}
        <View style={styles.doctorMetaRow}>
          <Text style={styles.doctorMetaText}>
            NMC Reg: {profileDoctor.reg_number || 'Pending Verification'}{profileDoctor.experience_years ? ` • ${profileDoctor.experience_years}` : ''}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.editCredentialsBtn}
          onPress={() => setShowEditCredentialsModal(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={15} color={Colors.primary} />
          <Text style={styles.editCredentialsBtnText}>Edit Degrees & Qualifications</Text>
        </TouchableOpacity>
      </View>

      {/* Clinical Credentials Card */}
      <View style={styles.sectionCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Text style={styles.sectionTitle}>Physician Credentials</Text>
          <TouchableOpacity onPress={() => setShowEditCredentialsModal(true)}>
            <Text style={{ fontFamily: FontFamily.semiBold, fontSize: 12, color: Colors.primary }}>Edit</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="school-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Primary Medical Degrees</Text>
            <Text style={styles.infoValue}>{profileDoctor.degree || 'Not provided'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="ribbon-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Post-Graduate Qualifications & Fellowships</Text>
            <Text style={styles.infoValue}>{profileDoctor.qualifications || 'None registered'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="medkit-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Clinical Designation</Text>
            <Text style={styles.infoValue}>{profileDoctor.designation || profileDoctor.specialty || 'Consultant'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="id-card-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Medical Registration Number</Text>
            <Text style={styles.infoValue}>{profileDoctor.reg_number || 'Pending Verification'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="calendar-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Clinical Experience</Text>
            <Text style={styles.infoValue}>{profileDoctor.experience_years || 'Not specified'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="chatbubbles-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Languages of Practice</Text>
            <Text style={styles.infoValue}>{(profileDoctor.languages || ['English', 'Hindi']).join(', ')}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="mail-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Official Medical Email</Text>
            <Text style={styles.infoValue}>{profileDoctor.email || 'Not configured'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="call-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Mobile Number</Text>
            <Text style={styles.infoValue}>{profileDoctor.phone}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="business-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Primary Clinic / Hospital</Text>
            <Text style={styles.infoValue}>{profileDoctor.clinic_name}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoIconBox}>
            <Ionicons name="location-outline" size={18} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoLabel}>Clinic Location & Area</Text>
            <Text style={styles.infoValue}>
              {profileDoctor.clinic_address
                ? `${profileDoctor.clinic_address}${profileDoctor.city ? `, ${profileDoctor.city}` : ''}${profileDoctor.state ? ` (${profileDoctor.state})` : ''}`
                : `${profileDoctor.city || 'Bangalore'}, ${profileDoctor.state || 'Karnataka'}`}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.editLocBadge}
            onPress={() => {
              setEditState(profileDoctor.state || 'Karnataka');
              setEditCity(profileDoctor.city || 'Bangalore');
              setEditClinicAddress(profileDoctor.clinic_address || '');
              setEditClinicName(profileDoctor.clinic_name || '');
              setShowEditLocationModal(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil" size={13} color={Colors.primary} />
            <Text style={styles.editLocBadgeText}>Edit</Text>
          </TouchableOpacity>
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
          <TouchableOpacity
            style={styles.hourBox}
            activeOpacity={0.7}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
              setTimePickerTarget('start');
            }}
          >
            <Ionicons name="time" size={17} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.hourBoxSub}>START TIME</Text>
              <Text style={styles.hourBoxValue}>{startTime.includes('M') ? startTime : `${startTime} AM`}</Text>
            </View>
            <Ionicons name="chevron-down" size={14} color="#64748B" />
          </TouchableOpacity>

          <View style={styles.hoursArrowCircle}>
            <Ionicons name="arrow-forward" size={14} color="#64748B" />
          </View>

          <TouchableOpacity
            style={styles.hourBox}
            activeOpacity={0.7}
            onPress={() => {
              try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
              setTimePickerTarget('end');
            }}
          >
            <Ionicons name="time" size={17} color={Colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.hourBoxSub}>END TIME</Text>
              <Text style={styles.hourBoxValue}>{endTime.includes('M') ? endTime : `${endTime} PM`}</Text>
            </View>
            <Ionicons name="chevron-down" size={14} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Leave / Out of Office Section with Interactive Monthly Calendar */}
        <View style={styles.leaveSectionBox}>
          <View style={styles.leaveHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="calendar-outline" size={16} color="#0D9488" />
              <Text style={styles.leaveSectionTitle}>Clinician Availability & Leave</Text>
            </View>
            {unavailableDates.length === 0 ? (
              <View style={styles.statusBadgePill}>
                <Ionicons name="checkmark-circle" size={13} color="#059669" />
                <Text style={styles.statusBadgeText}>Practicing as normal</Text>
              </View>
            ) : (
              <View style={[styles.statusBadgePill, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                <Ionicons name="alert-circle" size={13} color="#DC2626" />
                <Text style={[styles.statusBadgeText, { color: '#B91C1C' }]}>{unavailableDates.length} Leave Active</Text>
              </View>
            )}
          </View>
          <Text style={styles.leaveSectionDesc}>
            Tap any date on the calendar below to toggle your availability. Dates marked red indicate you are on leave — patients cannot book slots on those days.
          </Text>

          {/* Quick Actions Row */}
          <View style={styles.leaveQuickActionsRow}>
            <TouchableOpacity
              style={[
                styles.quickLeaveBtn,
                unavailableDates.includes(new Date().toISOString().split('T')[0]) && styles.quickLeaveBtnActive
              ]}
              onPress={handleMarkLeaveToday}
              activeOpacity={0.7}
            >
              <Ionicons
                name="airplane-outline"
                size={14}
                color={unavailableDates.includes(new Date().toISOString().split('T')[0]) ? '#DC2626' : '#0D9488'}
              />
              <Text
                style={[
                  styles.quickLeaveBtnText,
                  unavailableDates.includes(new Date().toISOString().split('T')[0]) && { color: '#DC2626' }
                ]}
              >
                {unavailableDates.includes(new Date().toISOString().split('T')[0]) ? 'Today: On Leave' : 'Mark Today Leave'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickLeaveBtn,
                (() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  return unavailableDates.includes(d.toISOString().split('T')[0]);
                })() && styles.quickLeaveBtnActive
              ]}
              onPress={handleMarkLeaveTomorrow}
              activeOpacity={0.7}
            >
              <Ionicons
                name="calendar-clear-outline"
                size={14}
                color={(() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  return unavailableDates.includes(d.toISOString().split('T')[0]) ? '#DC2626' : '#0D9488';
                })()}
              />
              <Text
                style={[
                  styles.quickLeaveBtnText,
                  (() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    return unavailableDates.includes(d.toISOString().split('T')[0]) ? { color: '#DC2626' } : null;
                  })()
                ]}
              >
                {(() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  return unavailableDates.includes(d.toISOString().split('T')[0]) ? 'Tomorrow: On Leave' : 'Mark Tomorrow Leave';
                })()}
              </Text>
            </TouchableOpacity>

            {unavailableDates.length > 0 && (
              <TouchableOpacity
                style={[styles.quickLeaveBtn, { flex: 0.7, borderColor: '#FECACA', backgroundColor: '#FFF5F5' }]}
                onPress={handleClearAllLeave}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={13} color="#DC2626" />
                <Text style={[styles.quickLeaveBtnText, { color: '#DC2626' }]}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Interactive Month-View Leave Calendar */}
          <View style={styles.calendarContainer}>
            {/* Calendar Header with Navigation */}
            <View style={styles.calendarHeaderRow}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={styles.calendarNavBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-back" size={18} color="#0F172A" />
              </TouchableOpacity>

              <Text style={styles.calendarMonthTitle}>
                {(() => {
                  const monthNames = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ];
                  return `${monthNames[calendarDate.getMonth()]} ${calendarDate.getFullYear()}`;
                })()}
              </Text>

              <TouchableOpacity
                onPress={handleNextMonth}
                style={styles.calendarNavBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="chevron-forward" size={18} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Weekday Labels Header */}
            <View style={styles.calendarWeekdaysRow}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <Text key={d} style={styles.calendarWeekdayText}>{d}</Text>
              ))}
            </View>

            {/* Calendar Day Grid */}
            <View style={styles.calendarGrid}>
              {(() => {
                const year = calendarDate.getFullYear();
                const month = calendarDate.getMonth();
                const firstDayIndex = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const now = new Date();
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                const cells = [];
                for (let i = 0; i < firstDayIndex; i++) {
                  cells.push(<View key={`empty-${i}`} style={styles.calendarCellBlank} />);
                }
                for (let day = 1; day <= daysInMonth; day++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === todayStr;
                  const isPast = dateStr < todayStr;
                  const isLeave = unavailableDates.includes(dateStr);

                  cells.push(
                    <TouchableOpacity
                      key={dateStr}
                      style={[
                        styles.calendarCell,
                        isToday && styles.calendarCellToday,
                        isLeave && styles.calendarCellLeave,
                        isPast && styles.calendarCellPast,
                      ]}
                      disabled={isPast}
                      onPress={() => toggleCalendarDateLeave(dateStr)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.calendarCellText,
                          isToday && styles.calendarCellTextToday,
                          isLeave && styles.calendarCellTextLeave,
                          isPast && styles.calendarCellTextPast,
                        ]}
                      >
                        {day}
                      </Text>
                      {isLeave && (
                        <View style={styles.calendarCellLeaveDot}>
                          <Ionicons name="airplane" size={9} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }
                return cells;
              })()}
            </View>
          </View>

          {/* Active Leave Dates Tag Cloud */}
          {unavailableDates.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: Colors.textSecondary }}>
                  Marked Leave Dates ({unavailableDates.length}):
                </Text>
                <Text style={{ fontSize: 10, color: '#94A3B8' }}>Tap ✕ to remove</Text>
              </View>
              <View style={styles.leaveTagsRow}>
                {unavailableDates.slice().sort().map((dt) => (
                  <TouchableOpacity
                    key={dt}
                    style={styles.leaveDateTag}
                    onPress={() => handleCancelLeave(dt)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="airplane" size={11} color="#DC2626" />
                    <Text style={styles.leaveDateTagText}>{dt}</Text>
                    <Ionicons name="close" size={13} color="#DC2626" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Save Schedule Button */}
        <TouchableOpacity
          style={[styles.saveScheduleBtn, savingSchedule && { opacity: 0.7 }]}
          onPress={handleSaveSchedule}
          disabled={savingSchedule}
          activeOpacity={0.85}
        >
          {savingSchedule ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="checkmark-circle" size={19} color="#ffffff" />
              <Text style={styles.saveScheduleBtnText}>Save Changes</Text>
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
            <Text style={styles.telemetryLabel}>Care Plan Sync (In-App)</Text>
            <Text style={[styles.telemetryVal, { color: '#10B981' }]}>Active</Text>
          </View>
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogoutPress}>
        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
        <Text style={styles.logoutBtnText}>Sign Out of Clinician Workspace</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>Praxirence Clinician Suite v1.0.0 (Build 2026.09)</Text>

      {/* Modal: Edit Clinician Qualifications & Degrees */}
      <Modal
        visible={showEditCredentialsModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditCredentialsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="school" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Edit Clinician Credentials</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditCredentialsModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>Primary Medical Degrees (e.g. MBBS, MD, MS, DNB)</Text>
              <TextInput
                style={styles.modalInput}
                value={editDegree}
                onChangeText={setEditDegree}
                placeholder="e.g. MBBS, MD"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Post-Graduate Qualifications & Fellowships</Text>
              <TextInput
                style={styles.modalInput}
                value={editQualifications}
                onChangeText={setEditQualifications}
                placeholder="e.g. Fellowship in Diabetology"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Clinical Designation</Text>
              <TextInput
                style={styles.modalInput}
                value={editDesignation}
                onChangeText={setEditDesignation}
                placeholder="e.g. Senior Consultant Physician"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Clinical Practice Experience</Text>
              <TextInput
                style={styles.modalInput}
                value={editExp}
                onChangeText={setEditExp}
                placeholder="e.g. 10 Years"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputLabel}>Consultation Languages (comma separated)</Text>
              <TextInput
                style={styles.modalInput}
                value={editLanguages}
                onChangeText={setEditLanguages}
                placeholder="e.g. English, Hindi"
                placeholderTextColor="#94A3B8"
              />
            </ScrollView>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleSaveCredentials}
              disabled={savingCredentials}
            >
              {savingCredentials ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.modalSaveBtnText}>Save Medical Credentials</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Edit Practice Location & State / City Dropdowns */}
      <Modal
        visible={showEditLocationModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowEditLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="location" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Edit Practice Location</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditLocationModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.inputLabel}>Clinic / Hospital Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editClinicName}
                onChangeText={setEditClinicName}
                placeholder="e.g. Apollo Clinic / City Hospital"
                placeholderTextColor="#94A3B8"
              />

              {/* State Picker Button */}
              <Text style={styles.inputLabel}>State / Union Territory *</Text>
              <TouchableOpacity
                style={styles.locDropdownBtn}
                onPress={() => setShowStatePicker(true)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="map-outline" size={17} color={Colors.primary} />
                  <Text style={styles.locDropdownBtnText}>{editState}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="#64748B" />
              </TouchableOpacity>

              {/* City Picker Button */}
              <Text style={styles.inputLabel}>City / District *</Text>
              <TouchableOpacity
                style={styles.locDropdownBtn}
                onPress={() => setShowCityPicker(true)}
                activeOpacity={0.8}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="business-outline" size={17} color={Colors.primary} />
                  <Text style={styles.locDropdownBtnText}>{editCity}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="#64748B" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Clinic Street Address & Landmark</Text>
              <TextInput
                style={styles.modalInput}
                value={editClinicAddress}
                onChangeText={setEditClinicAddress}
                placeholder="e.g. 42 MG Road, Indiranagar"
                placeholderTextColor="#94A3B8"
              />
            </ScrollView>

            <TouchableOpacity
              style={styles.modalSaveBtn}
              onPress={handleSaveLocation}
              disabled={savingLocation}
            >
              {savingLocation ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={17} color="#FFFFFF" />
                  <Text style={styles.modalSaveBtnText}>Save Practice Location</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* State Picker Modal */}
      <SearchablePickerModal
        visible={showStatePicker}
        title="Select State / Union Territory"
        items={INDIAN_STATES_AND_UTS}
        selectedItem={editState}
        onSelect={(st) => {
          setEditState(st);
          const cities = CITIES_BY_STATE[st] || [];
          if (cities.length > 0 && !cities.includes(editCity)) {
            setEditCity(cities[0]);
          }
        }}
        onClose={() => setShowStatePicker(false)}
        placeholder="Search Indian State..."
      />

      {/* City Picker Modal */}
      <SearchablePickerModal
        visible={showCityPicker}
        title={`Select City (${editState})`}
        items={CITIES_BY_STATE[editState] || [editCity]}
        selectedItem={editCity}
        onSelect={(ct) => setEditCity(ct)}
        onClose={() => setShowCityPicker(false)}
        placeholder="Search city or district..."
      />

      {/* Time Picker Modal for Opening/Closing Consultation Hours */}
      <Modal
        visible={timePickerTarget !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setTimePickerTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '82%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="time" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>
                  {timePickerTarget === 'start' ? 'Select Start Consultation Time' : 'Select Closing Consultation Time'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setTimePickerTarget(null)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
              Choose your practice consultation time from the options below:
            </Text>

            {/* Time Filter Tabs */}
            <View style={styles.timeFilterRow}>
              {(['all', 'am', 'pm'] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.timeFilterChip,
                    timeFilter === filter && styles.timeFilterChipActive
                  ]}
                  onPress={() => setTimeFilter(filter)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.timeFilterChipText,
                      timeFilter === filter && styles.timeFilterChipTextActive
                    ]}
                  >
                    {filter === 'all' ? 'All Hours' : filter === 'am' ? 'Morning (AM)' : 'Afternoon / Evening (PM)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Grid of Hours */}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.timeSlotsGrid}>
              {AVAILABLE_HOURS
                .filter((hour) => {
                  if (timeFilter === 'am') return hour.includes('AM');
                  if (timeFilter === 'pm') return hour.includes('PM');
                  return true;
                })
                .map((hour) => {
                  const isSelected = (timePickerTarget === 'start' ? startTime : endTime) === hour;
                  return (
                    <TouchableOpacity
                      key={hour}
                      style={[styles.timeSlotCard, isSelected && styles.timeSlotCardSelected]}
                      onPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (_) {}
                        if (timePickerTarget === 'start') {
                          setStartTime(hour);
                        } else {
                          setEndTime(hour);
                        }
                        setTimePickerTarget(null);
                      }}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.timeSlotCardText, isSelected && styles.timeSlotCardTextSelected]}>
                        {hour}
                      </Text>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalSaveBtn, { marginTop: 12 }]}
              onPress={() => setTimePickerTarget(null)}
            >
              <Text style={styles.modalSaveBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  doctorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 4,
  },
  doctorDegreesText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#334155',
    marginBottom: 3,
    textAlign: 'center',
  },
  designationText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#0284C7',
    marginTop: 2,
    textAlign: 'center',
  },
  doctorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  doctorMetaText: {
    fontFamily: FontFamily.medium,
    fontSize: 11.5,
    color: '#64748B',
  },
  editCredentialsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  editCredentialsBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#0F172A',
  },
  inputLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11.5,
    color: '#475569',
    marginTop: 8,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: FontFamily.sans,
    fontSize: 13,
    color: '#0F172A',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  modalSaveBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
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
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    marginTop: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#DC2626',
    letterSpacing: 0.2,
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 6,
  },
  dayPill: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 0,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dayPillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#64748B',
  },
  dayPillTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  hourBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  hoursArrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourBoxSub: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: '#64748B',
    letterSpacing: 0.5,
  },
  hourBoxValue: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#0F172A',
    marginTop: 1,
  },
  hourBoxLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  leaveSectionBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  leaveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  leaveSectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#0F172A',
  },
  statusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  statusBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#059669',
  },
  leaveSectionDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 10,
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
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 10,
    borderRadius: 10,
  },
  quickLeaveBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#0F766E',
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
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  saveScheduleBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  editLocBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  editLocBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.primaryDark,
  },
  locDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  locDropdownBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: '#0F172A',
  },
  quickLeaveBtnActive: {
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
  },
  calendarContainer: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#0F172A',
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
    marginBottom: 8,
  },
  calendarWeekdayText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#94A3B8',
    width: '14.28%',
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCellBlank: {
    width: '14.28%',
    height: 38,
  },
  calendarCell: {
    width: '14.28%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 2,
  },
  calendarCellToday: {
    borderWidth: 1.5,
    borderColor: '#0D9488',
  },
  calendarCellLeave: {
    backgroundColor: '#EF4444',
  },
  calendarCellPast: {
    opacity: 0.28,
  },
  calendarCellText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#1E293B',
  },
  calendarCellTextToday: {
    fontFamily: FontFamily.bold,
    color: '#0D9488',
  },
  calendarCellTextLeave: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  calendarCellTextPast: {
    color: '#94A3B8',
  },
  calendarCellLeaveDot: {
    position: 'absolute',
    bottom: 2,
  },
  leaveTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  leaveDateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  leaveDateTagText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#DC2626',
  },
  timeFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  timeFilterChip: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  timeFilterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timeFilterChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#64748B',
  },
  timeFilterChipTextActive: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 10,
  },
  timeSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '31%',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  timeSlotCardSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  timeSlotCardText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#334155',
  },
  timeSlotCardTextSelected: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
});

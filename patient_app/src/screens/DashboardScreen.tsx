import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Image,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { PatientUser, Visit, MedicineItem, ReminderItem, VitalsRecord, QueueStatusResponse, FamilyMemberProfile } from '../types';
import { mobileApi } from '../services/api';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { patientRealtime } from '../services/realtime';
import { BrandLogoMobile } from '../components/BrandLogoMobile';
import { PillTrackerCard } from '../components/PillTrackerCard';
import { VitalsTrackerModal } from '../components/VitalsTrackerModal';
import { EmptyState } from '../components/EmptyState';
import {
  LiveQueueTrackerCard,
  VitalsTelemetryGrid,
  FollowupCheckinModule,
  ConsultationFeedbackModule,
} from '../components/dashboard';
import * as Haptics from 'expo-haptics';
import { NotificationService } from '../services/NotificationService';
import {
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  translateText,
} from '../utils/languageTranslations';

interface DashboardScreenProps {
  user: PatientUser;
  onNavigateToConsent: () => void;
  onNavigateToChatbot?: () => void;
  onNavigateToDoctors?: () => void;
  onNavigateToVisits?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  onNavigateToConsent,
  onNavigateToChatbot,
  onNavigateToDoctors,
  onNavigateToVisits,
}) => {

  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [takenReminders, setTakenReminders] = useState<Record<string, boolean>>({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number>(-1);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Just now');
  const [newPlanAlert, setNewPlanAlert] = useState<string | null>(null);

  // Real Vitals Tracking State
  const [vitals, setVitals] = useState<VitalsRecord>({
    bloodPressureSystolic: 120,
    bloodPressureDiastolic: 80,
    heartRate: 72,
    spo2: 98,
    bloodSugar: 96,
    recordedAt: 'Today',
    statusNote: 'Optimal / Steady',
  });
  const [showVitalsModal, setShowVitalsModal] = useState<boolean>(false);
  const [inputSys, setInputSys] = useState<string>('120');
  const [inputDia, setInputDia] = useState<string>('80');
  const [inputHr, setInputHr] = useState<string>('72');
  const [inputSpo2, setInputSpo2] = useState<string>('98');
  const [inputSugar, setInputSugar] = useState<string>('96');
  // Multilingual State
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>('en');
  const [showLangModal, setShowLangModal] = useState<boolean>(false);
  const [queueStatus, setQueueStatus] = useState<QueueStatusResponse | null>(null);

  // Family Member Management State
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberProfile[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('self');
  const [showAddFamilyModal, setShowAddFamilyModal] = useState<boolean>(false);
  const [newMemberName, setNewMemberName] = useState<string>('');
  const [newMemberRelation, setNewMemberRelation] = useState<'child' | 'spouse' | 'parent' | 'other'>('child');
  const [newMemberDob, setNewMemberDob] = useState<string>('');
  const [savingMember, setSavingMember] = useState<boolean>(false);

  // Doctor Leave / Reschedule Alert State
  const [pendingReschedules, setPendingReschedules] = useState<Visit[]>([]);
  const [showRescheduleModal, setShowRescheduleModal] = useState<boolean>(false);
  const [selectedRescheduleVisit, setSelectedRescheduleVisit] = useState<Visit | null>(null);
  const [rescheduleSlot, setRescheduleSlot] = useState<string>('10:00 AM');
  const [rescheduling, setRescheduling] = useState<boolean>(false);

  // Automated Post-Consultation Follow-Up Check-ins (Day 3 & Day 7)
  const [pendingCheckins, setPendingCheckins] = useState<any[]>([]);
  const [checkinStatus, setCheckinStatus] = useState<'feeling_better' | 'recovering' | 'same' | 'worse'>('feeling_better');
  const [checkinNotes, setCheckinNotes] = useState<string>('');
  const [submittingCheckin, setSubmittingCheckin] = useState<boolean>(false);
  const [checkinSubmittedSuccess, setCheckinSubmittedSuccess] = useState<string | null>(null);

  // Optional Doctor Experience Review State (Minimum 10 words, completely optional for patient reference)
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewText, setReviewText] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewSubmittedSuccess, setReviewSubmittedSuccess] = useState<string | null>(null);
  const [dismissedReviews, setDismissedReviews] = useState<Record<string, boolean>>({});

  useEffect(() => {
    AsyncStorage.getItem('@praxirence_patient_lang').then((saved) => {
      if (saved && ['en', 'hi', 'kn', 'bho', 'ur', 'ta', 'te', 'mr', 'bn', 'gu', 'pa', 'ml'].includes(saved)) {
        setCurrentLang(saved as SupportedLanguage);
      }
    });
    AsyncStorage.getItem('@praxirence_dismissed_reviews').then((saved) => {
      if (saved) {
        try {
          setDismissedReviews(JSON.parse(saved));
        } catch (_) {}
      }
    });
  }, []);

  const handleSelectLang = async (lang: SupportedLanguage) => {
    setCurrentLang(lang);
    setShowLangModal(false);
    await AsyncStorage.setItem('@praxirence_patient_lang', lang);
  };

  useEffect(() => {
    const onBackPress = () => {
      if (showAddFamilyModal) {
        setShowAddFamilyModal(false);
        return true;
      }
      if (showRescheduleModal) {
        setShowRescheduleModal(false);
        return true;
      }
      if (showVitalsModal) {
        setShowVitalsModal(false);
        return true;
      }
      if (showLangModal) {
        setShowLangModal(false);
        return true;
      }
      return false;
    };
    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [showAddFamilyModal, showRescheduleModal, showVitalsModal, showLangModal]);

  useEffect(() => {
    loadDashboardData();
    loadVitalsData();
    checkPushPermissions();
    measureLatency();

    // Connect Realtime WebSocket for live queue and prescription updates
    if (user?.id) {
      patientRealtime.connect(user.id);
    }

    const unsubQueue = patientRealtime.on('QUEUE_UPDATE', () => {
      loadDashboardDataSilently();
    });

    const unsubPrescription = patientRealtime.on('NEW_PRESCRIPTION', () => {
      loadDashboardDataSilently();
    });

    const unsubLeave = patientRealtime.on('DOCTOR_LEAVE', () => {
      loadDashboardDataSilently();
    });

    const unsubDelay = patientRealtime.on('DOCTOR_DELAY', () => {
      loadDashboardDataSilently();
    });

    // 10s auto-polling fallback if WebSocket disconnects
    const pollInterval = setInterval(() => {
      loadDashboardDataSilently();
    }, 10000);

    // Load today's persisted dose compliance
    const todayStr = new Date().toISOString().slice(0, 10);
    AsyncStorage.getItem(`@praxirence_doses_${user.id}_${todayStr}`).then((raw) => {
      if (raw) {
        try {
          setTakenReminders(JSON.parse(raw));
        } catch (_) {}
      }
    });

    return () => {
      unsubQueue();
      unsubPrescription();
      unsubLeave();
      unsubDelay();
      clearInterval(pollInterval);
    };
  }, [user.id]);

  const measureLatency = async () => {
    const health = await mobileApi.checkHealth();
    setIsLive(health.healthy);
    setLatencyMs(health.latencyMs);
  };

  const checkPushPermissions = async () => {
    const token = await registerForPushNotificationsAsync(user.id);
    if (token) {
      setNotificationsEnabled(true);
      if (user?.id) {
        mobileApi.updateFcmToken(user.id, token).catch(() => {});
      }
    }
  };

  const syncQueueStatusForVisits = async (visitList: Visit[]) => {
    const todayIso = new Date().toISOString().slice(0, 10);
    const activeAppt = visitList.find((v) => {
      const vDate = v.appointment_date || v.date?.slice(0, 10);
      return vDate === todayIso && ['scheduled', 'in_progress', 'draft'].includes(v.status);
    });

    if (activeAppt) {
      try {
        const qStatus = await mobileApi.getVisitQueueStatus(activeAppt.id);
        setQueueStatus(qStatus);
      } catch (e) {
        setQueueStatus({
          visit_id: activeAppt.id,
          doctor_id: activeAppt.doctor_id || '',
          doctor_name: activeAppt.doctor_name || 'Attending Physician',
          patient_id: user.id,
          patient_name: user.name,
          appointment_date: todayIso,
          time_slot: activeAppt.time_slot || '10:00 AM',
          token_number: activeAppt.token_number || 1,
          token_display: activeAppt.token_display || `PX-0${activeAppt.token_number || 1}`,
          current_serving_token: 'PX-01',
          current_serving_token_number: 1,
          patients_ahead: activeAppt.patients_ahead || 0,
          estimated_wait_mins: activeAppt.estimated_wait_mins || 0,
          status: activeAppt.status,
          clinic_name: activeAppt.clinic_name || 'Praxirence Centre',
          clinic_address: activeAppt.clinic_address || 'Clinic OPD',
        });
      }
    } else {
      setQueueStatus(null);
    }
  };

  const loadDashboardDataSilently = async () => {
    try {
      const [data, reschedules, checkins, reviews] = await Promise.all([
        mobileApi.getVisits(user.id),
        mobileApi.getPendingReschedules(user.id).catch(() => []),
        mobileApi.getPendingCheckins(user.id).catch(() => []),
        mobileApi.getPendingDoctorReviews(user.id).catch(() => []),
      ]);
      if (data && data.length > 0) {
        setVisits(data);
        syncQueueStatusForVisits(data);
      }
      setPendingReschedules(reschedules || []);
      setPendingCheckins(checkins || []);
      setPendingReviews(reviews || []);
    } catch (e) {}
  };

  const loadDashboardData = async () => {
    const cacheKey = `praxirence_careplan_${user.id}`;
    try {
      setLoading(true);
      const [data, family, reschedules, checkins, reviews] = await Promise.all([
        mobileApi.getVisits(user.id),
        mobileApi.getFamilyMembers(user.id).catch(() => []),
        mobileApi.getPendingReschedules(user.id).catch(() => []),
        mobileApi.getPendingCheckins(user.id).catch(() => []),
        mobileApi.getPendingDoctorReviews(user.id).catch(() => []),
      ]);
      setVisits(data || []);
      setFamilyMembers(family || []);
      setPendingReschedules(reschedules || []);
      setPendingCheckins(checkins || []);
      setPendingReviews(reviews || []);

      if (data && data.length > 0) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        // Automatically schedule native recurring alarm notifications
        NotificationService.scheduleCarePlanReminders(data).catch(() => {});
        syncQueueStatusForVisits(data);
      }
      setIsOfflineCached(false);
      setIsLive(true);
      setLastSyncedTime('Just now');
    } catch (err) {
      console.log('Network error loading care plan, checking local offline cache:', err);
      setIsLive(false);
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setVisits(parsed);
          setIsOfflineCached(true);
          NotificationService.scheduleCarePlanReminders(parsed).catch(() => {});
          syncQueueStatusForVisits(parsed);
        }
      } catch (cacheErr) {
        console.log('Error reading offline cache:', cacheErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddFamilyMember = async () => {
    if (!newMemberName.trim()) {
      Alert.alert('Required', 'Please enter the family member full name.');
      return;
    }
    setSavingMember(true);
    try {
      await mobileApi.addFamilyMember(
        user.id,
        newMemberName.trim(),
        newMemberRelation,
        newMemberDob.trim() || undefined
      );
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
      Alert.alert('Family Member Added', `${newMemberName.trim()} has been linked to your primary account.`);
      setShowAddFamilyModal(false);
      setNewMemberName('');
      setNewMemberDob('');
      const updatedList = await mobileApi.getFamilyMembers(user.id);
      setFamilyMembers(updatedList);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add family member');
    } finally {
      setSavingMember(false);
    }
  };

  const handleConfirmReschedule = async () => {
    if (!selectedRescheduleVisit) return;
    setRescheduling(true);
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      await mobileApi.rescheduleVisit(selectedRescheduleVisit.id, todayIso, rescheduleSlot);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
      Alert.alert('Rescheduled Successfully', `Your appointment has been rescheduled to ${rescheduleSlot}. Your queue token has been reserved.`);
      setShowRescheduleModal(false);
      setSelectedRescheduleVisit(null);
      loadDashboardData();
    } catch (e: any) {
      Alert.alert('Reschedule Failed', e.message || 'Could not reschedule visit');
    } finally {
      setRescheduling(false);
    }
  };

  const loadVitalsData = async () => {
    try {
      const v = await mobileApi.getVitals(user.id);
      setVitals(v);
      setInputSys(String(v.bloodPressureSystolic));
      setInputDia(String(v.bloodPressureDiastolic));
      setInputHr(String(v.heartRate));
      setInputSpo2(String(v.spo2));
      if (v.bloodSugar) setInputSugar(String(v.bloodSugar));
    } catch (e) {
      console.log('Error loading vitals:', e);
    }
  };

  const handleSaveVitals = async () => {
    const sys = parseInt(inputSys, 10) || 120;
    const dia = parseInt(inputDia, 10) || 80;
    const hr = parseInt(inputHr, 10) || 72;
    const o2 = parseInt(inputSpo2, 10) || 98;
    const sugar = parseInt(inputSugar, 10) || 96;

    let note = 'Normal / Steady';
    if (sys >= 140 || dia >= 90) note = 'Elevated BP Alert';
    else if (o2 < 95) note = 'Low SpO2 Alert';
    else if (sugar > 140) note = 'Elevated Glucose';

    const updated: VitalsRecord = {
      bloodPressureSystolic: sys,
      bloodPressureDiastolic: dia,
      heartRate: hr,
      spo2: o2,
      bloodSugar: sugar,
      recordedAt: 'Just now',
      statusNote: note,
    };

    setVitals(updated);
    await mobileApi.saveVitals(user.id, updated);
    setShowVitalsModal(false);
    Alert.alert('Vitals Recorded', `Status: ${note}. Your health trends have been updated.`);
  };

  const handleAnswerCheckin = async (checkin: any, statusChoice?: 'feeling_better' | 'recovering' | 'same' | 'worse') => {
    const finalStatus = statusChoice || checkinStatus;
    try {
      setSubmittingCheckin(true);
      const res = await mobileApi.submitFollowupResponse(
        checkin.visit_id,
        checkin.day,
        finalStatus,
        checkinNotes
      );
      if (res.success) {
        setPendingCheckins((prev) => prev.filter((c) => !(c.visit_id === checkin.visit_id && c.day === checkin.day)));
        setCheckinSubmittedSuccess(`Thank you! Your Day ${checkin.day} recovery update has been recorded and shared with ${checkin.doctor_name}.`);
        setCheckinNotes('');
        setTimeout(() => setCheckinSubmittedSuccess(null), 6000);
        loadDashboardDataSilently();
      } else {
        Alert.alert('Notice', res.message || 'Could not record update.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit health update.');
    } finally {
      setSubmittingCheckin(false);
    }
  };

  const handleDismissReview = async (doctorId: string) => {
    try {
      const updated = { ...dismissedReviews, [doctorId]: true };
      setDismissedReviews(updated);
      await AsyncStorage.setItem('@praxirence_dismissed_reviews', JSON.stringify(updated));
    } catch (_) {}
  };

  const handleSubmitReview = async (pendingReview: any) => {
    const words = reviewText.trim().split(/\s+/).filter(Boolean);
    if (words.length < 10) {
      Alert.alert(
        'Minimum 10 Words Required',
        `Please write at least 10 words to provide helpful reference for other patients. You currently have ${words.length} words.`
      );
      return;
    }
    try {
      setSubmittingReview(true);
      const res = await mobileApi.submitDoctorReview(pendingReview.doctor_id, {
        patient_id: user.id,
        patient_name: user.name,
        visit_id: pendingReview.visit_id,
        rating: reviewRating,
        review_text: reviewText.trim(),
      });
      if (res.success) {
        setReviewSubmittedSuccess(`Thank you! Your reference review for ${pendingReview.doctor_name} has been published.`);
        setReviewText('');
        setReviewRating(5);
        handleDismissReview(pendingReview.doctor_id);
        setPendingReviews((prev) => prev.filter((r) => r.doctor_id !== pendingReview.doctor_id));
        setTimeout(() => setReviewSubmittedSuccess(null), 6000);
        loadDashboardDataSilently();
      } else {
        Alert.alert('Notice', res.message || 'Could not submit review.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const latestVisit = visits.length > 0 ? visits[0] : null;
  const activeMedicines: MedicineItem[] = latestVisit?.medicines || [];
  const upcomingReminders: ReminderItem[] = latestVisit?.reminders || [];

  const handleMarkTaken = async (key: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (_) {}
    const todayStr = new Date().toISOString().slice(0, 10);
    const updated = { ...takenReminders, [key]: true };
    setTakenReminders(updated);
    try {
      await AsyncStorage.setItem(`@praxirence_doses_${user.id}_${todayStr}`, JSON.stringify(updated));
    } catch (_) {}
    Alert.alert('Dose Logged', 'Great job staying on track with your medication schedule!');
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView
        style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            measureLatency();
            loadDashboardData();
          }}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Brand Logo Top Header */}
      <View style={styles.topBrandBar}>
        <View style={{ flexShrink: 1 }}>
          <BrandLogoMobile variant="header" size="sm" subtitleText="Patient Care Portal" />
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <TouchableOpacity
            style={styles.langBadge}
            onPress={() => setShowLangModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={13} color={Colors.primaryDark} />
            <Text style={styles.langBadgeText}>
              {SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.nativeLabel || 'English'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.consentBadge,
              { backgroundColor: user.consent_status ? 'rgba(13, 148, 136, 0.12)' : 'rgba(217, 119, 6, 0.12)' }
            ]}
            onPress={onNavigateToConsent}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons
                name={user.consent_status ? "shield-checkmark" : "warning"}
                size={13}
                color={user.consent_status ? Colors.primaryDark : Colors.amber}
              />
              <Text style={[
                styles.consentBadgeText,
                { color: user.consent_status ? Colors.primaryDark : Colors.amber }
              ]}>
                {user.consent_status ? 'ABDM Active' : 'Consent Pending'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Patient Greeting with Today Emblem */}
      <View style={styles.greetingBox}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.greetingSub}>Today's Clinical Summary</Text>
            <Text style={styles.patientName}>Hello, {user.name}</Text>
          </View>
          <Image source={require('../../assets/features/today.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
        </View>
      </View>

      {/* Family Member Profile Selector Chips */}
      <View style={styles.familyBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.familyScroll}>
          <TouchableOpacity
            style={[styles.familyChip, selectedMemberId === 'self' && styles.familyChipActive]}
            onPress={() => setSelectedMemberId('self')}
          >
            <Ionicons name="person" size={13} color={selectedMemberId === 'self' ? '#FFFFFF' : '#0D9488'} />
            <Text style={[styles.familyChipText, selectedMemberId === 'self' && styles.familyChipTextActive]}>
              Self ({(user?.name || 'Patient').split(' ')[0]})
            </Text>
          </TouchableOpacity>

          {familyMembers.map((member) => (
            <TouchableOpacity
              key={member.id}
              style={[styles.familyChip, selectedMemberId === member.id && styles.familyChipActive]}
              onPress={() => setSelectedMemberId(member.id)}
            >
              <Ionicons name="people" size={13} color={selectedMemberId === member.id ? '#FFFFFF' : '#0D9488'} />
              <Text style={[styles.familyChipText, selectedMemberId === member.id && styles.familyChipTextActive]}>
                {member.name} ({member.family_relation})
              </Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.addFamilyChip}
            onPress={() => setShowAddFamilyModal(true)}
          >
            <Ionicons name="add-circle" size={14} color="#0D9488" />
            <Text style={styles.addFamilyChipText}>+ Add Member</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Doctor Emergency Leave / Reschedule Alert Banner */}
      {pendingReschedules.length > 0 && (
        <View style={styles.rescheduleAlertBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Ionicons name="warning" size={24} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.rescheduleAlertTitle}>Doctor On Leave — Reschedule Required</Text>
              <Text style={styles.rescheduleAlertDesc}>
                Dr. {pendingReschedules[0].doctor_name || 'Your Doctor'} had to take emergency leave. Your appointment slot can be rescheduled now with zero waiting fee.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.rescheduleActionBtn}
            onPress={() => {
              setSelectedRescheduleVisit(pendingReschedules[0]);
              setShowRescheduleModal(true);
            }}
          >
            <Text style={styles.rescheduleActionBtnText}>Choose Slot</Text>
            <Ionicons name="calendar" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Clinical Update Success Toast */}
      {checkinSubmittedSuccess && (
        <View style={styles.clinicalSuccessToast}>
          <Ionicons name="checkmark-circle" size={18} color="#059669" />
          <Text style={styles.clinicalSuccessToastText}>{checkinSubmittedSuccess}</Text>
        </View>
      )}

      {/* Consultation Feedback Success Toast */}
      {reviewSubmittedSuccess && (
        <View style={styles.clinicalSuccessToast}>
          <Ionicons name="checkmark-circle" size={18} color="#059669" />
          <Text style={styles.clinicalSuccessToastText}>{reviewSubmittedSuccess}</Text>
        </View>
      )}

      <FollowupCheckinModule
        pendingCheckins={pendingCheckins}
        checkinStatus={checkinStatus}
        setCheckinStatus={setCheckinStatus}
        checkinNotes={checkinNotes}
        setCheckinNotes={setCheckinNotes}
        submittingCheckin={submittingCheckin}
        onAnswerCheckin={handleAnswerCheckin}
        onNavigateToDoctors={onNavigateToDoctors}
      />

      {/* ==================== OPTIONAL DOCTOR CONSULTATION FEEDBACK ==================== */}
      <ConsultationFeedbackModule
        pendingReviews={pendingReviews}
        dismissedReviews={dismissedReviews}
        reviewRating={reviewRating}
        setReviewRating={setReviewRating}
        reviewText={reviewText}
        setReviewText={setReviewText}
        submittingReview={submittingReview}
        onSubmitReview={handleSubmitReview}
        onDismissReview={handleDismissReview}
      />

      {/* ==================== QUICK CLINICAL ACTIONS ==================== */}
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.cleanQuickCard}
          onPress={onNavigateToChatbot}
          activeOpacity={0.8}
        >
          <View style={[styles.quickCardIconCircle, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="chatbubbles-outline" size={20} color="#15803D" />
          </View>
          <Text style={styles.quickCardTitle}>Clinical Assistant</Text>
          <Text style={styles.quickCardSub}>Care & Medication Q&A</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cleanQuickCard}
          onPress={onNavigateToDoctors}
          activeOpacity={0.8}
        >
          <View style={[styles.quickCardIconCircle, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="people-outline" size={20} color="#1D4ED8" />
          </View>
          <Text style={styles.quickCardTitle}>Doctor Directory</Text>
          <Text style={styles.quickCardSub}>Verified Clinicians</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cleanQuickCard}
          onPress={onNavigateToVisits}
          activeOpacity={0.8}
        >
          <View style={[styles.quickCardIconCircle, { backgroundColor: '#F0FDFA' }]}>
            <Ionicons name="document-text-outline" size={20} color="#0F766E" />
          </View>
          <Text style={styles.quickCardTitle}>Care Plans</Text>
          <Text style={styles.quickCardSub}>Digital Prescriptions</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cleanQuickCard}
          onPress={onNavigateToConsent}
          activeOpacity={0.8}
        >
          <View style={[styles.quickCardIconCircle, { backgroundColor: '#FAF5FF' }]}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#7E22CE" />
          </View>
          <Text style={styles.quickCardTitle}>Consent & Privacy</Text>
          <Text style={styles.quickCardSub}>Encrypted Records</Text>
        </TouchableOpacity>
      </View>

      {/* ==================== LIVE OPD QUEUE POSITION TRACKER ==================== */}
      {queueStatus && <LiveQueueTrackerCard queueStatus={queueStatus} />}

      {/* Real Interactive Vitals Tracker Card */}
      <VitalsTelemetryGrid
        vitals={vitals}
        onLogVitalsPress={() => setShowVitalsModal(true)}
      />

      {/* New Care Plan Alert */}
      {newPlanAlert && (
        <TouchableOpacity
          style={styles.newPlanBanner}
          onPress={() => setNewPlanAlert(null)}
        >
          <Ionicons name="sparkles" size={20} color={Colors.primaryDark} style={{ marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.newPlanTitle}>New Care Plan Received!</Text>
            <Text style={styles.newPlanSubtitle}>{newPlanAlert}</Text>
          </View>
          <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      )}

      {/* Push Notification Banner */}
      {!notificationsEnabled && (
        <TouchableOpacity
          style={styles.notificationBanner}
          onPress={checkPushPermissions}
        >
          <Ionicons name="notifications" size={20} color={Colors.primary} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Enable Push Notifications</Text>
            <Text style={styles.bannerSubtitle}>Receive timely alerts so you never miss a dose.</Text>
          </View>
        </TouchableOpacity>
      )}


      {/* Daily Pill Tracker & Adherence Streak Checklist */}
      <PillTrackerCard
        lang={currentLang}
        medicines={activeMedicines}
        reminders={upcomingReminders}
      />

      {/* Next Upcoming Reminder Card */}
      {upcomingReminders.length > 0 && (
        <View style={styles.nextDoseCard}>
          <View style={styles.nextDoseHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="alarm-outline" size={13} color={Colors.primary} />
              <Text style={styles.nextDoseLabel}>NEXT SCHEDULED DOSE</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                style={styles.testAlarmPill}
                onPress={async () => {
                  try {
                    await NotificationService.triggerTestReminder(
                      upcomingReminders[0].medicine_name,
                      upcomingReminders[0].dosage
                    );
                    Alert.alert('Alarm Triggered', 'Medication reminder scheduled to fire in 2 seconds.');
                  } catch (_) {}
                }}
              >
                <Ionicons name="notifications-outline" size={12} color="#0284C7" />
                <Text style={styles.testAlarmPillText}>Test Alarm</Text>
              </TouchableOpacity>
              <Text style={styles.nextDoseTime}>{upcomingReminders[0].time}</Text>
            </View>
          </View>

          <Text style={styles.nextDoseMedicine}>
            {upcomingReminders[0].medicine_name} ({upcomingReminders[0].dosage})
          </Text>
          <Text style={styles.nextDoseInstructions}>
            {upcomingReminders[0].instructions || 'Take as advised by your doctor'}
          </Text>

          <TouchableOpacity
            style={[
              styles.takenButton,
              takenReminders[`0`] && styles.takenButtonDone
            ]}
            onPress={() => handleMarkTaken(`0`)}
            disabled={takenReminders[`0`]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              {takenReminders[`0`] && <Ionicons name="checkmark-circle" size={14} color="#ffffff" />}
              <Text style={styles.takenButtonText}>
                {takenReminders[`0`] ? 'Marked as Taken' : 'Mark as Taken'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Active Care Plan Summary */}
      {latestVisit?.diagnosis && (
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>Latest Doctor Consultation</Text>
            {onNavigateToVisits && (
              <TouchableOpacity onPress={onNavigateToVisits}>
                <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primary }}>
                  View Full Details →
                </Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.diagnosisCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.diagnosisLabel}>DIAGNOSIS</Text>
                <Text style={styles.diagnosisText}>{latestVisit.diagnosis}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Text style={styles.doctorInfo}>
                    {latestVisit.doctor_name ? (latestVisit.doctor_name.startsWith('Dr.') ? latestVisit.doctor_name : `Dr. ${latestVisit.doctor_name}`) : 'Attending Physician'}
                  </Text>
                  {Boolean((latestVisit as any).doctor_degree) && (
                    <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#C7D2FE' }}>
                      <Text style={{ fontFamily: FontFamily.semiBold, fontSize: 10, color: '#1E40AF' }}>
                        {(latestVisit as any).doctor_degree}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ backgroundColor: 'rgba(5, 150, 105, 0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ fontFamily: FontFamily.bold, fontSize: 10, color: '#059669' }}>Synced to App</Text>
              </View>
            </View>

            {/* Doctor's Plain-Language Explanation */}
            <View style={{ backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#BBF7D0' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <Ionicons name="chatbubble-ellipses" size={14} color="#15803D" />
                <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#166534' }}>
                  What Your Doctor Explained:
                </Text>
              </View>
              <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: '#1F2937', lineHeight: 18 }}>
                {latestVisit.patient_summary || `Your doctor assessed your symptoms and prescribed a personalized care plan for ${latestVisit.diagnosis}.`}
              </Text>
            </View>

            {/* Quick Home Care Advice */}
            {latestVisit.doctor_advice && (
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, padding: 10, marginTop: 8, borderWidth: 1, borderColor: '#FDE68A' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <Ionicons name="bulb-outline" size={14} color="#B45309" />
                  <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: '#92400E' }}>
                    Doctor's Home Advice:
                  </Text>
                </View>
                <Text style={{ fontFamily: FontFamily.medium, fontSize: FontSize.xs, color: '#78350F', lineHeight: 17 }}>
                  {latestVisit.doctor_advice}
                </Text>
              </View>
            )}

            {onNavigateToVisits && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primarySurface, borderRadius: 8, paddingVertical: 8, marginTop: 10 }}
                onPress={onNavigateToVisits}
              >
                <Ionicons name="volume-high-outline" size={15} color={Colors.primaryDark} />
                <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.xs, color: Colors.primaryDark }}>
                  Listen to Doctor's Advice & View Timings
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Active Medications List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Medications ({activeMedicines.length})</Text>
        </View>

        {activeMedicines.length === 0 ? (
          <EmptyState
            icon="medkit-outline"
            title="No Active Prescriptions"
            description="You currently have no active prescribed medications. When your doctor approves a care plan, your medicines and dosage timers will appear here."
            actionLabel={onNavigateToDoctors ? "Find a Specialist" : undefined}
            onAction={onNavigateToDoctors}
          />
        ) : (
          activeMedicines.map((med, index) => (
            <View key={index} style={styles.medCard}>
              <View style={styles.medHeader}>
                <Text style={styles.medName}>{med.name}</Text>
                <View style={styles.dosageBadge}>
                  <Text style={styles.dosageText}>{med.dosage}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.medTiming}>{med.frequency}</Text>
              </View>
              {med.instructions && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <Ionicons name="document-text-outline" size={13} color={Colors.textSecondary} />
                  <Text style={styles.medInstructions}>{med.instructions}</Text>
                </View>
              )}
              {med.duration_days && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
                  <Text style={styles.medDuration}>Duration: {med.duration_days} days</Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>

      {/* Upcoming Reminders List */}
      {upcomingReminders.length > 1 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Daily Reminders</Text>
          {upcomingReminders.map((rem, idx) => (
            <View key={idx} style={styles.reminderRow}>
              <View style={styles.reminderTimeBadge}>
                <Text style={styles.reminderTimeText}>{rem.time}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reminderMedName}>{rem.medicine_name} ({rem.dosage})</Text>
                <Text style={styles.reminderMedInst}>{rem.instructions || 'Daily dose'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>

    {/* Real Interactive Vitals Tracker Modal */}
    <VitalsTrackerModal
      visible={showVitalsModal}
      onClose={() => setShowVitalsModal(false)}
      lang={currentLang}
      onVitalsUpdated={(updatedVitals) => {
        setVitals({
          bloodPressureSystolic: updatedVitals.bloodPressureSys,
          bloodPressureDiastolic: updatedVitals.bloodPressureDia,
          heartRate: updatedVitals.heartRate,
          spo2: updatedVitals.spo2,
          bloodSugar: updatedVitals.bloodSugar,
          recordedAt: updatedVitals.recordedAt,
          statusNote: 'Optimal / Steady',
        });
      }}
    />

    {/* Language Selection Modal */}
    <Modal
      visible={showLangModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLangModal(false)}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={() => setShowLangModal(false)}
      >
        <View style={styles.langModalCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Ionicons name="globe-outline" size={22} color={Colors.primary} />
            <Text style={styles.langModalTitle}>Select Language / भाषा चुनें</Text>
          </View>
          <Text style={styles.langModalSub}>
            Choose your preferred language for medication schedules and care summaries.
          </Text>

          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={true}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = currentLang === lang.code;
              return (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.langOptionItem, isSelected && styles.langOptionSelected]}
                  onPress={() => handleSelectLang(lang.code)}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={[styles.langOptionNative, isSelected && { color: Colors.primaryDark }]}>
                      {lang.nativeLabel}
                    </Text>
                    <Text style={styles.langOptionEnglish}>{lang.label}</Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>

    {/* Add Family Member Modal */}
    <Modal
      visible={showAddFamilyModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowAddFamilyModal(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.actionModalCard}>
          <View style={styles.actionModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="people" size={20} color={Colors.primary} />
              <Text style={styles.actionModalTitle}>Add Family Member</Text>
            </View>
            <TouchableOpacity onPress={() => setShowAddFamilyModal(false)}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>
          <Text style={styles.actionModalSub}>
            Link family members under this phone number to manage their prescriptions and track live OPD appointments.
          </Text>

          <Text style={styles.fieldLabel}>FULL NAME *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Family member's full name"
            placeholderTextColor="#94A3B8"
            value={newMemberName}
            onChangeText={setNewMemberName}
          />

          <Text style={styles.fieldLabel}>RELATIONSHIP</Text>
          <View style={styles.relationRow}>
            {(['child', 'spouse', 'parent', 'other'] as const).map((rel) => (
              <TouchableOpacity
                key={rel}
                style={[styles.relationChip, newMemberRelation === rel && styles.relationChipActive]}
                onPress={() => setNewMemberRelation(rel)}
              >
                <Text style={[styles.relationChipText, newMemberRelation === rel && styles.relationChipTextActive]}>
                  {((rel || '').charAt(0).toUpperCase() + (rel || '').slice(1))}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>YEAR OF BIRTH / AGE (OPTIONAL)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. 1995 or 12 yrs"
            placeholderTextColor="#94A3B8"
            value={newMemberDob}
            onChangeText={setNewMemberDob}
          />

          <TouchableOpacity
            style={[styles.primaryActionBtn, savingMember && { opacity: 0.7 }]}
            onPress={handleAddFamilyMember}
            disabled={savingMember}
          >
            <Text style={styles.primaryActionBtnText}>
              {savingMember ? 'Saving...' : 'Link Family Member'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>

    {/* Doctor Leave Reschedule Modal */}
    <Modal
      visible={showRescheduleModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowRescheduleModal(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.actionModalCard}>
          <View style={styles.actionModalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="calendar" size={20} color="#DC2626" />
              <Text style={styles.actionModalTitle}>Reschedule Appointment</Text>
            </View>
            <TouchableOpacity onPress={() => setShowRescheduleModal(false)}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>
          <Text style={styles.actionModalSub}>
            Your doctor had an emergency. Select an available upcoming slot for Dr. {selectedRescheduleVisit?.doctor_name || 'your physician'}.
          </Text>

          <Text style={styles.fieldLabel}>SELECT NEW TIME SLOT</Text>
          <View style={styles.slotGrid}>
            {['09:30 AM', '10:30 AM', '11:30 AM', '02:00 PM', '04:30 PM', '06:00 PM'].map((slot) => (
              <TouchableOpacity
                key={slot}
                style={[styles.slotChip, rescheduleSlot === slot && styles.slotChipActive]}
                onPress={() => setRescheduleSlot(slot)}
              >
                <Text style={[styles.slotChipText, rescheduleSlot === slot && styles.slotChipTextActive]}>
                  {slot}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.primaryActionBtn, { backgroundColor: Colors.primary }, rescheduling && { opacity: 0.7 }]}
            onPress={handleConfirmReschedule}
            disabled={rescheduling}
          >
            <Text style={styles.primaryActionBtnText}>
              {rescheduling ? 'Rescheduling...' : 'Confirm Rescheduled Slot'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  familyBar: {
    marginBottom: 12,
  },
  familyScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  familyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  familyChipActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0F766E',
  },
  familyChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F766E',
  },
  familyChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addFamilyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#0D9488',
    backgroundColor: '#FFFFFF',
  },
  addFamilyChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0D9488',
  },
  rescheduleAlertBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  rescheduleAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },
  rescheduleAlertDesc: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 16,
  },
  rescheduleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#DC2626',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  rescheduleActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  delayAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
  },
  delayAlertText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  commuteAdvisoryCard: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  commuteAdvisoryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F766E',
    letterSpacing: 0.5,
  },
  commuteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  commuteBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F766E',
  },
  commuteAdvisoryDesc: {
    fontSize: 10,
    color: '#115E59',
    marginTop: 4,
    lineHeight: 14,
  },
  actionModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    width: '90%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  actionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  actionModalSub: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 16,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  relationRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  relationChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  relationChipActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0F766E',
  },
  relationChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  relationChipTextActive: {
    color: '#FFFFFF',
  },
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  slotChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  slotChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primaryDark,
  },
  slotChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  slotChipTextActive: {
    color: '#FFFFFF',
  },
  primaryActionBtn: {
    backgroundColor: '#0D9488',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  patientName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    lineHeight: 28,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  switchRoleBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  switchRoleBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  consentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  consentBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    letterSpacing: LetterSpacing.wide,
  },
  cloudStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  cloudStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cloudStatusText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.text,
  },
  cloudSyncTime: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
  },
  newPlanBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  newPlanIcon: {
    fontSize: 22,
  },
  newPlanTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.primaryLight,
  },
  newPlanSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  newPlanDismiss: {
    fontSize: 14,
    color: Colors.textMuted,
    padding: 4,
  },
  notificationBanner: {
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  bannerIcon: {
    fontSize: 24,
  },
  bannerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.cyan,
  },
  bannerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  offlineTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.amber,
  },
  offlineSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  nextDoseCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  nextDoseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextDoseLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    letterSpacing: LetterSpacing.wide,
    textTransform: 'uppercase',
  },
  nextDoseTime: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  testAlarmPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  testAlarmPillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#0284C7',
  },
  nextDoseMedicine: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    lineHeight: 26,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  nextDoseInstructions: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  takenButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  takenButtonDone: {
    backgroundColor: Colors.cardSubtle,
  },
  takenButtonText: {
    fontFamily: FontFamily.bold,
    color: '#ffffff',
    fontSize: FontSize.body,
    letterSpacing: LetterSpacing.wide,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
    marginBottom: 12,
  },
  diagnosisCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
  },
  diagnosisLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
  },
  diagnosisText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.text,
    marginTop: 4,
  },
  doctorInfo: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  medCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  medHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  medName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  dosageBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dosageText: {
    fontFamily: FontFamily.bold,
    color: Colors.primaryLight,
    fontSize: FontSize.xs,
  },
  medTiming: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.cyan,
    marginTop: 2,
  },
  medInstructions: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  medDuration: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  reminderTimeBadge: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  reminderTimeText: {
    fontFamily: FontFamily.bold,
    color: Colors.cyan,
    fontSize: FontSize.base,
  },
  reminderMedName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.text,
  },
  reminderMedInst: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  topBrandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
    borderRadius: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  greetingBox: {
    marginBottom: 16,
  },
  greetingSub: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: LetterSpacing.wide,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  quickActionCard: {
    flex: 1,
    minWidth: '46%',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
  },
  quickActionIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  featureAssetIcon: {
    width: 36,
    height: 36,
    marginBottom: 8,
  },
  quickActionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  quickActionSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  vitalsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  vitalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  vitalsHeaderIcon: {
    fontSize: 18,
  },
  vitalsHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  logVitalsButton: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logVitalsButtonText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vitalBox: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vitalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  vitalValue: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: Colors.text,
  },
  vitalUnit: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: Colors.textMuted,
  },
  vitalStatusPill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  vitalStatusText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#059669',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  modalInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.text,
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCancelText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
  },
  modalSaveButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modalSaveText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: '#FFFFFF',
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  langBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.primaryDark,
  },
  langModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  langModalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  langModalSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  langOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  langOptionSelected: {
    backgroundColor: '#F0FDFA',
    borderColor: Colors.primary,
  },
  langOptionNative: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  langOptionEnglish: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  liveQueueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  liveQueueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  liveQueueIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveQueuePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
  },
  liveQueueHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#0369A1',
    letterSpacing: LetterSpacing.wide,
  },
  liveQueueStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveQueueStatusBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
  },
  liveQueueDoctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  liveQueueDoctorText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  liveQueueMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  liveQueueMetricBox: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  liveQueueTokenBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  liveQueueServingBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  liveQueueWaitBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  liveQueueMetricLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    letterSpacing: LetterSpacing.wide,
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  liveQueueTokenText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    color: Colors.primaryDark,
  },
  liveQueueWaitText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
  },
  liveQueueSubLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  // Hospital-Grade Clinical Post-Consultation Follow-Up Telemetry Styles
  clinicalSuccessToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#166534',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  clinicalSuccessToastText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  clinicalFollowupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  clinicalFollowupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clinicalHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  clinicalHeaderBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#0F766E',
    letterSpacing: 0.3,
  },
  clinicalDoctorLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#64748B',
  },
  clinicalCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 22,
  },
  clinicalCardSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 14,
  },
  clinicalFieldLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clinicalStatusSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  clinicalStatusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  clinicalStatusPillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#475569',
  },
  statusPillImproved: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  statusTextImproved: {
    color: '#065F46',
    fontWeight: '700',
  },
  statusPillSteady: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
  },
  statusTextSteady: {
    color: '#0369A1',
    fontWeight: '700',
  },
  statusPillWorsening: {
    backgroundColor: '#FFF1F2',
    borderColor: '#F43F5E',
  },
  statusTextWorsening: {
    color: '#BE123C',
    fontWeight: '700',
  },
  clinicalReferralBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  clinicalReferralIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicalReferralTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#0F766E',
  },
  clinicalReferralDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#115E59',
    marginTop: 2,
    lineHeight: 16,
  },
  clinicalReferralActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F766E',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  clinicalReferralActionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  clinicalNoteInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
    marginBottom: 14,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  clinicalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F766E',
    minHeight: 48,
    borderRadius: 12,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  clinicalSubmitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },

  // Hospital-Grade Consultation Feedback Card Styles
  feedbackCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  feedbackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feedbackHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  feedbackHeaderBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#0F766E',
    letterSpacing: 0.3,
  },
  feedbackSkipAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  feedbackSkipActionText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#94A3B8',
  },
  feedbackPromptTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 22,
  },
  feedbackPromptSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 14,
  },
  feedbackStarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 14,
  },
  feedbackStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackStarTouch: {
    padding: 3,
  },
  feedbackRatingLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#475569',
  },
  feedbackTextarea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  wordCounterContainer: {
    marginBottom: 16,
  },
  wordCounterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  wordCounterText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#64748B',
  },
  wordCounterVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wordCounterVerifiedText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#059669',
  },
  wordCounterTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  wordCounterFill: {
    height: '100%',
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
  },
  feedbackActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedbackDismissBtn: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  feedbackDismissBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#64748B',
  },
  feedbackSubmitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  feedbackSubmitBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  feedbackSubmitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },

  // Clean Quick Action Cards (No Emojis, Pure Crisp Vector Aesthetics)
  cleanQuickCard: {
    flex: 1,
    minWidth: '46%',
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  quickCardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  quickCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#0F172A',
  },
  quickCardSub: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
});

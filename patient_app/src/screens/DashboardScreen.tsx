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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { PatientUser, Visit, MedicineItem, ReminderItem, VitalsRecord } from '../types';
import { mobileApi } from '../services/api';
import { registerForPushNotificationsAsync } from '../services/notifications';
import { BrandLogoMobile } from '../components/BrandLogoMobile';

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

  useEffect(() => {
    loadDashboardData();
    loadVitalsData();
    checkPushPermissions();
    measureLatency();

    // SRE Real-time sync engine (polls every 6 seconds)
    const unsubscribe = mobileApi.startRealtimeSync(user.id, (freshVisits, liveStatus) => {
      setIsLive(liveStatus);
      if (liveStatus && freshVisits.length > 0) {
        setVisits((prev) => {
          if (prev.length > 0 && freshVisits.length > prev.length) {
            setNewPlanAlert(`New consultation received from Dr. ${freshVisits[0].doctor_name || 'Provider'}`);
          }
          return freshVisits;
        });
        setLastSyncedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setIsOfflineCached(false);
      }
    }, 6000);

    return () => unsubscribe();
  }, [user.id]);

  const measureLatency = async () => {
    const health = await mobileApi.checkHealth();
    setIsLive(health.healthy);
    setLatencyMs(health.latencyMs);
  };

  const checkPushPermissions = async () => {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      setNotificationsEnabled(true);
    }
  };

  const loadDashboardData = async () => {
    const cacheKey = `praxirence_careplan_${user.id}`;
    try {
      setLoading(true);
      const data = await mobileApi.getVisits(user.id);
      setVisits(data);
      if (data && data.length > 0) {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
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
        }
      } catch (cacheErr) {
        console.log('Error reading offline cache:', cacheErr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
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
    Alert.alert('Vitals Recorded! 🩺', `Status: ${note}. Your health trends have been updated.`);
  };

  const latestVisit = visits.length > 0 ? visits[0] : null;
  const activeMedicines: MedicineItem[] = latestVisit?.medicines || [];
  const upcomingReminders: ReminderItem[] = latestVisit?.reminders || [];

  const handleMarkTaken = (key: string) => {
    setTakenReminders((prev) => ({ ...prev, [key]: true }));
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
        <BrandLogoMobile variant="header" size="sm" subtitleText="Patient Care Portal" />
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
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
                {user.consent_status ? 'ABDM Vault Active' : 'Consent Pending'}
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

      {/* Quick Action Navigation Grid with Bespoke Feature Emblems */}
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={[styles.quickActionCard, { backgroundColor: 'rgba(13, 148, 136, 0.08)', borderColor: 'rgba(13, 148, 136, 0.25)' }]}
          onPress={onNavigateToChatbot}
          activeOpacity={0.8}
        >
          <Image source={require('../../assets/features/chatbot.png')} style={styles.featureAssetIcon} resizeMode="contain" />
          <Text style={styles.quickActionTitle}>AI Health Bot</Text>
          <Text style={styles.quickActionSub}>Prescription Q&A</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionCard, { backgroundColor: 'rgba(37, 99, 235, 0.08)', borderColor: 'rgba(37, 99, 235, 0.25)' }]}
          onPress={onNavigateToDoctors}
          activeOpacity={0.8}
        >
          <Image source={require('../../assets/features/doctors.png')} style={styles.featureAssetIcon} resizeMode="contain" />
          <Text style={styles.quickActionTitle}>Find Doctors</Text>
          <Text style={styles.quickActionSub}>Verified Clinics</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionCard, { backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)' }]}
          onPress={onNavigateToVisits}
          activeOpacity={0.8}
        >
          <Image source={require('../../assets/features/visits.png')} style={styles.featureAssetIcon} resizeMode="contain" />
          <Text style={styles.quickActionTitle}>Active Rx</Text>
          <Text style={styles.quickActionSub}>Download PDF</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionCard, { backgroundColor: 'rgba(245, 158, 11, 0.08)', borderColor: 'rgba(245, 158, 11, 0.25)' }]}
          onPress={onNavigateToConsent}
          activeOpacity={0.8}
        >
          <Image source={require('../../assets/features/vault.png')} style={styles.featureAssetIcon} resizeMode="contain" />
          <Text style={styles.quickActionTitle}>Data Vault</Text>
          <Text style={styles.quickActionSub}>ABDM / HIPAA</Text>
        </TouchableOpacity>
      </View>

      {/* Real Interactive Vitals Tracker Card */}
      <View style={styles.vitalsCard}>
        <View style={styles.vitalsHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="pulse" size={20} color={Colors.primary} />
            <Text style={styles.vitalsHeaderTitle}>Vitals Monitoring</Text>
          </View>
          <TouchableOpacity
            style={styles.logVitalsButton}
            onPress={() => setShowVitalsModal(true)}
          >
            <Text style={styles.logVitalsButtonText}>+ Log Vitals</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.vitalsGrid}>
          {/* BP */}
          <View style={styles.vitalBox}>
            <Text style={styles.vitalLabel}>Blood Pressure</Text>
            <Text style={styles.vitalValue}>{vitals.bloodPressureSystolic}/{vitals.bloodPressureDiastolic}</Text>
            <Text style={styles.vitalUnit}>mmHg</Text>
            <View style={[styles.vitalStatusPill, { flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
              <Ionicons
                name={vitals.bloodPressureSystolic < 130 ? "checkmark-circle" : "warning"}
                size={11}
                color={vitals.bloodPressureSystolic < 130 ? Colors.primaryDark : Colors.amber}
              />
              <Text style={styles.vitalStatusText}>
                {vitals.bloodPressureSystolic < 130 ? 'Optimal' : 'Elevated'}
              </Text>
            </View>
          </View>

          {/* Pulse */}
          <View style={styles.vitalBox}>
            <Text style={styles.vitalLabel}>Heart Rate</Text>
            <Text style={styles.vitalValue}>{vitals.heartRate}</Text>
            <Text style={styles.vitalUnit}>bpm</Text>
            <View style={[styles.vitalStatusPill, { flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
              <Ionicons name="heart" size={11} color="#EF4444" />
              <Text style={styles.vitalStatusText}>Steady</Text>
            </View>
          </View>

          {/* SpO2 */}
          <View style={styles.vitalBox}>
            <Text style={styles.vitalLabel}>Blood Oxygen</Text>
            <Text style={styles.vitalValue}>{vitals.spo2}%</Text>
            <Text style={styles.vitalUnit}>SpO2</Text>
            <View style={[styles.vitalStatusPill, { flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
              <Ionicons
                name={vitals.spo2 >= 95 ? "checkmark-circle" : "warning"}
                size={11}
                color={vitals.spo2 >= 95 ? Colors.primaryDark : Colors.amber}
              />
              <Text style={styles.vitalStatusText}>
                {vitals.spo2 >= 95 ? 'Normal' : 'Low'}
              </Text>
            </View>
          </View>

          {/* Sugar */}
          <View style={styles.vitalBox}>
            <Text style={styles.vitalLabel}>Blood Glucose</Text>
            <Text style={styles.vitalValue}>{vitals.bloodSugar || 96}</Text>
            <Text style={styles.vitalUnit}>mg/dL</Text>
            <View style={styles.vitalStatusPill}>
              <Text style={styles.vitalStatusText}>Fasting</Text>
            </View>
          </View>
        </View>
      </View>


      {/* Offline Status Notice (Only visible when disconnected) */}
      {!isLive && isOfflineCached && (
        <View style={styles.cloudStatusBar}>
          <View style={styles.cloudStatusLeft}>
            <Ionicons name="cloud-offline-outline" size={16} color="#D97706" />
            <Text style={[styles.cloudStatusText, { color: '#B45309' }]}>
              Offline Mode • Showing cached records
            </Text>
          </View>
        </View>
      )}

      {/* New Care Plan Live Alert */}
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

      {/* Offline Mode Indicator Banner */}
      {isOfflineCached && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline" size={20} color={Colors.amber} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.offlineTitle}>Offline Mode Active</Text>
            <Text style={styles.offlineSubtitle}>Viewing locally cached care plan & active medications.</Text>
          </View>
        </View>
      )}


      {/* Next Upcoming Reminder Card */}
      {upcomingReminders.length > 0 && (
        <View style={styles.nextDoseCard}>
          <View style={styles.nextDoseHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="alarm-outline" size={13} color={Colors.primary} />
              <Text style={styles.nextDoseLabel}>NEXT SCHEDULED DOSE</Text>
            </View>
            <Text style={styles.nextDoseTime}>{upcomingReminders[0].time}</Text>
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
                <Text style={styles.doctorInfo}>Dr. {latestVisit.doctor_name || 'Care Team'}</Text>
              </View>
              <View style={{ backgroundColor: 'rgba(37, 211, 102, 0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                <Text style={{ fontFamily: FontFamily.bold, fontSize: 10, color: Colors.whatsapp }}>WhatsApp Sent</Text>
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No active medications right now.</Text>
            <Text style={styles.emptySubtext}>Your prescribed medications will appear here after your doctor consultation.</Text>
          </View>
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

    {/* Modal to Log Daily Vitals */}
    <Modal
      visible={showVitalsModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowVitalsModal(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContent}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <Ionicons name="pulse" size={20} color={Colors.primary} />
            <Text style={styles.modalTitle}>Record Daily Vitals</Text>
          </View>
          <Text style={styles.modalSubtitle}>Update your current physiological readings for your care team.</Text>

          <View style={styles.modalInputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Systolic BP (mmHg)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={inputSys}
                onChangeText={setInputSys}
                placeholder="120"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Diastolic BP (mmHg)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={inputDia}
                onChangeText={setInputDia}
                placeholder="80"
              />
            </View>
          </View>

          <View style={styles.modalInputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Heart Rate (bpm)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={inputHr}
                onChangeText={setInputHr}
                placeholder="72"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>SpO2 Oxygen (%)</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={inputSpo2}
                onChangeText={setInputSpo2}
                placeholder="98"
              />
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={styles.inputLabel}>Blood Glucose (mg/dL)</Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="numeric"
              value={inputSugar}
              onChangeText={setInputSugar}
              placeholder="96"
            />
          </View>

          <View style={styles.modalActionsRow}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowVitalsModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleSaveVitals}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <Ionicons name="checkmark-circle" size={15} color="#ffffff" />
                <Text style={styles.modalSaveText}>Save Vitals</Text>
              </View>
            </TouchableOpacity>
          </View>
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
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
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
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  switchRoleBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    letterSpacing: LetterSpacing.wide,
    color: Colors.primary,
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
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
  },
  nextDoseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  nextDoseLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.primaryLight,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
  },
  nextDoseTime: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.lg,
    color: Colors.cyan,
    letterSpacing: LetterSpacing.tight,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 16,
    borderRadius: 16,
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
    borderWidth: 1.5,
    borderColor: 'rgba(13, 148, 136, 0.2)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  logVitalsButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: Colors.primaryDark,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vitalBox: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vitalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  vitalValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
});

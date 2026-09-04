import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { PatientUser, Visit, MedicineItem, ReminderItem } from '../types';
import { mobileApi } from '../services/api';
import { registerForPushNotificationsAsync } from '../services/notifications';

interface DashboardScreenProps {
  user: PatientUser;
  onNavigateToConsent: () => void;
  onSwitchToDoctorRole?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  onNavigateToConsent,
  onSwitchToDoctorRole,
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

  useEffect(() => {
    loadDashboardData();
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

  const latestVisit = visits.length > 0 ? visits[0] : null;
  const activeMedicines: MedicineItem[] = latestVisit?.medicines || [];
  const upcomingReminders: ReminderItem[] = latestVisit?.reminders || [];

  const handleMarkTaken = (key: string) => {
    setTakenReminders((prev) => ({ ...prev, [key]: true }));
    Alert.alert('Dose Logged', 'Great job staying on track with your medication schedule! 👍');
  };

  return (
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
      {/* Patient Greeting & Status Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.patientName}>{user.name}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {onSwitchToDoctorRole && (
            <TouchableOpacity
              style={styles.switchRoleBadge}
              onPress={onSwitchToDoctorRole}
            >
              <Text style={styles.switchRoleBadgeText}>Doctor 👨‍⚕️</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.consentBadge,
              { backgroundColor: user.consent_status ? 'rgba(13, 148, 136, 0.12)' : 'rgba(217, 119, 6, 0.12)' }
            ]}
            onPress={onNavigateToConsent}
          >
            <Text style={[
              styles.consentBadgeText,
              { color: user.consent_status ? Colors.primaryDark : Colors.amber }
            ]}>
              {user.consent_status ? '✓ Consent' : '⚠️ Consent'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>


      {/* SRE Real-time Cloud Connection & Latency Bar */}
      <View style={styles.cloudStatusBar}>
        <View style={styles.cloudStatusLeft}>
          <View style={[styles.pulseDot, { backgroundColor: isLive ? '#10b981' : '#f59e0b' }]} />
          <Text style={styles.cloudStatusText}>
            {isLive ? `Live Sync Active • ${latencyMs > 0 ? latencyMs + 'ms' : 'Railway Cloud'}` : isOfflineCached ? 'Offline • Cached Vault Mode' : 'Connecting to Vault...'}
          </Text>
        </View>
        <Text style={styles.cloudSyncTime}>Synced: {lastSyncedTime}</Text>
      </View>

      {/* New Care Plan Live Alert */}
      {newPlanAlert && (
        <TouchableOpacity
          style={styles.newPlanBanner}
          onPress={() => setNewPlanAlert(null)}
        >
          <Text style={styles.newPlanIcon}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.newPlanTitle}>New Care Plan Received!</Text>
            <Text style={styles.newPlanSubtitle}>{newPlanAlert}</Text>
          </View>
          <Text style={styles.newPlanDismiss}>✕</Text>
        </TouchableOpacity>
      )}

      {/* Push Notification Banner */}
      {!notificationsEnabled && (
        <TouchableOpacity
          style={styles.notificationBanner}
          onPress={checkPushPermissions}
        >
          <Text style={styles.bannerIcon}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>Enable Push Notifications</Text>
            <Text style={styles.bannerSubtitle}>Receive timely alerts so you never miss a dose.</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Offline Mode Indicator Banner */}
      {isOfflineCached && (
        <View style={styles.offlineBanner}>
          <Text style={styles.bannerIcon}>📡</Text>
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
            <Text style={styles.nextDoseLabel}>⏰ NEXT SCHEDULED DOSE</Text>
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
            <Text style={styles.takenButtonText}>
              {takenReminders[`0`] ? '✓ Marked as Taken' : 'Mark as Taken'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Active Care Plan Summary */}
      {latestVisit?.diagnosis && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Consultation Care Plan</Text>
          <View style={styles.diagnosisCard}>
            <Text style={styles.diagnosisLabel}>DIAGNOSIS</Text>
            <Text style={styles.diagnosisText}>{latestVisit.diagnosis}</Text>
            <Text style={styles.doctorInfo}>Prescribed by Dr. {latestVisit.doctor_name || 'Care Team'}</Text>
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

              <Text style={styles.medTiming}>🕒 {med.frequency}</Text>
              {med.instructions && (
                <Text style={styles.medInstructions}>📝 {med.instructions}</Text>
              )}
              {med.duration_days && (
                <Text style={styles.medDuration}>📅 Duration: {med.duration_days} days</Text>
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
});

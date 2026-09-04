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
import { Colors } from '../theme/colors';
import { PatientUser, Visit, MedicineItem, ReminderItem } from '../types';
import { mobileApi } from '../services/api';
import { registerForPushNotificationsAsync } from '../services/notifications';

interface DashboardScreenProps {
  user: PatientUser;
  onNavigateToConsent: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  user,
  onNavigateToConsent,
}) => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [takenReminders, setTakenReminders] = useState<Record<string, boolean>>({});
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isOfflineCached, setIsOfflineCached] = useState(false);

  useEffect(() => {
    loadDashboardData();
    checkPushPermissions();
  }, []);

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
    } catch (err) {
      console.log('Network error loading care plan, checking local offline cache:', err);
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
            loadDashboardData();
          }}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Patient Greeting & Status Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.patientName}>{user.name}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.consentBadge,
            { backgroundColor: user.consent_status ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)' }
          ]}
          onPress={onNavigateToConsent}
        >
          <Text style={[
            styles.consentBadgeText,
            { color: user.consent_status ? Colors.primaryLight : Colors.amber }
          ]}>
            {user.consent_status ? '✓ Consent Active' : '⚠️ Consent Pending'}
          </Text>
        </TouchableOpacity>
      </View>

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
    fontSize: 14,
    color: Colors.textSecondary,
  },
  patientName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  consentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  consentBadgeText: {
    fontSize: 12,
    fontWeight: '700',
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
    fontSize: 14,
    fontWeight: '700',
    color: Colors.cyan,
  },
  bannerSubtitle: {
    fontSize: 12,
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
    fontSize: 13,
    fontWeight: '700',
    color: Colors.amber,
  },
  offlineSubtitle: {
    fontSize: 12,
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
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primaryLight,
    letterSpacing: 0.5,
  },
  nextDoseTime: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.cyan,
  },
  nextDoseMedicine: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  nextDoseInstructions: {
    fontSize: 13,
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
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
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
    fontSize: 17,
    fontWeight: '700',
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
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  diagnosisText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 4,
  },
  doctorInfo: {
    fontSize: 12,
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
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  dosageBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dosageText: {
    color: Colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
  },
  medTiming: {
    fontSize: 13,
    color: Colors.cyan,
    fontWeight: '600',
    marginTop: 2,
  },
  medInstructions: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  medDuration: {
    fontSize: 11,
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
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontSize: 12,
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
    color: Colors.cyan,
    fontSize: 14,
    fontWeight: '700',
  },
  reminderMedName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  reminderMedInst: {
    fontSize: 12,
    color: Colors.textMuted,
  },
});

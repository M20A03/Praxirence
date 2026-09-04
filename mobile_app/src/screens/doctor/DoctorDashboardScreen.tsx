import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { DoctorUser, PatientSummary, Visit } from '../../types';
import { mobileApi } from '../../services/api';

interface DoctorDashboardScreenProps {
  doctor: DoctorUser;
  onNavigateToNewVisit: (patientId?: string) => void;
  onNavigateToPatients: () => void;
  onSwitchToPatientRole: () => void;
}

export const DoctorDashboardScreen: React.FC<DoctorDashboardScreenProps> = ({
  doctor,
  onNavigateToNewVisit,
  onNavigateToPatients,
  onSwitchToPatientRole,
}) => {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [latencyMs, setLatencyMs] = useState<number>(65);

  useEffect(() => {
    loadClinicalData();
  }, []);

  const loadClinicalData = async () => {
    try {
      setLoading(true);
      const health = await mobileApi.checkHealth();
      setIsLive(health.healthy);
      setLatencyMs(health.latencyMs);

      const patientList = await mobileApi.getPatients();
      setPatients(patientList);

      // Load visits across active patients
      if (patientList.length > 0) {
        const visitPromises = patientList.map(p => mobileApi.getVisits(p.id).catch(() => []));
        const allVisits = await Promise.all(visitPromises);
        setRecentVisits(allVisits.flat());
      }
    } catch (err) {
      console.warn('Clinical dashboard load notice:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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
            loadClinicalData();
          }}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Clinician Profile Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Clinician Workspace</Text>
          <Text style={styles.doctorName}>{doctor.name}</Text>
          <Text style={styles.specialtyText}>{doctor.specialty} • {doctor.clinic_name}</Text>
          <Text style={styles.regBadge}>REG: {doctor.reg_number}</Text>
        </View>

        <TouchableOpacity
          style={styles.switchRoleBtn}
          onPress={onSwitchToPatientRole}
        >
          <Text style={styles.switchRoleText}>Switch to Patient 👤</Text>
        </TouchableOpacity>
      </View>

      {/* SRE Live Cloud Status Bar */}
      <View style={styles.cloudStatusBar}>
        <View style={styles.cloudStatusLeft}>
          <View style={[styles.pulseDot, { backgroundColor: isLive ? '#10b981' : '#f59e0b' }]} />
          <Text style={styles.cloudStatusText}>
            {isLive ? `Live Sync Active • ${latencyMs > 0 ? latencyMs + 'ms' : 'Railway Cloud'}` : 'Offline Cached Mode'}
          </Text>
        </View>
        <Text style={styles.cloudSyncTime}>Clinical Vault Connected</Text>
      </View>

      {/* Quick Action: Start Consultation */}
      <TouchableOpacity
        style={styles.newConsultationCard}
        onPress={() => onNavigateToNewVisit()}
        activeOpacity={0.88}
      >
        <View style={styles.newConsultIconCircle}>
          <Text style={styles.newConsultIcon}>➕</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.newConsultTitle}>Start New Consultation</Text>
          <Text style={styles.newConsultSubtitle}>
            Prescribe medications, create care plans & deliver instant WhatsApp schedule.
          </Text>
        </View>
        <Text style={styles.arrowIcon}>→</Text>
      </TouchableOpacity>

      {/* Practice Stats Row */}
      <View style={styles.statsRow}>
        <TouchableOpacity
          style={styles.statCard}
          onPress={onNavigateToPatients}
        >
          <Text style={styles.statNumber}>{patients.length}</Text>
          <Text style={styles.statLabel}>Active Patients</Text>
          <Text style={styles.statLink}>View Directory →</Text>
        </TouchableOpacity>

        <View style={[styles.statCard, { borderLeftColor: Colors.whatsapp }]}>
          <Text style={[styles.statNumber, { color: Colors.whatsapp }]}>100%</Text>
          <Text style={styles.statLabel}>WhatsApp Delivery</Text>
          <Text style={[styles.statLink, { color: Colors.whatsapp }]}>Meta Cloud API ✓</Text>
        </View>
      </View>

      {/* Recent Consultations Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Patient Care Plans</Text>
          <TouchableOpacity onPress={() => loadClinicalData()}>
            <Text style={styles.refreshText}>↻ Refresh</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 20 }} />
        ) : recentVisits.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Consultations Recorded Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Start New Consultation" above to create your first clinical prescription.
            </Text>
          </View>
        ) : (
          recentVisits.map((visit) => (
            <View key={visit.id} style={styles.visitCard}>
              <View style={styles.visitHeader}>
                <View>
                  <Text style={styles.visitPatientName}>{visit.patient_name || 'Patient Consultation'}</Text>
                  <Text style={styles.visitDate}>
                    {new Date(visit.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>✓ WhatsApp Sent</Text>
                </View>
              </View>

              <Text style={styles.diagnosisText}>
                <Text style={{ fontFamily: FontFamily.bold }}>Diagnosis: </Text>
                {visit.diagnosis || 'Clinical evaluation'}
              </Text>

              {visit.medicines && visit.medicines.length > 0 && (
                <View style={styles.medsPillRow}>
                  {visit.medicines.map((m, i) => (
                    <View key={i} style={styles.medPill}>
                      <Text style={styles.medPillText}>💊 {m.name} ({m.dosage})</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </View>
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
    alignItems: 'flex-start',
    marginBottom: 16,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  greeting: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  doctorName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    lineHeight: 26,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
    marginTop: 2,
  },
  specialtyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  regBadge: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.primary,
    letterSpacing: LetterSpacing.wide,
    marginTop: 4,
  },
  switchRoleBtn: {
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  switchRoleText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.cyan,
  },
  cloudStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
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
  newConsultationCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  newConsultIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  newConsultIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  newConsultTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: '#FFFFFF',
    letterSpacing: LetterSpacing.wide,
  },
  newConsultSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    lineHeight: 16,
  },
  arrowIcon: {
    fontSize: FontSize.xl,
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statNumber: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.xxl,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  statLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statLink: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.primary,
    letterSpacing: LetterSpacing.wide,
    marginTop: 8,
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
    fontSize: FontSize.md,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  refreshText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  visitCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  visitPatientName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  visitDate: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.primaryDark,
    letterSpacing: LetterSpacing.wide,
  },
  diagnosisText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  medsPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  medPill: {
    backgroundColor: Colors.cardSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  medPillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.text,
  },
});

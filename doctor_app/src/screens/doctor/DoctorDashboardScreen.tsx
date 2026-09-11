import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { DoctorUser, UpcomingScheduleItem, UpcomingScheduleResponse } from '../../types';
import { mobileApi } from '../../services/api';
import { BrandLogoMobile } from '../../components/BrandLogoMobile';

interface DoctorDashboardScreenProps {
  doctor: DoctorUser;
  onNavigateToNewVisit: (patientId?: string, patientName?: string, chiefComplaint?: string) => void;
  onNavigateToPatients: () => void;
}

export const DoctorDashboardScreen: React.FC<DoctorDashboardScreenProps> = ({
  doctor,
  onNavigateToNewVisit,
  onNavigateToPatients,
}) => {
  const [scheduleData, setScheduleData] = useState<UpcomingScheduleResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [isLive, setIsLive] = useState<boolean>(true);
  const [latencyMs, setLatencyMs] = useState<number>(65);

  // Walk-in modal
  const [showWalkInModal, setShowWalkInModal] = useState<boolean>(false);
  const [walkInName, setWalkInName] = useState<string>('');
  const [walkInPhone, setWalkInPhone] = useState<string>('+91');
  const [walkInComplaint, setWalkInComplaint] = useState<string>('');
  const [walkInTriage, setWalkInTriage] = useState<'Urgent' | 'Priority' | 'Routine'>('Routine');
  const [creatingWalkIn, setCreatingWalkIn] = useState<boolean>(false);

  useEffect(() => {
    loadUpcomingSchedule();
  }, []);

  const loadUpcomingSchedule = async () => {
    try {
      setLoading(true);
      const health = await mobileApi.checkHealth();
      setIsLive(health.healthy);
      setLatencyMs(health.latencyMs);

      const schedule = await mobileApi.getUpcomingSchedule();
      setScheduleData(schedule);
    } catch (err) {
      console.warn('Clinical schedule load notice:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddWalkIn = async () => {
    if (!walkInName.trim()) {
      Alert.alert('Missing Name', 'Please enter patient full name.');
      return;
    }
    if (walkInPhone.trim().length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number with country code.');
      return;
    }

    try {
      setCreatingWalkIn(true);
      const created = await mobileApi.createPatient({
        name: walkInName.trim(),
        phone: walkInPhone.trim(),
      });

      const nextTokenNum = (scheduleData?.queue.length || 0) + 1;
      const newQueueItem: UpcomingScheduleItem = {
        token: `T-0${nextTokenNum}`,
        patient_id: created.id,
        patient_name: created.name,
        patient_phone: created.phone,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        chief_complaint: walkInComplaint.trim() || 'Walk-in acute consultation',
        triage: walkInTriage,
        status: 'Waiting in Clinic',
        consent_status: true,
      };

      if (scheduleData) {
        setScheduleData({
          ...scheduleData,
          total_scheduled: scheduleData.total_scheduled + 1,
          in_waiting: scheduleData.in_waiting + 1,
          queue: [newQueueItem, ...scheduleData.queue],
        });
      }

      setShowWalkInModal(false);
      setWalkInName('');
      setWalkInComplaint('');
      Alert.alert('Patient Added', `${created.name} added to queue as Token ${newQueueItem.token}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add walk-in patient');
    } finally {
      setCreatingWalkIn(false);
    }
  };

  const getTriageColor = (triage: string) => {
    switch (triage) {
      case 'Urgent':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.35)' };
      case 'Priority':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.35)' };
      default:
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.35)' };
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
            loadUpcomingSchedule();
          }}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Brand Logo Top Header */}
      <View style={{ marginBottom: 16 }}>
        <BrandLogoMobile variant="header" size="sm" subtitleText="Clinician Intelligence Suite" />
      </View>

      {/* Clinician Profile Header */}
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.greeting}>Clinician Workspace</Text>
          <Text style={styles.doctorName}>{doctor.name}</Text>
          <Text style={styles.specialtyText}>{doctor.specialty} • {doctor.clinic_name}</Text>
          <Text style={styles.regBadge}>REG: {doctor.reg_number}</Text>
        </View>

        <View style={styles.verifiedDoctorBadge}>
          <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
          <Text style={styles.verifiedDoctorText}>Verified Clinician</Text>
        </View>
      </View>

      {/* Clinical Session Date & Room Header */}
      <View style={styles.dateHeaderRow}>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={14} color="#0284c7" />
          <Text style={styles.dateLabel}>{scheduleData?.date || 'Today'}</Text>
        </View>
        <View style={styles.activeRoomBadge}>
          <View style={styles.livePulseDot} />
          <Text style={styles.activeRoomText}>OPD Consultation Session</Text>
        </View>
      </View>

      {/* Live Clinical Queue Metrics */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}>
          <View style={[styles.statIconBadge, { backgroundColor: '#E0F2FE' }]}>
            <Ionicons name="people" size={18} color="#0284c7" />
          </View>
          <Text style={[styles.statNumber, { color: '#0369a1' }]}>{scheduleData?.total_scheduled || 0}</Text>
          <Text style={styles.statLabel}>Today's Queue</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
          <View style={[styles.statIconBadge, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="checkmark-done" size={18} color="#15803d" />
          </View>
          <Text style={[styles.statNumber, { color: '#15803d' }]}>{scheduleData?.completed || 0}</Text>
          <Text style={styles.statLabel}>Consulted</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
          <View style={[styles.statIconBadge, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="time" size={18} color="#d97706" />
          </View>
          <Text style={[styles.statNumber, { color: '#b45309' }]}>
            {(scheduleData?.total_scheduled || 0) - (scheduleData?.completed || 0)}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Primary Section Header: Upcoming Patient Schedule */}
      <View style={styles.sectionHeaderRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.sectionTitle}>Upcoming Patient Schedule</Text>
          <Text style={styles.sectionSubtitle}>Live triage queue ordered by appointment time</Text>
        </View>
        <TouchableOpacity
          style={styles.addWalkInButton}
          onPress={() => setShowWalkInModal(true)}
        >
          <Ionicons name="person-add" size={15} color="#ffffff" />
          <Text style={styles.addWalkInText}>Walk-In</Text>
        </TouchableOpacity>
      </View>

      {/* Loading Indicator */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading clinical queue...</Text>
        </View>
      ) : scheduleData && scheduleData.queue.length > 0 ? (
        /* Upcoming Patient Queue Cards */
        scheduleData.queue.map((item, index) => {
          const triageStyle = getTriageColor(item.triage);
          const isNext = index === 0;

          return (
            <View key={item.token + index} style={[styles.queueCard, isNext && styles.queueCardNext]}>
              {/* Card Header: Token, Time, Triage */}
              <View style={styles.queueCardHeader}>
                <View style={styles.tokenBox}>
                  <Text style={styles.tokenText}>{item.token}</Text>
                </View>
                <View style={styles.timeBox}>
                  <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
                  <Text style={styles.timeText}>{item.time}</Text>
                </View>

                <View style={[styles.triageBadge, { backgroundColor: triageStyle.bg, borderColor: triageStyle.border }]}>
                  <Text style={[styles.triageText, { color: triageStyle.text }]}>{item.triage}</Text>
                </View>

                {isNext && (
                  <View style={styles.nextUpBadge}>
                    <Text style={styles.nextUpText}>NEXT</Text>
                  </View>
                )}
              </View>

              {/* Patient Info */}
              <View style={styles.patientInfoRow}>
                <View style={styles.patientAvatar}>
                  <Text style={styles.avatarText}>{item.patient_name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>{item.patient_name}</Text>
                  <Text style={styles.patientSubtext}>
                    {item.patient_phone} • Status: <Text style={{ color: Colors.primary }}>{item.status}</Text>
                  </Text>
                </View>
              </View>

              {/* Chief Complaint Box */}
              <View style={styles.complaintBox}>
                <View style={styles.complaintHeader}>
                  <Ionicons name="pulse" size={14} color="#0ea5e9" />
                  <Text style={styles.complaintTitle}>Chief Complaint & Triage Notes:</Text>
                </View>
                <Text style={styles.complaintText}>{item.chief_complaint}</Text>
              </View>

              {/* Card CTA: Start Consultation */}
              <View style={styles.cardActionRow}>
                <TouchableOpacity
                  style={styles.startConsultBtn}
                  onPress={() => onNavigateToNewVisit(item.patient_id, item.patient_name, item.chief_complaint)}
                >
                  <Ionicons name="mic" size={16} color="#ffffff" />
                  <Text style={styles.startConsultBtnText}>Start Consultation</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.patientHistoryBtn}
                  onPress={onNavigateToPatients}
                >
                  <Ionicons name="folder-open-outline" size={16} color={Colors.textPrimary} />
                  <Text style={styles.patientHistoryBtnText}>History</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={42} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Upcoming Patients</Text>
          <Text style={styles.emptySubtitle}>All scheduled patients for today have been consulted.</Text>
          <TouchableOpacity style={styles.addWalkInButton} onPress={() => setShowWalkInModal(true)}>
            <Ionicons name="add" size={18} color="#ffffff" />
            <Text style={styles.addWalkInText}>Add Walk-In Patient</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Directory & Past Care Plans Navigation Bar */}
      <View style={styles.patientsDirectoryCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.directoryCardTitle}>Patient Care Plans & History</Text>
          <Text style={styles.directoryCardSubtitle}>
            Browse visited patients to view past verified care plans, prescriptions, and advice.
          </Text>
        </View>
        <TouchableOpacity style={styles.viewDirectoryBtn} onPress={onNavigateToPatients}>
          <Text style={styles.viewDirectoryBtnText}>View Directory</Text>
          <Ionicons name="chevron-forward" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Walk-In Modal */}
      <Modal visible={showWalkInModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Walk-In Patient</Text>
              <TouchableOpacity onPress={() => setShowWalkInModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Patient Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Ramesh Chandra"
              placeholderTextColor={Colors.textSecondary}
              value={walkInName}
              onChangeText={setWalkInName}
            />

            <Text style={styles.inputLabel}>Mobile Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="+919876543210"
              placeholderTextColor={Colors.textSecondary}
              value={walkInPhone}
              onChangeText={setWalkInPhone}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Chief Complaint / Symptoms</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="e.g. Fever 102°F, throat pain, headache"
              placeholderTextColor={Colors.textSecondary}
              value={walkInComplaint}
              onChangeText={setWalkInComplaint}
              multiline
            />

            <Text style={styles.inputLabel}>Triage Priority</Text>
            <View style={styles.triageSelectRow}>
              {(['Routine', 'Priority', 'Urgent'] as const).map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[styles.triageOptionBtn, walkInTriage === lvl && styles.triageOptionBtnActive]}
                  onPress={() => setWalkInTriage(lvl)}
                >
                  <Text style={[styles.triageOptionText, walkInTriage === lvl && styles.triageOptionTextActive]}>
                    {lvl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalSubmitBtn}
              onPress={handleAddWalkIn}
              disabled={creatingWalkIn}
            >
              {creatingWalkIn ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                  <Text style={styles.modalSubmitBtnText}>Add To Clinical Queue</Text>
                </>
              )}
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
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  greeting: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.primary,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  doctorName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  specialtyText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  regBadge: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  verifiedDoctorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  verifiedDoctorText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  dateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dateLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: '#0369A1',
    fontWeight: '700',
  },
  activeRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
  },
  activeRoomText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#15803D',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  statLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  addWalkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addWalkInText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#ffffff',
    fontWeight: '600',
  },
  queueCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  queueCardNext: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(14, 165, 233, 0.05)',
  },
  queueCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  tokenBox: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tokenText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.sm,
    color: '#4F46E5',
    fontWeight: '700',
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  triageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  triageText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  nextUpBadge: {
    marginLeft: 'auto',
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  nextUpText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 1,
  },
  patientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: '700',
  },
  patientName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  patientSubtext: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  complaintBox: {
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  complaintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  complaintTitle: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: '#0ea5e9',
    fontWeight: '600',
  },
  complaintText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  startConsultBtn: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  startConsultBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: '#ffffff',
    fontWeight: '700',
  },
  patientHistoryBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  patientHistoryBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  patientsDirectoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
    gap: 12,
  },
  directoryCardTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  directoryCardSubtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  viewDirectoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  viewDirectoryBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#ffffff',
    fontWeight: '700',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  inputLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  triageSelectRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    marginBottom: 20,
  },
  triageOptionBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  triageOptionBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  triageOptionText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  triageOptionTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalSubmitBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: '#ffffff',
    fontWeight: '700',
  },
});

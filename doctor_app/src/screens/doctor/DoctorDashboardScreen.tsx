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
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { DoctorUser, UpcomingScheduleItem, UpcomingScheduleResponse } from '../../types';
import { mobileApi } from '../../services/api';
import { doctorRealtime } from '../../services/realtime';
import { BrandLogoMobile } from '../../components/BrandLogoMobile';
import { EmptyState } from '../../components/EmptyState';

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
  const [callingNext, setCallingNext] = useState<boolean>(false);
  const [delayMins, setDelayMins] = useState<number>(doctor?.current_delay_mins || 0);
  const [broadcastingDelay, setBroadcastingDelay] = useState<boolean>(false);

  // Hardware Back button protection for walk-in modal
  useEffect(() => {
    if (!showWalkInModal) return;
    const onBackPress = () => {
      setShowWalkInModal(false);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showWalkInModal]);

  useEffect(() => {
    loadUpcomingSchedule();

    // 1. Connect Realtime WebSocket for live queue and appointment updates
    if (doctor?.id) {
      doctorRealtime.connect(doctor.id);
    }

    const unsubQueue = doctorRealtime.on('QUEUE_UPDATE', () => {
      loadUpcomingScheduleSilently();
    });

    const unsubBooked = doctorRealtime.on('APPOINTMENT_BOOKED', () => {
      loadUpcomingScheduleSilently();
    });

    const unsubPill = doctorRealtime.on('PILL_TAKEN', () => {
      loadUpcomingScheduleSilently();
    });

    // 2. Background Polling Fallback (every 10s) if WebSocket disconnects
    const pollInterval = setInterval(() => {
      loadUpcomingScheduleSilently();
    }, 10000);

    return () => {
      unsubQueue();
      unsubBooked();
      unsubPill();
      clearInterval(pollInterval);
    };
  }, [doctor?.id]);

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

  const loadUpcomingScheduleSilently = async () => {
    try {
      const schedule = await mobileApi.getUpcomingSchedule();
      if (schedule && schedule.queue) {
        setScheduleData(schedule);
      }
    } catch (err) {
      // Background poll notice
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
      // 1. Create or retrieve patient
      const created = await mobileApi.createPatient({
        name: walkInName.trim(),
        phone: walkInPhone.trim(),
      });

      // 2. Persist Walk-in Visit to PostgreSQL database
      const walkInResult = await mobileApi.createWalkInVisit({
        patientId: created.id,
        doctorId: doctor.id,
        chiefComplaint: walkInComplaint.trim() || 'Walk-in acute consultation',
        triage: walkInTriage,
      });

      const assignedToken = walkInResult.token || `PX-0${(scheduleData?.queue.length || 0) + 1}`;
      const newQueueItem: UpcomingScheduleItem = {
        token: assignedToken,
        patient_id: created.id,
        patient_name: created.name,
        patient_phone: created.phone,
        time: walkInResult.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        chief_complaint: walkInComplaint.trim() || 'Walk-in acute consultation',
        triage: (walkInResult.triage as any) || walkInTriage,
        status: 'Waiting in Clinic',
        consent_status: true,
      };

      if (scheduleData) {
        setScheduleData({
          ...scheduleData,
          total_scheduled: scheduleData.total_scheduled + 1,
          in_waiting: scheduleData.in_waiting + 1,
          queue: [newQueueItem, ...scheduleData.queue.filter(q => q.patient_id !== created.id)],
        });
      }

      setShowWalkInModal(false);
      setWalkInName('');
      setWalkInComplaint('');
      Alert.alert('Patient Added to Live Queue', `${created.name} assigned Token ${assignedToken}.`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add walk-in patient');
    } finally {
      setCreatingWalkIn(false);
    }
  };

  const getTriageColor = (triage: string) => {
    switch (triage) {
      case 'Urgent':
        return { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' };
      case 'Priority':
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
      default:
        return { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' };
    }
  };

  const handleCallNext = async () => {
    try {
      setCallingNext(true);
      const res = await mobileApi.callNextPatient(doctor.id);
      if (res.success) {
        Alert.alert(
          'Patient Called Into Chamber',
          `Token ${res.token_called || 'Next'} (${res.patient_name || 'Patient'}) called into consultation room.`
        );
        await loadUpcomingScheduleSilently();
        if (res.serving_visit_id && res.patient_name) {
          onNavigateToNewVisit(res.serving_visit_id, res.patient_name, 'Consultation');
        }
      }
    } catch (err: any) {
      Alert.alert('Queue Notice', err.message || 'No patients currently waiting in queue.');
    } finally {
      setCallingNext(false);
    }
  };

  const handleStandby = async (item: UpcomingScheduleItem) => {
    if (!item.visit_id) {
      Alert.alert('Notice', 'Cannot defer walk-in without persistent appointment record.');
      return;
    }
    try {
      await mobileApi.advanceQueue(item.visit_id, 'deferred');
      Alert.alert('Patient Moved to Standby', `${item.patient_name} (${item.token}) deferred. Next patient can be called.`);
      loadUpcomingScheduleSilently();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not move patient to standby');
    }
  };

  const handleRecall = async (item: UpcomingScheduleItem) => {
    if (!item.visit_id) return;
    try {
      await mobileApi.recallPatient(item.visit_id);
      Alert.alert('Patient Recalled', `${item.patient_name} (${item.token}) restored to immediate active queue.`);
      loadUpcomingScheduleSilently();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not recall patient');
    }
  };

  const handleBroadcastDelay = async (minutes: number) => {
    try {
      setBroadcastingDelay(true);
      const res = await mobileApi.broadcastDoctorDelay(doctor.id, minutes);
      setDelayMins(minutes);
      Alert.alert(
        minutes > 0 ? 'Delay Broadcasted' : 'Schedule Reset',
        minutes > 0
          ? `Broadcasted a ${minutes}-minute running delay to ${res.affected_patients_count || 0} waiting patients.`
          : 'Clinic status reset to On Schedule.'
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to broadcast clinic delay');
    } finally {
      setBroadcastingDelay(false);
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
          <Text style={styles.greeting}>Attending Physician</Text>
          <Text style={styles.doctorName}>{doctor.name}</Text>
          <Text style={styles.specialtyText}>{doctor.specialty} • {doctor.clinic_name}</Text>
          <Text style={styles.regBadge}>Lic. No: {doctor.reg_number}</Text>
        </View>

        <View style={styles.verifiedDoctorBadge}>
          <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
          <Text style={styles.verifiedDoctorText}>Verified</Text>
        </View>
      </View>

      {/* Clinical Session Date & Room Header */}
      <View style={styles.dateHeaderRow}>
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.dateLabel}>{scheduleData?.date || 'Today'}</Text>
        </View>
        <View style={styles.activeRoomBadge}>
          <View style={styles.livePulseDot} />
          <Text style={styles.activeRoomText}>OPD Active Session</Text>
        </View>
      </View>

      {/* Live Clinical Queue Metrics */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={[styles.statIconBadge, { backgroundColor: '#F0F9FF' }]}>
            <Ionicons name="people" size={17} color="#0284c7" />
          </View>
          <Text style={styles.statNumber}>{scheduleData?.total_scheduled || 0}</Text>
          <Text style={styles.statLabel}>Today's Queue</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBadge, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="checkmark-done" size={17} color="#16a34a" />
          </View>
          <Text style={styles.statNumber}>{scheduleData?.completed || 0}</Text>
          <Text style={styles.statLabel}>Consulted</Text>
        </View>

        <View style={styles.statCard}>
          <View style={[styles.statIconBadge, { backgroundColor: '#FFFBEB' }]}>
            <Ionicons name="time-outline" size={17} color="#d97706" />
          </View>
          <Text style={styles.statNumber}>
            {(scheduleData?.total_scheduled || 0) - (scheduleData?.completed || 0)}
          </Text>
          <Text style={styles.statLabel}>In Waiting</Text>
        </View>
      </View>

      {/* 1-Tap "Call Next Patient" Sticky Hero Macro Card */}
      <TouchableOpacity
        style={styles.callNextHeroCard}
        onPress={handleCallNext}
        disabled={callingNext}
        activeOpacity={0.85}
      >
        <View style={styles.callNextHeroContent}>
          <View style={styles.callNextIconContainer}>
            {callingNext ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="megaphone" size={22} color="#FFFFFF" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.callNextHeroTitle}>Call Next Patient</Text>
              <View style={styles.macroBadge}>
                <Text style={styles.macroBadgeText}>1-TAP DISPATCH</Text>
              </View>
            </View>
            <Text style={styles.callNextHeroSubtitle}>
              Completes active consult, summons next token & broadcasts live alert.
            </Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={26} color="#FFFFFF" />
        </View>
      </TouchableOpacity>

      {/* OPD Running Delay Broadcast Bar */}
      <View style={styles.delayBroadcastCard}>
        <View style={styles.delayHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="speedometer-outline" size={16} color="#D97706" />
            <Text style={styles.delayTitle}>OPD Delay Broadcast:</Text>
          </View>
          <Text style={[styles.delayCurrentBadge, delayMins > 0 ? styles.delayActiveText : styles.delayNormalText]}>
            {delayMins > 0 ? `Running +${delayMins}m behind` : 'On Schedule'}
          </Text>
        </View>
        <View style={styles.delayChipsRow}>
          {[0, 15, 30, 45, 60].map((mins) => (
            <TouchableOpacity
              key={mins}
              style={[
                styles.delayChip,
                delayMins === mins && styles.delayChipActive,
                mins === 0 && styles.delayChipClear,
              ]}
              onPress={() => handleBroadcastDelay(mins)}
              disabled={broadcastingDelay}
            >
              <Text style={[
                styles.delayChipText,
                delayMins === mins && styles.delayChipTextActive,
                mins === 0 && delayMins === 0 && styles.delayChipClearText,
              ]}>
                {mins === 0 ? 'Clear (On Time)' : `+${mins}m`}
              </Text>
            </TouchableOpacity>
          ))}
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

              {/* Card Actions: Start Consultation, Standby, Recall, History */}
              <View style={styles.cardActionRow}>
                <TouchableOpacity
                  style={styles.startConsultBtn}
                  onPress={() => onNavigateToNewVisit(item.patient_id, item.patient_name, item.chief_complaint)}
                >
                  <Ionicons name="mic" size={16} color="#ffffff" />
                  <Text style={styles.startConsultBtnText}>Start</Text>
                </TouchableOpacity>

                {item.status === 'deferred' || item.status === 'skipped' ? (
                  <TouchableOpacity
                    style={styles.recallBtn}
                    onPress={() => handleRecall(item)}
                  >
                    <Ionicons name="refresh-circle-outline" size={16} color="#0284C7" />
                    <Text style={styles.recallBtnText}>Recall</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.standbyBtn}
                    onPress={() => handleStandby(item)}
                  >
                    <Ionicons name="pause-outline" size={15} color="#D97706" />
                    <Text style={styles.standbyBtnText}>
                      Standby{item.skip_count && item.skip_count > 0 ? ` (${item.skip_count})` : ''}
                    </Text>
                  </TouchableOpacity>
                )}

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
        <EmptyState
          icon="calendar-outline"
          title="No Patients in Queue"
          description="Your clinical triage queue is currently clear. Add a walk-in patient or initiate an ad-hoc consultation."
          actionLabel="Add Walk-In Patient"
          onAction={() => setShowWalkInModal(true)}
        />
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
      <Modal visible={showWalkInModal} animationType="slide" transparent onRequestClose={() => setShowWalkInModal(false)}>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  greeting: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  doctorName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  specialtyText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  regBadge: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
  verifiedDoctorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  verifiedDoctorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: '#166534',
  },
  dateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dateLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  activeRoomBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  activeRoomText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statNumber: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
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
    borderRadius: 8,
  },
  addWalkInText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: '#ffffff',
  },
  queueCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  queueCardNext: {
    borderColor: '#0284C7',
    backgroundColor: '#F8FAFC',
  },
  queueCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  tokenBox: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tokenText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  triageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  triageText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
  },
  nextUpBadge: {
    marginLeft: 'auto',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  nextUpText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: '#DC2626',
  },
  patientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  patientAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#0284C7',
  },
  patientName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  patientSubtext: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  complaintBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  complaintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  complaintTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  complaintText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  cardActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  startConsultBtn: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 9,
    borderRadius: 8,
  },
  startConsultBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: '#ffffff',
  },
  patientHistoryBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  patientHistoryBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginTop: 10,
  },
  emptySubtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  patientsDirectoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
    gap: 12,
  },
  directoryCardTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
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
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  viewDirectoryBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: '#ffffff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  inputLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: Colors.textPrimary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  triageSelectRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 18,
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
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  triageOptionTextActive: {
    color: '#ffffff',
    fontFamily: FontFamily.semiBold,
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalSubmitBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: '#ffffff',
  },
  callNextHeroCard: {
    backgroundColor: '#059669',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  callNextHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  callNextIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callNextHeroTitle: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  macroBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  macroBadgeText: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  callNextHeroSubtitle: {
    fontSize: 11,
    fontFamily: FontFamily.sans,
    color: '#E6F4EA',
    marginTop: 2,
    lineHeight: 15,
  },
  delayBroadcastCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    marginBottom: 14,
  },
  delayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  delayTitle: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: '#92400E',
  },
  delayCurrentBadge: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  delayActiveText: {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
  },
  delayNormalText: {
    backgroundColor: '#D1FAE5',
    color: '#065F46',
  },
  delayChipsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  delayChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  delayChipActive: {
    backgroundColor: '#D97706',
    borderColor: '#D97706',
  },
  delayChipClear: {
    borderColor: '#E2E8F0',
  },
  delayChipText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: '#B45309',
  },
  delayChipTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  delayChipClearText: {
    color: '#64748B',
  },
  standbyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  standbyBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: '#D97706',
  },
  recallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  recallBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: '#0284C7',
  },
});

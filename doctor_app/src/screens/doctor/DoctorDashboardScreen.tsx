import React, { useState, useEffect } from 'react';
import {
  Platform,
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
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { DoctorUser, UpcomingScheduleItem, UpcomingScheduleResponse, PendingAppointmentItem } from '../../types';
import { mobileApi } from '../../services/api';
import { doctorRealtime } from '../../services/realtime';
import { BrandLogoMobile } from '../../components/BrandLogoMobile';
import { EmptyState } from '../../components/EmptyState';

interface DoctorDashboardScreenProps {
  doctor: DoctorUser;
  onNavigateToNewVisit: (patientId?: string, patientName?: string, chiefComplaint?: string, visitId?: string) => void;
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

  // Online Appointment Approvals States
  const [pendingAppointments, setPendingAppointments] = useState<PendingAppointmentItem[]>([]);
  const [showPendingModal, setShowPendingModal] = useState<boolean>(false);
  const [rejectingItem, setRejectingItem] = useState<PendingAppointmentItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Doctor unavailable');
  const [processingPendingId, setProcessingPendingId] = useState<string | null>(null);

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

  // Priority, Remove, No-Show Reschedule, and Custom Slots
  const [showRescheduleModal, setShowRescheduleModal] = useState<boolean>(false);
  const [rescheduleTargetItem, setRescheduleTargetItem] = useState<UpcomingScheduleItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleSlot, setRescheduleSlot] = useState<string>('10:00 AM');
  const [rescheduling, setRescheduling] = useState<boolean>(false);

  const [showCustomSlotModal, setShowCustomSlotModal] = useState<boolean>(false);
  const [customSlotDate, setCustomSlotDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customSlotTime, setCustomSlotTime] = useState<string>('05:30 PM');
  const [customSlotAction, setCustomSlotAction] = useState<'add' | 'block' | 'unblock'>('add');
  const [savingCustomSlot, setSavingCustomSlot] = useState<boolean>(false);

  // Daily Consultation Capacity Modal States
  const [showCapacityModal, setShowCapacityModal] = useState<boolean>(false);
  const [capacityInput, setCapacityInput] = useState<string>('');
  const [savingCapacity, setSavingCapacity] = useState<boolean>(false);

  const handleOpenCapacityModal = () => {
    const currentLimit = scheduleData?.max_daily_patients || 20;
    setCapacityInput(String(currentLimit));
    setShowCapacityModal(true);
  };

  const handleSaveCapacity = async () => {
    const num = parseInt(capacityInput, 10);
    if (!num || num <= 0) {
      Alert.alert('Invalid Number', 'Please enter a valid positive number for your daily consultation capacity.');
      return;
    }
    setSavingCapacity(true);
    try {
      await mobileApi.updateDoctorSchedule(
        { max_daily_patients: num },
        doctor.id
      );
      if (scheduleData) {
        setScheduleData({
          ...scheduleData,
          max_daily_patients: num,
        });
      }
      setShowCapacityModal(false);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
      Alert.alert('Capacity Updated', `Your daily consultation capacity is set to ${num} patients.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update capacity.');
    } finally {
      setSavingCapacity(false);
    }
  };

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

    const unsubPillConfirmed = doctorRealtime.on('PATIENT_PILL_CONFIRMED', () => {
      loadUpcomingScheduleSilently();
    });

    const unsubPatientAuth = doctorRealtime.on('PATIENT_LINK_AUTHORIZED', () => {
      loadUpcomingScheduleSilently();
    });

    const unsubPatientAuthorized = doctorRealtime.on('PATIENT_AUTHORIZED', () => {
      loadUpcomingScheduleSilently();
    });

    const unsubVital = doctorRealtime.on('PATIENT_VITAL_UPDATED', () => {
      loadUpcomingScheduleSilently();
    });

    const unsubReview = doctorRealtime.on('NEW_DOCTOR_REVIEW', (data: any) => {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
      Alert.alert(
        'New Patient Review',
        `A patient rated your consultation ${data?.rating || 5}★
"${data?.review_text || ''}"`
      );
      loadUpcomingScheduleSilently();
    });

    const unsubPending = doctorRealtime.on('APPOINTMENT_PENDING', () => {
      loadUpcomingScheduleSilently();
      loadPendingAppointments();
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch (_) {}
    });

    const unsubUpdated = doctorRealtime.on('APPOINTMENT_UPDATED', () => {
      loadUpcomingScheduleSilently();
      loadPendingAppointments();
    });

    // 2. Background Polling Fallback (every 10s) if WebSocket disconnects
    const pollInterval = setInterval(() => {
      loadUpcomingScheduleSilently();
    }, 10000);

    return () => {
      unsubQueue();
      unsubBooked();
      unsubPill();
      unsubPillConfirmed();
      unsubPatientAuth();
      unsubPatientAuthorized();
      unsubVital();
      unsubReview();
      unsubPending();
      unsubUpdated();
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
      loadPendingAppointments();
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
      loadPendingAppointmentsSilently();
    } catch (err) {
      // Background poll notice
    }
  };

  const loadPendingAppointments = async () => {
    try {
      const items = await mobileApi.getPendingAppointments();
      setPendingAppointments(items);
    } catch (_) {}
  };

  const loadPendingAppointmentsSilently = async () => {
    try {
      const items = await mobileApi.getPendingAppointments();
      setPendingAppointments(items);
    } catch (_) {}
  };

  const handleConfirmPending = async (item: PendingAppointmentItem) => {
    setProcessingPendingId(item.id);
    try {
      const res = await mobileApi.confirmAppointment(item.id);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
      Alert.alert(
        'Appointment Confirmed',
        `Assigned Token: ${res.token_display || 'PX-XX'}\nPatient: ${item.patient_name}\nDate: ${item.appointment_date} at ${item.time_slot}\n\nPatient is now admitted into today's active queue.`
      );
      setPendingAppointments(prev => prev.filter(p => p.id !== item.id));
      loadUpcomingSchedule();
    } catch (err: any) {
      Alert.alert('Confirmation Error', err?.message || 'Failed to confirm appointment');
    } finally {
      setProcessingPendingId(null);
    }
  };

  const handleRejectPending = async () => {
    if (!rejectingItem) return;
    setProcessingPendingId(rejectingItem.id);
    try {
      await mobileApi.rejectAppointment(rejectingItem.id, rejectReason.trim() || 'Doctor unavailable');
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch (_) {}
      Alert.alert('Appointment Declined', `Declined appointment for ${rejectingItem.patient_name}. Patient notified.`);
      setPendingAppointments(prev => prev.filter(p => p.id !== rejectingItem.id));
      setRejectingItem(null);
      loadUpcomingSchedule();
    } catch (err: any) {
      Alert.alert('Decline Error', err?.message || 'Failed to decline appointment');
    } finally {
      setProcessingPendingId(null);
    }
  };

  const handleAddWalkIn = async () => {
    if (!walkInName.trim()) {
      Alert.alert('Missing Name', 'Please enter patient full name.');
      return;
    }
    const cleanDigits = walkInPhone.replace(/\D/g, '');
    if (cleanDigits.length !== 10 || !/^[6-9]/.test(cleanDigits)) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit Indian mobile number (+91) starting with 6, 7, 8, or 9.');
      return;
    }
    const formattedWalkInPhone = `+91${cleanDigits}`;

    try {
      setCreatingWalkIn(true);
      // 1. Create or retrieve patient
      const created = await mobileApi.createPatient({
        name: walkInName.trim(),
        phone: formattedWalkInPhone,
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
        patient_phone: created.phone || '',
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
    const waitingCount = (scheduleData?.total_scheduled || 0) - (scheduleData?.completed || 0);
    const hasQueueItems = Boolean(
      scheduleData?.queue &&
      scheduleData.queue.some((q) => ['scheduled', 'confirmed', 'waiting', 'Waiting in Clinic', 'booked', 'draft', 'deferred'].includes(q.status))
    );

    if (waitingCount <= 0 && !hasQueueItems) {
      Alert.alert(
        'Queue Empty',
        'There are no patients waiting in your queue right now. You can add a patient using "+ Walk-In" to begin.'
      );
      return;
    }

    try {
      setCallingNext(true);
      const res = await mobileApi.callNextPatient(doctor.id);
      if (res.success && res.serving_visit_id && res.patient_name) {
        Alert.alert(
          'Patient Called Into Chamber',
          `Token ${res.token_called || 'PX-01'} (${res.patient_name}) called into consultation room.`
        );
        await loadUpcomingScheduleSilently();
        onNavigateToNewVisit(res.serving_visit_id, res.patient_name, 'Consultation');
      } else {
        Alert.alert('Queue Empty', res.message || 'There are no patients waiting in your queue right now.');
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

  const handleEndVisitFromQueue = (item: UpcomingScheduleItem) => {
    Alert.alert(
      'Complete Consultation / End Visit',
      `Are you sure you want to mark the consultation with ${item.patient_name || 'Patient'} as completed and release the queue slot?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete Visit',
          style: 'default',
          onPress: async () => {
            try {
              if (item.visit_id) {
                await mobileApi.updateVisitStatus(item.visit_id, 'completed');
              } else if ((item as any).id) {
                await mobileApi.endConsultation((item as any).id);
              }
              try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
              Alert.alert('Consultation Completed', `Consultation with ${item.patient_name || 'Patient'} has been finalized.`);
              loadUpcomingScheduleSilently();
            } catch (err: any) {
              Alert.alert('Notice', err.message || 'Could not complete consultation');
            }
          },
        },
      ]
    );
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

  const handleTogglePriority = async (item: UpcomingScheduleItem) => {
    const nextTriage: 'Urgent' | 'Priority' | 'Routine' =
      item.triage === 'Urgent' ? 'Routine' : 'Urgent';

    try {
      if (item.visit_id) {
        await mobileApi.setPatientPriority(item.visit_id, nextTriage);
      }
      if (scheduleData) {
        const updatedQueue = scheduleData.queue.map((q) =>
          q.token === item.token ? { ...q, triage: nextTriage } : q
        );
        updatedQueue.sort((a, b) => {
          const scoreA = a.triage === 'Urgent' ? 0 : (a.triage === 'Priority' ? 1 : 2);
          const scoreB = b.triage === 'Urgent' ? 0 : (b.triage === 'Priority' ? 1 : 2);
          return scoreA - scoreB;
        });
        setScheduleData({ ...scheduleData, queue: updatedQueue });
      }
      Alert.alert(
        nextTriage === 'Urgent' ? 'Priority Escalated' : 'Routine Status Restored',
        `${item.patient_name} (${item.token}) is now marked as ${nextTriage}.${nextTriage === 'Urgent' ? ' Repositioned to front of waiting queue.' : ''}`
      );
      loadUpcomingScheduleSilently();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update priority');
    }
  };

  const handleRemovePatient = (item: UpcomingScheduleItem) => {
    Alert.alert(
      'Remove Patient From Queue?',
      `Are you sure you want to remove ${item.patient_name} (${item.token}) from today's active clinical queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.visit_id) {
                await mobileApi.removePatientFromQueue(item.visit_id, 'Removed by clinician');
              }
              if (scheduleData) {
                setScheduleData({
                  ...scheduleData,
                  total_scheduled: Math.max(0, scheduleData.total_scheduled - 1),
                  in_waiting: Math.max(0, scheduleData.in_waiting - 1),
                  queue: scheduleData.queue.filter((q) => q.token !== item.token),
                });
              }
              Alert.alert('Patient Removed', `${item.patient_name} removed from active queue.`);
              loadUpcomingScheduleSilently();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Could not remove patient');
            }
          },
        },
      ]
    );
  };

  const handleOpenRescheduleModal = (item: UpcomingScheduleItem) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = tomorrow.toISOString().split('T')[0];

    setRescheduleTargetItem(item);
    setRescheduleDate(tomorrowIso);
    setRescheduleSlot(item.time || '10:00 AM');
    setShowRescheduleModal(true);
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleTargetItem) return;
    try {
      setRescheduling(true);
      if (rescheduleTargetItem.visit_id) {
        await mobileApi.rescheduleFreeSlot(
          rescheduleTargetItem.visit_id,
          rescheduleDate,
          rescheduleSlot,
          'Patient No-Show / Complimentary Slot'
        );
      }
      if (scheduleData) {
        setScheduleData({
          ...scheduleData,
          total_scheduled: Math.max(0, scheduleData.total_scheduled - 1),
          in_waiting: Math.max(0, scheduleData.in_waiting - 1),
          queue: scheduleData.queue.filter((q) => q.token !== rescheduleTargetItem.token),
        });
      }
      setShowRescheduleModal(false);
      Alert.alert(
        'Complimentary Slot Assigned',
        `${rescheduleTargetItem.patient_name} successfully scheduled for free on ${rescheduleDate} at ${rescheduleSlot}.`
      );
      loadUpcomingScheduleSilently();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to reschedule free slot');
    } finally {
      setRescheduling(false);
    }
  };

  const handleSaveCustomSlot = async () => {
    if (!customSlotDate || !customSlotTime) {
      Alert.alert('Input Missing', 'Please provide date and time slot.');
      return;
    }
    try {
      setSavingCustomSlot(true);
      await mobileApi.manageCustomSlot(
        doctor.id,
        customSlotDate,
        customSlotAction,
        customSlotTime
      );
      setShowCustomSlotModal(false);
      Alert.alert(
        'Slot Configured',
        `Slot ${customSlotTime} on ${customSlotDate} successfully ${customSlotAction === 'add' ? 'opened' : (customSlotAction === 'block' ? 'blocked' : 'unblocked')}.`
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update slot');
    } finally {
      setSavingCustomSlot(false);
    }
  };

  const docRawName = doctor?.name || 'Physician';
  const doctorName = docRawName.startsWith('Dr.') ? docRawName : `Dr. ${docRawName}`;
  const doctorDegree = doctor?.degree || '';
  const doctorSpecialty = doctor?.specialty || '';
  const doctorClinic = doctor?.clinic_name || '';
  const doctorReg = doctor?.reg_number || '';
  const doctorExp = doctor?.experience_years ? (typeof doctor.experience_years === 'number' ? `${doctor.experience_years}+ Yrs Exp` : doctor.experience_years) : '';
  const doctorDesignation = doctor?.designation || doctor?.specialty || '';
  const doctorLanguages = doctor?.languages && doctor.languages.length > 0 ? doctor.languages : [];
  const doctorInitials = (doctorName || 'MD').replace('Dr. ', '').trim().split(' ').map(n => (n ? n[0] : '')).filter(Boolean).slice(0, 2).join('') || 'MD';

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
      <View style={{ marginBottom: 12 }}>
        <BrandLogoMobile variant="header" size="sm" subtitleText="Clinician Intelligence Suite" />
      </View>

      {/* Clinician Executive Identity Card */}
      <View style={styles.clinicianHeroCard}>
        {/* Clinician Profile Row */}
        <View style={styles.clinicianTopRow}>
          <View style={styles.avatarWrapper}>
            <View style={styles.clinicianAvatar}>
              <Text style={styles.avatarInitials}>{doctorInitials}</Text>
            </View>
            <View style={styles.avatarVerifiedPin}>
              <Ionicons name="checkmark-circle" size={16} color="#0284C7" />
            </View>
          </View>

          <View style={styles.clinicianIdentityMain}>
            <View style={styles.doctorTitleRow}>
              <Text style={styles.clinicianName} numberOfLines={1}>
                {doctorName}
              </Text>
              <Ionicons name="checkmark-circle" size={17} color="#0284C7" />
            </View>

            {/* Medical Degrees - Clean Typography */}
            {(doctorDegree || doctor?.qualifications) ? (
              <Text style={styles.clinicianDegrees} numberOfLines={1}>
                {doctorDegree}{doctor?.qualifications && doctor.qualifications !== doctorDegree ? ` • ${doctor.qualifications}` : ''}
              </Text>
            ) : null}

            {/* Designation & Specialty */}
            {doctorDesignation ? (
              <Text style={styles.clinicianDesignationText} numberOfLines={1}>
                {doctorDesignation}
              </Text>
            ) : null}
            {(doctorSpecialty || doctorClinic) ? (
              <Text style={styles.clinicianSpecialtyText} numberOfLines={1}>
                {[doctorSpecialty, doctorClinic].filter(Boolean).join(' • ')}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Credentials & Registration Metadata */}
        <View style={styles.credentialsMetaRow}>
          <Ionicons name="shield-checkmark-outline" size={13} color="#0284C7" />
          <Text style={styles.credentialsMetaText} numberOfLines={1}>
            NMC Reg: {doctorReg} • {doctorExp} • {doctorLanguages.join(', ')}
          </Text>
        </View>

        {/* Offline Clinical AI Intelligence Status Bar */}
        <View style={styles.systemStatusBar}>
          <View style={styles.systemStatusDot} />
          <Text style={styles.systemStatusText}>
            Offline Clinical Engine Active • Local Models Ready
          </Text>
        </View>

        {/* Quick Consultation Macro Action Bar */}
        <View style={styles.consultActionsRow}>
          <TouchableOpacity
            style={styles.heroConsultBtn}
            onPress={() => onNavigateToNewVisit()}
            activeOpacity={0.88}
          >
            <Ionicons name="mic" size={16} color="#FFFFFF" />
            <Text style={styles.heroConsultBtnText}>Start New Consultation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.heroWalkInBtn}
            onPress={() => setShowWalkInModal(true)}
            activeOpacity={0.88}
          >
            <Ionicons name="person-add-outline" size={15} color="#0F172A" />
            <Text style={styles.heroWalkInBtnText}>+ Walk-In</Text>
          </TouchableOpacity>
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
      <View style={styles.statsBanner}>
        <View style={styles.statColumn}>
          <View style={[styles.statIconBadge, { backgroundColor: '#F0F9FF' }]}>
            <Ionicons name="people" size={15} color="#0284c7" />
          </View>
          <Text style={[styles.statNumber, { color: '#0369A1' }]}>{scheduleData?.total_scheduled || 0}</Text>
          <Text style={styles.statLabel}>Today's Queue</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statColumn}>
          <View style={[styles.statIconBadge, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="checkmark-done" size={15} color="#16a34a" />
          </View>
          <Text style={[styles.statNumber, { color: '#15803D' }]}>{scheduleData?.completed || 0}</Text>
          <Text style={styles.statLabel}>Consulted</Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statColumn}>
          <View style={[styles.statIconBadge, { backgroundColor: '#FFFBEB' }]}>
            <Ionicons name="time-outline" size={15} color="#d97706" />
          </View>
          <Text style={[styles.statNumber, { color: '#B45309' }]}>
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
            <Ionicons name="speedometer-outline" size={16} color="#0D9488" />
            <Text style={styles.delayTitle}>OPD Delay Broadcast</Text>
          </View>
          <View style={[styles.delayCurrentBadge, delayMins > 0 ? styles.delayActiveBadge : styles.delayNormalBadge]}>
            <View style={[styles.delayDot, { backgroundColor: delayMins > 0 ? '#DC2626' : '#16A34A' }]} />
            <Text style={[styles.delayStatusText, { color: delayMins > 0 ? '#B91C1C' : '#15803D' }]}>
              {delayMins > 0 ? `+${delayMins}m Delay` : 'On Schedule'}
            </Text>
          </View>
        </View>
        <View style={styles.delayChipsRow}>
          {[
            { mins: 0, label: 'On Time' },
            { mins: 15, label: '+15m' },
            { mins: 30, label: '+30m' },
            { mins: 45, label: '+45m' },
            { mins: 60, label: '+60m' },
          ].map((item) => {
            const isSelected = delayMins === item.mins;
            return (
              <TouchableOpacity
                key={item.mins}
                style={[
                  styles.delayChip,
                  isSelected && styles.delayChipActive,
                ]}
                onPress={() => handleBroadcastDelay(item.mins)}
                disabled={broadcastingDelay}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.delayChipText,
                  isSelected && styles.delayChipTextActive,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Primary Section Header: Upcoming Patient Schedule */}
      <View style={styles.sectionHeaderRow}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.sectionTitle}>Upcoming Patient Schedule</Text>
          <Text style={styles.sectionSubtitle}>Live triage queue ordered by priority & appointment time</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={[styles.addWalkInButton, { backgroundColor: '#334155' }]}
            onPress={() => setShowCustomSlotModal(true)}
          >
            <Ionicons name="time-outline" size={15} color="#ffffff" />
            <Text style={styles.addWalkInText}>Slots</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addWalkInButton}
            onPress={() => setShowWalkInModal(true)}
          >
            <Ionicons name="person-add" size={15} color="#ffffff" />
            <Text style={styles.addWalkInText}>Walk-In</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Live Daily Patient Capacity Status Tracker */}
      {scheduleData ? (
        (() => {
          const limit = scheduleData.max_daily_patients || 20;
          const currentCount = scheduleData.queue ? scheduleData.queue.length : 0;
          const isFull = currentCount >= limit;
          const pct = Math.min(100, Math.round((currentCount / limit) * 100));
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleOpenCapacityModal}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                padding: 12,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: isFull ? '#FCA5A5' : '#E2E8F0',
                borderLeftWidth: 4,
                borderLeftColor: isFull ? '#EF4444' : '#0D9488',
                shadowColor: '#0F172A',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.04,
                shadowRadius: 4,
                elevation: 1,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="people" size={15} color={isFull ? '#DC2626' : '#0D9488'} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                    Daily Consultation Capacity
                  </Text>
                  <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Ionicons name="pencil" size={10} color="#0D9488" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#0D9488' }}>Set Number</Text>
                  </View>
                </View>
                <View style={{
                  backgroundColor: isFull ? '#FEF2F2' : '#F0FDFA',
                  borderWidth: 1,
                  borderColor: isFull ? '#FECACA' : '#CCFBF1',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 12,
                }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isFull ? '#B91C1C' : '#0F766E' }}>
                    {currentCount} / {limit} Patients {isFull ? '(FULL)' : `(${Math.max(0, limit - currentCount)} left)`}
                  </Text>
                </View>
              </View>
              {/* Progress bar track */}
              <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ height: '100%', width: `${pct}%`, backgroundColor: isFull ? '#EF4444' : pct > 75 ? '#F59E0B' : '#0D9488', borderRadius: 3 }} />
              </View>
            </TouchableOpacity>
          );
        })()
      ) : null}

      {/* Pending Online Appointment Approval Banner */}
      {pendingAppointments.length > 0 && (
        <View style={{
          backgroundColor: '#FFFBEB',
          borderRadius: 12,
          padding: 14,
          marginBottom: 14,
          borderWidth: 1,
          borderColor: '#FDE68A',
          borderLeftWidth: 4,
          borderLeftColor: '#F59E0B',
          shadowColor: '#B45309',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 2,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="notifications" size={17} color="#D97706" />
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E' }}>
                ONLINE REQUESTS AWAITING APPROVAL ({pendingAppointments.length})
              </Text>
            </View>
            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#B45309' }}>ACTION NEEDED</Text>
            </View>
          </View>
          <Text style={{ fontSize: 12, color: '#78350F', marginBottom: 10 }}>
            {pendingAppointments.length} online booking{pendingAppointments.length > 1 ? 's' : ''} require your or front-desk confirmation before admission.
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: '#D97706',
              paddingVertical: 9,
              paddingHorizontal: 14,
              borderRadius: 8,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 6,
            }}
            onPress={() => setShowPendingModal(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
              Review Online Requests ({pendingAppointments.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Loading Indicator */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading clinical queue...</Text>
        </View>
      ) : scheduleData && scheduleData.queue.length > 0 ? (
        /* Upcoming Patient Queue Cards */
        scheduleData.queue.map((item, index) => {
          const isUrgent = item.triage === 'Urgent';
          const triageStyle = getTriageColor(item.triage);
          const isNext = index === 0;

          return (
            <View
              key={item.token + index}
              style={[
                styles.queueCard,
                isNext && styles.queueCardNext,
                isUrgent && styles.queueCardUrgent,
              ]}
            >
              {/* Card Header: Token & Time on Left, Next & Triage on Right */}
              <View style={styles.queueCardHeader}>
                <View style={styles.queueHeaderLeft}>
                  <View style={[styles.tokenBox, isUrgent && styles.tokenBoxUrgent]}>
                    <Text style={[styles.tokenText, isUrgent && styles.tokenTextUrgent]}>{item.token}</Text>
                  </View>
                  <View style={styles.timeBox}>
                    <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
                    <Text style={styles.timeText}>{item.time}</Text>
                  </View>
                </View>

                <View style={styles.queueHeaderRight}>
                  {isNext && (
                    <View style={styles.nextBadge}>
                      <Text style={styles.nextBadgeText}>NEXT</Text>
                    </View>
                  )}
                  <View style={[styles.triageBadge, { backgroundColor: triageStyle.bg, borderColor: triageStyle.border }]}>
                    <View style={[styles.triageDot, { backgroundColor: triageStyle.text }]} />
                    <Text style={[styles.triageText, { color: triageStyle.text }]}>{item.triage}</Text>
                  </View>
                </View>
              </View>

              {/* Patient Info */}
              <View style={styles.patientInfoRow}>
                <View style={[styles.patientAvatar, isUrgent && { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.avatarText, isUrgent && { color: '#DC2626' }]}>
                    {(item.patient_name || 'P').charAt(0)}
                  </Text>
                </View>
                <View style={styles.patientDetailsCol}>
                  <Text style={styles.patientName} numberOfLines={1}>{item.patient_name || 'Patient'}</Text>
                  <Text style={styles.patientSubtext} numberOfLines={1}>
                    {item.patient_phone || ''} • Status: <Text style={{ color: isUrgent ? '#DC2626' : Colors.primary, fontWeight: '600' }}>{((item.status || 'active').charAt(0).toUpperCase() + (item.status || 'active').slice(1))}</Text>
                  </Text>
                </View>
              </View>

              {/* Chief Complaint Box with Clean Left Accent */}
              <View style={[styles.complaintBox, isUrgent && styles.complaintBoxUrgent]}>
                <View style={styles.complaintHeader}>
                  <Ionicons name="pulse" size={13} color={isUrgent ? '#DC2626' : '#0284c7'} />
                  <Text style={[styles.complaintTitle, isUrgent && { color: '#B91C1C' }]}>
                    {isUrgent ? 'Emergency Triage Notes' : 'Chief Complaint'}
                  </Text>
                </View>
                <Text style={[styles.complaintText, isUrgent && { color: '#7F1D1D' }]} numberOfLines={3}>
                  {item.chief_complaint}
                </Text>
              </View>

              {/* Card Actions: 2-Tier Ergonomic Layout (NO OVERLAPPING) */}
              <View style={styles.queueCardActionsContainer}>
                {/* Tier 1: Primary Actions */}
                <View style={styles.primaryActionRow}>
                  <TouchableOpacity
                    style={styles.startConsultBtn}
                    onPress={() => onNavigateToNewVisit(item.patient_id, item.patient_name, item.chief_complaint, item.visit_id || item.id)}
                    activeOpacity={0.88}
                  >
                    <Ionicons name="mic" size={16} color="#ffffff" />
                    <Text style={styles.startConsultBtnText}>Start Consultation</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.completeConsultBtn}
                    onPress={() => handleEndVisitFromQueue(item)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="checkmark-done" size={14} color="#059669" />
                    <Text style={styles.completeConsultBtnText}>Complete Visit</Text>
                  </TouchableOpacity>

                  {item.status === 'deferred' || item.status === 'skipped' ? (
                    <TouchableOpacity
                      style={styles.recallBtn}
                      onPress={() => handleRecall(item)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="refresh" size={14} color="#0284C7" />
                      <Text style={styles.recallBtnText}>Recall</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.standbyBtn}
                      onPress={() => handleStandby(item)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="pause" size={14} color="#B45309" />
                      <Text style={styles.standbyBtnText}>
                        Standby{item.skip_count && item.skip_count > 0 ? ` (${item.skip_count})` : ''}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Tier 2: Secondary Queue Management Controls */}
                <View style={styles.secondaryActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.secondaryActionChip,
                      isUrgent && styles.secondaryActionChipUrgent,
                    ]}
                    onPress={() => handleTogglePriority(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isUrgent ? 'flame' : 'alert-circle-outline'}
                      size={14}
                      color={isUrgent ? '#DC2626' : '#64748B'}
                    />
                    <Text style={[styles.secondaryActionChipText, isUrgent && { color: '#DC2626', fontWeight: '700' }]}>
                      {isUrgent ? 'Urgent' : 'Mark Priority'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryActionChip}
                    onPress={() => handleOpenRescheduleModal(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="calendar-outline" size={14} color="#059669" />
                    <Text style={[styles.secondaryActionChipText, { color: '#059669' }]}>Reschedule</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.removeActionChip}
                    onPress={() => handleRemovePatient(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={15} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })
      ) : (
        <EmptyState
          icon="calendar-outline"
          title="No Patients in Queue"
          description="Your clinical triage queue is currently clear. Add a walk-in patient or initiate an ad-hoc consultation."
          actionLabel="+ Admit Walk-In Patient"
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

      {/* Modal: Review Pending Online Appointments */}
      <Modal
        visible={showPendingModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPendingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="calendar" size={20} color="#D97706" />
                <Text style={styles.modalTitle}>Pending Online Bookings ({pendingAppointments.length})</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPendingModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {pendingAppointments.length === 0 ? (
                <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                  <Ionicons name="checkmark-done-circle-outline" size={48} color="#10B981" />
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 10 }}>All Requests Handled</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>No online bookings are currently awaiting approval.</Text>
                </View>
              ) : (
                pendingAppointments.map((item) => {
                  const isProcessing = processingPendingId === item.id;
                  return (
                    <View
                      key={item.id}
                      style={{
                        backgroundColor: '#F8FAFC',
                        borderRadius: 12,
                        padding: 14,
                        marginBottom: 12,
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>{item.patient_name}</Text>
                          <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            {item.appointment_date} • {item.time_slot} {item.patient_phone ? `• ${item.patient_phone}` : ''}
                          </Text>
                        </View>
                        <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309' }}>AWAITING APPROVAL</Text>
                        </View>
                      </View>

                      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, padding: 8, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>Chief Complaint:</Text>
                        <Text style={{ fontSize: 12, color: '#1E293B', marginTop: 2 }}>{item.chief_complaint || 'General Consultation'}</Text>
                      </View>

                      {/* Action Buttons */}
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            backgroundColor: '#059669',
                            paddingVertical: 10,
                            borderRadius: 8,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 6,
                          }}
                          onPress={() => handleConfirmPending(item)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                              <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>Confirm & Token</Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            borderRadius: 8,
                            alignItems: 'center',
                            flexDirection: 'row',
                            justifyContent: 'center',
                            gap: 4,
                            backgroundColor: '#FEF2F2',
                            borderWidth: 1,
                            borderColor: '#FECACA',
                          }}
                          onPress={() => setRejectingItem(item)}
                          disabled={isProcessing}
                        >
                          <Ionicons name="close-circle-outline" size={16} color="#DC2626" />
                          <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700' }}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal: Decline Reason Selection */}
      <Modal
        visible={!!rejectingItem}
        animationType="fade"
        transparent
        onRequestClose={() => setRejectingItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 360 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Decline Appointment</Text>
              <TouchableOpacity onPress={() => setRejectingItem(null)}>
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
              Select or enter reason for declining {rejectingItem?.patient_name}:
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {['Doctor unavailable', 'Emergency surgery', 'Consultation slot full', 'Please visit as walk-in'].map((r) => {
                const isSelected = rejectReason === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 6,
                      backgroundColor: isSelected ? '#DC2626' : '#F1F5F9',
                    }}
                    onPress={() => setRejectReason(r)}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '600', color: isSelected ? '#FFFFFF' : '#334155' }}>{r}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#CBD5E1',
                borderRadius: 8,
                padding: 10,
                fontSize: 13,
                marginBottom: 14,
                backgroundColor: '#F8FAFC',
              }}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Custom reason..."
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#F1F5F9' }}
                onPress={() => setRejectingItem(null)}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#DC2626' }}
                onPress={handleRejectPending}
                disabled={!!processingPendingId}
              >
                {processingPendingId ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Confirm Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              placeholder="Patient's Full Name"
              placeholderTextColor={Colors.textSecondary}
              value={walkInName}
              onChangeText={setWalkInName}
            />

            <Text style={styles.inputLabel}>Mobile Phone (Optional)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: Colors.border, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 12, borderTopLeftRadius: 7, borderBottomLeftRadius: 7, gap: 4, borderRightWidth: 1, borderRightColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 14 }}>🇮🇳</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: Colors.text }}>+91</Text>
              </View>
              <TextInput
                style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: Colors.text }}
                placeholder="10-digit mobile number (Optional)"
                placeholderTextColor={Colors.textSecondary}
                value={walkInPhone.replace('+91', '').trim()}
                onChangeText={(val) => setWalkInPhone(`+91${val.replace(/\D/g, '').slice(0, 10)}`)}
                keyboardType="number-pad"
                maxLength={10}
              />
            </View>

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

      {/* 1. Patient No-Show / Free Slot Reschedule Modal */}
      <Modal
        visible={showRescheduleModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>No-Show / Free Slot Reschedule</Text>
                <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                  Assign complimentary slot to {rescheduleTargetItem?.patient_name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowRescheduleModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ backgroundColor: '#ECFDF5', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="gift-outline" size={16} color="#059669" />
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#065F46' }}>
                  100% Free / Complimentary Reschedule
                </Text>
              </View>
              <Text style={{ fontSize: 11, color: '#047857', marginTop: 3 }}>
                Patient will not be charged any additional fee. Sequential OPD token will be reserved on target date.
              </Text>
            </View>

            <Text style={styles.inputLabel}>Target Appointment Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textSecondary}
              value={rescheduleDate}
              onChangeText={setRescheduleDate}
            />

            {/* Quick Date Selectors */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Tomorrow', days: 1 },
                { label: '+2 Days', days: 2 },
                { label: '+3 Days', days: 3 },
                { label: 'Next Week', days: 7 },
              ].map((pill) => {
                const target = new Date();
                target.setDate(target.getDate() + pill.days);
                const iso = target.toISOString().split('T')[0];
                const isActive = rescheduleDate === iso;
                return (
                  <TouchableOpacity
                    key={pill.label}
                    style={[styles.quickPill, isActive && styles.quickPillActive]}
                    onPress={() => setRescheduleDate(iso)}
                  >
                    <Text style={[styles.quickPillText, isActive && styles.quickPillTextActive]}>
                      {pill.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Target Time Slot</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10:00 AM"
              placeholderTextColor={Colors.textSecondary}
              value={rescheduleSlot}
              onChangeText={setRescheduleSlot}
            />

            {/* Quick Slot Selectors */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {['10:00 AM', '05:30 PM', '08:00 PM'].map((slot) => {
                const isActive = rescheduleSlot === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    style={[styles.quickPill, isActive && styles.quickPillActive]}
                    onPress={() => setRescheduleSlot(slot)}
                  >
                    <Text style={[styles.quickPillText, isActive && styles.quickPillTextActive]}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.modalSubmitBtn, { backgroundColor: '#059669' }]}
              onPress={handleConfirmReschedule}
              disabled={rescheduling}
            >
              {rescheduling ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-circle" size={18} color="#ffffff" />
                  <Text style={styles.modalSubmitBtnText}>Confirm Free Slot Reschedule</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Doctor Custom Slots Management Modal */}
      <Modal
        visible={showCustomSlotModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCustomSlotModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Manage Specific Slots</Text>
                <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
                  Open custom slots or block time for breaks & procedures
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowCustomSlotModal(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Slot Action</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {[
                { key: 'add', label: 'Open Slot', color: '#059669' },
                { key: 'block', label: 'Block Slot', color: '#DC2626' },
                { key: 'unblock', label: 'Unblock', color: '#0284C7' },
              ].map((act) => {
                const isActive = customSlotAction === act.key;
                return (
                  <TouchableOpacity
                    key={act.key}
                    style={[
                      styles.quickPill,
                      { flex: 1, alignItems: 'center' },
                      isActive && { backgroundColor: act.color, borderColor: act.color },
                    ]}
                    onPress={() => setCustomSlotAction(act.key as any)}
                  >
                    <Text style={[styles.quickPillText, isActive && { color: '#ffffff', fontWeight: '700' }]}>
                      {act.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Target Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={Colors.textSecondary}
              value={customSlotDate}
              onChangeText={setCustomSlotDate}
            />

            {/* Quick Date Selectors */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Today', days: 0 },
                { label: 'Tomorrow', days: 1 },
                { label: '+2 Days', days: 2 },
              ].map((pill) => {
                const target = new Date();
                target.setDate(target.getDate() + pill.days);
                const iso = target.toISOString().split('T')[0];
                const isActive = customSlotDate === iso;
                return (
                  <TouchableOpacity
                    key={pill.label}
                    style={[styles.quickPill, isActive && styles.quickPillActive]}
                    onPress={() => setCustomSlotDate(iso)}
                  >
                    <Text style={[styles.quickPillText, isActive && styles.quickPillTextActive]}>
                      {pill.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Time Slot (e.g. 05:30 PM)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 05:30 PM or 17:30"
              placeholderTextColor={Colors.textSecondary}
              value={customSlotTime}
              onChangeText={setCustomSlotTime}
            />

            {/* Quick Slot Suggestions */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {['10:00 AM', '05:30 PM', '08:00 PM'].map((s) => {
                const isActive = customSlotTime === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.quickPill, isActive && styles.quickPillActive]}
                    onPress={() => setCustomSlotTime(s)}
                  >
                    <Text style={[styles.quickPillText, isActive && styles.quickPillTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.modalSubmitBtn,
                customSlotAction === 'block' && { backgroundColor: '#DC2626' },
                customSlotAction === 'unblock' && { backgroundColor: '#0284C7' },
              ]}
              onPress={handleSaveCustomSlot}
              disabled={savingCustomSlot}
            >
              {savingCustomSlot ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                  <Text style={styles.modalSubmitBtnText}>
                    {customSlotAction === 'add'
                      ? 'Open & Make Slot Available'
                      : customSlotAction === 'block'
                      ? 'Block Slot Immediately'
                      : 'Unblock Slot'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
              {/* 3. Daily Consultation Capacity Setting Modal */}
      <Modal
        visible={showCapacityModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCapacityModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 360 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <View style={{ backgroundColor: '#F0FDFA', padding: 8, borderRadius: 10 }}>
                  <Ionicons name="people" size={20} color="#0D9488" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Daily Consultation Capacity</Text>
                  <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                    Type your capacity number manually
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowCapacityModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12, lineHeight: 17 }}>
              Set the maximum number of patients you will consult in a day. The OPD tracker will update immediately.
            </Text>

            <Text style={styles.inputLabel}>Capacity Limit (Patients / Day)</Text>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#F8FAFC',
              borderWidth: 1.5,
              borderColor: '#CBD5E1',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: Platform.OS === 'ios' ? 10 : 4,
              marginBottom: 18,
            }}>
              <Ionicons name="medical-outline" size={18} color="#0D9488" style={{ marginRight: 8 }} />
              <TextInput
                style={{
                  flex: 1,
                  fontSize: 18,
                  fontWeight: '700',
                  color: '#0F172A',
                  paddingVertical: 6,
                }}
                value={capacityInput}
                onChangeText={(t) => setCapacityInput(t.replace(/[^0-9]/g, ''))}
                placeholder="Set numbers"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
              />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B' }}>
                Patients
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { flex: 1, backgroundColor: '#F1F5F9' }]}
                onPress={() => setShowCapacityModal(false)}
              >
                <Text style={[styles.modalSubmitBtnText, { color: '#475569' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { flex: 1.5, backgroundColor: '#0D9488' }]}
                onPress={handleSaveCapacity}
                disabled={savingCapacity}
              >
                {savingCapacity ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#ffffff" />
                    <Text style={styles.modalSubmitBtnText}>Save Capacity</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
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
  clinicianHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  clinicianTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatarWrapper: {
    position: 'relative',
  },
  clinicianAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    color: '#1E40AF',
    fontWeight: '700',
  },
  avatarVerifiedPin: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  clinicianIdentityMain: {
    flex: 1,
  },
  doctorTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  clinicianName: {
    fontFamily: FontFamily.display,
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
  },
  doctorVerifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  doctorVerifiedTagText: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: 10,
    color: '#166534',
    textTransform: 'uppercase',
  },
  clinicianDegrees: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: 12.5,
    color: '#334155',
    marginTop: 3,
  },
  clinicianDesignationText: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: 12,
    color: '#0284C7',
    marginTop: 1,
  },
  clinicianSpecialtyText: {
    fontFamily: FontFamily.sans,
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  credentialsMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  credentialsMetaText: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 11.5,
    color: '#64748B',
    flex: 1,
  },
  systemStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    marginTop: 10,
  },
  systemStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  systemStatusText: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 11,
    color: '#15803D',
  },
  consultActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  heroConsultBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  heroConsultBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12.5,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  heroWalkInBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  heroWalkInBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12.5,
    color: '#0F172A',
    fontWeight: '600',
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
    fontWeight: '500',
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  doctorName: {
    fontFamily: FontFamily.display,
    fontWeight: '700',
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
    fontWeight: '500',
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
    fontWeight: '500',
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
    fontWeight: '500',
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
    fontWeight: '500',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  statsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  statIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statNumber: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
    fontWeight: '700',
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
    fontWeight: '600',
    fontSize: FontSize.xs,
    color: '#ffffff',
  },
  queueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  queueCardNext: {
    borderColor: '#38BDF8',
    backgroundColor: '#FAFDFE',
  },
  queueCardUrgent: {
    borderColor: '#F87171',
    backgroundColor: '#FFFBFB',
    borderWidth: 1.5,
  },
  queueCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  queueHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  queueHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tokenBox: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  tokenBoxUrgent: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  tokenText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: FontSize.sm,
    color: '#1E293B',
  },
  tokenTextUrgent: {
    color: '#DC2626',
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#64748B',
  },
  nextBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  nextBadgeText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 10,
    color: '#1D4ED8',
  },
  triageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  triageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  triageText: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: FontSize.caption,
  },
  patientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F2FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: FontSize.sm,
    color: '#0284C7',
  },
  patientDetailsCol: {
    flex: 1,
  },
  patientName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    color: '#0F172A',
    fontWeight: '700',
  },
  patientSubtext: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#64748B',
    marginTop: 1,
  },
  complaintBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 3,
    borderLeftColor: '#0284C7',
  },
  complaintBoxUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderLeftColor: '#DC2626',
  },
  complaintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  complaintTitle: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: FontSize.caption,
    color: '#475569',
  },
  complaintText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: '#334155',
    lineHeight: 18,
  },
  queueCardActionsContainer: {
    gap: 8,
  },
  primaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  startConsultBtn: {
    flex: 1.4,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },
  startConsultBtnText: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: FontSize.sm,
    color: '#ffffff',
  },
  completeConsultBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  completeConsultBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: '#059669',
  },
  standbyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FFFBEB',
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  standbyBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    color: '#B45309',
  },
  recallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F0F9FF',
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  recallBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    color: '#0284C7',
  },
  secondaryActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryActionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    minHeight: 36,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  secondaryActionChipUrgent: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  secondaryActionChipText: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 11,
    color: '#475569',
  },
  removeActionChip: {
    width: 38,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#FECACA',
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
    fontWeight: '500',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '600',
    fontSize: FontSize.xs,
    color: '#ffffff',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
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
    fontWeight: '700',
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  inputLabel: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
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
    fontWeight: '500',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  triageOptionTextActive: {
    color: '#ffffff',
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  delayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  delayTitle: {
    fontSize: 13,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: '#0F172A',
  },
  delayCurrentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  delayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  delayActiveBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  delayNormalBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  delayStatusText: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
  },
  delayChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  delayChip: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delayChipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  delayChipText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: '#334155',
  },
  delayChipTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontWeight: '700',
  },

  quickPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  quickPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quickPillText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  quickPillTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
  },
});

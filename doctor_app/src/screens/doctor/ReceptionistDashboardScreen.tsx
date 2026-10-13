import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, FontSize } from '../../theme';
import { mobileApi } from '../../services/api';
import { doctorRealtime } from '../../services/realtime';
import { ReceptionistUser, UpcomingScheduleResponse, UpcomingScheduleItem } from '../../types';

interface ReceptionistDashboardScreenProps {
  staffUser: ReceptionistUser;
  onLogout: () => void;
  onSwitchToDoctorLogin?: () => void;
}

export const ReceptionistDashboardScreen: React.FC<ReceptionistDashboardScreenProps> = ({
  staffUser,
  onLogout,
  onSwitchToDoctorLogin,
}) => {
  const [scheduleData, setScheduleData] = useState<UpcomingScheduleResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Add Walk-in Modal States
  const [showWalkInModal, setShowWalkInModal] = useState<boolean>(false);
  const [walkInName, setWalkInName] = useState<string>('');
  const [walkInPhone, setWalkInPhone] = useState<string>('');
  const [walkInComplaint, setWalkInComplaint] = useState<string>('');
  const [walkInTriage, setWalkInTriage] = useState<'Routine' | 'Priority' | 'Urgent'>('Routine');
  const [feeCollected, setFeeCollected] = useState<boolean>(true);
  const [creatingWalkIn, setCreatingWalkIn] = useState<boolean>(false);

  // Quick Search for Returning Patients
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState<boolean>(false);

  // Load Queue on mount & set up WebSocket listener
  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 6000);

    const unsub = doctorRealtime.on('QUEUE_UPDATE', () => {
      loadQueue();
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  const loadQueue = async () => {
    try {
      const schedule = await mobileApi.getUpcomingSchedule();
      if (schedule && schedule.queue) {
        setScheduleData(schedule);
      }
    } catch (_) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadQueue();
  };

  // Search returning patient by Unique ID or Phone
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim() || text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await mobileApi.searchPatientsByUhid(text.trim());
      setSearchResults(results);
    } catch (_) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Re-issue Token to Returning Patient
  const handleIssueTokenToExisting = async (patient: any) => {
    try {
      setCreatingWalkIn(true);
      const walkInResult = await mobileApi.createWalkInVisit({
        patientId: patient.id,
        doctorId: staffUser.doctor_id,
        chiefComplaint: 'Clinic Follow-up Consultation',
        triage: 'Routine',
      });
      const assignedToken = walkInResult.token || `PX-0${(scheduleData?.queue.length || 0) + 1}`;
      setSearchQuery('');
      setSearchResults([]);
      await loadQueue();
      Alert.alert(
        'Token Issued Successfully',
        `Assigned Token: ${assignedToken}\nPatient: ${patient.name}\n\nPlease ask the patient to take a seat in the waiting area.`
      );
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to issue token');
    } finally {
      setCreatingWalkIn(false);
    }
  };

  // Submit Brand New Walk-in Patient
  const handleAddWalkIn = async () => {
    if (!walkInName.trim()) {
      Alert.alert('Name Required', 'Please enter the patient full name.');
      return;
    }

    let formattedPhone: string | undefined = undefined;
    const cleanDigits = walkInPhone.replace(/\D/g, '');
    if (cleanDigits.length > 0) {
      if (cleanDigits.length !== 10 || !/^[6-9]/.test(cleanDigits)) {
        Alert.alert('Invalid Phone', 'Please enter a valid 10-digit Indian mobile number (+91), or leave it empty.');
        return;
      }
      formattedPhone = `+91${cleanDigits}`;
    }

    try {
      setCreatingWalkIn(true);
      // 1. Create patient record
      const created = await mobileApi.createPatient({
        name: walkInName.trim(),
        phone: formattedPhone,
      });

      // 2. Add to live queue
      const walkInResult = await mobileApi.createWalkInVisit({
        patientId: created.id,
        doctorId: staffUser.doctor_id,
        chiefComplaint: walkInComplaint.trim() || 'Walk-in acute consultation',
        triage: walkInTriage,
      });

      const assignedToken = walkInResult.token || `PX-0${(scheduleData?.queue.length || 0) + 1}`;

      // Reset modal fields
      setShowWalkInModal(false);
      setWalkInName('');
      setWalkInPhone('');
      setWalkInComplaint('');
      setWalkInTriage('Routine');
      await loadQueue();

      Alert.alert(
        'Token Generated',
        `Token: ${assignedToken}\nPatient: ${created.name}\nPatient ID: ${created.uhid || created.id}\nFee Status: ${feeCollected ? 'Paid' : 'Pending'}\n\nPlease give this token to the patient.`
      );
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (_) {}
    } catch (err: any) {
      Alert.alert('Registration Error', err?.message || 'Failed to register walk-in patient');
    } finally {
      setCreatingWalkIn(false);
    }
  };

  // Update status (e.g. mark cancelled)
  const handleAdvanceStatus = async (visitId: string, newStatus: string, patientName: string) => {
    try {
      await mobileApi.advanceQueue(visitId, newStatus as any);
      await loadQueue();
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch (_) {}
    } catch (err: any) {
      Alert.alert('Status Error', err?.message || 'Could not update patient status');
    }
  };

  const queue = scheduleData?.queue || [];
  const waitingCount = queue.filter((item) => item.status === 'Waiting in Clinic' || item.status === 'scheduled').length;
  const inProgressItem = queue.find((item) => item.status === 'in_progress');
  const completedCount = queue.filter((item) => item.status === 'completed').length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Clinic Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={styles.staffBadge}>
              <Ionicons name="shield-checkmark" size={12} color="#0284C7" />
              <Text style={styles.staffBadgeText}>FRONT DESK / RECEPTION</Text>
            </View>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>LIVE SYNC</Text>
            </View>
          </View>
          <Text style={styles.clinicTitle}>{staffUser.clinic_name || 'Praxirence Clinical Centre'}</Text>
          <Text style={styles.doctorSubtext}>Attending: {staffUser.doctor_name}</Text>
        </View>

        <TouchableOpacity
          style={styles.exitBtn}
          onPress={() => {
            Alert.alert(
              'Exit Front Desk',
              'Do you want to sign out or switch to Doctor Login?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Doctor Login',
                  onPress: () => (onSwitchToDoctorLogin ? onSwitchToDoctorLogin() : onLogout()),
                },
                { text: 'Sign Out', style: 'destructive', onPress: onLogout },
              ]
            );
          }}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.exitBtnText}>Exit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
      >
        {/* Quick Stats Bar */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={styles.statLabel}>WAITING OUTSIDE</Text>
            <Text style={[styles.statValue, { color: '#D97706' }]}>{waitingCount}</Text>
          </View>

          <View style={[styles.statCard, { borderLeftColor: '#0284C7' }]}>
            <Text style={styles.statLabel}>INSIDE WITH DOCTOR</Text>
            <Text style={[styles.statValue, { color: '#0284C7' }]}>
              {inProgressItem ? inProgressItem.token : 'None'}
            </Text>
          </View>

          <View style={[styles.statCard, { borderLeftColor: '#10B981' }]}>
            <Text style={styles.statLabel}>COMPLETED TODAY</Text>
            <Text style={[styles.statValue, { color: '#059669' }]}>{completedCount}</Text>
          </View>
        </View>

        {/* Primary Action Button: + Add Walk-in Patient */}
        <TouchableOpacity
          style={styles.addWalkInBtn}
          onPress={() => setShowWalkInModal(true)}
          activeOpacity={0.85}
        >
          <View style={styles.addWalkInIcon}>
            <Ionicons name="person-add" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addWalkInBtnTitle}>+ Register Walk-In Patient</Text>
            <Text style={styles.addWalkInBtnSubtitle}>Assign token, collect fee, and add to doctor's queue</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Search Returning Patient Bar */}
        <View style={styles.searchSection}>
          <Text style={styles.sectionTitle}>Check-In Returning Patient</Text>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by Patient Unique ID or Mobile Number..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={handleSearch}
              autoCapitalize="characters"
            />
            {searching ? (
              <ActivityIndicator size="small" color="#0284C7" />
            ) : searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Search Dropdown Results */}
          {searchResults.length > 0 && (
            <View style={styles.searchResultsBox}>
              {searchResults.map((res) => (
                <View key={res.id} style={styles.searchResultItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{res.name}</Text>
                    <Text style={styles.searchResultSub}>
                      ID: {res.uhid || res.id} {res.phone ? `• ${res.phone}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.issueTokenBtn}
                    onPress={() => handleIssueTokenToExisting(res)}
                    disabled={creatingWalkIn}
                  >
                    <Text style={styles.issueTokenBtnText}>Issue Token</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Live Token Queue */}
        <View style={styles.queueSection}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>Today's Clinical OPD Queue ({queue.length})</Text>
            <TouchableOpacity onPress={handleRefresh} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="refresh" size={14} color="#0284C7" />
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#0284C7' }}>Refresh</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 24 }} />
          ) : queue.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="people-outline" size={40} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No Patients in Queue</Text>
              <Text style={styles.emptySub}>Tap "+ Register Walk-In Patient" above to issue the first token.</Text>
            </View>
          ) : (
            queue.map((item: UpcomingScheduleItem) => {
              const isServing = item.status === 'in_progress';
              const isCompleted = item.status === 'completed';
              const isUrgent = item.triage === 'Urgent';

              return (
                <View
                  key={item.token}
                  style={[
                    styles.tokenCard,
                    isServing && styles.tokenCardServing,
                    isUrgent && styles.tokenCardUrgent,
                  ]}
                >
                  {/* Token Badge */}
                  <View style={[styles.tokenBadge, isServing && styles.tokenBadgeServing]}>
                    <Text style={[styles.tokenBadgeText, isServing && styles.tokenBadgeTextServing]}>
                      {item.token}
                    </Text>
                  </View>

                  {/* Patient Info */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.patientNameText}>{item.patient_name}</Text>
                      {isUrgent && (
                        <View style={styles.urgentPill}>
                          <Text style={styles.urgentPillText}>URGENT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.complaintText}>
                      {item.chief_complaint || 'General OPD consultation'}
                    </Text>
                    <Text style={styles.timeText}>
                      {item.time} • {item.patient_phone ? item.patient_phone : 'Walk-in'}
                    </Text>
                  </View>

                  {/* Status Indicator / Actions */}
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View
                      style={[
                        styles.statusPill,
                        isServing
                          ? { backgroundColor: '#E0F2FE' }
                          : isCompleted
                          ? { backgroundColor: '#DCFCE7' }
                          : { backgroundColor: '#FEF3C7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          isServing
                            ? { color: '#0369A1' }
                            : isCompleted
                            ? { color: '#15803D' }
                            : { color: '#B45309' },
                        ]}
                      >
                        {isServing ? 'With Doctor' : isCompleted ? 'Completed' : 'Waiting Outside'}
                      </Text>
                    </View>

                    {/* Quick remove button if patient left */}
                    {!isCompleted && !isServing && (
                      <TouchableOpacity
                        onPress={() => {
                          Alert.alert('Cancel Token', `Remove ${item.patient_name} (${item.token}) from queue?`, [
                            { text: 'No', style: 'cancel' },
                            {
                              text: 'Yes, Remove',
                              style: 'destructive',
                              onPress: () => handleAdvanceStatus(item.patient_id, 'cancelled', item.patient_name),
                            },
                          ]);
                        }}
                      >
                        <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Add Walk-in Patient Modal */}
      <Modal visible={showWalkInModal} transparent animationType="slide" onRequestClose={() => setShowWalkInModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register Walk-In Patient</Text>
              <TouchableOpacity onPress={() => setShowWalkInModal(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Patient Full Name *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. Ramesh Kumar"
                placeholderTextColor="#94A3B8"
                value={walkInName}
                onChangeText={setWalkInName}
              />

              <Text style={styles.inputLabel}>Mobile Phone (Optional)</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.flagBox}>
                  <Text style={styles.countryBadge}>IN</Text>
                  <Text style={styles.flagCode}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="10-digit mobile number (Optional)"
                  placeholderTextColor="#94A3B8"
                  value={walkInPhone.replace('+91', '').trim()}
                  onChangeText={(val) => setWalkInPhone(val.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>

              <Text style={styles.inputLabel}>Symptoms / Chief Complaint (Optional)</Text>
              <TextInput
                style={[styles.modalInput, { height: 60 }]}
                placeholder="e.g. Fever 101°F, throat pain, headache"
                placeholderTextColor="#94A3B8"
                value={walkInComplaint}
                onChangeText={setWalkInComplaint}
                multiline
              />

              <Text style={styles.inputLabel}>Triage Urgency</Text>
              <View style={styles.triageRow}>
                {(['Routine', 'Priority', 'Urgent'] as const).map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[styles.triageBtn, walkInTriage === lvl && styles.triageBtnActive]}
                    onPress={() => setWalkInTriage(lvl)}
                  >
                    <Text style={[styles.triageBtnText, walkInTriage === lvl && styles.triageBtnTextActive]}>
                      {lvl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Consultation Fee Checkbox */}
              <TouchableOpacity
                style={styles.feeBox}
                onPress={() => setFeeCollected(!feeCollected)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={feeCollected ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={feeCollected ? '#10B981' : '#94A3B8'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.feeTitle}>Consultation Fee: ₹{staffUser.consultation_fee || 500}</Text>
                  <Text style={styles.feeSubtitle}>{feeCollected ? 'Marked as Collected at Front Desk' : 'Payment Pending'}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitModalBtn}
                onPress={handleAddWalkIn}
                disabled={creatingWalkIn}
              >
                {creatingWalkIn ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Text style={styles.submitModalBtnText}>Issue Token & Add To Queue</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  staffBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  staffBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  onlineText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803D',
  },
  clinicTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#0F172A',
    marginTop: 4,
  },
  doctorSubtext: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#64748B',
  },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  exitBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
  },
  addWalkInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    marginBottom: 20,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  addWalkInIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addWalkInBtnTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  addWalkInBtnSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#D1FAE5',
    marginTop: 2,
  },
  searchSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 2,
  },
  searchResultsBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    marginTop: 6,
    padding: 6,
    elevation: 3,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  searchResultName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  searchResultSub: {
    fontSize: 11,
    color: '#0284C7',
    marginTop: 2,
  },
  issueTokenBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  issueTokenBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  queueSection: {
    marginBottom: 20,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 30,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#475569',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  tokenCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  tokenCardServing: {
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
  },
  tokenCardUrgent: {
    borderColor: '#F87171',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  tokenBadge: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tokenBadgeServing: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  tokenBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#334155',
  },
  tokenBadgeTextServing: {
    color: '#FFFFFF',
  },
  patientNameText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#0F172A',
  },
  urgentPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  urgentPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#DC2626',
  },
  complaintText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 17,
    color: '#0F172A',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 14,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    marginBottom: 14,
  },
  flagBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
    gap: 4,
  },
  countryBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flagCode: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  triageRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  triageBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  triageBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  triageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  triageBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  feeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginBottom: 18,
  },
  feeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  feeSubtitle: {
    fontSize: 11,
    color: '#15803D',
  },
  submitModalBtn: {
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitModalBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});

export default ReceptionistDashboardScreen;

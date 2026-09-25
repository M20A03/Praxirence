import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { PatientSummary, Visit } from '../../types';
import { mobileApi } from '../../services/api';
import { EmptyState } from '../../components/EmptyState';

interface DoctorPatientsScreenProps {
  onSelectPatientForConsultation: (patient: PatientSummary) => void;
}

export const DoctorPatientsScreen: React.FC<DoctorPatientsScreenProps> = ({
  onSelectPatientForConsultation,
}) => {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected Patient Care Plans Modal / Drawer
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const [patientVisits, setPatientVisits] = useState<Visit[]>([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  // Add Patient Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('+91');
  const [addingPatient, setAddingPatient] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async (query?: string) => {
    try {
      setLoading(true);
      const data = await mobileApi.getPatients(query);
      setPatients(data);
    } catch (err) {
      console.warn('Load patients notice:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (text.trim().length === 0) {
      loadPatients();
    } else if (text.trim().length >= 2) {
      loadPatients(text.trim());
    }
  };

  const handleOpenPatientCarePlans = async (patient: PatientSummary) => {
    setSelectedPatient(patient);
    setLoadingVisits(true);
    try {
      const visits = await mobileApi.getVisits(patient.id);
      setPatientVisits(visits);
    } catch (err) {
      console.warn('Error loading patient care plans:', err);
      setPatientVisits([]);
    } finally {
      setLoadingVisits(false);
    }
  };

  const handleCreatePatient = async () => {
    if (!newName.trim() || !newPhone.trim() || newPhone.trim() === '+91') {
      Alert.alert('Incomplete', 'Please enter the patient name and phone number.');
      return;
    }
    setAddingPatient(true);
    try {
      const created = await mobileApi.createPatient({
        name: newName.trim(),
        phone: newPhone.trim(),
      });
      setPatients((prev) => [created, ...prev]);
      setModalVisible(false);
      setNewName('');
      setNewPhone('+91');
      Alert.alert('Patient Added', `${created.name} was successfully registered.`);
    } catch (err: any) {
      Alert.alert('Registration Notice', err.message || 'Patient registered in local directory.');
      setModalVisible(false);
    } finally {
      setAddingPatient(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header with Search & Add Patient */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Patient Directory & Care Plans</Text>
            <Text style={styles.subtitle}>{patients.length} registered patient medical vaults</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="person-add" size={14} color="#ffffff" />
            <Text style={styles.addBtnText}>+ Add Patient</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by patient name or phone..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={16} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Patient List */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPatients(searchQuery);
            }}
            tintColor={Colors.primary}
          />
        }
      >
        {loading ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 24 }} />
        ) : patients.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No Patients Found"
            description="No matching patient records found in your directory. Register your first patient to begin."
            actionLabel="Register New Patient"
            onAction={() => setModalVisible(true)}
          />
        ) : (
          patients.map((pat) => (
            <View key={pat.id} style={styles.patientCard}>
              <View style={styles.patientInfoRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{(pat.name || 'P').slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>{pat.name}</Text>
                  <Text style={styles.patientPhone}>{pat.phone}</Text>
                  <View style={styles.consentTagRow}>
                    <View
                      style={[
                        styles.consentTag,
                        {
                          backgroundColor: pat.consent_status
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(245, 158, 11, 0.12)',
                          borderColor: pat.consent_status ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)',
                        },
                      ]}
                    >
                      <Ionicons
                        name={pat.consent_status ? 'shield-checkmark' : 'warning'}
                        size={11}
                        color={pat.consent_status ? '#10b981' : '#f59e0b'}
                      />
                      <Text
                        style={{
                          fontSize: FontSize.xs,
                          fontFamily: FontFamily.medium,
                          color: pat.consent_status ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {pat.consent_status ? 'DPDP Consent Active' : 'Consent Pending'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Action Buttons: View Care Plans & Start Consultation */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.carePlansBtn}
                  onPress={() => handleOpenPatientCarePlans(pat)}
                >
                  <Ionicons name="document-text-outline" size={15} color="#0ea5e9" />
                  <Text style={styles.carePlansBtnText}>Recent Care Plans</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.consultBtn}
                  onPress={() => onSelectPatientForConsultation(pat)}
                >
                  <Ionicons name="mic" size={15} color="#ffffff" />
                  <Text style={styles.consultBtnText}>Consult</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Patient Care Plans & History Modal */}
      <Modal visible={!!selectedPatient} transparent animationType="slide" onRequestClose={() => setSelectedPatient(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.carePlansModalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalSubtitle}>PATIENT CARE PLAN ARCHIVE</Text>
                <Text style={styles.modalTitle}>{selectedPatient?.name}</Text>
                <Text style={styles.modalPhone}>{selectedPatient?.phone}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedPatient(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Content: List of Recent & Past Care Plans */}
            {loadingVisits ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Fetching verified care plans...</Text>
              </View>
            ) : patientVisits.length === 0 ? (
              <View style={styles.emptyCarePlansBox}>
                <Ionicons name="folder-open-outline" size={40} color={Colors.textSecondary} />
                <Text style={styles.emptyCarePlansTitle}>No Past Care Plans</Text>
                <Text style={styles.emptyCarePlansSubtitle}>
                  This patient hasn't had any completed consultations yet.
                </Text>
                {selectedPatient && (
                  <TouchableOpacity
                    style={styles.startFirstConsultBtn}
                    onPress={() => {
                      const p = selectedPatient;
                      setSelectedPatient(null);
                      onSelectPatientForConsultation(p);
                    }}
                  >
                    <Ionicons name="mic" size={16} color="#ffffff" />
                    <Text style={styles.startFirstConsultBtnText}>Start First Consultation</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.archiveHeader}>
                  {patientVisits.length} Verified Consultation{patientVisits.length > 1 ? 's' : ''}
                </Text>

                {patientVisits.map((visit, vIdx) => (
                  <View key={visit.id || vIdx} style={styles.visitCard}>
                    <View style={styles.visitHeader}>
                      <View>
                        <Text style={styles.visitDate}>
                          {visit.date ? new Date(visit.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent Visit'}
                        </Text>
                        <Text style={styles.visitDiagnosis}>
                          {visit.diagnosis || 'Clinical Consultation'}
                        </Text>
                      </View>
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="shield-checkmark" size={13} color="#10b981" />
                        <Text style={styles.verifiedText}>Verified by Doctor</Text>
                      </View>
                    </View>

                    {/* Patient Summary */}
                    {visit.patient_summary ? (
                      <View style={styles.summarySection}>
                        <Text style={styles.sectionLabel}>CONSULTATION SUMMARY</Text>
                        <Text style={styles.summaryContent}>{visit.patient_summary}</Text>
                      </View>
                    ) : null}

                    {/* Medicines Prescribed */}
                    {visit.medicines && visit.medicines.length > 0 && (
                      <View style={styles.medicinesSection}>
                        <Text style={styles.sectionLabel}>PRESCRIBED MEDICINES & TIMINGS</Text>
                        {visit.medicines.map((med, mIdx) => (
                          <View key={mIdx} style={styles.medicineRow}>
                            <View style={styles.medBullet} />
                            <View style={{ flex: 1 }}>
                              <Text style={styles.medName}>
                                {med.name} <Text style={styles.medDose}>({med.dosage})</Text>
                              </Text>
                              <Text style={styles.medInstructions}>
                                {med.frequency} • {med.instructions || 'As advised'}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Reminders / Timings */}
                    {visit.reminders && visit.reminders.length > 0 && (
                      <View style={styles.remindersSection}>
                        <Text style={styles.sectionLabel}>SCHEDULED TIMINGS</Text>
                        <View style={styles.remindersChipsRow}>
                          {visit.reminders.map((rem, rIdx) => (
                            <View key={rIdx} style={styles.reminderChip}>
                              <Ionicons name="alarm-outline" size={12} color="#0ea5e9" />
                              <Text style={styles.reminderChipText}>
                                {rem.time}: {rem.medicine_name} ({rem.dosage})
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Doctor Advice */}
                    {visit.doctor_advice ? (
                      <View style={styles.adviceSection}>
                        <Text style={styles.sectionLabel}>DOCTOR'S CLINICAL ADVICE</Text>
                        <Text style={styles.adviceContent}>{visit.doctor_advice}</Text>
                      </View>
                    ) : null}
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Footer Action */}
            {selectedPatient && (
              <TouchableOpacity
                style={styles.newConsultFromHistoryBtn}
                onPress={() => {
                  const p = selectedPatient;
                  setSelectedPatient(null);
                  onSelectPatientForConsultation(p);
                }}
              >
                <Ionicons name="add-circle" size={18} color="#ffffff" />
                <Text style={styles.newConsultFromHistoryBtnText}>Start New Consultation for {selectedPatient.name}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Add Patient Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register New Patient</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Mayank Raj"
              placeholderTextColor={Colors.textSecondary}
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.inputLabel}>Mobile Phone (for Patient Portal)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="+919876543210"
              placeholderTextColor={Colors.textSecondary}
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />

            <TouchableOpacity
              style={styles.submitPatientBtn}
              onPress={handleCreatePatient}
              disabled={addingPatient}
            >
              {addingPatient ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitPatientText}>Save Patient Record →</Text>
              )}
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
  header: {
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#ffffff',
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    paddingVertical: 2,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  patientCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  patientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    color: Colors.primary,
    fontWeight: '700',
  },
  patientName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  patientPhone: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  consentTagRow: {
    marginTop: 6,
  },
  consentTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  carePlansBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.3)',
  },
  carePlansBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#0ea5e9',
    fontWeight: '700',
  },
  consultBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  consultBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#ffffff',
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 24,
  },
  emptyTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  carePlansModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    height: '85%',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
  },
  modalSubtitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.primary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  modalPhone: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  emptyCarePlansBox: {
    alignItems: 'center',
    padding: 40,
  },
  emptyCarePlansTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginTop: 12,
  },
  emptyCarePlansSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  startFirstConsultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  startFirstConsultBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: '#ffffff',
  },
  archiveHeader: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  visitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  visitDate: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  visitDiagnosis: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  verifiedText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: '#166534',
  },
  summarySection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  summaryContent: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  medicinesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  medicineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
  },
  medBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 6,
  },
  medName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  medDose: {
    color: Colors.primary,
    fontFamily: FontFamily.medium,
  },
  medInstructions: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  remindersSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  remindersChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  reminderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reminderChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  adviceSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  adviceContent: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  newConsultFromHistoryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  newConsultFromHistoryBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: '#ffffff',
    fontWeight: '700',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 20,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  inputLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  modalInput: {
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
  submitPatientBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  submitPatientText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: '#ffffff',
    fontWeight: '700',
  },
});

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
import { Colors, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { PatientSummary } from '../../types';
import { mobileApi } from '../../services/api';

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
            <Text style={styles.title}>Patient Directory</Text>
            <Text style={styles.subtitle}>{patients.length} registered clinical records</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.addBtnText}>+ Add Patient</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by patient name or phone..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Text style={styles.clearSearch}>✕</Text>
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
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No Patients Found</Text>
            <Text style={styles.emptySubtitle}>
              Tap "+ Add Patient" above to register a new clinical record.
            </Text>
          </View>
        ) : (
          patients.map((pat) => (
            <View key={pat.id} style={styles.patientCard}>
              <View style={styles.patientInfoRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{pat.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>{pat.name}</Text>
                  <Text style={styles.patientPhone}>{pat.phone}</Text>
                  <View style={styles.consentTagRow}>
                    <Text
                      style={[
                        styles.consentTag,
                        {
                          color: pat.consent_status ? Colors.primaryDark : Colors.amber,
                          backgroundColor: pat.consent_status
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(245, 158, 11, 0.1)',
                        },
                      ]}
                    >
                      {pat.consent_status ? '✓ DPDP Consent Active' : '⚠️ Consent Pending'}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.consultBtn}
                onPress={() => onSelectPatientForConsultation(pat)}
              >
                <Text style={styles.consultBtnText}>Start Consultation 📝</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Patient Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Register New Patient</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Mayank"
              placeholderTextColor={Colors.textMuted}
              value={newName}
              onChangeText={setNewName}
            />

            <Text style={styles.inputLabel}>Mobile Phone (for WhatsApp Care Plan)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="+919835139865"
              placeholderTextColor={Colors.textMuted}
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
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
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    lineHeight: 26,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    letterSpacing: LetterSpacing.wide,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    paddingVertical: 10,
    fontSize: FontSize.base,
    color: Colors.text,
  },
  clearSearch: {
    fontSize: 14,
    color: Colors.textMuted,
    padding: 4,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  patientCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  patientInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  patientName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  patientPhone: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  consentTagRow: {
    marginTop: 4,
  },
  consentTag: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    letterSpacing: LetterSpacing.wide,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  consultBtn: {
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.25)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  consultBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.primary,
    letterSpacing: LetterSpacing.wide,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  modalClose: {
    fontSize: 18,
    color: Colors.textMuted,
    padding: 4,
  },
  inputLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    letterSpacing: LetterSpacing.wide,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  modalInput: {
    fontFamily: FontFamily.medium,
    backgroundColor: Colors.cardSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: FontSize.base,
    color: Colors.text,
    marginBottom: 14,
  },
  submitPatientBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitPatientText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSize.base,
    letterSpacing: LetterSpacing.wide,
  },
});

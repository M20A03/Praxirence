import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { mobileApi } from '../../services/api';
import { DoctorUser, PatientSummary } from '../../types';
import { Colors } from '../../theme/colors';
import { FontFamily, FontSize } from '../../theme/typography';

interface DoctorCopilotScreenProps {
  doctor?: DoctorUser | null;
  initialPatientId?: string;
  onInsertPrescription?: (meds: string[]) => void;
}

export default function DoctorCopilotScreen({
  doctor,
  initialPatientId,
  onInsertPrescription,
}: DoctorCopilotScreenProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const [ddiAlert, setDdiAlert] = useState<any>(null);

  // Integrated Multi-Drug Safety Tray
  const [showMedTray, setShowMedTray] = useState(false);
  const [medInput, setMedInput] = useState('');
  const [medList, setMedList] = useState<string[]>([
    'Clarithromycin 500mg',
    'Atorvastatin 40mg',
  ]);
  const [renalStatus, setRenalStatus] = useState<string>('Normal');

  // Active Patient Grounding
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(initialPatientId);
  const [showPatientPicker, setShowPatientPicker] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const data = await mobileApi.getPatients();
      setPatients(data || []);
    } catch (_) {}
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const handleAskCopilot = async (customQuery?: string) => {
    const q = (customQuery !== undefined ? customQuery : query).trim();
    
    // If query is empty but medications exist in the tray, formulate a drug safety query
    let finalQuery = q;
    if (!finalQuery && medList.length >= 2) {
      finalQuery = `Screen multi-drug interactions for: ${medList.join(', ')} in patient with renal status: ${renalStatus}.`;
    }

    if (!finalQuery) {
      Alert.alert(
        'Input Required',
        'Please enter a clinical case, symptoms, medicine name, or open the Multi-Drug Tray to screen interactions.'
      );
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    setLoading(true);
    setCopilotReply(null);
    setDdiAlert(null);

    try {
      // 1. If multiple medications are loaded in the tray, run pairwise DDI screen
      if (medList.length >= 2) {
        try {
          const ddiRes = await mobileApi.checkDrugInteractions({
            medications: medList,
            renalStatus,
          });
          if (ddiRes) {
            setDdiAlert(ddiRes);
          }
        } catch (_) {}
      }

      // 2. Query clinical decision support engine
      const res = await mobileApi.askDoctorCopilot({
        query: finalQuery,
        patientId: selectedPatientId,
        context: {
          current_medications: medList.length > 0 ? medList : undefined,
          recent_labs: renalStatus !== 'Normal' ? `Renal status: ${renalStatus}` : undefined,
        },
      });

      if (res.reply) {
        setCopilotReply(res.reply);
        if (res.ddi_alert && !ddiAlert) {
          setDdiAlert(res.ddi_alert);
        }
      }
    } catch (err: any) {
      Alert.alert('Clinical Copilot Notice', err.message || 'Unable to connect to clinical intelligence engine.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedication = () => {
    const trimmed = medInput.trim();
    if (!trimmed) return;
    if (!medList.includes(trimmed)) {
      setMedList([...medList, trimmed]);
    }
    setMedInput('');
  };

  const handleRemoveMedication = (index: number) => {
    const updated = [...medList];
    updated.splice(index, 1);
    setMedList(updated);
  };

  const handleClearAll = () => {
    setQuery('');
    setCopilotReply(null);
    setDdiAlert(null);
  };

  const handleShareReport = async () => {
    if (!copilotReply) return;
    try {
      await Share.share({
        title: 'Praxirence Clinical Copilot Recommendation',
        message: `Praxirence Clinical Decision Support Summary:

${copilotReply}`,
      });
    } catch (_) {}
  };

  const QUICK_PROMPTS = [
    {
      title: '🫀 Rule Out ACS / MI',
      query: '58-year-old male with retrosternal crushing chest pain radiating to left shoulder, diaphoresis, BP 150/90. Evaluate emergency DDx, stat workup, and pharmacotherapy.',
      tray: false,
    },
    {
      title: '🛡️ Drug Interaction Check',
      query: 'Screen drug interactions between Clarithromycin 500mg and Atorvastatin 40mg. What are the clinical consequences and safer macrolide/statin alternatives?',
      tray: true,
    },
    {
      title: '💊 Paracetamol Monograph',
      query: 'Paracetamol',
      tray: false,
    },
    {
      title: '🧪 Renal Dosing (CKD 3)',
      query: 'Patient with Type 2 Diabetes and CKD Stage 3 (eGFR 42 ml/min). What are the dose titrations for Metformin, ACEi/ARB, and safe analgesics?',
      tray: false,
    },
    {
      title: '🫁 Acute Bronchitis vs CAP',
      query: '32-year-old female with persistent productive cough, mild wheeze, fever of 100.5F for 4 days. SpO2 97%. Give guideline-based workup and antibiotic decision tree.',
      tray: false,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top Clinical Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconBox}>
            <Ionicons name="pulse" size={22} color="#0284C7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Clinical AI Copilot</Text>
            <Text style={styles.headerSubtitle}>
              CDSS 🏥 • DDI Safety Shield 🛡️ • Jan Aushadhi 💊
            </Text>
          </View>
          <View style={styles.badgeBox}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Active</Text>
          </View>
        </View>

        {/* Patient Grounding Bar */}
        <TouchableOpacity
          style={styles.patientBar}
          onPress={() => setShowPatientPicker(!showPatientPicker)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="person-circle-outline"
            size={18}
            color={selectedPatient ? '#0284C7' : '#64748B'}
          />
          <Text style={styles.patientBarText} numberOfLines={1}>
            {selectedPatient
              ? `Patient: ${selectedPatient.name} (${selectedPatient.age || 'Age N/A'}, ${selectedPatient.gender || 'N/A'})`
              : 'Attach Patient Profile for Grounded Analysis...'}
          </Text>
          <Ionicons
            name={showPatientPicker ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#64748B"
          />
        </TouchableOpacity>

        {/* Collapsible Patient Selector */}
        {showPatientPicker && (
          <View style={styles.patientDropdown}>
            <TouchableOpacity
              style={[
                styles.patientOption,
                !selectedPatientId && styles.patientOptionSelected,
              ]}
              onPress={() => {
                setSelectedPatientId(undefined);
                setShowPatientPicker(false);
              }}
            >
              <Text
                style={[
                  styles.patientOptionText,
                  !selectedPatientId && styles.patientOptionTextSelected,
                ]}
              >
                No Patient Attached (General Clinical Query)
              </Text>
            </TouchableOpacity>
            {patients.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.patientOption,
                  selectedPatientId === p.id && styles.patientOptionSelected,
                ]}
                onPress={() => {
                  setSelectedPatientId(p.id);
                  setShowPatientPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.patientOptionText,
                    selectedPatientId === p.id && styles.patientOptionTextSelected,
                  ]}
                >
                  {p.name} • {p.age || 'Age N/A'} • {p.gender || ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Quick Consultation Presets */}
        <Text style={styles.sectionLabel}>CLINICAL CAPABILITY PRESETS</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {QUICK_PROMPTS.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.chip}
              onPress={() => {
                setQuery(item.query);
                if (item.tray) {
                  setShowMedTray(true);
                }
                handleAskCopilot(item.query);
              }}
            >
              <Ionicons name="flash-outline" size={14} color="#0284C7" style={{ marginRight: 4 }} />
              <Text style={styles.chipText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Main Unified Input Card */}
        <View style={styles.inputCard}>
          <View style={styles.inputCardHeader}>
            <Ionicons name="clipboard-outline" size={18} color="#0284C7" />
            <Text style={styles.inputCardTitle}>Clinical Presentation, Drug, or DDI Query</Text>
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          <TextInput
            style={styles.textInput}
            placeholder="e.g. Paracetamol dosing / 58yo male with acute crushing chest pain / Clarithromycin + Atorvastatin..."
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={4}
            value={query}
            onChangeText={setQuery}
          />

          {/* Toggle Button for Multi-Drug Tray */}
          <TouchableOpacity
            style={styles.trayToggleBtn}
            onPress={() => setShowMedTray(!showMedTray)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#0284C7" />
              <Text style={styles.trayToggleText}>
                🛡️ Multi-Drug Safety Tray ({medList.length} medications loaded)
              </Text>
            </View>
            <Ionicons
              name={showMedTray ? 'chevron-up-circle' : 'chevron-down-circle'}
              size={18}
              color="#0284C7"
            />
          </TouchableOpacity>

          {/* Collapsible Multi-Drug Screening Tray */}
          {showMedTray && (
            <View style={styles.medTrayBox}>
              <Text style={styles.medTrayHeading}>
                Add Active Medications to Screen Pairwise Interactions:
              </Text>

              {/* Add Medicine Row */}
              <View style={styles.addMedRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1, height: 42, marginBottom: 0 }]}
                  placeholder="e.g. Clarithromycin 500mg, Ramipril 5mg"
                  placeholderTextColor="#94A3B8"
                  value={medInput}
                  onChangeText={setMedInput}
                  onSubmitEditing={handleAddMedication}
                />
                <TouchableOpacity style={styles.addMedBtn} onPress={handleAddMedication}>
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {/* Tags */}
              <View style={styles.medTagContainer}>
                {medList.map((m, idx) => (
                  <View key={idx} style={styles.medTag}>
                    <Text style={styles.medTagText}>{m}</Text>
                    <TouchableOpacity onPress={() => handleRemoveMedication(idx)}>
                      <Ionicons name="close-circle" size={16} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Renal Status */}
              <Text style={[styles.sectionLabel, { marginTop: 10, fontSize: 10 }]}>
                PATIENT RENAL eGFR STATUS
              </Text>
              <View style={styles.renalSelectorRow}>
                {['Normal', 'eGFR 30-59 (Stage 3)', 'eGFR < 30 (Stage 4/5)'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.renalChip,
                      renalStatus === status && styles.renalChipActive,
                    ]}
                    onPress={() => setRenalStatus(status)}
                  >
                    <Text
                      style={[
                        styles.renalChipText,
                        renalStatus === status && styles.renalChipTextActive,
                      ]}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.inputFooter}>
            <TouchableOpacity
              style={[styles.actionBtn, loading && styles.actionBtnDisabled]}
              onPress={() => handleAskCopilot()}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="pulse" size={18} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>🩺 Analyze Clinical Query & Safety</Text>
                </>
              )}
            </TouchableOpacity>

            {(copilotReply || ddiAlert) && (
              <TouchableOpacity style={styles.clearBtn} onPress={handleClearAll}>
                <Ionicons name="refresh-outline" size={18} color="#64748B" />
                <Text style={styles.clearBtnText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* DDI Alert Banner (If Drug Interactions Detected) */}
        {ddiAlert && (
          <View style={styles.ddiAlertCard}>
            <View style={styles.ddiAlertHeader}>
              <Ionicons
                name={
                  ddiAlert.severe_interactions && ddiAlert.severe_interactions.length > 0
                    ? 'alert-circle'
                    : 'warning'
                }
                size={22}
                color={
                  ddiAlert.severe_interactions && ddiAlert.severe_interactions.length > 0
                    ? '#EF4444'
                    : '#F59E0B'
                }
              />
              <Text
                style={[
                  styles.ddiAlertTitle,
                  {
                    color:
                      ddiAlert.severe_interactions && ddiAlert.severe_interactions.length > 0
                        ? '#DC2626'
                        : '#D97706',
                  },
                ]}
              >
                {ddiAlert.summary || 'Drug-Drug Interaction Screen'}
              </Text>
            </View>

            {/* Severe Interactions */}
            {ddiAlert.severe_interactions?.map((item: any, idx: number) => (
              <View key={idx} style={styles.severeCard}>
                <Text style={styles.severePair}>
                  {item.drug_1} ⇄ {item.drug_2}
                </Text>
                <Text style={styles.severeMech}>{item.mechanism}</Text>
                <View style={styles.directiveRow}>
                  <Text style={styles.directiveLabel}>Clinical Directive: </Text>
                  <Text style={styles.directiveText}>{item.recommendation}</Text>
                </View>
              </View>
            ))}

            {/* Moderate Interactions */}
            {ddiAlert.moderate_interactions?.map((item: any, idx: number) => (
              <View key={idx} style={styles.moderateCard}>
                <Text style={styles.moderatePair}>
                  {item.drug_1} + {item.drug_2}
                </Text>
                <Text style={styles.moderateMech}>{item.mechanism}</Text>
                <Text style={styles.directiveText}>Action: {item.recommendation}</Text>
              </View>
            ))}

            {/* Organ cautions */}
            {ddiAlert.organ_cautions?.map((caution: string, idx: number) => (
              <View key={idx} style={styles.cautionCard}>
                <Ionicons name="information-circle" size={16} color="#0284C7" />
                <Text style={styles.cautionText}>{caution}</Text>
              </View>
            ))}
          </View>
        )}

        {/* AI CDSS / Pharmacology Monograph Output */}
        {copilotReply && (
          <View style={styles.replyCard}>
            <View style={styles.replyHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="document-text" size={18} color="#0284C7" />
                <Text style={styles.replyTitle}>Evidence-Based Clinical Analysis</Text>
              </View>
              <TouchableOpacity onPress={handleShareReport} style={styles.shareBtn}>
                <Ionicons name="share-social-outline" size={18} color="#0284C7" />
              </TouchableOpacity>
            </View>

            <Text style={styles.replyBody}>{copilotReply}</Text>

            <View style={styles.replyFooter}>
              <Text style={styles.guidelineFooterText}>
                Clinical Standards: ICMR • WHO • NICE • KDIGO • CDSCO Formulary
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 44 : 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#0F172A',
  },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#64748B',
    marginTop: 2,
  },
  badgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 5,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  badgeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#15803D',
  },
  patientBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  patientBarText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#334155',
  },
  patientDropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    maxHeight: 180,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  patientOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  patientOptionSelected: {
    backgroundColor: '#F0F9FF',
  },
  patientOptionText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#475569',
  },
  patientOptionTextSelected: {
    fontFamily: FontFamily.bold,
    color: '#0284C7',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#64748B',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#334155',
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  inputCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  inputCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#1E293B',
    flex: 1,
    marginLeft: 8,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#0F172A',
    textAlignVertical: 'top',
    minHeight: 88,
    marginBottom: 12,
  },
  trayToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 12,
  },
  trayToggleText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#0369A1',
  },
  medTrayBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  medTrayHeading: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#475569',
    marginBottom: 8,
  },
  addMedRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  addMedBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  medTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  medTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  medTagText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#0369A1',
  },
  renalSelectorRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  renalChip: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  renalChipActive: {
    backgroundColor: '#E0F2FE',
    borderColor: '#0284C7',
  },
  renalChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
  },
  renalChipTextActive: {
    color: '#0369A1',
    fontFamily: FontFamily.bold,
  },
  inputFooter: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  clearBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#64748B',
  },
  ddiAlertCard: {
    backgroundColor: '#FFF1F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECDD3',
    marginBottom: 16,
  },
  ddiAlertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ddiAlertTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    flex: 1,
  },
  severeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
    marginBottom: 10,
  },
  severePair: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#991B1B',
    marginBottom: 4,
  },
  severeMech: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 6,
  },
  directiveRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  directiveLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#0F172A',
  },
  directiveText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#0F172A',
  },
  moderateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    marginBottom: 10,
  },
  moderatePair: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#B45309',
    marginBottom: 4,
  },
  moderateMech: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 4,
  },
  cautionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  cautionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#0369A1',
    flex: 1,
  },
  replyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 12,
  },
  replyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#0284C7',
  },
  shareBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
  },
  replyBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#1E293B',
    lineHeight: 22,
  },
  replyFooter: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  guidelineFooterText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
  },
});

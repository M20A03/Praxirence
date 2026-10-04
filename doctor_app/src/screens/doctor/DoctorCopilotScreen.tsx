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
  const [activeTab, setActiveTab] = useState<'cdss' | 'ddi'>('cdss');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [copilotReply, setCopilotReply] = useState<string | null>(null);
  const [ddiAlert, setDdiAlert] = useState<any>(null);

  // DDI Dedicated Mode state
  const [medInput, setMedInput] = useState('');
  const [medList, setMedList] = useState<string[]>([
    'Clarithromycin 500mg',
    'Atorvastatin 40mg',
  ]);
  const [renalStatus, setRenalStatus] = useState<string>('Normal');
  const [ddiResult, setDdiResult] = useState<any>(null);
  const [ddiLoading, setDdiLoading] = useState(false);

  // Patients list for grounding
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(initialPatientId);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const data = await mobileApi.getPatients();
      setPatients(data || []);
    } catch (_) {}
  };

  const handleAskCopilot = async (customQuery?: string) => {
    const q = (customQuery || query).trim();
    if (!q) {
      Alert.alert('Input Required', 'Please enter a clinical query or symptom presentation.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    setLoading(true);
    setCopilotReply(null);
    setDdiAlert(null);

    try {
      const res = await mobileApi.askDoctorCopilot({
        query: q,
        patientId: selectedPatientId,
      });

      if (res.reply) {
        setCopilotReply(res.reply);
        if (res.ddi_alert) {
          setDdiAlert(res.ddi_alert);
        }
      }
    } catch (err: any) {
      Alert.alert('Clinical Copilot Notice', err.message || 'Unable to connect to clinical intelligence engine.');
    } finally {
      setLoading(false);
    }
  };

  const handleRunDdiCheck = async () => {
    if (medList.length < 2) {
      Alert.alert('Medications Needed', 'Add at least 2 medications to screen for Drug-Drug Interactions.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    setDdiLoading(true);
    try {
      const res = await mobileApi.checkDrugInteractions({
        medications: medList,
        renalStatus,
      });
      setDdiResult(res);
    } catch (err: any) {
      Alert.alert('DDI Check Notice', err.message || 'Failed to screen drug interactions.');
    } finally {
      setDdiLoading(false);
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

  const handleShareReport = async () => {
    if (!copilotReply) return;
    try {
      await Share.share({
        title: 'Praxirence Clinical Copilot Recommendation',
        message: `Praxirence CDSS Clinical Summary:\n\n${copilotReply}`,
      });
    } catch (_) {}
  };

  const QUICK_PROMPTS = [
    {
      title: 'Rule Out ACS',
      query: '58-year-old male with retrosternal crushing chest pain radiating to left shoulder, diaphoresis, BP 150/90. Evaluate emergency DDx, stat workup, and pharmacotherapy.',
    },
    {
      title: 'Acute Bronchitis vs Pneumonia',
      query: '32-year-old female with persistent productive cough, mild wheeze, fever of 100.5F for 4 days. Non-smoker. SpO2 97%. Give guideline-based workup and antibiotic decision tree.',
    },
    {
      title: 'Migraine with Nausea',
      query: '28-year-old female presenting with severe throbbing unilateral headache with photophobia and persistent nausea. Prescribe acute abortive therapy and contraindication checks.',
    },
    {
      title: 'Renal Dosing (CKD Stage 3)',
      query: 'Patient with Type 2 Diabetes and CKD Stage 3 (eGFR 42 ml/min). What are the dose titrations for Metformin, ACEi/ARB, and safe analgesics?',
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
            <Ionicons name="sparkles" size={22} color="#0284C7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Clinical AI Copilot</Text>
            <Text style={styles.headerSubtitle}>
              CDSS • ICMR / WHO Guidelines • DDI Shield
            </Text>
          </View>
          <View style={styles.badgeBox}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Active</Text>
          </View>
        </View>

        {/* Mode Selector Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'cdss' && styles.tabButtonActive]}
            onPress={() => setActiveTab('cdss')}
          >
            <Ionicons
              name="medkit"
              size={16}
              color={activeTab === 'cdss' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'cdss' && styles.tabTextActive]}>
              Diagnostic & Rx Copilot
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'ddi' && styles.tabButtonActive]}
            onPress={() => setActiveTab('ddi')}
          >
            <Ionicons
              name="shield-checkmark"
              size={16}
              color={activeTab === 'ddi' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.tabText, activeTab === 'ddi' && styles.tabTextActive]}>
              DDI Safety Shield
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeTab === 'cdss' ? (
          <>
            {/* Quick Consultation Presets */}
            <Text style={styles.sectionLabel}>CLINICAL DECISION PRESETS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {QUICK_PROMPTS.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.chip}
                  onPress={() => {
                    setQuery(item.query);
                    handleAskCopilot(item.query);
                  }}
                >
                  <Ionicons name="flash-outline" size={14} color="#0284C7" style={{ marginRight: 4 }} />
                  <Text style={styles.chipText}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Input Query Card */}
            <View style={styles.inputCard}>
              <View style={styles.inputCardHeader}>
                <Ionicons name="clipboard-outline" size={18} color="#0284C7" />
                <Text style={styles.inputCardTitle}>Clinical Presentation or Query</Text>
              </View>
              <TextInput
                style={styles.textInput}
                placeholder="Enter patient vitals, chief complaints, symptoms, or ask drug interaction queries..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                value={query}
                onChangeText={setQuery}
              />

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
                      <Ionicons name="analytics-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.actionBtnText}>Analyze Clinical Case</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* DDI Alert Banner (if any) */}
            {ddiAlert && (ddiAlert.severe_interactions?.length > 0 || ddiAlert.moderate_interactions?.length > 0) && (
              <View style={styles.ddiWarningCard}>
                <View style={styles.warningTitleRow}>
                  <Ionicons name="warning" size={20} color="#DC2626" />
                  <Text style={styles.warningTitle}>Pharmacological Interaction Warning</Text>
                </View>
                {ddiAlert.severe_interactions?.map((s: any, i: number) => (
                  <View key={i} style={styles.warningBox}>
                    <Text style={styles.warningDrugNames}>{s.drug_1} + {s.drug_2}</Text>
                    <Text style={styles.warningDesc}>{s.mechanism}</Text>
                    <Text style={styles.warningAction}>Action: {s.recommendation}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* AI Recommendation Output */}
            {copilotReply && (
              <View style={styles.replyCard}>
                <View style={styles.replyHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="document-text" size={18} color="#0284C7" />
                    <Text style={styles.replyTitle}>Evidence-Based CDSS Recommendation</Text>
                  </View>
                  <TouchableOpacity onPress={handleShareReport} style={styles.shareBtn}>
                    <Ionicons name="share-outline" size={18} color="#0284C7" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.replyBody}>{copilotReply}</Text>

                <View style={styles.replyFooter}>
                  <Text style={styles.guidelineFooterText}>
                    Guidelines: ICMR • WHO • NICE • AHA/ACC • KDIGO
                  </Text>
                </View>
              </View>
            )}
          </>
        ) : (
          /* DDI Dedicated Safety Shield Tab */
          <View style={styles.ddiContainer}>
            <View style={styles.inputCard}>
              <View style={styles.inputCardHeader}>
                <Ionicons name="shield-outline" size={18} color="#0284C7" />
                <Text style={styles.inputCardTitle}>Active Medication Regimen</Text>
              </View>

              {/* Add Medicine Row */}
              <View style={styles.addMedRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1, height: 44, marginBottom: 0 }]}
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

              {/* Renal Status Picker */}
              <Text style={[styles.sectionLabel, { marginTop: 14 }]}>PATIENT RENAL eGFR STATUS</Text>
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

              <TouchableOpacity
                style={[styles.actionBtn, { marginTop: 16 }]}
                onPress={handleRunDdiCheck}
                disabled={ddiLoading}
              >
                {ddiLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Screen Drug-Drug Interactions</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* DDI Results */}
            {ddiResult && (
              <View style={styles.ddiResultCard}>
                <Text style={styles.ddiSummaryText}>{ddiResult.summary}</Text>

                {ddiResult.severe_interactions?.length > 0 && (
                  <View style={styles.severeSection}>
                    <Text style={styles.dangerHeading}>CRITICAL / CONTRAINDICATED (BOXED WARNING)</Text>
                    {ddiResult.severe_interactions.map((item: any, idx: number) => (
                      <View key={idx} style={styles.dangerBox}>
                        <Text style={styles.dangerDrugs}>{item.drug_1} ⇄ {item.drug_2}</Text>
                        <Text style={styles.dangerMech}>{item.mechanism}</Text>
                        <Text style={styles.dangerRec}>Clinical Directive: {item.recommendation}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {ddiResult.moderate_interactions?.length > 0 && (
                  <View style={styles.moderateSection}>
                    <Text style={styles.moderateHeading}>MODERATE INTERACTIONS (MONITORING REQUIRED)</Text>
                    {ddiResult.moderate_interactions.map((item: any, idx: number) => (
                      <View key={idx} style={styles.moderateBox}>
                        <Text style={styles.moderateDrugs}>{item.drug_1} ⇄ {item.drug_2}</Text>
                        <Text style={styles.moderateMech}>{item.mechanism}</Text>
                        <Text style={styles.moderateRec}>Directive: {item.recommendation}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {ddiResult.organ_cautions?.length > 0 && (
                  <View style={styles.organSection}>
                    <Text style={styles.organHeading}>RENAL / ORGAN TITRATIONS</Text>
                    {ddiResult.organ_cautions.map((c: string, idx: number) => (
                      <Text key={idx} style={styles.organText}>• {c}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}
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
    paddingTop: Platform.OS === 'ios' ? 54 : 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  headerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: '#0F172A',
  },
  headerSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  badgeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  badgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#065F46',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: '#0284C7',
  },
  tabText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    marginRight: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#334155',
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 2,
  },
  inputCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  inputCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#1E293B',
  },
  textInput: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
  ddiWarningCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  warningTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  warningTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#991B1B',
  },
  warningBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#DC2626',
  },
  warningDrugNames: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#DC2626',
  },
  warningDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#475569',
    marginTop: 3,
  },
  warningAction: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#0F172A',
    marginTop: 4,
  },
  replyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  replyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 14,
  },
  replyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#0284C7',
  },
  shareBtn: {
    padding: 4,
  },
  replyBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#1E293B',
    lineHeight: 22,
  },
  replyFooter: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  guidelineFooterText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#94A3B8',
  },
  ddiContainer: {
    flex: 1,
  },
  addMedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  addMedBtn: {
    backgroundColor: '#0284C7',
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medTagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  medTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  medTagText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#334155',
  },
  renalSelectorRow: {
    flexDirection: 'row',
    gap: 6,
  },
  renalChip: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  },
  renalChipTextActive: {
    fontFamily: FontFamily.bold,
    color: '#0284C7',
  },
  ddiResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ddiSummaryText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#0F172A',
    marginBottom: 12,
  },
  severeSection: {
    marginTop: 10,
  },
  dangerHeading: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#DC2626',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dangerBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  dangerDrugs: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#991B1B',
  },
  dangerMech: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#475569',
    marginTop: 4,
  },
  dangerRec: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#0F172A',
    marginTop: 6,
  },
  moderateSection: {
    marginTop: 10,
  },
  moderateHeading: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#D97706',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  moderateBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  moderateDrugs: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#B45309',
  },
  moderateMech: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: '#78350F',
    marginTop: 4,
  },
  moderateRec: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#0F172A',
    marginTop: 6,
  },
  organSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  organHeading: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#475569',
    marginBottom: 6,
  },
  organText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#334155',
    lineHeight: 18,
  },
});

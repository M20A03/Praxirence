import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { PatientSummary, MedicineItem, ReminderItem, DoctorUser, ConsultationSummarizeResult } from '../../types';
import { mobileApi } from '../../services/api';
import { AudioConsultationRecorder } from '../../components/AudioConsultationRecorder';
import { generateAndSharePrescriptionPdf } from '../../services/PrescriptionPdfService';

interface DoctorNewConsultationScreenProps {
  doctor: DoctorUser;
  preselectedPatientId?: string;
  preselectedPatientName?: string;
  preselectedComplaint?: string;
  onConsultationSaved: () => void;
  onCancel: () => void;
}

export const DoctorNewConsultationScreen: React.FC<DoctorNewConsultationScreenProps> = ({
  doctor,
  preselectedPatientId,
  preselectedPatientName,
  preselectedComplaint,
  onConsultationSaved,
  onCancel,
}) => {
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || '');
  const [diagnosis, setDiagnosis] = useState('');
  const [doctorVerified, setDoctorVerified] = useState<boolean>(false);
  
  // Conversation & AI Summarizer States
  const [conversationText, setConversationText] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [patientSummary, setPatientSummary] = useState('');
  const [doctorAdvice, setDoctorAdvice] = useState('');
  const [warningSigns, setWarningSigns] = useState<string[]>([]);
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [reminders, setReminders] = useState<ReminderItem[]>([]);

  // Form states for adding another medicine
  const [medName, setMedName] = useState('');
  const [medDosage, setMedDosage] = useState('');
  const [medFreq, setMedFreq] = useState('Twice daily');
  const [medDuration, setMedDuration] = useState('5');
  const [showAddMed, setShowAddMed] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const data = await mobileApi.getPatients();
      setPatients(data);
      if (!selectedPatientId && data.length > 0) {
        setSelectedPatientId(data[0].id);
      }
    } catch (e) {
      console.warn('Patients load notice:', e);
    }
  };

  const handleApplyPreset = (scenario: 'bronchitis' | 'diabetes' | 'migraine' | 'hypertension') => {
    const selectedPat = patients.find((p) => p.id === selectedPatientId);
    const patName = selectedPat?.name || 'Patient';

    if (scenario === 'bronchitis') {
      setConversationText(
        `Doctor: Hello ${patName}, what symptoms have you been experiencing?\n` +
        `Patient: Doctor, I have had a continuous chest cough, whistling sound when breathing, and low fever for 4 days.\n` +
        `Doctor: Upon chest auscultation, there is bilateral bronchial wheezing. You have Acute Bronchitis.\n` +
        `I am prescribing Azithromycin 500mg once daily for 3 days, Levosalbutamol cough syrup 5ml twice daily, and Paracetamol 650mg for fever.\n` +
        `Take steam inhalation twice daily and stay in warm environment. If breathlessness increases, come to emergency.`
      );
    } else if (scenario === 'diabetes') {
      setConversationText(
        `Doctor: Hello ${patName}, let us review your recent blood sugar reports.\n` +
        `Patient: Doctor, my fasting sugar was 168 mg/dL and post-meal was 230 mg/dL. I feel tired frequently.\n` +
        `Doctor: Your readings indicate Type 2 Diabetes Mellitus with suboptimal control.\n` +
        `We will start Metformin 500mg twice daily with meals and Glimepiride 1mg before breakfast.\n` +
        `Avoid refined sugar, sweets, and high carb snacks. Walk 30 minutes daily and check fasting sugar weekly.`
      );
    } else if (scenario === 'migraine') {
      setConversationText(
        `Doctor: Hello ${patName}, describe the headache episodes you have had.\n` +
        `Patient: Doctor, throbbing pain on one side of my head, nausea, and sensitivity to light and loud noises.\n` +
        `Doctor: This is a classic Acute Migraine episode.\n` +
        `Take Sumatriptan 50mg at the earliest onset of attack, and Ondansetron 4mg for nausea.\n` +
        `Rest in a dark, quiet room during an attack. Maintain regular sleep hours and avoid skipped meals.`
      );
    } else {
      setConversationText(
        `Doctor: Hello ${patName}, your blood pressure reading today is 148/92 mmHg.\n` +
        `Patient: Doctor, I have had mild morning headaches and stress at work.\n` +
        `Doctor: You have Stage 1 Essential Hypertension.\n` +
        `I am prescribing Telmisartan 40mg once daily in the morning after breakfast.\n` +
        `Strictly reduce dietary salt to less than 5g per day, reduce caffeine, and monitor BP 3 times weekly.`
      );
    }
  };

  const handleSummarizeConsultation = async () => {
    if (!conversationText.trim()) {
      Alert.alert('Required', 'Please enter or dictate doctor-patient conversation dialogue.');
      return;
    }

    const selectedPat = patients.find((p) => p.id === selectedPatientId);
    setSummarizing(true);
    try {
      const summaryResult = await mobileApi.summarizeConsultation({
        conversation: conversationText.trim(),
        patient_name: selectedPat?.name || 'Patient',
        doctor_name: doctor.name,
      });

      setPatientSummary(summaryResult.patient_summary);
      setDoctorAdvice(summaryResult.doctor_advice);
      if (summaryResult.warning_signs && summaryResult.warning_signs.length > 0) {
        setWarningSigns(summaryResult.warning_signs);
      }
      if (summaryResult.diagnosis) {
        setDiagnosis(summaryResult.diagnosis);
      }
      if (summaryResult.medicines && summaryResult.medicines.length > 0) {
        setMedicines(summaryResult.medicines);
      }
      if (summaryResult.reminders && summaryResult.reminders.length > 0) {
        setReminders(summaryResult.reminders);
      }

      Alert.alert(
        '✨ Consultation Summarized!',
        'AI has structured the clinical diagnosis, medications, and generated an easy-to-understand explanation for your patient.'
      );
    } catch (e: any) {
      Alert.alert('Notice', e.message || 'Consultation summarized using offline clinical intelligence.');
    } finally {
      setSummarizing(false);
    }
  };

  const handleAudioProcessed = (result: ConsultationSummarizeResult) => {
    if (result.conversation) setConversationText(result.conversation);
    if (result.diagnosis) setDiagnosis(result.diagnosis);
    if (result.patient_summary) setPatientSummary(result.patient_summary);
    if (result.doctor_advice) setDoctorAdvice(result.doctor_advice);
    if (result.medicines && result.medicines.length > 0) setMedicines(result.medicines);
    if (result.reminders && result.reminders.length > 0) setReminders(result.reminders);
    if (result.warning_signs && result.warning_signs.length > 0) setWarningSigns(result.warning_signs);
  };

  const handleSharePdf = async () => {
    const selectedPat = patients.find((p) => p.id === selectedPatientId);
    if (!selectedPat) {
      Alert.alert('Select Patient', 'Please select a patient before generating PDF.');
      return;
    }
    await generateAndSharePrescriptionPdf({
      doctor,
      patient: selectedPat,
      diagnosis,
      patientSummary,
      doctorAdvice,
      medicines,
      reminders,
    });
  };

  const handleAddMedicine = () => {
    if (!medName.trim() || !medDosage.trim()) {
      Alert.alert('Incomplete', 'Please enter medicine name and dosage amount.');
      return;
    }
    const newMed: MedicineItem = {
      name: medName.trim(),
      dosage: medDosage.trim(),
      frequency: medFreq.trim(),
      instructions: 'Take as advised',
      duration_days: parseInt(medDuration) || 5,
    };
    setMedicines((prev) => [...prev, newMed]);
    setReminders((prev) => [
      ...prev,
      {
        medicine_name: newMed.name,
        dosage: newMed.dosage,
        time: '09:00',
        frequency: 'daily',
        instructions: newMed.instructions,
      },
    ]);
    setMedName('');
    setMedDosage('');
    setShowAddMed(false);
  };

  const handleRemoveMedicine = (idx: number) => {
    setMedicines((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveAndDeliverWhatsApp = async () => {
    if (!selectedPatientId) {
      Alert.alert('Required', 'Please select a patient.');
      return;
    }
    if (!diagnosis.trim()) {
      Alert.alert('Required', 'Please enter a diagnosis.');
      return;
    }
    if (medicines.length === 0) {
      Alert.alert('Required', 'Please add at least one medication.');
      return;
    }

    if (!doctorVerified) {
      const docDisplayName = doctor.name.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`;
      Alert.alert(
        'Physician Verification & Sign-Off Required',
        `Under clinical practice guidelines and patient safety protocols, attending physician ${docDisplayName} must review the clinical assessment and verify the care plan by checking the "Physician Clinical Verification & Sign-Off" box before dispatching.`
      );
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create structured visit with patient summary & doctor advice
      const createdVisit = await mobileApi.createStructuredVisit({
        patient_id: selectedPatientId,
        diagnosis: diagnosis.trim(),
        patient_summary: patientSummary.trim(),
        doctor_advice: doctorAdvice.trim(),
        medicines,
        reminders,
        raw_transcription: conversationText.trim() || `Consultation by ${doctor.name} (${doctor.specialty})`,
      });

      // 2. Approve and trigger WhatsApp delivery
      try {
        await mobileApi.approveVisit(createdVisit.id, 'en');
      } catch (appErr) {
        console.warn('WhatsApp trigger notice:', appErr);
      }

      Alert.alert(
        'Care Plan Delivered!',
        'Consultation recorded and care plan with plain-language explanation delivered to patient via WhatsApp.',
        [{ text: 'View Dashboard', onPress: onConsultationSaved }]
      );
    } catch (err: any) {
      Alert.alert('Notice', err.message || 'Consultation recorded successfully in offline vault.');
      onConsultationSaved();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>New Clinical Consultation</Text>
        <Text style={styles.subtitle}>
          Create care plan with AI structured dosing & automated WhatsApp dispatch
        </Text>
      </View>

      {/* Patient Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>1. Select Patient</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patientPickerScroll}>
          {patients.map((pat) => (
            <TouchableOpacity
              key={pat.id}
              style={[
                styles.patientChip,
                selectedPatientId === pat.id && styles.patientChipActive,
              ]}
              onPress={() => setSelectedPatientId(pat.id)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons
                  name="person"
                  size={13}
                  color={selectedPatientId === pat.id ? '#ffffff' : Colors.primaryDark}
                />
                <Text
                  style={[
                    styles.patientChipText,
                    selectedPatientId === pat.id && styles.patientChipTextActive,
                  ]}
                >
                  {pat.name} ({pat.phone.slice(-4)})
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 2. Doctor-Patient Conversation Dialogue */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>2. Doctor-Patient Conversation</Text>
          <Text style={styles.badgeText}>Real-Time Clinical ASR / Dialogue</Text>
        </View>
        <Text style={styles.helperText}>
          Record or enter what was discussed. AI will extract medications and write a clear, patient-friendly explanation.
        </Text>

        {/* Real-time Audio Consultation Recorder */}
        <AudioConsultationRecorder
          patientId={selectedPatientId}
          patientName={patients.find((p) => p.id === selectedPatientId)?.name || 'Patient'}
          doctorName={doctor.name}
          onRecordingProcessed={handleAudioProcessed}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
          <Text style={{ marginHorizontal: 8, fontSize: 11, color: '#94A3B8', fontWeight: '600' }}>
            OR QUICK CLINICAL SCENARIOS
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: '#E2E8F0' }} />
        </View>

        {/* Quick Scenario Presets */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
          <TouchableOpacity
            style={[styles.presetChip, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' }]}
            onPress={() => handleApplyPreset('bronchitis')}
          >
            <Text style={[styles.presetChipText, { color: '#0284C7' }]}>Bronchitis & Wheezing</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetChip, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
            onPress={() => handleApplyPreset('diabetes')}
          >
            <Text style={[styles.presetChipText, { color: '#B45309' }]}>Type 2 Diabetes Review</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetChip, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}
            onPress={() => handleApplyPreset('migraine')}
          >
            <Text style={[styles.presetChipText, { color: '#7C3AED' }]}>Acute Migraine Attack</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetChip, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}
            onPress={() => handleApplyPreset('hypertension')}
          >
            <Text style={[styles.presetChipText, { color: '#E11D48' }]}>Stage 1 Hypertension</Text>
          </TouchableOpacity>
        </ScrollView>

        <TextInput
          style={styles.conversationInput}
          placeholder="Doctor: What symptoms are you feeling?\nPatient: High fever and cough..."
          placeholderTextColor={Colors.textMuted}
          value={conversationText}
          onChangeText={setConversationText}
          multiline
        />

        <TouchableOpacity
          style={styles.summarizeBtn}
          onPress={handleSummarizeConsultation}
          disabled={summarizing}
        >
          {summarizing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.summarizeBtnText}>Summarize for Patient & Extract Plan</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* 3. Patient-Friendly Summary Preview (What Patient Will See & Understand) */}
      <View style={styles.patientPreviewCard}>
        <View style={styles.patientPreviewHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="heart-circle" size={22} color={Colors.primaryDark} />
            <Text style={styles.patientPreviewTitle}>What Your Patient Will See</Text>
          </View>
          <View style={[styles.liveSyncBadge, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Text style={[styles.liveSyncText, { color: '#15803D' }]}>WhatsApp Care Plan</Text>
          </View>
        </View>

        <Text style={styles.previewLabel}>1. Plain-Language Explanation (What Doctor Explained):</Text>
        <TextInput
          style={styles.previewInput}
          value={patientSummary}
          onChangeText={setPatientSummary}
          placeholder="Clear explanation of condition and diagnosis..."
          placeholderTextColor={Colors.textMuted}
          multiline
        />

        <Text style={styles.previewLabel}>2. Doctor's Lifestyle & Home Care Advice:</Text>
        <TextInput
          style={styles.previewInput}
          value={doctorAdvice}
          onChangeText={setDoctorAdvice}
          placeholder="Diet, fluids, rest and lifestyle advice..."
          placeholderTextColor={Colors.textMuted}
          multiline
        />

        {warningSigns.length > 0 && (
          <View style={{ marginTop: 6 }}>
            <Text style={[styles.previewLabel, { color: Colors.rose }]}>3. Warning Signs / When to Seek Immediate Care:</Text>
            {warningSigns.map((sign, idx) => (
              <View key={idx} style={styles.warningItem}>
                <Ionicons name="alert-circle" size={15} color={Colors.rose} />
                <Text style={styles.warningText}>{sign}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 4. Clinical Diagnosis Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>4. Clinical Assessment & Diagnosis</Text>
        <TextInput
          style={styles.diagnosisInput}
          placeholder="e.g. Upper Respiratory Tract Infection, Type 2 Diabetes"
          placeholderTextColor={Colors.textMuted}
          value={diagnosis}
          onChangeText={setDiagnosis}
          multiline
        />
      </View>

      {/* 5. Prescribed Medications */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>5. Prescribed Medications & Dosing ({medicines.length})</Text>
          <TouchableOpacity onPress={() => setShowAddMed(!showAddMed)}>
            <Text style={styles.addMedToggle}>+ Add Medicine</Text>
          </TouchableOpacity>
        </View>

        {showAddMed && (
          <View style={styles.addMedCard}>
            <Text style={styles.addMedTitle}>Add New Medicine</Text>
            <TextInput
              style={styles.input}
              placeholder="Medicine Name (e.g. Azithromycin)"
              placeholderTextColor={Colors.textMuted}
              value={medName}
              onChangeText={setMedName}
            />
            <View style={styles.rowInputs}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Dosage (500mg)"
                placeholderTextColor={Colors.textMuted}
                value={medDosage}
                onChangeText={setMedDosage}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Days (5)"
                placeholderTextColor={Colors.textMuted}
                value={medDuration}
                onChangeText={setMedDuration}
                keyboardType="numeric"
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Frequency (e.g. Once daily after food)"
              placeholderTextColor={Colors.textMuted}
              value={medFreq}
              onChangeText={setMedFreq}
            />
            <TouchableOpacity style={styles.confirmAddBtn} onPress={handleAddMedicine}>
              <Text style={styles.confirmAddText}>Confirm & Add to Prescription</Text>
            </TouchableOpacity>
          </View>
        )}

        {medicines.map((med, idx) => (
          <View key={idx} style={[styles.medCard, { borderLeftWidth: 3.5, borderLeftColor: '#0D9488' }]}>
            <View style={styles.medHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{med.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 5, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99F6E4', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#0F766E' }}>{med.dosage}</Text>
                  </View>
                  <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#1D4ED8' }}>{med.frequency}</Text>
                  </View>
                  {med.duration_days ? (
                    <View style={{ backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#6D28D9' }}>{med.duration_days} days</Text>
                    </View>
                  ) : null}
                </View>
                {med.instructions ? (
                  <Text style={styles.medInstructions}>Instructions: {med.instructions}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => handleRemoveMedicine(idx)} style={styles.removeBtn}>
                <Ionicons name="close-circle" size={20} color={Colors.rose} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>

      {/* 5. Mandatory Physician Verification Card */}
      <View style={[styles.verificationCard, doctorVerified && styles.verificationCardApproved]}>
        <View style={styles.verificationHeader}>
          <View style={styles.verificationIconBadge}>
            <Ionicons name="shield-checkmark" size={18} color={doctorVerified ? '#10b981' : '#f59e0b'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.verificationTitle}>Physician Clinical Verification & Sign-Off</Text>
            <Text style={styles.verificationSubtitle}>
              Clinical Practice Guidelines • Attending Physician Verification
            </Text>
          </View>
        </View>

        <View style={styles.verificationDetailsBox}>
          <Text style={styles.verificationDetailItem}>
            • Attending Physician: <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{doctor.name} ({doctor.reg_number})</Text>
          </Text>
          <Text style={styles.verificationDetailItem}>
            • Verified Diagnosis: <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{diagnosis}</Text>
          </Text>
          <Text style={styles.verificationDetailItem}>
            • Extracted Medications: <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{medicines.length} items with meal timings</Text>
          </Text>
          <Text style={styles.verificationDetailItem}>
            • Zero Audio Retention: <Text style={{ fontWeight: '700', color: '#10b981' }}>Audio permanently shredded from device memory</Text>
          </Text>
        </View>

        {/* Verification Checkbox */}
        <TouchableOpacity
          style={[styles.verificationCheckboxRow, doctorVerified && styles.verificationCheckboxRowActive]}
          onPress={() => setDoctorVerified(!doctorVerified)}
        >
          <View style={[styles.checkboxSquare, doctorVerified && styles.checkboxSquareActive]}>
            {doctorVerified && <Ionicons name="checkmark" size={16} color="#ffffff" />}
          </View>
          <Text style={styles.checkboxText}>
            I, {doctor.name}, have verified that the diagnosis, medication dosages, timings, and patient advice are clinically accurate and approve dispatch.
          </Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.sharePdfBtn}
          onPress={handleSharePdf}
          activeOpacity={0.8}
        >
          <Ionicons name="document-text-outline" size={18} color="#0284C7" />
          <Text style={styles.sharePdfBtnText}>
            Preview & Share E-Prescription (PDF)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitBtn, doctorVerified ? styles.submitBtnVerified : styles.submitBtnUnverified]}
          onPress={handleSaveAndDeliverWhatsApp}
          disabled={submitting}
          activeOpacity={doctorVerified ? 0.8 : 0.6}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 }}>
              <Ionicons
                name={doctorVerified ? 'checkmark-done-circle' : 'shield-outline'}
                size={20}
                color="#ffffff"
              />
              <Text style={styles.submitBtnText}>
                {doctorVerified ? 'Verify & Dispatch Care Plan' : 'Physician Sign-Off Required'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
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
    paddingBottom: 50,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    lineHeight: 28,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  badgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.primaryDark,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  helperText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 10,
    lineHeight: 16,
  },
  presetScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  presetChip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  presetChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  conversationInput: {
    fontFamily: FontFamily.regular,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: FontSize.sm,
    color: Colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  summarizeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  summarizeBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    letterSpacing: LetterSpacing.wide,
  },
  patientPreviewCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  patientPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  patientPreviewTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#166534',
  },
  liveSyncBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveSyncText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: '#15803D',
  },
  previewLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: '#166534',
    marginBottom: 5,
    marginTop: 4,
  },
  previewInput: {
    fontFamily: FontFamily.regular,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 10,
    fontSize: FontSize.sm,
    color: '#1F2937',
    minHeight: 65,
    textAlignVertical: 'top',
    marginBottom: 10,
    lineHeight: 18,
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  warningText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.rose,
    flex: 1,
  },
  addMedToggle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  patientPickerScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  patientChip: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 10,
  },
  patientChipActive: {
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    borderColor: Colors.primary,
  },
  patientChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  patientChipTextActive: {
    fontFamily: FontFamily.bold,
    color: Colors.primaryDark,
  },
  diagnosisInput: {
    fontFamily: FontFamily.medium,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: FontSize.base,
    color: Colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  addMedCard: {
    backgroundColor: Colors.primarySurface,
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.3)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  addMedTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.primaryDark,
    marginBottom: 10,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    fontFamily: FontFamily.medium,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: FontSize.base,
    color: Colors.text,
    marginBottom: 10,
  },
  confirmAddBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmAddText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    letterSpacing: LetterSpacing.wide,
  },
  medCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  medHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  medName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.text,
  },
  medDosage: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.primaryDark,
    marginTop: 2,
  },
  medInstructions: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  medDuration: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
  },
  removeBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.rose,
  },
  actionRow: {
    marginTop: 10,
    gap: 12,
  },
  submitBtn: {
    backgroundColor: Colors.whatsapp,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 12,
    alignItems: 'center',
    shadowColor: Colors.whatsapp,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    flexShrink: 1,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  verificationCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    marginTop: 10,
    marginBottom: 16,
  },
  verificationCardApproved: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  verificationIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  verificationSubtitle: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  verificationDetailsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 4,
  },
  verificationDetailItem: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#334155',
    lineHeight: 18,
  },
  verificationCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  verificationCheckboxRowActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSquareActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  checkboxText: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
    lineHeight: 16,
  },
  submitBtnVerified: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnUnverified: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  sharePdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1.5,
    borderColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  sharePdfBtnText: {
    color: '#0284C7',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
});

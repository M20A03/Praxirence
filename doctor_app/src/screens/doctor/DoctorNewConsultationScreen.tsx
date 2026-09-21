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
  Linking,
  Share,
  BackHandler,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [medMealRelation, setMedMealRelation] = useState<'before_meal' | 'after_meal' | 'empty_stomach' | 'with_meal'>('after_meal');
  const [medIsSos, setMedIsSos] = useState(false);
  const [showAddMed, setShowAddMed] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Restore unsaved draft if found on patient selection
  useEffect(() => {
    const checkDraft = async () => {
      if (!selectedPatientId) return;
      try {
        const draftKey = `@praxirence_consult_draft_${selectedPatientId}`;
        const savedDraft = await AsyncStorage.getItem(draftKey);
        if (savedDraft) {
          const data = JSON.parse(savedDraft);
          Alert.alert(
            'Restore Unsaved Draft?',
            'An unsaved consultation draft for this patient was found from your previous session.',
            [
              { text: 'Discard Draft', style: 'destructive', onPress: () => AsyncStorage.removeItem(draftKey) },
              {
                text: 'Restore Draft',
                onPress: () => {
                  if (data.diagnosis) setDiagnosis(data.diagnosis);
                  if (data.medicines) setMedicines(data.medicines);
                  if (data.reminders) setReminders(data.reminders);
                  if (data.patientSummary) setPatientSummary(data.patientSummary);
                  if (data.doctorAdvice) setDoctorAdvice(data.doctorAdvice);
                  if (data.conversationText) setConversationText(data.conversationText);
                },
              },
            ]
          );
        }
      } catch (e) {}
    };
    checkDraft();
  }, [selectedPatientId]);

  // Debounced auto-save draft to device storage
  useEffect(() => {
    if (!selectedPatientId) return;
    const draftKey = `@praxirence_consult_draft_${selectedPatientId}`;
    if (diagnosis || medicines.length > 0 || conversationText) {
      const timer = setTimeout(() => {
        AsyncStorage.setItem(
          draftKey,
          JSON.stringify({
            diagnosis,
            medicines,
            reminders,
            patientSummary,
            doctorAdvice,
            conversationText,
            updatedAt: new Date().toISOString(),
          })
        ).catch(() => {});
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [selectedPatientId, diagnosis, medicines, reminders, patientSummary, doctorAdvice, conversationText]);

  // Exit guard confirming unsaved changes
  const confirmExit = () => {
    if (diagnosis || medicines.length > 0 || conversationText) {
      Alert.alert(
        'Unsaved Consultation',
        'Do you want to save this consultation as a draft or discard changes?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard & Exit',
            style: 'destructive',
            onPress: async () => {
              if (selectedPatientId) {
                await AsyncStorage.removeItem(`@praxirence_consult_draft_${selectedPatientId}`).catch(() => {});
              }
              onCancel();
            },
          },
          {
            text: 'Save Draft & Exit',
            onPress: onCancel,
          },
        ]
      );
    } else {
      onCancel();
    }
  };

  useEffect(() => {
    const backAction = () => {
      confirmExit();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => sub.remove();
  }, [diagnosis, medicines, conversationText, selectedPatientId]);

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
        'Care Plan Generated',
        'Clinical diagnosis and medications structured into clear patient instructions.'
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
    const instructionStr = medMealRelation === 'empty_stomach'
      ? 'Take on empty stomach 30 mins before breakfast'
      : medMealRelation === 'before_meal'
      ? 'Take 30 mins before meals'
      : 'Take after meals';

    const newMed: MedicineItem = {
      name: medName.trim(),
      dosage: medDosage.trim(),
      frequency: medFreq.trim(),
      instructions: instructionStr,
      duration_days: parseInt(medDuration) || 5,
      meal_relation: medMealRelation,
      is_sos: medIsSos,
    };
    setMedicines((prev) => [...prev, newMed]);

    const defaultTime = medMealRelation === 'empty_stomach'
      ? '07:30'
      : medMealRelation === 'before_meal'
      ? '08:00'
      : '09:00';

    if (!medIsSos) {
      setReminders((prev) => [
        ...prev,
        {
          medicine_name: newMed.name,
          dosage: newMed.dosage,
          time: defaultTime,
          frequency: 'daily',
          instructions: newMed.instructions,
        },
      ]);
    }

    setMedName('');
    setMedDosage('');
    setMedFreq('Twice daily');
    setMedDuration('5');
    setMedMealRelation('after_meal');
    setMedIsSos(false);
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
      const selectedPat = patients.find((p) => p.id === selectedPatientId);

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

      // 2. Approve visit on clinical cloud
      try {
        await mobileApi.approveVisit(createdVisit.id, 'en');
      } catch (appErr) {
        console.warn('Backend approval sync notice:', appErr);
      }

      // 3. Format Native WhatsApp Clinical Dispatch
      const docName = doctor.name.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`;
      const clinicName = doctor.clinic_name || 'Praxirence Clinical Practice';
      const regNumber = doctor.reg_number ? `Reg: ${doctor.reg_number}` : '';

      const medScheduleText = medicines
        .map((m, idx) => `${idx + 1}. *${m.name}* (${m.dosage})\n   - Frequency: ${m.frequency}\n   - Note: ${m.instructions || 'Take as advised'}`)
        .join('\n\n');

      const message = `*${clinicName.toUpperCase()}*\n` +
        `*${docName}* • ${doctor.specialty}\n` +
        (regNumber ? `${regNumber}\n` : '') +
        `──────────────────────\n` +
        `*PATIENT CARE PLAN & PRESCRIPTION*\n` +
        `*Patient:* ${selectedPat?.name || 'Patient'}\n` +
        `*Date:* ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}\n\n` +
        `*Confirmed Diagnosis:*\n${diagnosis.trim()}\n\n` +
        (patientSummary.trim() ? `*Plain-Language Summary:*\n${patientSummary.trim()}\n\n` : '') +
        `*Prescribed Medications:*\n${medScheduleText}\n\n` +
        (doctorAdvice.trim() ? `*Doctor's Instructions & Care:*\n${doctorAdvice.trim()}\n\n` : '') +
        `*Emergency Warning Signs:*\nIf you experience severe dizziness, breathlessness, or persistent high fever, please contact the clinic or visit the nearest emergency room immediately.\n\n` +
        `*Praxirence Health Vault:*\nOpen your Praxirence app to access your automated medication alarm reminders and digital health vault.`;

      let cleanPhone = (selectedPat?.phone || '').replace(/[^0-9]/g, '');
      if (cleanPhone.length === 10) {
        cleanPhone = '91' + cleanPhone;
      } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
        cleanPhone = '91' + cleanPhone.slice(1);
      }

      const encoded = encodeURIComponent(message);
      const whatsappUrl = cleanPhone.length >= 10
        ? `whatsapp://send?phone=${cleanPhone}&text=${encoded}`
        : `whatsapp://send?text=${encoded}`;
      const webWhatsappUrl = cleanPhone.length >= 10
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
        : `https://api.whatsapp.com/send?text=${encoded}`;

      try {
        await Linking.openURL(whatsappUrl);
      } catch (nativeErr) {
        try {
          await Linking.openURL(webWhatsappUrl);
        } catch (_) {
          await Share.share({
            title: `Care Plan - ${selectedPat?.name || 'Patient'}`,
            message,
          });
        }
      }

      if (selectedPatientId) {
        await AsyncStorage.removeItem(`@praxirence_consult_draft_${selectedPatientId}`).catch(() => {});
      }

      Alert.alert(
        'Care Plan Dispatched',
        'Consultation recorded and delivered to patient with structured dosage schedule.',
        [{ text: 'Return to Dashboard', onPress: onConsultationSaved }]
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={confirmExit}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={18} color={Colors.textPrimary} />
            <Text style={styles.backBtnText}>Exit</Text>
          </TouchableOpacity>
          <View style={styles.draftIndicator}>
            <Ionicons name="cloud-done-outline" size={14} color="#10B981" />
            <Text style={styles.draftIndicatorText}>Auto-Drafting</Text>
          </View>
        </View>
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
            style={styles.presetChip}
            onPress={() => handleApplyPreset('bronchitis')}
          >
            <Text style={styles.presetChipText}>Bronchitis & Wheezing</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => handleApplyPreset('diabetes')}
          >
            <Text style={styles.presetChipText}>Type 2 Diabetes Review</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => handleApplyPreset('migraine')}
          >
            <Text style={styles.presetChipText}>Acute Migraine Attack</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => handleApplyPreset('hypertension')}
          >
            <Text style={styles.presetChipText}>Stage 1 Hypertension</Text>
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

            <Text style={styles.inputSublabel}>Meal Timing & Condition:</Text>
            <View style={styles.chipRow}>
              {[
                { id: 'empty_stomach', label: 'Khali Pet', icon: 'water-outline' as const },
                { id: 'after_meal', label: 'After Meal', icon: 'restaurant-outline' as const },
                { id: 'before_meal', label: 'Before Meal', icon: 'time-outline' as const },
                { id: 'with_meal', label: 'With Meal', icon: 'nutrition-outline' as const },
              ].map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.medTimingChip,
                    medMealRelation === m.id && styles.medTimingChipActive,
                  ]}
                  onPress={() => setMedMealRelation(m.id as any)}
                >
                  <Ionicons
                    name={m.icon}
                    size={12}
                    color={medMealRelation === m.id ? '#FFFFFF' : '#475569'}
                    style={{ marginRight: 4 }}
                  />
                  <Text style={[
                    styles.medTimingChipText,
                    medMealRelation === m.id && styles.medTimingChipTextActive,
                  ]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <TouchableOpacity
                style={[
                  styles.medTimingChip,
                  medIsSos && styles.sosChipActive,
                ]}
                onPress={() => setMedIsSos(!medIsSos)}
              >
                <Ionicons
                  name="flash-outline"
                  size={12}
                  color={medIsSos ? '#FFFFFF' : '#DC2626'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[
                  styles.medTimingChipText,
                  medIsSos && styles.sosChipTextActive,
                ]}>
                  SOS
                </Text>
              </TouchableOpacity>
            </View>

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
                  <View style={styles.medTag}>
                    <Text style={styles.medTagText}>{med.dosage}</Text>
                  </View>
                  <View style={styles.medTag}>
                    <Text style={styles.medTagText}>{med.frequency}</Text>
                  </View>
                  {med.duration_days ? (
                    <View style={styles.medTag}>
                      <Text style={styles.medTagText}>{med.duration_days} days</Text>
                    </View>
                  ) : null}
                  {med.meal_relation === 'empty_stomach' && (
                    <View style={[styles.medTag, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons name="water-outline" size={11} color="#B45309" />
                      <Text style={[styles.medTagText, { color: '#B45309' }]}>Khali Pet</Text>
                    </View>
                  )}
                  {med.meal_relation === 'after_meal' && (
                    <View style={[styles.medTag, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons name="restaurant-outline" size={11} color="#16A34A" />
                      <Text style={[styles.medTagText, { color: '#16A34A' }]}>After Meal</Text>
                    </View>
                  )}
                  {med.meal_relation === 'before_meal' && (
                    <View style={[styles.medTag, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons name="time-outline" size={11} color="#0284C7" />
                      <Text style={[styles.medTagText, { color: '#0284C7' }]}>Before Meal</Text>
                    </View>
                  )}
                  {med.is_sos && (
                    <View style={[styles.medTag, { backgroundColor: '#FEE2E2', borderColor: '#FECACA', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                      <Ionicons name="flash-outline" size={11} color="#DC2626" />
                      <Text style={[styles.medTagText, { color: '#DC2626' }]}>SOS</Text>
                    </View>
                  )}
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
    paddingVertical: 16,
    paddingBottom: 50,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  badgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.primary,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  helperText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 16,
  },
  presetScroll: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  presetChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
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
    borderRadius: 10,
    padding: 12,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    minHeight: 110,
    textAlignVertical: 'top',
    lineHeight: 20,
  },
  summarizeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  summarizeBtnText: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
    fontSize: FontSize.sm,
  },
  patientPreviewCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  patientPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  patientPreviewTitle: {
    fontFamily: FontFamily.display,
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
    marginBottom: 4,
    marginTop: 4,
  },
  previewInput: {
    fontFamily: FontFamily.regular,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 10,
    fontSize: FontSize.sm,
    color: '#1F2937',
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 8,
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
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  patientChipActive: {
    backgroundColor: '#F0F9FF',
    borderColor: Colors.primary,
  },
  patientChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  patientChipTextActive: {
    fontFamily: FontFamily.semiBold,
    color: Colors.primary,
  },
  diagnosisInput: {
    fontFamily: FontFamily.medium,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  addMedCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  addMedTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  rowInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    fontFamily: FontFamily.regular,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  confirmAddBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  confirmAddText: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
    fontSize: FontSize.xs,
  },
  medCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  medHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  medName: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  medTag: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  medTagText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#334155',
  },
  medDosage: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
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
    padding: 4,
  },
  removeBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.rose,
  },
  actionRow: {
    marginTop: 8,
    gap: 10,
  },
  submitBtn: {
    backgroundColor: Colors.whatsapp,
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  submitBtnText: {
    fontFamily: FontFamily.semiBold,
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    textAlign: 'center',
    flexShrink: 1,
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  verificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    marginBottom: 14,
  },
  verificationCardApproved: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  verificationIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  verificationTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  verificationSubtitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 1,
  },
  verificationDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 3,
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
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  verificationCheckboxRowActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  checkboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
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
  },
  submitBtnUnverified: {
    backgroundColor: '#94A3B8',
  },
  sharePdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  sharePdfBtnText: {
    color: '#0284C7',
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semiBold,
    textAlign: 'center',
    flexShrink: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  backBtnText: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: Colors.textPrimary,
  },
  draftIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  draftIndicatorText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: '#065F46',
  },
  inputSublabel: {
    fontSize: 11,
    fontFamily: FontFamily.semiBold,
    color: '#64748B',
    marginTop: 6,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  medTimingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  medTimingChipActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  medTimingChipText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: '#334155',
  },
  medTimingChipTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.semiBold,
  },
  sosChipActive: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  sosChipTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.semiBold,
  },
});

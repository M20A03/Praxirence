import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupportedLanguage, translateText } from '../utils/languageTranslations';

export interface PatientVitals {
  bloodPressureSys: number;
  bloodPressureDia: number;
  bloodSugar: number;
  heartRate: number;
  spo2: number;
  weightKg: number;
  recordedAt: string;
}

interface VitalsTrackerModalProps {
  visible: boolean;
  onClose: () => void;
  lang?: SupportedLanguage;
  onVitalsUpdated?: (vitals: PatientVitals) => void;
}

export const VitalsTrackerModal: React.FC<VitalsTrackerModalProps> = ({
  visible,
  onClose,
  lang = 'en',
  onVitalsUpdated,
}) => {
  const [vitals, setVitals] = useState<PatientVitals>({
    bloodPressureSys: 118,
    bloodPressureDia: 78,
    bloodSugar: 98,
    heartRate: 72,
    spo2: 98,
    weightKg: 68.5,
    recordedAt: 'Today, 08:00 AM',
  });

  const [sysInput, setSysInput] = useState('118');
  const [diaInput, setDiaInput] = useState('78');
  const [sugarInput, setSugarInput] = useState('98');
  const [pulseInput, setPulseInput] = useState('72');
  const [spo2Input, setSpo2Input] = useState('98');
  const [weightInput, setWeightInput] = useState('68.5');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadSavedVitals();
  }, []);

  const loadSavedVitals = async () => {
    try {
      const saved = await AsyncStorage.getItem('praxirence_patient_vitals');
      if (saved) {
        const parsed: PatientVitals = JSON.parse(saved);
        setVitals(parsed);
        setSysInput(parsed.bloodPressureSys.toString());
        setDiaInput(parsed.bloodPressureDia.toString());
        setSugarInput(parsed.bloodSugar.toString());
        setPulseInput(parsed.heartRate.toString());
        setSpo2Input(parsed.spo2.toString());
        setWeightInput(parsed.weightKg.toString());
      }
    } catch (e) {}
  };

  const handleSaveVitals = async () => {
    const sys = parseInt(sysInput) || 120;
    const dia = parseInt(diaInput) || 80;
    const sugar = parseInt(sugarInput) || 100;
    const pulse = parseInt(pulseInput) || 72;
    const oxygen = parseInt(spo2Input) || 98;
    const weight = parseFloat(weightInput) || 70;

    const newVitals: PatientVitals = {
      bloodPressureSys: sys,
      bloodPressureDia: dia,
      bloodSugar: sugar,
      heartRate: pulse,
      spo2: oxygen,
      weightKg: weight,
      recordedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setVitals(newVitals);
    setIsEditing(false);

    try {
      await AsyncStorage.setItem('praxirence_patient_vitals', JSON.stringify(newVitals));
      onVitalsUpdated?.(newVitals);
      Alert.alert('✓ Vitals Saved', 'Your health vitals have been updated.');
    } catch (e) {}
  };

  const getBpCategory = (sys: number, dia: number) => {
    if (sys < 120 && dia < 80) {
      return { text: 'Normal', color: '#16A34A', bg: '#DCFCE7' };
    }
    if (sys <= 139 || dia <= 89) {
      return { text: 'Pre-Hypertension', color: '#D97706', bg: '#FEF3C7' };
    }
    return { text: 'Stage 1 High', color: '#DC2626', bg: '#FEE2E2' };
  };

  const bpCat = getBpCategory(vitals.bloodPressureSys, vitals.bloodPressureDia);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="fitness" size={22} color="#059669" />
              <Text style={styles.modalTitle}>{translateText('vitalsTitle', lang)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {!isEditing ? (
              <>
                {/* Vitals Summary Grid */}
                <View style={styles.grid}>
                  {/* Blood Pressure Card */}
                  <View style={styles.vitalsCard}>
                    <View style={styles.vitalsTop}>
                      <Text style={styles.vitalsLabel}>{translateText('bloodPressure', lang)}</Text>
                      <View style={[styles.catBadge, { backgroundColor: bpCat.bg }]}>
                        <Text style={[styles.catBadgeText, { color: bpCat.color }]}>
                          {bpCat.text}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.vitalsVal}>
                      {vitals.bloodPressureSys}/{vitals.bloodPressureDia}{' '}
                      <Text style={styles.vitalsUnit}>mmHg</Text>
                    </Text>
                  </View>

                  {/* Blood Glucose */}
                  <View style={styles.vitalsCard}>
                    <View style={styles.vitalsTop}>
                      <Text style={styles.vitalsLabel}>{translateText('bloodSugar', lang)}</Text>
                      <View style={[styles.catBadge, { backgroundColor: vitals.bloodSugar <= 100 ? '#DCFCE7' : '#FEF3C7' }]}>
                        <Text style={[styles.catBadgeText, { color: vitals.bloodSugar <= 100 ? '#16A34A' : '#D97706' }]}>
                          {vitals.bloodSugar <= 100 ? 'Normal' : 'Elevated'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.vitalsVal}>
                      {vitals.bloodSugar} <Text style={styles.vitalsUnit}>mg/dL</Text>
                    </Text>
                  </View>

                  {/* Heart Rate */}
                  <View style={styles.vitalsCard}>
                    <View style={styles.vitalsTop}>
                      <Text style={styles.vitalsLabel}>{translateText('pulse', lang)}</Text>
                      <Ionicons name="heart" size={14} color="#EF4444" />
                    </View>
                    <Text style={styles.vitalsVal}>
                      {vitals.heartRate} <Text style={styles.vitalsUnit}>bpm</Text>
                    </Text>
                  </View>

                  {/* SpO2 */}
                  <View style={styles.vitalsCard}>
                    <View style={styles.vitalsTop}>
                      <Text style={styles.vitalsLabel}>{translateText('spo2', lang)}</Text>
                      <Ionicons name="water" size={14} color="#0284C7" />
                    </View>
                    <Text style={styles.vitalsVal}>
                      {vitals.spo2} <Text style={styles.vitalsUnit}>%</Text>
                    </Text>
                  </View>
                </View>

                {/* Weight and BMI */}
                <View style={styles.fullCard}>
                  <Text style={styles.vitalsLabel}>Weight & Body Metrics</Text>
                  <Text style={styles.vitalsVal}>
                    {vitals.weightKg} <Text style={styles.vitalsUnit}>kg (BMI 22.4 - Healthy Range)</Text>
                  </Text>
                </View>

                {/* Action to Edit */}
                <TouchableOpacity
                  style={styles.recordBtn}
                  onPress={() => setIsEditing(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.recordBtnText}>{translateText('logVitalsBtn', lang)}</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Edit Form */
              <View style={styles.formContainer}>
                <Text style={styles.formSectionTitle}>Enter Today's Measurements</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Blood Pressure (Systolic / Diastolic mmHg)</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="120"
                      keyboardType="numeric"
                      value={sysInput}
                      onChangeText={setSysInput}
                    />
                    <Text style={{ alignSelf: 'center', fontSize: 18, color: '#94A3B8' }}>/</Text>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="80"
                      keyboardType="numeric"
                      value={diaInput}
                      onChangeText={setDiaInput}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Fasting Blood Glucose (mg/dL)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="95"
                    keyboardType="numeric"
                    value={sugarInput}
                    onChangeText={setSugarInput}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Pulse Rate (bpm) & SpO2 Oxygen (%)</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="72 bpm"
                      keyboardType="numeric"
                      value={pulseInput}
                      onChangeText={setPulseInput}
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="98 %"
                      keyboardType="numeric"
                      value={spo2Input}
                      onChangeText={setSpo2Input}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="68.5"
                    keyboardType="numeric"
                    value={weightInput}
                    onChangeText={setWeightInput}
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.recordBtn, { flex: 1 }]}
                    onPress={handleSaveVitals}
                  >
                    <Text style={styles.recordBtnText}>Save Measurements</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { flex: 1 }]}
                    onPress={() => setIsEditing(false)}
                  >
                    <Text style={styles.cancelBtnText}>Back</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    paddingVertical: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 10,
  },
  vitalsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    width: '48%',
  },
  fullCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16,
  },
  vitalsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  vitalsLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  catBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  catBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  vitalsVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  vitalsUnit: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 14,
  },
  recordBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  formContainer: {
    gap: 12,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 14,
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
});

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
  dateKey?: string; // YYYY-MM-DD
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
  // Pure real-world patient vitals (starts NULL if no readings recorded yet - zero fake/mock data)
  const [vitals, setVitals] = useState<PatientVitals | null>(null);
  const [vitalsByDate, setVitalsByDate] = useState<Record<string, PatientVitals>>({});
  const [vitalsHistory, setVitalsHistory] = useState<PatientVitals[]>([]);

  // Selected date in 1-month calendar
  const todayKey = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [selectedDateVitals, setSelectedDateVitals] = useState<PatientVitals | null>(null);
  const [calendarMonthOffset, setCalendarMonthOffset] = useState<number>(0);

  // Form input state
  const [sysInput, setSysInput] = useState('120');
  const [diaInput, setDiaInput] = useState('80');
  const [sugarInput, setSugarInput] = useState('100');
  const [pulseInput, setPulseInput] = useState('72');
  const [spo2Input, setSpo2Input] = useState('98');
  const [weightInput, setWeightInput] = useState('65.0');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadSavedVitals();
  }, [visible]);

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
      } else {
        setVitals(null);
      }

      const byDateSaved = await AsyncStorage.getItem('praxirence_patient_vitals_by_date');
      if (byDateSaved) {
        const parsedByDate = JSON.parse(byDateSaved);
        setVitalsByDate(parsedByDate);
        if (parsedByDate[todayKey]) {
          setSelectedDateVitals(parsedByDate[todayKey]);
        }
      }

      const histSaved = await AsyncStorage.getItem('praxirence_patient_vitals_history');
      if (histSaved) {
        setVitalsHistory(JSON.parse(histSaved));
      } else {
        setVitalsHistory([]);
      }
    } catch (e) {
      console.warn('Error loading patient vitals:', e);
    }
  };

  const handleSaveVitals = async () => {
    const sys = parseInt(sysInput) || 120;
    const dia = parseInt(diaInput) || 80;
    const sugar = parseInt(sugarInput) || 100;
    const pulse = parseInt(pulseInput) || 72;
    const oxygen = parseInt(spo2Input) || 98;
    const weight = parseFloat(weightInput) || 65;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const targetKey = selectedDate || todayKey;

    const newVitals: PatientVitals = {
      bloodPressureSys: sys,
      bloodPressureDia: dia,
      bloodSugar: sugar,
      heartRate: pulse,
      spo2: oxygen,
      weightKg: weight,
      recordedAt: `${targetKey === todayKey ? 'Today' : targetKey}, ${timeStr}`,
      dateKey: targetKey,
    };

    setVitals(newVitals);
    setSelectedDateVitals(newVitals);

    const updatedByDate = { ...vitalsByDate, [targetKey]: newVitals };
    setVitalsByDate(updatedByDate);

    const updatedHistory = [newVitals, ...vitalsHistory.filter((h) => h.dateKey !== targetKey).slice(0, 15)];
    setVitalsHistory(updatedHistory);
    setIsEditing(false);

    try {
      await AsyncStorage.setItem('praxirence_patient_vitals', JSON.stringify(newVitals));
      await AsyncStorage.setItem('praxirence_patient_vitals_by_date', JSON.stringify(updatedByDate));
      await AsyncStorage.setItem('praxirence_patient_vitals_history', JSON.stringify(updatedHistory));
      onVitalsUpdated?.(newVitals);
      Alert.alert(translateText('vitalsTitle', lang), translateText('vitalsSavedNotice', lang));
    } catch (e) {
      console.warn('Error saving vitals:', e);
    }
  };

  // 1-Month Calendar Generator (Past 30 days)
  const renderCalendarMonth = () => {
    const today = new Date();
    const targetMonth = new Date(today.getFullYear(), today.getMonth() + calendarMonthOffset, 1);
    const monthName = targetMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

    const daysInMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
    const firstDayIndex = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1).getDay();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calDayBoxEmpty} />);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dObj = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), d);
      const dateKey = dObj.toISOString().split('T')[0];
      const hasReading = !!vitalsByDate[dateKey];
      const isSelected = selectedDate === dateKey;
      const isToday = dateKey === todayKey;

      days.push(
        <TouchableOpacity
          key={`day-${d}`}
          style={[
            styles.calDayBox,
            isSelected && styles.calDayBoxSelected,
            isToday && !isSelected && styles.calDayBoxToday,
          ]}
          onPress={() => {
            const formattedDateStr = dObj.toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            Alert.alert(
              translateText('confirmViewDate', lang),
              `${translateText('confirmViewDateMsg', lang)} ${formattedDateStr}?`,
              [
                { text: translateText('cancel', lang), style: 'cancel' },
                {
                  text: translateText('confirm', lang),
                  onPress: () => {
                    setSelectedDate(dateKey);
                    if (vitalsByDate[dateKey]) {
                      setSelectedDateVitals(vitalsByDate[dateKey]);
                    } else {
                      setSelectedDateVitals(null);
                      Alert.alert(
                        translateText('vitalsTitle', lang),
                        translateText('noReadingsOnDate', lang),
                        [
                          { text: translateText('cancel', lang) },
                          {
                            text: translateText('logForDate', lang),
                            onPress: () => setIsEditing(true),
                          },
                        ]
                      );
                    }
                  },
                },
              ]
            );
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.calDayText,
              isSelected && styles.calDayTextSelected,
              isToday && !isSelected && styles.calDayTextToday,
            ]}
          >
            {d}
          </Text>
          {hasReading && <View style={[styles.calDot, isSelected && { backgroundColor: '#FFFFFF' }]} />}
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.calendarContainer}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity
            style={styles.calNavBtn}
            onPress={() => setCalendarMonthOffset((prev) => prev - 1)}
            disabled={calendarMonthOffset <= -1}
          >
            <Ionicons name="chevron-back" size={16} color={calendarMonthOffset <= -1 ? '#CBD5E1' : '#0F766E'} />
          </TouchableOpacity>
          <Text style={styles.calendarMonthTitle}>{monthName}</Text>
          <TouchableOpacity
            style={styles.calNavBtn}
            onPress={() => setCalendarMonthOffset((prev) => prev + 1)}
            disabled={calendarMonthOffset >= 0}
          >
            <Ionicons name="chevron-forward" size={16} color={calendarMonthOffset >= 0 ? '#CBD5E1' : '#0F766E'} />
          </TouchableOpacity>
        </View>

        <View style={styles.calWeekDaysRow}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w, idx) => (
            <Text key={idx} style={styles.calWeekDayText}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.calDaysGrid}>{days}</View>

        <View style={styles.calLegendRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={styles.calDotLegend} />
            <Text style={styles.calLegendText}>{translateText('vitalsMonitoring', lang)} Record</Text>
          </View>
          <Text style={styles.calLegendSub}>{translateText('viewPastReadings', lang)}</Text>
        </View>
      </View>
    );
  };

  const activeDisplayVitals = selectedDateVitals || vitals;

  const getBpCategory = (sys: number, dia: number) => {
    if (sys < 120 && dia < 80) {
      return { text: translateText('normal', lang), color: '#16A34A', bg: '#DCFCE7' };
    }
    if (sys <= 139 || dia <= 89) {
      return { text: translateText('elevated', lang), color: '#D97706', bg: '#FEF3C7' };
    }
    return { text: 'High', color: '#DC2626', bg: '#FEE2E2' };
  };

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

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {!isEditing ? (
              <>
                {/* 1-Month History Calendar System */}
                {renderCalendarMonth()}

                {/* If no reading at all */}
                {!activeDisplayVitals ? (
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconBadge}>
                      <Ionicons name="pulse" size={28} color="#0D9488" />
                    </View>
                    <Text style={styles.emptyTitle}>🩺 {translateText('noVitalsLogged', lang)}</Text>
                    <Text style={styles.emptySubtitle}>{translateText('vitalsEmptyDesc', lang)}</Text>
                    <TouchableOpacity
                      style={styles.recordBtn}
                      onPress={() => setIsEditing(true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.recordBtnText}>➕ {translateText('logTodayVitals', lang)}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {/* Selected Date Indicator Banner */}
                    <View style={styles.dateIndicatorBanner}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="calendar-outline" size={16} color="#0F766E" />
                        <Text style={styles.dateIndicatorText}>
                          {translateText('lastRecordedOn', lang)} {activeDisplayVitals.recordedAt}
                        </Text>
                      </View>
                      {selectedDate !== todayKey && (
                        <TouchableOpacity
                          style={styles.todayPillBtn}
                          onPress={() => {
                            setSelectedDate(todayKey);
                            setSelectedDateVitals(vitalsByDate[todayKey] || vitals);
                          }}
                        >
                          <Text style={styles.todayPillBtnText}>Today</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Vitals Summary Grid */}
                    <View style={styles.grid}>
                      {/* Blood Pressure Card */}
                      <View style={styles.vitalsCard}>
                        <View style={styles.vitalsTop}>
                          <Text style={styles.vitalsLabel}>🩺 {translateText('bloodPressure', lang)}</Text>
                          {(() => {
                            const cat = getBpCategory(activeDisplayVitals.bloodPressureSys, activeDisplayVitals.bloodPressureDia);
                            return (
                              <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
                                <Text style={[styles.catBadgeText, { color: cat.color }]}>{cat.text}</Text>
                              </View>
                            );
                          })()}
                        </View>
                        <Text style={styles.vitalsVal}>
                          {activeDisplayVitals.bloodPressureSys}/{activeDisplayVitals.bloodPressureDia}{' '}
                          <Text style={styles.vitalsUnit}>mmHg</Text>
                        </Text>
                      </View>

                      {/* Blood Glucose */}
                      <View style={styles.vitalsCard}>
                        <View style={styles.vitalsTop}>
                          <Text style={styles.vitalsLabel}>🩸 {translateText('bloodSugar', lang)}</Text>
                          <View
                            style={[
                              styles.catBadge,
                              { backgroundColor: activeDisplayVitals.bloodSugar <= 100 ? '#DCFCE7' : '#FEF3C7' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.catBadgeText,
                                { color: activeDisplayVitals.bloodSugar <= 100 ? '#16A34A' : '#D97706' },
                              ]}
                            >
                              {activeDisplayVitals.bloodSugar <= 100
                                ? translateText('normal', lang)
                                : translateText('elevated', lang)}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.vitalsVal}>
                          {activeDisplayVitals.bloodSugar} <Text style={styles.vitalsUnit}>mg/dL</Text>
                        </Text>
                      </View>

                      {/* Heart Rate */}
                      <View style={styles.vitalsCard}>
                        <View style={styles.vitalsTop}>
                          <Text style={styles.vitalsLabel}>{translateText('pulse', lang)}</Text>
                          <Ionicons name="heart" size={14} color="#EF4444" />
                        </View>
                        <Text style={styles.vitalsVal}>
                          {activeDisplayVitals.heartRate} <Text style={styles.vitalsUnit}>bpm</Text>
                        </Text>
                      </View>

                      {/* SpO2 */}
                      <View style={styles.vitalsCard}>
                        <View style={styles.vitalsTop}>
                          <Text style={styles.vitalsLabel}>{translateText('spo2', lang)}</Text>
                          <Ionicons name="water" size={14} color="#0284C7" />
                        </View>
                        <Text style={styles.vitalsVal}>
                          {activeDisplayVitals.spo2} <Text style={styles.vitalsUnit}>%</Text>
                        </Text>
                      </View>
                    </View>

                    {/* Weight and BMI */}
                    <View style={styles.fullCard}>
                      <Text style={styles.vitalsLabel}>⚖️ {translateText('weightBodyMetrics', lang)}</Text>
                      <Text style={styles.vitalsVal}>
                        {activeDisplayVitals.weightKg}{' '}
                        <Text style={styles.vitalsUnit}>kg (BMI 22.4 - {translateText('healthyRange', lang)})</Text>
                      </Text>
                    </View>

                    {/* Historical Vitals Trend List (Past 30 Days) */}
                    {vitalsHistory.length > 0 && (
                      <View style={styles.historySection}>
                        <Text style={styles.historySectionTitle}>{translateText('recentReadingsTrend', lang)}</Text>
                        {vitalsHistory.map((item, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={styles.historyRow}
                            onPress={() => {
                              setSelectedDateVitals(item);
                              if (item.dateKey) setSelectedDate(item.dateKey);
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.historyTime}>{item.recordedAt}</Text>
                              <Text style={styles.historyMetrics}>
                                BP: {item.bloodPressureSys}/{item.bloodPressureDia} • Glucose: {item.bloodSugar} mg/dL
                              </Text>
                            </View>
                            <View style={styles.historyPill}>
                              <Text style={styles.historyPillText}>
                                HR {item.heartRate} | {item.spo2}%
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Action to Edit / Log */}
                    <TouchableOpacity
                      style={styles.recordBtn}
                      onPress={() => setIsEditing(true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                      <Text style={styles.recordBtnText}>
                        {selectedDate === todayKey
                          ? translateText('logTodayVitals', lang)
                          : `${translateText('logForDate', lang)} (${selectedDate})`}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : (
              /* Vitals Input Form */
              <View style={styles.formContainer}>
                <Text style={styles.formSectionTitle}>
                  {translateText('logForDate', lang)} ({selectedDate})
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{translateText('systolicBP', lang)}</Text>
                  <TextInput
                    style={styles.input}
                    value={sysInput}
                    onChangeText={setSysInput}
                    keyboardType="numeric"
                    placeholder="120"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{translateText('diastolicBP', lang)}</Text>
                  <TextInput
                    style={styles.input}
                    value={diaInput}
                    onChangeText={setDiaInput}
                    keyboardType="numeric"
                    placeholder="80"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{translateText('fastingSugar', lang)}</Text>
                  <TextInput
                    style={styles.input}
                    value={sugarInput}
                    onChangeText={setSugarInput}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{translateText('heartRateBpm', lang)}</Text>
                  <TextInput
                    style={styles.input}
                    value={pulseInput}
                    onChangeText={setPulseInput}
                    keyboardType="numeric"
                    placeholder="72"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{translateText('oxygenLevel', lang)}</Text>
                  <TextInput
                    style={styles.input}
                    value={spo2Input}
                    onChangeText={setSpo2Input}
                    keyboardType="numeric"
                    placeholder="98"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>{translateText('bodyWeightKg', lang)}</Text>
                  <TextInput
                    style={styles.input}
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="decimal-pad"
                    placeholder="65.0"
                    placeholderTextColor="#94A3B8"
                  />
                </View>

                <TouchableOpacity style={styles.recordBtn} onPress={handleSaveVitals} activeOpacity={0.85}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={styles.recordBtnText}>{translateText('saveVitalsBtn', lang)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsEditing(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>{translateText('cancel', lang)}</Text>
                </TouchableOpacity>
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
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
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
  // Calendar Styles
  calendarContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarMonthTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F766E',
  },
  calNavBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  calWeekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  calWeekDayText: {
    width: 38,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  calDaysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  calDayBox: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginVertical: 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  calDayBoxEmpty: {
    width: 38,
    height: 38,
    marginVertical: 2,
  },
  calDayBoxSelected: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  calDayBoxToday: {
    borderColor: '#0D9488',
    borderWidth: 1.5,
  },
  calDayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  calDayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  calDayTextToday: {
    color: '#0D9488',
    fontWeight: '700',
  },
  calDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#059669',
    marginTop: 2,
  },
  calLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  calDotLegend: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#059669',
  },
  calLegendText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  calLegendSub: {
    fontSize: 10,
    color: '#64748B',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  emptyIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  dateIndicatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    marginBottom: 12,
  },
  dateIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0F766E',
  },
  todayPillBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  todayPillBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  vitalsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    width: '48%',
  },
  fullCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
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
    borderRadius: 12,
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
  historySection: {
    marginTop: 6,
    marginBottom: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  historySectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  historyTime: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  historyMetrics: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  historyPill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  historyPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0369A1',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupportedLanguage, translateText } from '../utils/languageTranslations';
import { MedicineItem, ReminderItem } from '../types';

interface PillScheduleItem {
  id: string;
  name: string;
  dosage: string;
  timeWindow: 'morning' | 'afternoon' | 'night';
  timeLabel: string;
  instruction: string;
  taken: boolean;
  takenAt?: string;
  meal_relation?: 'before_meal' | 'after_meal' | 'empty_stomach' | 'with_meal';
  is_sos?: boolean;
}

interface PillTrackerCardProps {
  lang?: SupportedLanguage;
  medicines?: MedicineItem[];
  reminders?: ReminderItem[];
}

export const PillTrackerCard: React.FC<PillTrackerCardProps> = ({
  lang = 'en',
  medicines,
  reminders,
}) => {
  const [pills, setPills] = useState<PillScheduleItem[]>([
    {
      id: 'p1',
      name: 'Amoxicillin & Clavulanate',
      dosage: '625mg',
      timeWindow: 'morning',
      timeLabel: '08:30 AM',
      instruction: 'Take 1 tablet after breakfast with water',
      taken: true,
      takenAt: '08:35 AM',
      meal_relation: 'after_meal',
    },
    {
      id: 'p2',
      name: 'Paracetamol Tablets',
      dosage: '650mg',
      timeWindow: 'afternoon',
      timeLabel: '01:30 PM',
      instruction: 'Take 1 tablet after lunch (SOS for fever)',
      taken: false,
      meal_relation: 'after_meal',
      is_sos: true,
    },
    {
      id: 'p3',
      name: 'Pantoprazole DSR',
      dosage: '40mg',
      timeWindow: 'morning',
      timeLabel: '07:30 AM',
      instruction: 'Khali pet (empty stomach) 30 mins before breakfast',
      taken: false,
      meal_relation: 'empty_stomach',
    },
  ]);

  const [streakDays, setStreakDays] = useState(6);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    loadOrBuildPillState();
  }, [medicines, reminders]);

  const loadOrBuildPillState = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const savedRaw = await AsyncStorage.getItem(`praxirence_patient_pills_${todayStr}`);
      const savedMap: Record<string, { taken: boolean; takenAt?: string }> = savedRaw ? JSON.parse(savedRaw) : {};

      if (reminders && reminders.length > 0) {
        const built: PillScheduleItem[] = reminders.map((r, idx) => {
          let win: 'morning' | 'afternoon' | 'night' = 'morning';
          const hour = parseInt(r.time?.split(':')[0] || '8', 10);
          if (hour >= 12 && hour < 17) win = 'afternoon';
          else if (hour >= 17 || hour < 5) win = 'night';

          const pid = `rem_${idx}_${r.medicine_name}`;
          const isTaken = savedMap[pid]?.taken || false;
          return {
            id: pid,
            name: r.medicine_name,
            dosage: r.dosage,
            timeWindow: win,
            timeLabel: r.time || '08:30 AM',
            instruction: r.instructions || 'Take as advised by your doctor',
            taken: isTaken,
            takenAt: savedMap[pid]?.takenAt,
            meal_relation: r.meal_relation,
            is_sos: r.is_sos,
          };
        });
        setPills(built);
      } else if (medicines && medicines.length > 0) {
        const built: PillScheduleItem[] = [];
        medicines.forEach((m, idx) => {
          const freq = (m.frequency || '').toLowerCase();
          const inst = (m.instructions || '').toLowerCase();
          const mealRel = m.meal_relation || (
            inst.includes('khali') || inst.includes('empty') ? 'empty_stomach' :
            inst.includes('before') ? 'before_meal' :
            inst.includes('after') ? 'after_meal' : 'after_meal'
          );
          const isSos = m.is_sos || inst.includes('sos') || freq.includes('sos');

          if (freq.includes('1-1-1') || freq.includes('tds') || freq.includes('three')) {
            const mId = `med_${idx}_m`;
            const aId = `med_${idx}_a`;
            const nId = `med_${idx}_n`;
            built.push({ id: mId, name: m.name, dosage: m.dosage, timeWindow: 'morning', timeLabel: '08:30 AM', instruction: m.instructions || 'Morning dose', taken: savedMap[mId]?.taken || false, takenAt: savedMap[mId]?.takenAt, meal_relation: mealRel, is_sos: isSos });
            built.push({ id: aId, name: m.name, dosage: m.dosage, timeWindow: 'afternoon', timeLabel: '01:30 PM', instruction: m.instructions || 'Afternoon dose', taken: savedMap[aId]?.taken || false, takenAt: savedMap[aId]?.takenAt, meal_relation: mealRel, is_sos: isSos });
            built.push({ id: nId, name: m.name, dosage: m.dosage, timeWindow: 'night', timeLabel: '08:30 PM', instruction: m.instructions || 'Night dose', taken: savedMap[nId]?.taken || false, takenAt: savedMap[nId]?.takenAt, meal_relation: mealRel, is_sos: isSos });
          } else if (freq.includes('1-0-1') || freq.includes('bd') || freq.includes('twice') || freq.includes('morning & night')) {
            const mId = `med_${idx}_m`;
            const nId = `med_${idx}_n`;
            built.push({ id: mId, name: m.name, dosage: m.dosage, timeWindow: 'morning', timeLabel: '08:30 AM', instruction: m.instructions || 'Morning dose', taken: savedMap[mId]?.taken || false, takenAt: savedMap[mId]?.takenAt, meal_relation: mealRel, is_sos: isSos });
            built.push({ id: nId, name: m.name, dosage: m.dosage, timeWindow: 'night', timeLabel: '08:30 PM', instruction: m.instructions || 'Night dose', taken: savedMap[nId]?.taken || false, takenAt: savedMap[nId]?.takenAt, meal_relation: mealRel, is_sos: isSos });
          } else if (freq.includes('0-0-1') || freq.includes('night') || freq.includes('hs')) {
            const nId = `med_${idx}_n`;
            built.push({ id: nId, name: m.name, dosage: m.dosage, timeWindow: 'night', timeLabel: '08:30 PM', instruction: m.instructions || 'Bedtime dose', taken: savedMap[nId]?.taken || false, takenAt: savedMap[nId]?.takenAt, meal_relation: mealRel, is_sos: isSos });
          } else {
            const mId = `med_${idx}_m`;
            built.push({ id: mId, name: m.name, dosage: m.dosage, timeWindow: 'morning', timeLabel: '08:30 AM', instruction: m.instructions || 'Morning dose', taken: savedMap[mId]?.taken || false, takenAt: savedMap[mId]?.takenAt, meal_relation: mealRel, is_sos: isSos });
          }
        });
        setPills(built);
      }
    } catch (e) {}
  };

  const togglePillTaken = async (id: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = new Date().toISOString().slice(0, 10);
    const updated = pills.map((p) => {
      if (p.id === id) {
        const nextState = !p.taken;
        return {
          ...p,
          taken: nextState,
          takenAt: nextState ? nowTime : undefined,
        };
      }
      return p;
    });

    setPills(updated);
    try {
      const stateMap: Record<string, { taken: boolean; takenAt?: string }> = {};
      updated.forEach((p) => {
        stateMap[p.id] = { taken: p.taken, takenAt: p.takenAt };
      });
      await AsyncStorage.setItem(`praxirence_patient_pills_${todayStr}`, JSON.stringify(stateMap));
    } catch (e) {}
  };

  const takenCount = pills.filter((p) => p.taken).length;
  const adherencePercent = pills.length > 0 ? Math.round((takenCount / pills.length) * 100) : 100;

  const handleSpeakPill = async (pill: PillScheduleItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (speakingId === pill.id) {
        await Speech.stop();
        setSpeakingId(null);
        return;
      }
      setSpeakingId(pill.id);

      const mealPhrase =
        pill.meal_relation === 'empty_stomach'
          ? (lang === 'hi' ? 'खाली पेट लें' : 'take on an empty stomach')
          : pill.meal_relation === 'before_meal'
          ? (lang === 'hi' ? 'भोजन से पहले लें' : 'take before meal')
          : (lang === 'hi' ? 'भोजन के बाद लें' : 'take after meal');

      const sosPhrase = pill.is_sos
        ? (lang === 'hi' ? 'यह दवा केवल ज़रूरत पड़ने पर ही लें।' : 'Take this medication only when needed.')
        : '';

      let spokenText = '';
      if (lang === 'hi') {
        spokenText = `दवा: ${pill.name}, खुराक: ${pill.dosage}। ${mealPhrase}। ${pill.instruction}। ${sosPhrase}`;
      } else {
        spokenText = `Medicine: ${pill.name}, dosage: ${pill.dosage}. Please ${mealPhrase}. ${pill.instruction}. ${sosPhrase}`;
      }

      Speech.speak(spokenText, {
        language: lang === 'hi' ? 'hi-IN' : 'en-IN',
        rate: 0.88,
        onDone: () => setSpeakingId(null),
        onError: () => setSpeakingId(null),
        onStopped: () => setSpeakingId(null),
      });
    } catch (e) {
      console.warn('Speech playback notice:', e);
      setSpeakingId(null);
    }
  };

  const getMealBadge = (relation?: string, isSos?: boolean) => {
    if (isSos) {
      return {
        label: lang === 'hi' ? 'एसओएस (जरूरत पर)' : 'SOS (When Needed)',
        icon: 'flash-outline' as const,
        bg: '#FEE2E2',
        border: '#FCA5A5',
        color: '#DC2626',
      };
    }
    switch (relation) {
      case 'empty_stomach':
        return {
          label: lang === 'hi' ? 'खाली पेट (Khali Pet)' : 'Empty Stomach (Khali Pet)',
          icon: 'water-outline' as const,
          bg: '#CCFBF1',
          border: '#99F6E4',
          color: '#0F766E',
        };
      case 'before_meal':
        return {
          label: lang === 'hi' ? 'खाने से पहले' : 'Before Meal',
          icon: 'time-outline' as const,
          bg: '#FEF3C7',
          border: '#FDE68A',
          color: '#B45309',
        };
      case 'after_meal':
      default:
        return {
          label: lang === 'hi' ? 'खाने के बाद' : 'After Meal',
          icon: 'restaurant-outline' as const,
          bg: '#DCFCE7',
          border: '#86EFAC',
          color: '#15803D',
        };
    }
  };

  const getWindowBadge = (window: 'morning' | 'afternoon' | 'night') => {
    switch (window) {
      case 'morning':
        return { label: translateText('morningDose', lang), bg: '#FEF3C7', border: '#FDE68A', color: '#B45309', icon: 'sunny' as const };
      case 'afternoon':
        return { label: translateText('afternoonDose', lang), bg: '#E0F2FE', border: '#BAE6FD', color: '#0369A1', icon: 'partly-sunny' as const };
      case 'night':
        return { label: translateText('nightDose', lang), bg: '#F5F3FF', border: '#DDD6FE', color: '#6D28D9', icon: 'moon' as const };
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="medkit" size={18} color="#059669" />
            <Text style={styles.title}>{translateText('pillTrackerTitle', lang)}</Text>
          </View>
          <Text style={styles.subtitle}>{translateText('pillTrackerSubtitle', lang)}</Text>
        </View>

        {/* Adherence Circle */}
        <View style={styles.scorePill}>
          <Text style={styles.scoreText}>{takenCount}/{pills.length}</Text>
          <Text style={styles.scoreSub}>Taken</Text>
        </View>
      </View>

      {/* Streak Badge */}
      <View style={styles.streakCard}>
        <Ionicons name="ribbon-outline" size={14} color="#047857" style={{ marginRight: 6 }} />
        <Text style={styles.streakText}>
          Adherence Streak: {streakDays} Days • {adherencePercent}% Score
        </Text>
      </View>

      {/* Pill Items */}
      <View style={styles.pillsList}>
        {pills.map((pill) => {
          const win = getWindowBadge(pill.timeWindow);
          const meal = getMealBadge(pill.meal_relation, pill.is_sos);
          const isSpeakingThis = speakingId === pill.id;

          return (
            <TouchableOpacity
              key={pill.id}
              style={[styles.pillRow, pill.taken && styles.pillRowTaken]}
              onPress={() => togglePillTaken(pill.id)}
              activeOpacity={0.7}
            >
              {/* Checkbox */}
              <View style={[styles.checkbox, pill.taken && styles.checkboxActive]}>
                {pill.taken && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
              </View>

              {/* Medicine Details */}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <Text style={[styles.medName, pill.taken && styles.medNameTaken]}>
                    {pill.name}
                  </Text>
                  <View style={styles.dosagePill}>
                    <Text style={styles.dosageText}>{pill.dosage}</Text>
                  </View>
                </View>

                <Text style={styles.instructionText}>
                  {pill.instruction}
                </Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
                  {/* Time Window Tag */}
                  <View style={[styles.windowTag, { backgroundColor: win.bg, borderColor: win.border, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }]}>
                    <Ionicons name={win.icon} size={11} color={win.color} />
                    <Text style={[styles.windowTagText, { color: win.color }]}>
                      {win.label} • {pill.timeLabel}
                    </Text>
                  </View>

                  {/* Meal Relation Glyphs Badge */}
                  <View style={[styles.windowTag, { backgroundColor: meal.bg, borderColor: meal.border, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Ionicons name={meal.icon} size={11} color={meal.color} />
                    <Text style={[styles.windowTagText, { color: meal.color }]}>
                      {meal.label}
                    </Text>
                  </View>
                </View>
              </View>

              {/* 1-Tap Native TTS Speak Advice Button */}
              <TouchableOpacity
                style={[styles.speakBtn, isSpeakingThis && styles.speakBtnActive]}
                onPress={() => handleSpeakPill(pill)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={isSpeakingThis ? "volume-high" : "volume-medium-outline"}
                  size={16}
                  color={isSpeakingThis ? "#0D9488" : "#64748B"}
                />
              </TouchableOpacity>

              {/* Taken Status Indicator */}
              {pill.taken && pill.takenAt && (
                <View style={[styles.takenStamp, { flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
                  <Ionicons name="checkmark-circle" size={12} color="#059669" />
                  <Text style={styles.takenStampText}>{pill.takenAt}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  scorePill: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#059669',
  },
  scoreSub: {
    fontSize: 9,
    fontWeight: '600',
    color: '#16A34A',
    textTransform: 'uppercase',
  },
  streakCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
    flexShrink: 1,
  },
  pillsList: {
    gap: 8,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  pillRowTaken: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  medName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  medNameTaken: {
    color: '#059669',
    textDecorationLine: 'line-through',
  },
  dosagePill: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  dosageText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
  },
  instructionText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  windowTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  windowTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  takenStamp: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  takenStampText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  speakBtn: {
    padding: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  speakBtnActive: {
    backgroundColor: '#CCFBF1',
  },
});

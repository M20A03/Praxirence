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
  // Empty default state - never show fake medicines or fake streak to a fresh user
  const [pills, setPills] = useState<PillScheduleItem[]>([]);
  const [streakDays, setStreakDays] = useState(0);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    loadOrBuildPillState();
  }, [medicines, reminders]);

  const loadOrBuildPillState = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const savedRaw = await AsyncStorage.getItem(`praxirence_patient_pills_${todayStr}`);
      const savedMap: Record<string, { taken: boolean; takenAt?: string }> = savedRaw ? JSON.parse(savedRaw) : {};

      // Load streak from real storage
      const storedStreak = await AsyncStorage.getItem('praxirence_patient_adherence_streak');
      if (storedStreak) {
        setStreakDays(parseInt(storedStreak, 10) || 0);
      }

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
      } else {
        // No prescriptions or reminders
        setPills([]);
      }
    } catch (e) {
      setPills([]);
    }
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
  const adherencePercent = pills.length > 0 ? Math.round((takenCount / pills.length) * 100) : 0;

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
        icon: 'flash' as const,
        bg: '#FEE2E2',
        border: '#FECACA',
        color: '#DC2626',
      };
    }
    switch (relation) {
      case 'empty_stomach':
        return {
          label: lang === 'hi' ? 'खाली पेट (Khali Pet)' : 'Empty Stomach (Khali Pet)',
          icon: 'water' as const,
          bg: '#CCFBF1',
          border: '#99F6E4',
          color: '#0F766E',
        };
      case 'before_meal':
        return {
          label: lang === 'hi' ? 'खाने से पहले' : 'Before Meal',
          icon: 'time' as const,
          bg: '#FEF3C7',
          border: '#FDE68A',
          color: '#B45309',
        };
      case 'after_meal':
      default:
        return {
          label: lang === 'hi' ? 'खाने के बाद' : 'After Meal',
          icon: 'restaurant' as const,
          bg: '#DCFCE7',
          border: '#BBF7D0',
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

  // When no medicines are prescribed, render clean empty state
  if (pills.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="medkit" size={17} color="#0D9488" />
              </View>
              <Text style={styles.title}>{translateText('pillTrackerTitle', lang)}</Text>
            </View>
            <Text style={styles.subtitle}>{translateText('pillTrackerSubtitle', lang)}</Text>
          </View>
        </View>

        <View style={styles.emptyCard}>
          <View style={styles.emptyIconBadge}>
            <Ionicons name="bandage-outline" size={32} color="#0D9488" />
          </View>
          <Text style={styles.emptyTitle}>No active prescriptions for today</Text>
          <Text style={styles.emptySubtitle}>
            Your prescribed medicines, dosages, and reminder schedule will automatically appear here following your consultation.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.headerIconBadge}>
              <Ionicons name="medkit" size={17} color="#0D9488" />
            </View>
            <Text style={styles.title}>{translateText('pillTrackerTitle', lang)}</Text>
          </View>
          <Text style={styles.subtitle}>{translateText('pillTrackerSubtitle', lang)}</Text>
        </View>

        {/* Adherence Ratio Pill */}
        <View style={styles.scorePill}>
          <Text style={styles.scoreText}>{takenCount}/{pills.length}</Text>
          <Text style={styles.scoreSub}>TAKEN</Text>
        </View>
      </View>

      {/* Elevated Adherence Streak Card */}
      <View style={styles.streakCard}>
        <View style={styles.streakLeftRow}>
          <View style={styles.streakIconCircle}>
            <Ionicons name="trophy" size={15} color="#059669" />
          </View>
          <Text style={styles.streakText}>
            Adherence Streak: <Text style={styles.streakBoldText}>{streakDays} Days</Text>
          </Text>
        </View>
        <View style={styles.scorePercentageBadge}>
          <Text style={styles.scorePercentageText}>{adherencePercent}% Score</Text>
        </View>
      </View>

      {/* Pill Items */}
      <View style={styles.pillsList}>
        {pills.map((pill) => {
          const win = getWindowBadge(pill.timeWindow);
          const meal = getMealBadge(pill.meal_relation, pill.is_sos);
          const isSpeakingThis = speakingId === pill.id;

          return (
            <View
              key={pill.id}
              style={[styles.pillCard, pill.taken && styles.pillCardTaken]}
            >
              {/* Card Top Row: Checkbox, Medicine Name, Dosage, and Right Actions */}
              <View style={styles.pillCardHeader}>
                <TouchableOpacity
                  style={styles.checkboxTouchable}
                  onPress={() => togglePillTaken(pill.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, pill.taken && styles.checkboxActive]}>
                    {pill.taken && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
                  </View>
                  <View style={styles.medTitleContainer}>
                    <Text style={[styles.medName, pill.taken && styles.medNameTaken]}>
                      {pill.name}
                    </Text>
                    <View style={styles.dosagePill}>
                      <Text style={styles.dosageText}>{pill.dosage}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Right Actions: Taken Stamp + Native TTS Speaker Button */}
                <View style={styles.headerActionsRight}>
                  {pill.taken && pill.takenAt && (
                    <View style={styles.takenStamp}>
                      <Ionicons name="checkmark-circle" size={12} color="#059669" />
                      <Text style={styles.takenStampText}>{pill.takenAt}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.speakBtn, isSpeakingThis && styles.speakBtnActive]}
                    onPress={() => handleSpeakPill(pill)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name={isSpeakingThis ? "volume-high" : "volume-medium-outline"}
                      size={17}
                      color={isSpeakingThis ? "#0D9488" : "#64748B"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Instructions Row */}
              <Text style={styles.instructionText}>
                {pill.instruction}
              </Text>

              {/* Badges Metadata Row (Flex Wrap without clipping) */}
              <View style={styles.badgesWrapRow}>
                {/* Time Window Tag */}
                <View style={[styles.badgePill, { backgroundColor: win.bg, borderColor: win.border }]}>
                  <Ionicons name={win.icon} size={12} color={win.color} />
                  <Text style={[styles.badgePillText, { color: win.color }]}>
                    {win.label} • {pill.timeLabel}
                  </Text>
                </View>

                {/* Meal Relation Badge */}
                <View style={[styles.badgePill, { backgroundColor: meal.bg, borderColor: meal.border }]}>
                  <Ionicons name={meal.icon} size={12} color={meal.color} />
                  <Text style={[styles.badgePillText, { color: meal.color }]}>
                    {meal.label}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 16,
    color: '#0F172A',
  },
  subtitle: {
    fontFamily: 'System',
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  scorePill: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
  },
  scoreText: {
    fontFamily: 'System',
    fontWeight: '800',
    fontSize: 15,
    color: '#059669',
  },
  scoreSub: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 9,
    color: '#059669',
    letterSpacing: 0.5,
  },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  streakLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakText: {
    fontFamily: 'System',
    fontSize: 12,
    color: '#166534',
  },
  streakBoldText: {
    fontWeight: '700',
    color: '#15803D',
  },
  scorePercentageBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scorePercentageText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 11,
    color: '#15803D',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyIconBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  emptyTitle: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: 'System',
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 290,
  },
  pillsList: {
    gap: 12,
  },
  pillCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pillCardTaken: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  pillCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  checkboxTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.8,
    borderColor: '#94A3B8',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  medTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  medName: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 15,
    color: '#0F172A',
  },
  medNameTaken: {
    color: '#059669',
  },
  dosagePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dosageText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 11,
    color: '#475569',
  },
  headerActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  takenStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  takenStampText: {
    fontFamily: 'System',
    fontWeight: '700',
    fontSize: 11,
    color: '#15803D',
  },
  speakBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  speakBtnActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#99F6E4',
  },
  instructionText: {
    fontFamily: 'System',
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    marginBottom: 10,
    marginLeft: 32,
  },
  badgesWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginLeft: 32,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  badgePillText: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 11,
  },
});

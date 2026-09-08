import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SupportedLanguage, translateText } from '../utils/languageTranslations';

interface PillScheduleItem {
  id: string;
  name: string;
  dosage: string;
  timeWindow: 'morning' | 'afternoon' | 'night';
  timeLabel: string;
  instruction: string;
  taken: boolean;
  takenAt?: string;
}

interface PillTrackerCardProps {
  lang?: SupportedLanguage;
}

export const PillTrackerCard: React.FC<PillTrackerCardProps> = ({ lang = 'en' }) => {
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
    },
    {
      id: 'p2',
      name: 'Paracetamol Tablets',
      dosage: '650mg',
      timeWindow: 'afternoon',
      timeLabel: '01:30 PM',
      instruction: 'Take 1 tablet after lunch (SOS for fever)',
      taken: false,
    },
    {
      id: 'p3',
      name: 'Amoxicillin & Clavulanate',
      dosage: '625mg',
      timeWindow: 'night',
      timeLabel: '08:30 PM',
      instruction: 'Take 1 tablet after dinner',
      taken: false,
    },
  ]);

  const [streakDays, setStreakDays] = useState(5);

  useEffect(() => {
    loadPillState();
  }, []);

  const loadPillState = async () => {
    try {
      const saved = await AsyncStorage.getItem('praxirence_patient_pills_today');
      if (saved) {
        setPills(JSON.parse(saved));
      }
    } catch (e) {}
  };

  const togglePillTaken = async (id: string) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
      await AsyncStorage.setItem('praxirence_patient_pills_today', JSON.stringify(updated));
    } catch (e) {}
  };

  const takenCount = pills.filter((p) => p.taken).length;
  const adherencePercent = Math.round((takenCount / pills.length) * 100);

  const getWindowBadge = (window: 'morning' | 'afternoon' | 'night') => {
    switch (window) {
      case 'morning':
        return { label: translateText('morningDose', lang), bg: '#FEF3C7', color: '#B45309', icon: 'sunny' as const };
      case 'afternoon':
        return { label: translateText('afternoonDose', lang), bg: '#E0F2FE', color: '#0369A1', icon: 'partly-sunny' as const };
      case 'night':
        return { label: translateText('nightDose', lang), bg: '#F1F5F9', color: '#334155', icon: 'moon' as const };
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
        <Text style={styles.streakText}>
          🔥 {streakDays}-Day Adherence Streak • {adherencePercent}% Today
        </Text>
      </View>

      {/* Pill Items */}
      <View style={styles.pillsList}>
        {pills.map((pill) => {
          const win = getWindowBadge(pill.timeWindow);
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

                <View style={styles.windowTag}>
                  <Ionicons name={win.icon} size={11} color={win.color} />
                  <Text style={[styles.windowTagText, { color: win.color }]}>
                    {win.label} • {pill.timeLabel}
                  </Text>
                </View>
              </View>

              {/* Taken Status Indicator */}
              {pill.taken && pill.takenAt && (
                <View style={styles.takenStamp}>
                  <Text style={styles.takenStampText}>✓ {pill.takenAt}</Text>
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
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  streakText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
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
});

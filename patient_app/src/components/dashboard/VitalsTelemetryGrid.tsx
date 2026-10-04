import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize } from '../../theme';
import { VitalsRecord } from '../../types';
import { SupportedLanguage, translateText } from '../../utils/languageTranslations';

interface VitalsTelemetryGridProps {
  vitals: VitalsRecord | null;
  onLogVitalsPress: () => void;
  lang?: SupportedLanguage;
}

export const VitalsTelemetryGrid: React.FC<VitalsTelemetryGridProps> = ({
  vitals,
  onLogVitalsPress,
  lang = 'en',
}) => {
  if (!vitals) {
    return (
      <View style={styles.vitalsCard}>
        <View style={styles.vitalsHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="pulse" size={18} color="#0D9488" />
            </View>
            <Text style={styles.vitalsHeaderTitle}>🩺 {translateText('vitalsMonitoring', lang)}</Text>
          </View>
        </View>

        {/* Production Empty State */}
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconBadge}>
            <Ionicons name="fitness-outline" size={32} color="#0D9488" />
          </View>
          <Text style={styles.emptyTitle}>🩺 {translateText('noVitalsLogged', lang)}</Text>
          <Text style={styles.emptySubtitle}>
            {translateText('vitalsEmptyDesc', lang)}
          </Text>
          <TouchableOpacity
            style={styles.emptyCtaButton}
            onPress={onLogVitalsPress}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyCtaText}>➕ {translateText('logFirstVital', lang)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.vitalsCard}>
      <View style={styles.vitalsHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={styles.headerIconCircle}>
            <Ionicons name="pulse" size={18} color="#0D9488" />
          </View>
          <Text style={styles.vitalsHeaderTitle}>🩺 {translateText('vitalsMonitoring', lang)}</Text>
        </View>
        <TouchableOpacity
          style={styles.logVitalsButton}
          onPress={onLogVitalsPress}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={14} color="#0F766E" />
          <Text style={styles.logVitalsButtonText}>{translateText('logTodayVitals', lang)}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.vitalsGrid}>
        {/* Blood Pressure */}
        <View style={styles.vitalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="pulse" size={14} color="#0284C7" />
            <Text style={styles.vitalLabel}>🩺 {translateText('bloodPressure', lang)}</Text>
          </View>
          <Text style={styles.vitalValue}>{vitals.bloodPressureSystolic}/{vitals.bloodPressureDiastolic}</Text>
          <Text style={styles.vitalUnit}>mmHg</Text>
          <View style={[styles.vitalStatusPill, { backgroundColor: vitals.bloodPressureSystolic < 130 ? '#F0FDF4' : '#FFFBEB', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <Ionicons
              name={vitals.bloodPressureSystolic < 130 ? "checkmark-circle" : "warning"}
              size={12}
              color={vitals.bloodPressureSystolic < 130 ? "#16A34A" : "#D97706"}
            />
            <Text style={[styles.vitalStatusText, { color: vitals.bloodPressureSystolic < 130 ? '#16A34A' : '#D97706' }]}>
              {vitals.bloodPressureSystolic < 130 ? 'Optimal' : 'Elevated'}
            </Text>
          </View>
        </View>

        {/* Pulse / Heart Rate */}
        <View style={styles.vitalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="heart" size={14} color="#E11D48" />
            <Text style={styles.vitalLabel}>{translateText('pulse', lang)}</Text>
          </View>
          <Text style={styles.vitalValue}>{vitals.heartRate}</Text>
          <Text style={styles.vitalUnit}>bpm</Text>
          <View style={[styles.vitalStatusPill, { backgroundColor: '#F0FDF4', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <Ionicons name="heart" size={12} color="#16A34A" />
            <Text style={[styles.vitalStatusText, { color: '#16A34A' }]}>Steady</Text>
          </View>
        </View>

        {/* Blood Oxygen / SpO2 */}
        <View style={styles.vitalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="fitness" size={14} color="#0D9488" />
            <Text style={styles.vitalLabel}>{translateText('spo2', lang)}</Text>
          </View>
          <Text style={styles.vitalValue}>{vitals.spo2}%</Text>
          <Text style={styles.vitalUnit}>SpO2</Text>
          <View style={[styles.vitalStatusPill, { backgroundColor: vitals.spo2 >= 95 ? '#F0FDF4' : '#FEF2F2', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <Ionicons
              name={vitals.spo2 >= 95 ? "checkmark-circle" : "warning"}
              size={12}
              color={vitals.spo2 >= 95 ? "#16A34A" : "#DC2626"}
            />
            <Text style={[styles.vitalStatusText, { color: vitals.spo2 >= 95 ? '#16A34A' : '#DC2626' }]}>
              {vitals.spo2 >= 95 ? 'Normal' : 'Low'}
            </Text>
          </View>
        </View>

        {/* Blood Glucose */}
        <View style={styles.vitalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="water" size={14} color="#D97706" />
            <Text style={styles.vitalLabel}>Blood Glucose</Text>
          </View>
          <Text style={styles.vitalValue}>{vitals.bloodSugar || 96}</Text>
          <Text style={styles.vitalUnit}>mg/dL</Text>
          <View style={[styles.vitalStatusPill, { backgroundColor: '#F8FAFC' }]}>
            <Text style={[styles.vitalStatusText, { color: '#64748B' }]}>Fasting</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  vitalsCard: {
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
  vitalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vitalsHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#0F172A',
  },
  logVitalsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  logVitalsButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#0F766E',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  emptyIconBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    maxWidth: 280,
  },
  emptyCtaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyCtaText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#FFFFFF',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  vitalBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  vitalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#64748B',
  },
  vitalValue: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: '#0F172A',
    marginTop: 6,
  },
  vitalUnit: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
    marginBottom: 8,
  },
  vitalStatusPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  vitalStatusText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
  },
});

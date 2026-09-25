import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize } from '../../theme';
import { VitalsRecord } from '../../types';

interface VitalsTelemetryGridProps {
  vitals: VitalsRecord;
  onLogVitalsPress: () => void;
}

export const VitalsTelemetryGrid: React.FC<VitalsTelemetryGridProps> = ({
  vitals,
  onLogVitalsPress,
}) => {
  return (
    <View style={styles.vitalsCard}>
      <View style={styles.vitalsHeaderRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="pulse" size={20} color={Colors.primary} />
          <Text style={styles.vitalsHeaderTitle}>Vitals Monitoring</Text>
        </View>
        <TouchableOpacity
          style={styles.logVitalsButton}
          onPress={onLogVitalsPress}
          activeOpacity={0.8}
        >
          <Text style={styles.logVitalsButtonText}>+ Log Vitals</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.vitalsGrid}>
        {/* Blood Pressure */}
        <View style={styles.vitalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="pulse" size={13} color="#0284C7" />
            <Text style={styles.vitalLabel}>Blood Pressure</Text>
          </View>
          <Text style={styles.vitalValue}>{vitals.bloodPressureSystolic}/{vitals.bloodPressureDiastolic}</Text>
          <Text style={styles.vitalUnit}>mmHg</Text>
          <View style={[styles.vitalStatusPill, { backgroundColor: vitals.bloodPressureSystolic < 130 ? '#F0FDF4' : '#FFFBEB', flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
            <Ionicons
              name={vitals.bloodPressureSystolic < 130 ? "checkmark-circle" : "warning"}
              size={11}
              color={vitals.bloodPressureSystolic < 130 ? "#16A34A" : "#D97706"}
            />
            <Text style={[styles.vitalStatusText, { color: vitals.bloodPressureSystolic < 130 ? '#16A34A' : '#D97706' }]}>
              {vitals.bloodPressureSystolic < 130 ? 'Optimal' : 'Elevated'}
            </Text>
          </View>
        </View>

        {/* Pulse / Heart Rate */}
        <View style={styles.vitalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="heart" size={13} color="#E11D48" />
            <Text style={styles.vitalLabel}>Heart Rate</Text>
          </View>
          <Text style={styles.vitalValue}>{vitals.heartRate}</Text>
          <Text style={styles.vitalUnit}>bpm</Text>
          <View style={[styles.vitalStatusPill, { backgroundColor: '#F0FDF4', flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
            <Ionicons name="heart" size={11} color="#16A34A" />
            <Text style={[styles.vitalStatusText, { color: '#16A34A' }]}>Steady</Text>
          </View>
        </View>

        {/* Blood Oxygen / SpO2 */}
        <View style={styles.vitalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="fitness" size={13} color="#0D9488" />
            <Text style={styles.vitalLabel}>Blood Oxygen</Text>
          </View>
          <Text style={styles.vitalValue}>{vitals.spo2}%</Text>
          <Text style={styles.vitalUnit}>SpO2</Text>
          <View style={[styles.vitalStatusPill, { backgroundColor: vitals.spo2 >= 95 ? '#F0FDF4' : '#FEF2F2', flexDirection: 'row', alignItems: 'center', gap: 3 }]}>
            <Ionicons
              name={vitals.spo2 >= 95 ? "checkmark-circle" : "warning"}
              size={11}
              color={vitals.spo2 >= 95 ? "#16A34A" : "#DC2626"}
            />
            <Text style={[styles.vitalStatusText, { color: vitals.spo2 >= 95 ? '#16A34A' : '#DC2626' }]}>
              {vitals.spo2 >= 95 ? 'Normal' : 'Low'}
            </Text>
          </View>
        </View>

        {/* Blood Glucose */}
        <View style={styles.vitalBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="water" size={13} color="#D97706" />
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
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  vitalsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  vitalsHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  logVitalsButton: {
    backgroundColor: Colors.primarySurface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logVitalsButtonText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.primaryDark,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  vitalBox: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  vitalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  vitalValue: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: Colors.text,
    marginTop: 6,
  },
  vitalUnit: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  vitalStatusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
  },
  vitalStatusText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#059669',
  },
});

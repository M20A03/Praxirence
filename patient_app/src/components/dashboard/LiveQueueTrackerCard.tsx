import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { QueueStatusResponse } from '../../types';

interface LiveQueueTrackerCardProps {
  queueStatus: QueueStatusResponse;
}

export const LiveQueueTrackerCard: React.FC<LiveQueueTrackerCardProps> = ({ queueStatus }) => {
  return (
    <View style={styles.liveQueueCard}>
      <View style={styles.liveQueueHeaderRow}>
        <View style={styles.liveQueueIndicatorRow}>
          <View style={styles.liveQueuePulseDot} />
          <Text style={styles.liveQueueHeaderTitle}>LIVE OPD QUEUE TRACKER</Text>
        </View>
        <View style={[
          styles.liveQueueStatusBadge,
          { backgroundColor: queueStatus.status === 'in_progress' ? '#DCFCE7' : '#EFF6FF' }
        ]}>
          <Text style={[
            styles.liveQueueStatusBadgeText,
            { color: queueStatus.status === 'in_progress' ? '#166534' : '#1E40AF' }
          ]}>
            {queueStatus.status === 'in_progress' ? 'Consulting Now' : 'In Waiting Lounge'}
          </Text>
        </View>
      </View>

      <View style={styles.liveQueueDoctorInfo}>
        <Ionicons name="medical" size={15} color={Colors.primary} />
        <Text style={styles.liveQueueDoctorText}>
          {queueStatus.doctor_name ? (queueStatus.doctor_name.startsWith('Dr.') ? queueStatus.doctor_name : `Dr. ${queueStatus.doctor_name}`) : 'Attending Physician'} • {queueStatus.time_slot}
        </Text>
      </View>

      <View style={styles.liveQueueMetricsGrid}>
        <View style={[styles.liveQueueMetricBox, styles.liveQueueTokenBox]}>
          <Text style={styles.liveQueueMetricLabel}>YOUR TOKEN</Text>
          <Text style={styles.liveQueueTokenText}>{queueStatus.token_display || `PX-0${queueStatus.token_number}`}</Text>
          <Text style={styles.liveQueueSubLabel}>Reserved</Text>
        </View>

        <View style={[styles.liveQueueMetricBox, styles.liveQueueServingBox]}>
          <Text style={[styles.liveQueueMetricLabel, { color: '#0369A1' }]}>NOW SERVING</Text>
          <Text style={[styles.liveQueueTokenText, { color: '#0284C7' }]}>
            {queueStatus.current_serving_token || 'PX-01'}
          </Text>
          <Text style={[styles.liveQueueSubLabel, { color: '#0284C7' }]}>In Chamber</Text>
        </View>

        <View style={[styles.liveQueueMetricBox, styles.liveQueueWaitBox]}>
          <Text style={[styles.liveQueueMetricLabel, { color: '#B45309' }]}>ESTIMATED WAIT</Text>
          <Text style={[styles.liveQueueWaitText, { color: '#D97706' }]}>
            {queueStatus.patients_ahead === 0
              ? 'Next!'
              : `~${queueStatus.estimated_wait_mins || (queueStatus.patients_ahead * 15)}m`}
          </Text>
          <Text style={[styles.liveQueueSubLabel, { color: '#B45309' }]}>
            {queueStatus.patients_ahead === 0
              ? 'Get Ready'
              : `${queueStatus.patients_ahead} patient${queueStatus.patients_ahead > 1 ? 's' : ''} ahead`}
          </Text>
        </View>
      </View>

      {/* Doctor Delay Alert Banner */}
      {queueStatus.doctor_delay_mins && queueStatus.doctor_delay_mins > 0 ? (
        <View style={styles.delayAlertRow}>
          <Ionicons name="time" size={15} color="#D97706" />
          <Text style={styles.delayAlertText}>
            Doctor running ~{queueStatus.doctor_delay_mins}m behind schedule. Commute advice updated.
          </Text>
        </View>
      ) : null}

      {/* Commute Guidance / When to Leave Home */}
      {queueStatus.recommended_departure_time && (
        <View style={styles.commuteAdvisoryCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="navigate-circle" size={18} color="#0D9488" />
              <Text style={styles.commuteAdvisoryTitle}>WHEN TO LEAVE HOME</Text>
            </View>
            <View style={styles.commuteBadge}>
              <Ionicons name="car-outline" size={12} color="#0F766E" />
              <Text style={styles.commuteBadgeText}>Leave by {queueStatus.recommended_departure_time}</Text>
            </View>
          </View>
          <Text style={styles.commuteAdvisoryDesc}>
            Calculated based on live OPD throughput to arrive ~10 mins before your token is called in chamber.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  liveQueueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  liveQueueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  liveQueueIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveQueuePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0284C7',
  },
  liveQueueHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#0369A1',
    letterSpacing: LetterSpacing.wide,
  },
  liveQueueStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveQueueStatusBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
  },
  liveQueueDoctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  liveQueueDoctorText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  liveQueueMetricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  liveQueueMetricBox: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  liveQueueTokenBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  liveQueueServingBox: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  liveQueueWaitBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  liveQueueMetricLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    letterSpacing: LetterSpacing.wide,
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  liveQueueTokenText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    color: Colors.primaryDark,
  },
  liveQueueWaitText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
  },
  liveQueueSubLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  delayAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  delayAlertText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#92400E',
    flex: 1,
  },
  commuteAdvisoryCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  commuteAdvisoryTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#0F766E',
    letterSpacing: LetterSpacing.wide,
  },
  commuteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  commuteBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#0F766E',
  },
  commuteAdvisoryDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#115E59',
    marginTop: 4,
    lineHeight: 16,
  },
});

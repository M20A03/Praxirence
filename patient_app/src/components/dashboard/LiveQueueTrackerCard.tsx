import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { QueueStatusResponse } from '../../types';
import { useLanguage } from '../../utils/LanguageContext';

interface LiveQueueTrackerCardProps {
  queueStatus: QueueStatusResponse;
  onCancelAppointment?: (visitId: string) => void;
  onDismissTracker?: () => void;
}

export const LiveQueueTrackerCard: React.FC<LiveQueueTrackerCardProps> = ({
  queueStatus,
  onCancelAppointment,
  onDismissTracker,
}) => {
  const { t } = useLanguage();
  const isInProgress = queueStatus.status === 'in_progress';
  const docDisplayName = queueStatus.doctor_name
    ? (queueStatus.doctor_name.startsWith('Dr.') ? queueStatus.doctor_name : `Dr. ${queueStatus.doctor_name}`)
    : 'Attending Physician';

  // Animated pulse effect for the live indicator dot
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Format departure text cleanly
  let commuteText = queueStatus.recommended_departure_time || '';
  if (commuteText.startsWith('Leave by Leave home now')) {
    commuteText = 'Leave home now (traffic ~30m)';
  } else if (!commuteText.toLowerCase().startsWith('leave') && !commuteText.toLowerCase().startsWith('depart')) {
    commuteText = `Depart at ~${commuteText}`;
  }

  return (
    <View style={[styles.liveQueueCard, isInProgress && styles.cardActiveConsultation]}>
      {/* Header Row */}
      <View style={styles.liveQueueHeaderRow}>
        <View style={styles.liveQueueIndicatorRow}>
          <Animated.View style={[styles.liveQueuePulseDot, isInProgress && styles.pulseDotActive, { opacity: pulseAnim }]} />
          <Text style={[styles.liveQueueHeaderTitle, isInProgress && styles.headerTitleActive]}>
            {isInProgress ? t('activeConsultation') : t('activeOPDQueue')}
          </Text>
        </View>
        <View style={[
          styles.liveQueueStatusBadge,
          { backgroundColor: isInProgress ? '#DCFCE7' : '#EFF6FF', borderColor: isInProgress ? '#86EFAC' : '#BFDBFE' }
        ]}>
          <Text style={[
            styles.liveQueueStatusBadgeText,
            { color: isInProgress ? '#15803D' : '#1E40AF' }
          ]}>
            {isInProgress ? t('inDoctorCabin') : t('aheadInQueue')}
          </Text>
        </View>
      </View>

      {/* Doctor & Chamber Info */}
      <View style={styles.liveQueueDoctorInfo}>
        <Ionicons name="medical" size={16} color={isInProgress ? '#15803D' : Colors.primary} />
        <Text style={styles.liveQueueDoctorText}>
          {docDisplayName} • {queueStatus.clinic_name || 'Clinic Chamber 1'}
        </Text>
      </View>

      {/* When in active consultation: Clear Guidance Banner */}
      {isInProgress ? (
        <View style={styles.activeConsultationBanner}>
          <View style={styles.activeBannerIconWrap}>
            <Ionicons name="pulse" size={20} color="#15803D" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>
              You are currently in consultation with {docDisplayName}
            </Text>
            <Text style={styles.activeBannerSubtitle}>
              The doctor is examining your symptoms and preparing your digital care plan and prescription.
            </Text>
          </View>
        </View>
      ) : null}

      {/* Metrics Grid */}
      <View style={styles.liveQueueMetricsGrid}>
        <View style={[styles.liveQueueMetricBox, styles.liveQueueTokenBox]}>
          <Text style={styles.liveQueueMetricLabel}>{t('tokenNumber')}</Text>
          <Text style={styles.liveQueueTokenText}>{queueStatus.token_display || `PX-0${queueStatus.token_number}`}</Text>
          <Text style={styles.liveQueueSubLabel}>{t('activeAndVerified')}</Text>
        </View>

        <View style={[styles.liveQueueMetricBox, styles.liveQueueServingBox]}>
          <Text style={[styles.liveQueueMetricLabel, { color: '#0369A1' }]}>{t('activeConsultation')}</Text>
          <Text style={[styles.liveQueueTokenText, { color: '#0284C7' }]}>
            {queueStatus.current_serving_token || 'PX-01'}
          </Text>
          <Text style={[styles.liveQueueSubLabel, { color: '#0284C7' }]}>
            {isInProgress ? t('optimal') : t('inDoctorCabin')}
          </Text>
        </View>

        <View style={[styles.liveQueueMetricBox, styles.liveQueueWaitBox]}>
          <Text style={[styles.liveQueueMetricLabel, { color: '#B45309' }]}>{t('estimatedWait')}</Text>
          <Text style={[styles.liveQueueWaitText, { color: '#D97706' }]}>
            {isInProgress
              ? 'Now'
              : (queueStatus.patients_ahead === 0
                ? 'Next!'
                : `~${queueStatus.estimated_wait_mins || (queueStatus.patients_ahead * 15)} ${t('mins')}`)}
          </Text>
          <Text style={[styles.liveQueueSubLabel, { color: '#B45309' }]}>
            {isInProgress
              ? t('optimal')
              : (queueStatus.patients_ahead === 0
                ? t('normal')
                : `${queueStatus.patients_ahead} ${t('patientsAhead')}`)}
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

      {/* Commute Guidance / When to Leave Home (Only when waiting) */}
      {!isInProgress && queueStatus.recommended_departure_time ? (
        <View style={styles.commuteAdvisoryCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="navigate-circle" size={18} color="#0D9488" />
              <Text style={styles.commuteAdvisoryTitle}>{t('commuteAdvisory')}</Text>
            </View>
            <View style={styles.commuteBadge}>
              <Ionicons name="car-outline" size={13} color="#0F766E" />
              <Text style={styles.commuteBadgeText}>{commuteText}</Text>
            </View>
          </View>
          <Text style={styles.commuteAdvisoryDesc}>
            Calculated based on live OPD throughput so you arrive ~10 minutes before your token is called.
          </Text>
        </View>
      ) : null}

      {/* Action Footer: End / Cancel / Dismiss */}
      <View style={styles.actionFooterRow}>
        {onCancelAppointment && (
          <TouchableOpacity
            style={styles.cancelApptBtn}
            onPress={() => onCancelAppointment(queueStatus.visit_id)}
            activeOpacity={0.7}
          >
            <Ionicons name="close-circle-outline" size={15} color="#DC2626" />
            <Text style={styles.cancelApptBtnText}>
              {isInProgress ? 'End / Exit Consultation' : t('cancelAppointment')}
            </Text>
          </TouchableOpacity>
        )}

        {onDismissTracker && (
          <TouchableOpacity
            style={styles.dismissTrackerBtn}
            onPress={onDismissTracker}
            activeOpacity={0.7}
          >
            <Ionicons name="eye-off-outline" size={14} color="#64748B" />
            <Text style={styles.dismissTrackerBtnText}>Dismiss Tracker</Text>
          </TouchableOpacity>
        )}
      </View>
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
  cardActiveConsultation: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    shadowColor: '#10B981',
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
  pulseDotActive: {
    backgroundColor: '#10B981',
    transform: [{ scale: 1.2 }],
  },
  liveQueueHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: FontSize.xs,
    color: '#0369A1',
    letterSpacing: LetterSpacing.wide,
  },
  headerTitleActive: {
    color: '#15803D',
  },
  liveQueueStatusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  liveQueueStatusBadgeText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
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
    fontWeight: '600',
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  activeConsultationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  activeBannerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBannerTitle: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: FontSize.xs,
    color: '#166534',
    lineHeight: 18,
  },
  activeBannerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#15803D',
    marginTop: 2,
    lineHeight: 15,
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
    fontWeight: '700',
    fontSize: 9,
    letterSpacing: LetterSpacing.wide,
    color: Colors.primaryDark,
    marginBottom: 4,
  },
  liveQueueTokenText: {
    fontFamily: FontFamily.extraBold,
    fontWeight: '800',
    fontSize: 20,
    color: Colors.primaryDark,
  },
  liveQueueWaitText: {
    fontFamily: FontFamily.extraBold,
    fontWeight: '800',
    fontSize: 18,
  },
  liveQueueSubLabel: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
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
    fontWeight: '500',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
  actionFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 10,
  },
  cancelApptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  cancelApptBtnText: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: 11,
    color: '#DC2626',
  },
  dismissTrackerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dismissTrackerBtnText: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    fontSize: 11,
    color: '#64748B',
  },
});

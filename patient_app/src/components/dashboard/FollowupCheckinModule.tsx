import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '../../theme';

export interface PendingCheckinItem {
  visit_id: string;
  day: number;
  doctor_id: string;
  doctor_name: string;
  scheduled_for?: string;
}

interface FollowupCheckinModuleProps {
  pendingCheckins: PendingCheckinItem[];
  checkinStatus: string;
  setCheckinStatus: (status: any) => void;
  checkinNotes: string;
  setCheckinNotes: (notes: string) => void;
  submittingCheckin: boolean;
  onAnswerCheckin: (checkin: PendingCheckinItem) => void;
  onNavigateToDoctors?: () => void;
}

export const FollowupCheckinModule: React.FC<FollowupCheckinModuleProps> = ({
  pendingCheckins,
  checkinStatus,
  setCheckinStatus,
  checkinNotes,
  setCheckinNotes,
  submittingCheckin,
  onAnswerCheckin,
  onNavigateToDoctors,
}) => {
  if (!pendingCheckins || pendingCheckins.length === 0) return null;

  const currentCheckin = pendingCheckins[0];
  const isDay3 = currentCheckin.day === 3;

  return (
    <View style={styles.clinicalFollowupCard}>
      <View style={styles.clinicalFollowupHeader}>
        <View style={styles.clinicalHeaderBadge}>
          <Ionicons
            name={isDay3 ? "pulse-outline" : "fitness-outline"}
            size={14}
            color="#0F766E"
          />
          <Text style={styles.clinicalHeaderBadgeText}>
            {isDay3 ? '3-Day Clinical Follow-up' : '1-Week Health Evaluation'}
          </Text>
        </View>
        <Text style={styles.clinicalDoctorLabel}>{currentCheckin.doctor_name}</Text>
      </View>

      <Text style={styles.clinicalCardTitle}>
        {isDay3 ? 'Recovery Evaluation' : '1-Week Health Follow-up'}
      </Text>
      <Text style={styles.clinicalCardSubtitle}>
        {isDay3
          ? `How is your recovery progressing following your consultation with ${currentCheckin.doctor_name}?`
          : `One week has elapsed since your visit with ${currentCheckin.doctor_name}. Please report your recovery status.`}
      </Text>

      <Text style={styles.clinicalFieldLabel}>Select Clinical Status</Text>
      <View style={styles.clinicalStatusSelector}>
        {isDay3 ? (
          <>
            <TouchableOpacity
              style={[
                styles.clinicalStatusPill,
                checkinStatus === 'feeling_better' && styles.statusPillImproved
              ]}
              onPress={() => setCheckinStatus('feeling_better')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="trending-up-outline"
                size={16}
                color={checkinStatus === 'feeling_better' ? '#065F46' : '#64748B'}
              />
              <Text style={[
                styles.clinicalStatusPillText,
                checkinStatus === 'feeling_better' && styles.statusTextImproved
              ]}>
                Improved
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.clinicalStatusPill,
                checkinStatus === 'recovering' && styles.statusPillSteady
              ]}
              onPress={() => setCheckinStatus('recovering')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="remove-outline"
                size={16}
                color={checkinStatus === 'recovering' ? '#0369A1' : '#64748B'}
              />
              <Text style={[
                styles.clinicalStatusPillText,
                checkinStatus === 'recovering' && styles.statusTextSteady
              ]}>
                Steady
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.clinicalStatusPill,
                checkinStatus === 'worse' && styles.statusPillWorsening
              ]}
              onPress={() => setCheckinStatus('worse')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={checkinStatus === 'worse' ? '#BE123C' : '#64748B'}
              />
              <Text style={[
                styles.clinicalStatusPillText,
                checkinStatus === 'worse' && styles.statusTextWorsening
              ]}>
                Worsening
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.clinicalStatusPill,
                checkinStatus === 'feeling_better' && styles.statusPillImproved
              ]}
              onPress={() => setCheckinStatus('feeling_better')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={checkinStatus === 'feeling_better' ? '#065F46' : '#64748B'}
              />
              <Text style={[
                styles.clinicalStatusPillText,
                checkinStatus === 'feeling_better' && styles.statusTextImproved
              ]}>
                Fully Recovered
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.clinicalStatusPill,
                checkinStatus === 'recovering' && styles.statusPillSteady
              ]}
              onPress={() => setCheckinStatus('recovering')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="pulse-outline"
                size={16}
                color={checkinStatus === 'recovering' ? '#0369A1' : '#64748B'}
              />
              <Text style={[
                styles.clinicalStatusPillText,
                checkinStatus === 'recovering' && styles.statusTextSteady
              ]}>
                Ongoing Symptoms
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.clinicalStatusPill,
                checkinStatus === 'worse' && styles.statusPillWorsening
              ]}
              onPress={() => setCheckinStatus('worse')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={checkinStatus === 'worse' ? '#BE123C' : '#64748B'}
              />
              <Text style={[
                styles.clinicalStatusPillText,
                checkinStatus === 'worse' && styles.statusTextWorsening
              ]}>
                Follow-up Needed
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Inline Re-Schedule Action if symptoms persist on Day 7 */}
      {!isDay3 && (checkinStatus === 'recovering' || checkinStatus === 'worse') && (
        <View style={styles.clinicalReferralBanner}>
          <View style={styles.clinicalReferralIconWrap}>
            <Ionicons name="calendar-outline" size={18} color="#0F766E" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clinicalReferralTitle}>Schedule Follow-up Consultation</Text>
            <Text style={styles.clinicalReferralDesc}>
              Consult directly with {currentCheckin.doctor_name} for a clinical re-assessment.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.clinicalReferralActionBtn}
            onPress={() => onNavigateToDoctors?.()}
            activeOpacity={0.8}
          >
            <Text style={styles.clinicalReferralActionBtnText}>Book</Text>
            <Ionicons name="chevron-forward" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        style={styles.clinicalNoteInput}
        placeholder="Describe any ongoing symptoms or questions for your doctor (optional)..."
        placeholderTextColor="#94A3B8"
        value={checkinNotes}
        onChangeText={setCheckinNotes}
        multiline
        numberOfLines={2}
      />

      <TouchableOpacity
        style={styles.clinicalSubmitBtn}
        disabled={submittingCheckin}
        onPress={() => onAnswerCheckin(currentCheckin)}
        activeOpacity={0.8}
      >
        {submittingCheckin ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Text style={styles.clinicalSubmitBtnText}>Submit Evaluation</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  clinicalFollowupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  clinicalFollowupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clinicalHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  clinicalHeaderBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#0F766E',
    letterSpacing: 0.3,
  },
  clinicalDoctorLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#64748B',
  },
  clinicalCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 22,
  },
  clinicalCardSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 14,
  },
  clinicalFieldLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  clinicalStatusSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  clinicalStatusPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  clinicalStatusPillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#475569',
  },
  statusPillImproved: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
  },
  statusTextImproved: {
    color: '#065F46',
    fontWeight: '700',
  },
  statusPillSteady: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
  },
  statusTextSteady: {
    color: '#0369A1',
    fontWeight: '700',
  },
  statusPillWorsening: {
    backgroundColor: '#FFF1F2',
    borderColor: '#F43F5E',
  },
  statusTextWorsening: {
    color: '#BE123C',
    fontWeight: '700',
  },
  clinicalReferralBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  clinicalReferralIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicalReferralTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#0F766E',
  },
  clinicalReferralDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#115E59',
    marginTop: 2,
    lineHeight: 16,
  },
  clinicalReferralActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F766E',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  clinicalReferralActionBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  clinicalNoteInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 18,
    marginBottom: 14,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  clinicalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F766E',
    minHeight: 48,
    borderRadius: 12,
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  clinicalSubmitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});

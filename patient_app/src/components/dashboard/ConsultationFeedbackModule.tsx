import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '../../theme';

export interface PendingReviewItem {
  doctor_id: string;
  doctor_name: string;
  is_first_visit?: boolean;
}

interface ConsultationFeedbackModuleProps {
  pendingReviews: PendingReviewItem[];
  dismissedReviews: { [key: string]: boolean };
  reviewRating: number;
  setReviewRating: (rating: number) => void;
  reviewText: string;
  setReviewText: (text: string) => void;
  submittingReview: boolean;
  onSubmitReview: (review: PendingReviewItem) => void;
  onDismissReview: (doctorId: string) => void;
}

export const ConsultationFeedbackModule: React.FC<ConsultationFeedbackModuleProps> = ({
  pendingReviews,
  dismissedReviews,
  reviewRating,
  setReviewRating,
  reviewText,
  setReviewText,
  submittingReview,
  onSubmitReview,
  onDismissReview,
}) => {
  const activeReview = pendingReviews.find((r) => !dismissedReviews[r.doctor_id]);
  if (!activeReview) return null;

  const currentWords = reviewText.trim().split(/\s+/).filter(Boolean);
  const wordCount = reviewText.trim() === '' ? 0 : currentWords.length;
  const isReady = wordCount >= 10 && reviewRating >= 1;
  const progressPct = Math.min(100, (wordCount / 10) * 100);

  return (
    <View style={styles.feedbackCardContainer}>
      <View style={styles.feedbackCardHeader}>
        <View style={styles.feedbackHeaderBadge}>
          <Ionicons name="shield-checkmark-outline" size={13} color="#0F766E" />
          <Text style={styles.feedbackHeaderBadgeText}>
            {activeReview.is_first_visit ? 'First Consultation Feedback' : 'Consultation Feedback'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.feedbackSkipAction}
          onPress={() => onDismissReview(activeReview.doctor_id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.feedbackSkipActionText}>Skip for now</Text>
          <Ionicons name="close" size={14} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <Text style={styles.feedbackPromptTitle}>
        How was your consultation with {activeReview.doctor_name}?
      </Text>
      <Text style={styles.feedbackPromptSubtitle}>
        Optional reference for other patients. Please write at least 10 words about the clinician's explanation and care quality.
      </Text>

      {/* 5-Star Clinical Rating Selector */}
      <View style={styles.feedbackStarsContainer}>
        <View style={styles.feedbackStarsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => setReviewRating(star)}
              style={styles.feedbackStarTouch}
              activeOpacity={0.7}
            >
              <Ionicons
                name={star <= reviewRating ? 'star' : 'star-outline'}
                size={24}
                color={star <= reviewRating ? '#D97706' : '#CBD5E1'}
              />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.feedbackRatingLabel}>
          {reviewRating.toFixed(1)} / 5.0 • {
            reviewRating === 5 ? 'Excellent Care' :
            reviewRating === 4 ? 'Good Experience' :
            reviewRating === 3 ? 'Standard Visit' :
            reviewRating === 2 ? 'Suboptimal' : 'Unsatisfactory'
          }
        </Text>
      </View>

      {/* Structured Feedback Textarea */}
      <TextInput
        style={styles.feedbackTextarea}
        placeholder="Share details regarding the doctor's explanation, treatment clarity, and waiting time..."
        placeholderTextColor="#94A3B8"
        value={reviewText}
        onChangeText={setReviewText}
        multiline
        numberOfLines={3}
      />

      {/* Sleek 10-Word Verification Progress Meter */}
      <View style={styles.wordCounterContainer}>
        <View style={styles.wordCounterHeaderRow}>
          <Text style={styles.wordCounterText}>
            {wordCount < 10
              ? `${wordCount} of 10 words minimum (${10 - wordCount} more required)`
              : `${wordCount} words recorded`}
          </Text>
          {isReady && (
            <View style={styles.wordCounterVerifiedBadge}>
              <Ionicons name="checkmark-circle" size={13} color="#059669" />
              <Text style={styles.wordCounterVerifiedText}>Ready to submit</Text>
            </View>
          )}
        </View>
        <View style={styles.wordCounterTrack}>
          <View
            style={[
              styles.wordCounterFill,
              { width: `${progressPct}%` },
              isReady && { backgroundColor: '#0D9488' }
            ]}
          />
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.feedbackActionRow}>
        <TouchableOpacity
          style={styles.feedbackDismissBtn}
          onPress={() => onDismissReview(activeReview.doctor_id)}
          activeOpacity={0.7}
        >
          <Text style={styles.feedbackDismissBtnText}>Maybe Later</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.feedbackSubmitBtn,
            !isReady && styles.feedbackSubmitBtnDisabled
          ]}
          disabled={!isReady || submittingReview}
          onPress={() => onSubmitReview(activeReview)}
          activeOpacity={0.8}
        >
          {submittingReview ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.feedbackSubmitBtnText}>Submit Feedback</Text>
              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  feedbackCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  feedbackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  feedbackHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  feedbackHeaderBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#0F766E',
    letterSpacing: 0.3,
  },
  feedbackSkipAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  feedbackSkipActionText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: '#94A3B8',
  },
  feedbackPromptTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 4,
    lineHeight: 22,
  },
  feedbackPromptSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
    marginBottom: 14,
  },
  feedbackStarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 14,
  },
  feedbackStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feedbackStarTouch: {
    padding: 3,
  },
  feedbackRatingLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#475569',
  },
  feedbackTextarea: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#1E293B',
    lineHeight: 19,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  wordCounterContainer: {
    marginBottom: 16,
  },
  wordCounterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  wordCounterText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#64748B',
  },
  wordCounterVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  wordCounterVerifiedText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#059669',
  },
  wordCounterTrack: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  wordCounterFill: {
    height: '100%',
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
  },
  feedbackActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedbackDismissBtn: {
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  feedbackDismissBtnText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    color: '#64748B',
  },
  feedbackSubmitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    shadowColor: '#0F766E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  feedbackSubmitBtnDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
  },
  feedbackSubmitBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});

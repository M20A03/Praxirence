import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize, LetterSpacing } from '../theme/typography';
import { PatientUser, ConsentDocument } from '../types';
import { mobileApi } from '../services/api';

interface ConsentScreenProps {
  user: PatientUser;
  onConsentUpdated: (newStatus: boolean) => void;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({
  user,
  onConsentUpdated,
}) => {
  const [doc, setDoc] = useState<ConsentDocument | null>(null);
  const [consentStatus, setConsentStatus] = useState(user.consent_status);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadConsentDocument();
  }, []);

  const loadConsentDocument = async () => {
    try {
      setLoading(true);
      const data = await mobileApi.getConsent(user.id);
      setDoc(data);
      setConsentStatus(data.consent_status);
    } catch (err) {
      console.log('Error loading consent:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConsent = async (newStatus: boolean) => {
    setSubmitting(true);
    try {
      await mobileApi.updateConsent(user.id, newStatus);
      setConsentStatus(newStatus);
      onConsentUpdated(newStatus);
      Alert.alert(
        newStatus ? 'Consent Granted' : 'Consent Revoked',
        newStatus
          ? 'Thank you. Your doctor can now dispatch care plans and reminders directly to your WhatsApp.'
          : 'Your consent has been revoked. Automatic reminders and messaging have been paused.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update consent status.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Title & Status Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Patient Consent Agreement</Text>
        <Text style={styles.subtitle}>Plain-Language Clinical Data & Notification Policy</Text>

        <View style={[
          styles.statusCard,
          { backgroundColor: consentStatus ? 'rgba(16, 185, 129, 0.12)' : 'rgba(244, 63, 94, 0.12)' }
        ]}>
          <Text style={[
            styles.statusCardTitle,
            { color: consentStatus ? Colors.primaryLight : Colors.rose }
          ]}>
            {consentStatus ? '✓ Current Status: Consent Granted' : '⚠️ Current Status: Consent Not Granted'}
          </Text>
          <Text style={styles.statusCardDesc}>
            {consentStatus
              ? 'You have agreed to receive care plans and reminders via WhatsApp and push notifications.'
              : 'You have not authorized automated care plan dispatches. Tap below to grant consent.'}
          </Text>
        </View>
      </View>

      {/* Plain Language Document */}
      <View style={styles.docCard}>
        <Text style={styles.docHeading}>How Praxirence Protects & Uses Your Data</Text>
        <Text style={styles.plainText}>
          {doc?.plain_language_text ||
            'I understand and agree that Praxirence assists my doctor in generating my medical care plan, transcribing our consultation notes, and sending me scheduled medication reminders via WhatsApp and push notifications.'}
        </Text>

        <Text style={styles.bulletHeading}>Key Guarantees & Privacy Rights:</Text>

        {doc?.bullet_points?.map((point, index) => (
          <View key={index} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>🛡️</Text>
            <Text style={styles.bulletText}>{point}</Text>
          </View>
        ))}

        <View style={styles.securityNote}>
          <Text style={styles.securityNoteText}>
            🔒 Security Notice: Your phone number ({user.phone}) is encrypted at rest using AES-256. Voice recordings are wiped immediately from storage after transcription unless expressly retained for your legal medical history.
          </Text>
        </View>
      </View>

      {/* Clear Action Buttons */}
      <View style={styles.actionContainer}>
        {!consentStatus ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={() => handleUpdateConsent(true)}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.acceptBtnText}>✓ Accept & Grant Consent</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionBtn, styles.declineBtn]}
            onPress={() => handleUpdateConsent(false)}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fb7185" />
            ) : (
              <Text style={styles.declineBtnText}>✕ Revoke My Consent</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    color: Colors.text,
    letterSpacing: LetterSpacing.tight,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  statusCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusCardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    letterSpacing: LetterSpacing.tight,
  },
  statusCardDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  docCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    marginBottom: 24,
  },
  docHeading: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.text,
    marginBottom: 10,
    letterSpacing: LetterSpacing.tight,
  },
  plainText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 18,
  },
  bulletHeading: {
    fontFamily: FontFamily.extraBold,
    fontSize: FontSize.xs,
    color: Colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: LetterSpacing.wider,
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  bulletDot: {
    fontSize: FontSize.base,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 19,
  },
  securityNote: {
    backgroundColor: Colors.cardSubtle,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  securityNoteText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  actionContainer: {
    marginTop: 10,
  },
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
  },
  acceptBtnText: {
    color: '#ffffff',
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    letterSpacing: LetterSpacing.wide,
  },
  declineBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.25)',
  },
  declineBtnText: {
    color: Colors.rose,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    letterSpacing: LetterSpacing.wide,
  },
});

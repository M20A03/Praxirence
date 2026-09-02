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
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  statusCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  statusCardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusCardDesc: {
    fontSize: 12,
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
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 10,
  },
  plainText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 18,
  },
  bulletHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.cyan,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  bulletDot: {
    fontSize: 14,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  securityNote: {
    backgroundColor: Colors.cardSubtle,
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  securityNoteText: {
    fontSize: 11,
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
    fontSize: 16,
    fontWeight: '700',
  },
  declineBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  declineBtnText: {
    color: '#fb7185',
    fontSize: 15,
    fontWeight: '700',
  },
});

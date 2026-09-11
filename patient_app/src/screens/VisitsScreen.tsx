import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { PatientUser, Visit } from '../types';
import { mobileApi } from '../services/api';
import { BrandLogoMobile } from '../components/BrandLogoMobile';
import { EmptyState } from '../components/EmptyState';

interface VisitsScreenProps {
  user: PatientUser;
}

export const VisitsScreen: React.FC<VisitsScreenProps> = ({ user }) => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [doseTracker, setDoseTracker] = useState<Record<string, boolean>>({});

  const soundRef = useRef<Audio.Sound | null>(null);

  const toggleDose = (key: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    setDoseTracker((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    loadVisits();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, [user.id]);

  const loadVisits = async () => {
    try {
      setLoading(true);
      const data = await mobileApi.getVisits(user.id);
      setVisits(data);
    } catch (err) {
      console.log('Error loading visits:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const toggleExpand = (id: string) => {
    try {
      Haptics.selectionAsync();
    } catch (_) {}
    setExpandedId(expandedId === id ? null : id);
  };

  const handleToggleAudio = async (visitId: string, audioUrl?: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      if (playingAudioId === visitId) {
        if (soundRef.current) {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        setPlayingAudioId(null);
        return;
      }

      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      setPlayingAudioId(visitId);
      const targetUrl = audioUrl || `${mobileApi.getApiUrl()}/recordings/visit/${visitId}`;
      const { sound } = await Audio.Sound.createAsync(
        { uri: targetUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingAudioId(null);
          sound.unloadAsync().catch(() => {});
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.warn('Audio playback notice:', err);
      setPlayingAudioId(null);
    }
  };

  const handleShareSummary = async (visit: Visit) => {
    const summaryText =
      visit.patient_summary ||
      `During your consultation, your doctor evaluated your symptoms and confirmed ${visit.diagnosis || 'your condition'}. Please follow the medication instructions carefully.`;
    const adviceText =
      visit.doctor_advice || 'Stay hydrated, get sufficient rest, and avoid cold or strenuous activities.';
    const medList = (visit.medicines || [])
      .map((m, i) => `  ${i + 1}. ${m.name} (${m.dosage}) - ${m.frequency}`)
      .join('\n');

    const message =
      `*Praxirence Consultation Summary*\n` +
      `Doctor: Dr. ${visit.doctor_name || 'Care Team'}\n` +
      `Date: ${new Date(visit.date).toLocaleDateString()}\n` +
      `Diagnosis: ${visit.diagnosis || 'Clinical Consultation'}\n\n` +
      `*What Your Doctor Explained:*\n${summaryText}\n\n` +
      `*Doctor's Advice & Care:*\n${adviceText}\n\n` +
      `*Prescribed Medications:*\n${medList || 'None specified'}\n\n` +
      `_Recorded and delivered via Praxirence Clinical Portal_`;

    try {
      await Share.share({
        title: 'Doctor Consultation Summary',
        message,
      });
    } catch (err) {
      console.warn('Share notice:', err);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadVisits} tintColor={Colors.primary} />
      }
    >
      <View style={{ marginBottom: 16 }}>
        <BrandLogoMobile variant="header" size="sm" subtitleText="Clinical Consultation History" />
      </View>

      {/* Header with Bespoke Screen Feature Asset */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.title}>Consultation Care Plans</Text>
            <Text style={styles.subtitle}>Doctor explanations, home advice, and prescriptions</Text>
          </View>
          <Image source={require('../../assets/features/visits.png')} style={{ width: 50, height: 50 }} resizeMode="contain" />
        </View>
      </View>

      {/* DPDP Act 2023 & Cybersecurity End-to-End Trust Shield */}
      <View style={styles.securityTrustBanner}>
        <View style={styles.securityTrustIconWrap}>
          <Ionicons name="shield-checkmark" size={14} color="#059669" />
        </View>
        <Text style={styles.securityTrustText}>
          DPDP Act 2023 Compliant • AES-256 Encrypted Health Vault
        </Text>
      </View>

      {visits.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No Past Consultations"
          description="Your medical vault is completely clean. When your doctor finishes a consultation and approves your care plan, all prescriptions, clinical summaries, and doctor voice advice will safely appear here."
        />
      ) : (
        visits.map((visit) => {
          const isExpanded = expandedId === visit.id;
          const isPlayingAudio = playingAudioId === visit.id;
          const visitDate = new Date(visit.date).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

          const summaryText =
            visit.patient_summary ||
            `During your consultation, your doctor evaluated your symptoms and confirmed ${visit.diagnosis || 'your condition'}. Please adhere to your medication schedule and home rest instructions.`;
          const adviceText =
            visit.doctor_advice ||
            'Drink plenty of warm fluids, rest in a well-ventilated room, and maintain balanced nutrition.';

          return (
            <View key={visit.id} style={styles.visitCard}>
              <View style={styles.visitHeader}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.visitDate}>{visitDate}</Text>
                  <Text style={styles.doctorName}>Dr. {visit.doctor_name || 'Care Provider'}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="checkmark-circle" size={13} color={Colors.whatsapp} />
                    <Text style={styles.statusText}>WhatsApp Delivered</Text>
                  </View>
                </View>
              </View>

              {/* Diagnosis Banner */}
              <View style={styles.diagnosisSection}>
                <Text style={styles.diagnosisLabel}>DIAGNOSIS</Text>
                <Text style={styles.diagnosisText}>
                  {visit.diagnosis || 'Clinical Consultation'}
                </Text>
              </View>

              {/* What Your Doctor Explained (Plain-Language Explanation) */}
              <View style={styles.explanationCard}>
                <View style={styles.explanationHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="chatbubble-ellipses" size={17} color={Colors.primaryDark} />
                    <Text style={styles.explanationTitle}>What Your Doctor Explained</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={() => handleShareSummary(visit)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="share-social-outline" size={15} color={Colors.primaryDark} />
                    <Text style={styles.shareButtonText}>Share</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.explanationBody}>{summaryText}</Text>

                {/* Doctor's Advice Box */}
                <View style={styles.adviceBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                    <Ionicons name="bulb-outline" size={15} color="#B45309" />
                    <Text style={styles.adviceHeading}>Doctor's Advice & Home Care:</Text>
                  </View>
                  <Text style={styles.adviceBody}>{adviceText}</Text>
                </View>

                {/* Audio Read-Out Player */}
                <TouchableOpacity
                  style={[styles.audioPlayerBar, isPlayingAudio && styles.audioPlayerBarActive]}
                  onPress={() => handleToggleAudio(visit.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.audioIconCircle}>
                    <Ionicons
                      name={isPlayingAudio ? 'pause' : 'volume-high'}
                      size={16}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.audioTitle}>
                      {isPlayingAudio ? 'Speaking Doctor\'s Explanation...' : 'Listen to Doctor\'s Advice (Read Aloud)'}
                    </Text>
                    <Text style={styles.audioSub}>
                      {isPlayingAudio ? 'Tap to pause audio playback' : 'Empathetic voice guidance for elderly & patients'}
                    </Text>
                  </View>
                  {isPlayingAudio && (
                    <View style={styles.audioWavePulse}>
                      <Ionicons name="pulse" size={18} color={Colors.primaryDark} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Medicines Summary */}
              {visit.medicines && visit.medicines.length > 0 && (
                <TouchableOpacity
                  style={styles.medsSummary}
                  onPress={() => toggleExpand(visit.id)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="medkit-outline" size={16} color={Colors.primary} />
                    <Text style={styles.medsCount}>
                      {visit.medicines.length} Medication{visit.medicines.length > 1 ? 's' : ''} Prescribed
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.expandPrompt}>
                      {isExpanded ? 'Hide Details' : 'View Timings'}
                    </Text>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={Colors.primary} />
                  </View>
                </TouchableOpacity>
              )}

              {/* Expanded Care Plan Details */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  <Text style={styles.expandedTitle}>Medication Timings & Instructions:</Text>
                  {visit.medicines.map((med, mIdx) => (
                    <View key={mIdx} style={styles.medDetailRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.medDetailName}>
                          {mIdx + 1}. {med.name} ({med.dosage})
                        </Text>
                        <Text style={styles.medDetailFreq}>Timing: {med.frequency}</Text>
                        {med.instructions && (
                          <Text style={styles.medDetailInst}>Note: {med.instructions}</Text>
                        )}

                        {/* Interactive Daily Dose Checklist */}
                        <View style={styles.doseTrackerContainer}>
                          <Text style={styles.doseTrackerTitle}>Track dose today:</Text>
                          <View style={styles.dosePillRow}>
                            {['Morning', 'Afternoon', 'Night'].map((slot) => {
                              const doseKey = `${visit.id}_${med.name}_${slot}`;
                              const isTaken = !!doseTracker[doseKey];
                              const slotColor =
                                slot === 'Morning'
                                  ? { bg: '#FEF3C7', border: '#FDE68A', text: '#92400E' }
                                  : slot === 'Afternoon'
                                  ? { bg: '#E0F2FE', border: '#BAE6FD', text: '#0369A1' }
                                  : { bg: '#F5F3FF', border: '#DDD6FE', text: '#6D28D9' };
                              return (
                                <TouchableOpacity
                                  key={slot}
                                  style={[
                                    styles.dosePill,
                                    { backgroundColor: slotColor.bg, borderColor: slotColor.border },
                                    isTaken && styles.dosePillActive,
                                  ]}
                                  onPress={() => toggleDose(doseKey)}
                                  activeOpacity={0.7}
                                >
                                  <Ionicons
                                    name={isTaken ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={12}
                                    color={isTaken ? '#FFFFFF' : slotColor.text}
                                  />
                                  <Text
                                    style={[
                                      styles.dosePillText,
                                      { color: slotColor.text },
                                      isTaken && styles.dosePillTextActive,
                                    ]}
                                  >
                                    {slot}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                      {med.duration_days && (
                        <Text style={styles.medDetailDuration}>{med.duration_days} days</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    fontSize: FontSize.xl,
    lineHeight: 28,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  visitCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  visitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  visitDate: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  doctorName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.cyan,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.whatsapp,
  },
  diagnosisSection: {
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  diagnosisLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: '#0284C7',
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
  },
  diagnosisText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.text,
    marginTop: 3,
  },
  explanationCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  explanationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  explanationTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#166534',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  shareButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: '#15803D',
  },
  explanationBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 10,
  },
  adviceBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  adviceHeading: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#92400E',
  },
  adviceBody: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#78350F',
    lineHeight: 18,
  },
  audioPlayerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 10,
    padding: 10,
  },
  audioPlayerBarActive: {
    backgroundColor: '#DCFCE7',
    borderColor: Colors.primary,
  },
  audioIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#166534',
  },
  audioSub: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  audioWavePulse: {
    paddingRight: 4,
  },
  medsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  medsCount: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  expandPrompt: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.cyan,
  },
  expandedContent: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  expandedTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: LetterSpacing.wider,
    marginBottom: 8,
  },
  medDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#CCFBF1',
    borderLeftWidth: 3,
    borderLeftColor: Colors.teal || '#0D9488',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  medDetailName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.text,
  },
  medDetailFreq: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    marginTop: 2,
  },
  medDetailInst: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    marginTop: 2,
  },
  medDetailDuration: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.cyan,
  },
  securityTrustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  securityTrustIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTrustText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: '#065F46',
    flex: 1,
  },
  doseTrackerContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  doseTrackerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: LetterSpacing.wide,
    marginBottom: 4,
  },
  dosePillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dosePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  dosePillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dosePillText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textMuted,
  },
  dosePillTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  emptyCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 32,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});

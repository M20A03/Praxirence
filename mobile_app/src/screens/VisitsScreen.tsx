import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { PatientUser, Visit } from '../types';
import { mobileApi } from '../services/api';

interface VisitsScreenProps {
  user: PatientUser;
}

export const VisitsScreen: React.FC<VisitsScreenProps> = ({ user }) => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadVisits();

    const unsubscribe = mobileApi.startRealtimeSync(user.id, (freshVisits, isLive) => {
      if (isLive && freshVisits.length > 0) {
        setVisits(freshVisits);
      }
    }, 8000);

    return () => unsubscribe();
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
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadVisits();
          }}
          tintColor={Colors.primary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Consultation History</Text>
        <Text style={styles.subtitle}>All your clinical care plans and prescriptions</Text>
      </View>

      {visits.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No Past Consultations</Text>
          <Text style={styles.emptySubtitle}>
            When your doctor completes a consultation and approves your care plan, it will be safely recorded here.
          </Text>
        </View>
      ) : (
        visits.map((visit) => {
          const isExpanded = expandedId === visit.id;
          const visitDate = new Date(visit.date).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

          return (
            <TouchableOpacity
              key={visit.id}
              style={styles.visitCard}
              onPress={() => toggleExpand(visit.id)}
              activeOpacity={0.8}
            >
              <View style={styles.visitHeader}>
                <View>
                  <Text style={styles.visitDate}>{visitDate}</Text>
                  <Text style={styles.doctorName}>Dr. {visit.doctor_name || 'Care Provider'}</Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusText}>✓ WhatsApp Delivered</Text>
                </View>
              </View>

              <View style={styles.diagnosisSection}>
                <Text style={styles.diagnosisLabel}>DIAGNOSIS</Text>
                <Text style={styles.diagnosisText}>
                  {visit.diagnosis || 'Clinical Consultation'}
                </Text>
              </View>

              {/* Medicines Summary */}
              {visit.medicines && visit.medicines.length > 0 && (
                <View style={styles.medsSummary}>
                  <Text style={styles.medsCount}>
                    💊 {visit.medicines.length} Medication{visit.medicines.length > 1 ? 's' : ''} Prescribed
                  </Text>
                  <Text style={styles.expandPrompt}>
                    {isExpanded ? 'Hide Details ▲' : 'View Care Plan ▼'}
                  </Text>
                </View>
              )}

              {/* Expanded Care Plan Details */}
              {isExpanded && (
                <View style={styles.expandedContent}>
                  <Text style={styles.expandedTitle}>Prescription Details:</Text>
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
                      </View>
                      {med.duration_days && (
                        <Text style={styles.medDetailDuration}>{med.duration_days} days</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
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
    marginBottom: 14,
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
    color: '#25D366',
    fontSize: FontSize.caption,
    letterSpacing: LetterSpacing.wide,
  },
  diagnosisSection: {
    marginBottom: 12,
  },
  diagnosisLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.textMuted,
    letterSpacing: LetterSpacing.wider,
    textTransform: 'uppercase',
  },
  diagnosisText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.text,
    marginTop: 3,
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
    backgroundColor: Colors.cardSubtle,
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
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

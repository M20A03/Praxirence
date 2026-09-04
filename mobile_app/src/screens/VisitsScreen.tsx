import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../theme/colors';
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
  }, []);

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
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 13,
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
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  doctorName: {
    fontSize: 13,
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
    color: '#25D366',
    fontSize: 11,
    fontWeight: '700',
  },
  diagnosisSection: {
    marginBottom: 12,
  },
  diagnosisLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  diagnosisText: {
    fontSize: 15,
    fontWeight: '600',
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
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  expandPrompt: {
    fontSize: 12,
    color: Colors.cyan,
    fontWeight: '600',
  },
  expandedContent: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  expandedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  medDetailFreq: {
    fontSize: 12,
    color: Colors.primaryLight,
    marginTop: 2,
  },
  medDetailInst: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  medDetailDuration: {
    fontSize: 12,
    color: Colors.cyan,
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});

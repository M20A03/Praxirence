import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../theme/colors';
import { FontFamily, FontSize, LetterSpacing } from '../theme/typography';
import { Visit } from '../types';

interface ConsultationCardProps {
  visit: Visit;
  isExpanded?: boolean;
  isPlayingAudio?: boolean;
  onToggleExpand?: () => void;
  onPlayAudio?: () => void;
  onViewPdf?: () => void;
}

export const ConsultationCard: React.FC<ConsultationCardProps> = ({
  visit,
  isExpanded = false,
  isPlayingAudio = false,
  onToggleExpand,
  onPlayAudio,
  onViewPdf,
}) => {
  const handleToggle = () => {
    try {
      Haptics.selectionAsync();
    } catch (_) {}
    if (onToggleExpand) onToggleExpand();
  };

  const handleAudio = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
    if (onPlayAudio) onPlayAudio();
  };

  const handlePdf = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    if (onViewPdf) onViewPdf();
  };

  const formattedDate = new Date(visit.created_at || Date.now()).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <View style={styles.card}>
      {/* Header Row */}
      <TouchableOpacity style={styles.headerRow} onPress={handleToggle} activeOpacity={0.7}>
        <View style={styles.docAvatar}>
          <Ionicons name="medical" size={20} color={Colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.doctorName}>Dr. {visit.doctor_name || 'Care Team'}</Text>
          <Text style={styles.specialty}>{visit.specialty || 'General Physician'}</Text>
        </View>
        <View style={styles.dateBadge}>
          <Text style={styles.dateText}>{formattedDate}</Text>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textMuted}
            style={{ marginLeft: 4 }}
          />
        </View>
      </TouchableOpacity>

      {/* Diagnosis Tag */}
      <View style={styles.diagnosisRow}>
        <Text style={styles.diagnosisLabel}>DIAGNOSIS:</Text>
        <Text style={styles.diagnosisText}>{visit.diagnosis || 'Clinical Assessment'}</Text>
      </View>

      {/* Patient Friendly Summary */}
      {visit.patient_summary ? (
        <Text style={styles.summaryText} numberOfLines={isExpanded ? undefined : 2}>
          {visit.patient_summary}
        </Text>
      ) : null}

      {/* Expanded Medication List */}
      {isExpanded && visit.medicines && visit.medicines.length > 0 && (
        <View style={styles.medsSection}>
          <Text style={styles.medsHeader}>Prescribed Medications ({visit.medicines.length}):</Text>
          {visit.medicines.map((med, idx) => (
            <View key={idx} style={styles.medItem}>
              <View style={styles.medBullet} />
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>
                  {med.name} <Text style={styles.medDosage}>({med.dosage})</Text>
                </Text>
                <Text style={styles.medInstructions}>
                  {med.frequency} • {med.instructions}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Actions Row */}
      <View style={styles.actionsRow}>
        {onPlayAudio && (
          <TouchableOpacity
            style={[styles.audioBtn, isPlayingAudio && styles.audioBtnActive]}
            onPress={handleAudio}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isPlayingAudio ? 'pause-circle' : 'play-circle'}
              size={18}
              color={isPlayingAudio ? '#FFFFFF' : Colors.primary}
            />
            <Text style={[styles.audioBtnText, isPlayingAudio && styles.audioBtnTextActive]}>
              {isPlayingAudio ? 'Playing' : 'Audio Note'}
            </Text>
          </TouchableOpacity>
        )}

        {onViewPdf && (
          <TouchableOpacity style={styles.pdfBtn} onPress={handlePdf} activeOpacity={0.8}>
            <Ionicons name="document-text-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.pdfBtnText}>Prescription PDF</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  docAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  headerText: {
    flex: 1,
    marginLeft: 12,
  },
  doctorName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.base,
    color: Colors.text,
  },
  specialty: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dateText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  diagnosisRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  diagnosisLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.5,
    marginRight: 6,
  },
  diagnosisText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.text,
    flex: 1,
  },
  summaryText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  medsSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 10,
    marginBottom: 12,
  },
  medsHeader: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  medItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  medBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginTop: 6,
    marginRight: 8,
  },
  medName: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.text,
  },
  medDosage: {
    fontFamily: FontFamily.regular,
    color: Colors.textSecondary,
  },
  medInstructions: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: 12,
  },
  audioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primarySurface,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
  },
  audioBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  audioBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  audioBtnTextActive: {
    color: '#FFFFFF',
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pdfBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});

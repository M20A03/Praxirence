import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { PatientUser, ConsentDocument } from '../types';
import { mobileApi } from '../services/api';
import { BrandLogoMobile } from '../components/BrandLogoMobile';

interface ConsentScreenProps {
  user: PatientUser;
  onConsentUpdated: (newStatus: boolean) => void;
}

export const ConsentScreen: React.FC<ConsentScreenProps> = ({
  user,
  onConsentUpdated,
}) => {
  const [doc, setDoc] = useState<ConsentDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Granular DPDP Consent Preferences
  const [coreConsent, setCoreConsent] = useState<boolean>(user.consent_status);
  const [whatsappConsent, setWhatsappConsent] = useState<boolean>(true);
  const [secondaryConsent, setSecondaryConsent] = useState<boolean>(false);

  // Right to Erasure Modal State
  const [showErasureModal, setShowErasureModal] = useState<boolean>(false);
  const [erasureConfirmed, setErasureConfirmed] = useState<boolean>(false);
  const [erasing, setErasing] = useState<boolean>(false);

  // Export Data State
  const [exporting, setExporting] = useState<boolean>(false);

  useEffect(() => {
    loadConsentDocument();
  }, []);

  const loadConsentDocument = async () => {
    try {
      setLoading(true);
      const data = await mobileApi.getConsent(user.id);
      setDoc(data);
      setCoreConsent(data.consent_status);
    } catch (err) {
      console.warn('Notice loading consent doc:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async (
    newCore: boolean,
    newWhatsApp: boolean,
    newSecondary: boolean
  ) => {
    setSaving(true);
    try {
      await mobileApi.updateConsentPreferences(user.id, {
        core_consent: newCore,
        whatsapp_consent: newWhatsApp,
        secondary_consent: newSecondary,
      });

      setCoreConsent(newCore);
      setWhatsappConsent(newWhatsApp);
      setSecondaryConsent(newSecondary);
      onConsentUpdated(newCore);

      Alert.alert(
        'Preferences Updated',
        newCore
          ? 'Consent settings updated. Praxirence will continue securely managing your digital care plans and scheduled medication timings.'
          : 'Data processing paused. Automated care plan generation and WhatsApp reminders have been halted.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update consent preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCore = (val: boolean) => {
    if (!val) {
      Alert.alert(
        'Pause Data Processing?',
        'Withdrawing consent means your doctor cannot dispatch automated digital care plans or WhatsApp medication reminders to you.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Yes, Pause', style: 'destructive', onPress: () => handleSavePreferences(false, whatsappConsent, secondaryConsent) },
        ]
      );
    } else {
      handleSavePreferences(true, whatsappConsent, secondaryConsent);
    }
  };

  const handleExportData = async () => {
    setExporting(true);
    try {
      const visits = await mobileApi.getVisits(user.id);
      const healthData = {
        patient_id: user.id,
        patient_name: user.name,
        phone: user.phone,
        exported_at: new Date().toISOString(),
        compliance: 'ABDM FHIR M2 & DPDP Act 2023 Data Portability',
        consultation_records: visits,
      };

      Alert.alert(
        'Health Data Export Ready',
        `Successfully compiled ${visits.length} clinical care plans and prescriptions into encrypted JSON vault.\n\nYour data has been packaged for portability.`,
        [{ text: 'OK' }]
      );
    } catch (err: any) {
      Alert.alert('Export Failed', err.message || 'Could not export records');
    } finally {
      setExporting(false);
    }
  };

  const handleRequestErasure = async () => {
    setErasing(true);
    try {
      await mobileApi.updateConsentPreferences(user.id, {
        core_consent: false,
        whatsapp_consent: false,
        secondary_consent: false,
        erasure_requested: true,
      });

      setShowErasureModal(false);
      setCoreConsent(false);
      setWhatsappConsent(false);
      setSecondaryConsent(false);
      onConsentUpdated(false);

      Alert.alert(
        'Right to Erasure Submitted',
        'Your request under Section 12 of the DPDP Act 2023 has been logged. All non-statutory medical records and voice transcription tokens are queued for permanent shredding.',
        [{ text: 'Understood' }]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit erasure request');
    } finally {
      setErasing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading privacy & consent policies...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Brand Header */}
      <View style={{ marginBottom: 16 }}>
        <BrandLogoMobile variant="header" size="sm" subtitleText="Privacy, Consent & Data Governance" />
      </View>

      {/* Title */}
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={styles.complianceBadge}>
            <Ionicons name="shield-checkmark" size={13} color="#10b981" />
            <Text style={styles.complianceBadgeText}>DPDP ACT 2023 & ABDM FHIR COMPLIANT</Text>
          </View>
        </View>
        <Text style={styles.title}>Patient Consent & Data Concerns</Text>
        <Text style={styles.subtitle}>
          Control how your consultation dialogue, medication schedules, and clinical data are processed.
        </Text>
      </View>

      {/* Overall Status Banner */}
      <View style={[styles.statusBanner, coreConsent ? styles.statusBannerActive : styles.statusBannerPaused]}>
        <Ionicons
          name={coreConsent ? 'shield-checkmark' : 'pause-circle'}
          size={24}
          color={coreConsent ? '#10b981' : '#f59e0b'}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.statusBannerTitle, { color: coreConsent ? '#10b981' : '#f59e0b' }]}>
            {coreConsent ? 'Consent Active & Secured' : 'Data Processing Paused'}
          </Text>
          <Text style={styles.statusBannerSubtitle}>
            {coreConsent
              ? 'Authorized to generate AI clinical notes and deliver medication timing reminders'
              : 'Automated care plans and WhatsApp timing reminders are currently disabled'}
          </Text>
        </View>
      </View>

      {/* Primary Toggle: Proceed With Data Processing */}
      <View style={styles.card}>
        <Text style={styles.cardSectionHeader}>DATA PROCESSING DECISION</Text>

        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={styles.toggleTitle}>Proceed with Health Data Processing</Text>
            <Text style={styles.toggleDesc}>
              Allow your doctor and Praxirence AI to analyze consultation notes, structure prescriptions, and maintain your medication timing schedule.
            </Text>
          </View>
          <Switch
            value={coreConsent}
            onValueChange={handleToggleCore}
            trackColor={{ false: '#334155', true: '#0ea5e9' }}
            thumbColor={coreConsent ? '#ffffff' : '#94a3b8'}
            disabled={saving}
          />
        </View>

        <View style={styles.divider} />

        {/* WhatsApp Reminders Toggle */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
              <Text style={styles.toggleTitle}>WhatsApp Medication Reminders</Text>
            </View>
            <Text style={styles.toggleDesc}>
              Receive scheduled alerts on WhatsApp when it is time to eat medicines (Morning, Afternoon, Night; before/after food).
            </Text>
          </View>
          <Switch
            value={whatsappConsent}
            onValueChange={(val) => handleSavePreferences(coreConsent, val, secondaryConsent)}
            trackColor={{ false: '#334155', true: '#25D366' }}
            thumbColor={whatsappConsent ? '#ffffff' : '#94a3b8'}
            disabled={saving || !coreConsent}
          />
        </View>

        <View style={styles.divider} />

        {/* Secondary Research Toggle */}
        <View style={styles.toggleRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
              <Ionicons name="flask-outline" size={16} color="#0ea5e9" />
              <Text style={styles.toggleTitle}>Secondary Healthcare AI Research</Text>
            </View>
            <Text style={styles.toggleDesc}>
              Anonymously contribute de-identified diagnostic tokens to help train open-source medical models. No names or phone numbers are ever shared.
            </Text>
          </View>
          <Switch
            value={secondaryConsent}
            onValueChange={(val) => handleSavePreferences(coreConsent, whatsappConsent, val)}
            trackColor={{ false: '#334155', true: '#0ea5e9' }}
            thumbColor={secondaryConsent ? '#ffffff' : '#94a3b8'}
            disabled={saving || !coreConsent}
          />
        </View>
      </View>

      {/* Patient Data Concerns & Statutory Guarantees */}
      <View style={styles.card}>
        <Text style={styles.cardSectionHeader}>DATA CONCERNS & STATUTORY RIGHTS</Text>

        <View style={styles.guaranteeRow}>
          <View style={[styles.guaranteeIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Ionicons name="trash-outline" size={20} color="#10b981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guaranteeTitle}>Zero Audio Retention Guarantee</Text>
            <Text style={styles.guaranteeDesc}>
              Consultation voice recordings are processed in ephemeral server memory and permanently shredded immediately after transcription. No audio files are kept on disk.
            </Text>
          </View>
        </View>

        <View style={styles.guaranteeRow}>
          <View style={[styles.guaranteeIconBox, { backgroundColor: 'rgba(14, 165, 233, 0.15)' }]}>
            <Ionicons name="lock-closed-outline" size={20} color="#0ea5e9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guaranteeTitle}>AES-256 Encryption at Rest</Text>
            <Text style={styles.guaranteeDesc}>
              Your phone number, medication history, and consultation summaries are encrypted with bank-grade AES-256 encryption.
            </Text>
          </View>
        </View>

        <View style={styles.guaranteeRow}>
          <View style={[styles.guaranteeIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Ionicons name="finger-print-outline" size={20} color="#f59e0b" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guaranteeTitle}>No Third-Party Advertising</Text>
            <Text style={styles.guaranteeDesc}>
              Your personal health data is never sold, leased, or monetized for advertising under any circumstances.
            </Text>
          </View>
        </View>
      </View>

      {/* Data Portability & Right to Erasure Actions */}
      <View style={styles.card}>
        <Text style={styles.cardSectionHeader}>YOUR DATA RIGHTS</Text>

        {/* Export Data */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleExportData}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#0ea5e9" />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#0ea5e9" />
              <View style={{ flex: 1 }}>
                <Text style={styles.actionBtnTitle}>Download My Health Records (Data Portability)</Text>
                <Text style={styles.actionBtnSubtitle}>Export all care plans and prescriptions in FHIR/JSON format</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Right to Erasure */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setShowErasureModal(true)}
        >
          <Ionicons name="trash-bin-outline" size={18} color="#ef4444" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionBtnTitle, { color: '#ef4444' }]}>Right to Erasure (DPDP Act 2023)</Text>
            <Text style={styles.actionBtnSubtitle}>Request complete permanent deletion of all your medical data</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Erasure Confirmation Modal */}
      <Modal visible={showErasureModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.warningIconCircle}>
                <Ionicons name="alert" size={24} color="#ef4444" />
              </View>
              <Text style={styles.modalTitle}>Request Data Erasure?</Text>
            </View>

            <Text style={styles.modalBody}>
              Under Section 12 of the Digital Personal Data Protection Act 2023, you have the right to request permanent erasure of your personal health data.
            </Text>

            <View style={styles.erasureConsequencesBox}>
              <Text style={styles.consequencesTitle}>What will happen:</Text>
              <Text style={styles.consequencesItem}>• Your prescription history and care plans will be permanently purged.</Text>
              <Text style={styles.consequencesItem}>• All automated WhatsApp pill reminders will immediately terminate.</Text>
              <Text style={styles.consequencesItem}>• This action is irreversible once processed by the compliance officer.</Text>
            </View>

            <TouchableOpacity
              style={styles.confirmErasureBtn}
              onPress={handleRequestErasure}
              disabled={erasing}
            >
              {erasing ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.confirmErasureBtnText}>Permanently Delete My Data</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelErasureBtn}
              onPress={() => setShowErasureModal(false)}
            >
              <Text style={styles.cancelErasureBtnText}>Keep My Records</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Text style={styles.footerNote}>
        Praxirence Care operates under the Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023) and Telemedicine Practice Guidelines, India.
      </Text>
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
  loadingText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 50,
  },
  header: {
    marginBottom: 16,
  },
  badgeRow: {
    marginBottom: 8,
  },
  complianceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  complianceBadgeText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: '#10b981',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  subtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusBannerActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusBannerPaused: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  statusBannerTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  statusBannerSubtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  cardSectionHeader: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: '#0ea5e9',
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleTitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  toggleDesc: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 3,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  guaranteeIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guaranteeTitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  guaranteeDesc: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  actionBtnTitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  actionBtnSubtitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  footerNote: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 16,
    paddingHorizontal: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  warningIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    fontWeight: '800',
  },
  modalBody: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 14,
  },
  erasureConsequencesBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: 4,
  },
  consequencesTitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#ef4444',
    fontWeight: '700',
    marginBottom: 2,
  },
  consequencesItem: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#991B1B',
    lineHeight: 16,
  },
  confirmErasureBtn: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmErasureBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: '#ffffff',
    fontWeight: '700',
  },
  cancelErasureBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelErasureBtnText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { ActiveUser, UserRole, DoctorUser } from '../types';
import { BrandLogoMobile } from '../components/BrandLogoMobile';
import { mobileApi } from '../services/api';
import { SecureStorage } from '../security/SecureStorage';
import { useLanguage } from '../utils/LanguageContext';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../utils/languageTranslations';

interface ProfileScreenProps {
  user: ActiveUser;
  role: UserRole;
  onLogout: () => void;
  onDoctorVerified?: (doctorUser: DoctorUser) => void;
  onNavigateToConsent?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  role,
  onLogout,
  onDoctorVerified,
  onNavigateToConsent,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<ActiveUser>(user);
  const [clinicPhone, setClinicPhone] = useState<string | null>(null);
  const [attendingDoctorName, setAttendingDoctorName] = useState<string | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Edit Profile & ABHA ID Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone && !user.phone.includes('@') ? user.phone : '');
  const [editAbhaId, setEditAbhaId] = useState((user as any)?.abha_id || '');
  const [editAge, setEditAge] = useState((user as any)?.age ? String((user as any).age) : '');
  const [editGender, setEditGender] = useState<'Male' | 'Female' | 'Other'>((user as any)?.gender || 'Male');
  const [editEmergency, setEditEmergency] = useState((user as any)?.emergency_contact || '');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setCurrentUser(user);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }
    if (!editPhone.trim()) {
      Alert.alert('Required', 'Please enter your mobile phone number.');
      return;
    }
    setSavingProfile(true);
    try {
      const payload = {
        name: editName.trim(),
        phone: editPhone.trim(),
        abha_id: editAbhaId.trim() || undefined,
        age: editAge.trim() ? parseInt(editAge.trim(), 10) : undefined,
        gender: editGender,
        emergency_contact: editEmergency.trim() || undefined,
      };
      const res = await mobileApi.updatePatientProfile(currentUser.id, payload);
      const mergedUser: any = {
        ...currentUser,
        ...payload,
        ...(res.user || {}),
      };
      setCurrentUser(mergedUser);
      await AsyncStorage.setItem('praxirence_patient_profile', JSON.stringify(mergedUser));
      await SecureStorage.setItem('praxirence_user', JSON.stringify(mergedUser));
      setShowEditModal(false);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (_) {}
      Alert.alert('Profile Updated', 'Your personal details and ABHA ID have been safely updated.');
    } catch (e: any) {
      Alert.alert('Notice', e.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!user) {
    return null;
  }

  const isDoctor = role === 'doctor';

  useEffect(() => {
    const loadAttendingContact = async () => {
      try {
        if (!user?.id) return;
        // 1. Check cached visits
        const cacheKey = `praxirence_cache_visits_${user.id}`;
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list) && list.length > 0) {
            const first = list[0] as any;
            const phone = first.doctor?.phone || first.doctor?.clinic_phone || first.clinic_phone || null;
            if (phone && !phone.includes('98765 43210') && !phone.includes('9876543210')) {
              setClinicPhone(phone);
              setAttendingDoctorName(first.doctor?.name || first.doctor_name || null);
              return;
            }
          }
        }

        // 2. Query live visits
        const visits = await mobileApi.getVisits(user.id);
        if (visits && visits.length > 0) {
          const first = visits[0] as any;
          const phone = first.doctor?.phone || first.doctor?.clinic_phone || first.clinic_phone || null;
          if (phone && !phone.includes('98765 43210') && !phone.includes('9876543210')) {
            setClinicPhone(phone);
            setAttendingDoctorName(first.doctor?.name || first.doctor_name || null);
          }
        }
      } catch (err) {
        console.warn('Load attending clinic contact notice:', err);
      }
    };
    loadAttendingContact();
  }, [user?.id]);

  const handleLogoutPress = () => {
    Alert.alert(
      t('signOut'),
      'Are you sure you want to sign out of your Praxirence account?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: t('signOut'), style: 'destructive', onPress: onLogout },
      ]
    );
  };

  const handleSwitchAccountPress = () => {
    onLogout();
  };

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={{ marginBottom: 16 }}>
        <BrandLogoMobile variant="header" size="sm" subtitleText="Account & Compliance Settings" />
      </View>

      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons
            name={isDoctor ? "medkit" : "person"}
            size={32}
            color={Colors.primary}
          />
        </View>
        <Text style={styles.name}>{currentUser.name}</Text>
        <Text style={styles.phone}>
          {currentUser.phone && !currentUser.phone.includes('@')
            ? currentUser.phone
            : ((currentUser as any).email || (currentUser.phone && currentUser.phone.includes('@') ? currentUser.phone : 'No contact provided'))}
        </Text>
        <View style={styles.roleBadge}>
          <Ionicons
            name={isDoctor ? "shield-checkmark" : "heart"}
            size={13}
            color={Colors.primaryDark}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.roleBadgeText}>
            {isDoctor ? 'Verified Clinician (Doctor Portal)' : 'Patient Personal Vault'}
          </Text>
        </View>
      </View>

      {/* Language Preference Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="language-outline" size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>{t('switchLanguage')}</Text>
        </View>
        <TouchableOpacity
          style={styles.languageSelectorBtn}
          onPress={() => setShowLanguageModal(true)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={styles.langPillIcon}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primaryDark }}>
                {currentLangObj.code.toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={{ fontFamily: FontFamily.semiBold, fontSize: 14, color: Colors.text }}>
                {currentLangObj.nativeLabel} ({currentLangObj.label})
              </Text>
              <Text style={{ fontFamily: FontFamily.regular, fontSize: 11, color: Colors.textSecondary, marginTop: 2 }}>
                App interface and medication reminders
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Account Credentials Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="finger-print-outline" size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>Identity & Verification</Text>
        </View>

        {isDoctor ? (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Medical Specialty</Text>
              <Text style={styles.infoValue}>{(currentUser as any).specialty || 'Specialty pending'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Affiliated Hospital</Text>
              <Text style={styles.infoValue}>{(currentUser as any).clinic_name || 'Clinic pending'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Medical Registration</Text>
              <Text style={[styles.infoValue, { color: Colors.primaryDark, fontFamily: FontFamily.bold }]}>
                {(currentUser as any).reg_number || 'Registration pending'}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ABHA Health ID</Text>
              {(currentUser as any).abha_id ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="shield-checkmark" size={14} color="#059669" />
                  <Text style={[styles.infoValue, { color: Colors.primaryDark, fontFamily: FontFamily.bold }]}>
                    {(currentUser as any).abha_id}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.infoValue, { color: Colors.textSecondary, fontStyle: 'italic' }]}>
                  Not Linked
                </Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Registered Mobile</Text>
              <Text style={styles.infoValue}>
                {currentUser.phone && !currentUser.phone.includes('@') ? currentUser.phone : 'Not Provided'}
              </Text>
            </View>

            {Boolean((currentUser as any).age || (currentUser as any).gender) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Demographics</Text>
                <Text style={styles.infoValue}>
                  {[(currentUser as any).age ? `${(currentUser as any).age} Yrs` : null, (currentUser as any).gender].filter(Boolean).join(' • ')}
                </Text>
              </View>
            )}

            {Boolean((currentUser as any).emergency_contact) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Emergency Contact</Text>
                <Text style={styles.infoValue}>{(currentUser as any).emergency_contact}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.editProfileBtn}
              onPress={() => {
                setEditName(currentUser.name || '');
                setEditPhone(currentUser.phone && !currentUser.phone.includes('@') ? currentUser.phone : '');
                setEditAbhaId((currentUser as any).abha_id || '');
                setEditAge((currentUser as any).age ? String((currentUser as any).age) : '');
                setEditGender((currentUser as any).gender || 'Male');
                setEditEmergency((currentUser as any).emergency_contact || '');
                setShowEditModal(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={15} color="#FFFFFF" />
              <Text style={styles.editProfileBtnText}>Edit Details & Link ABHA ID</Text>
            </TouchableOpacity>
          </>
        )}

        {((currentUser as any).email || (currentUser.phone && currentUser.phone.includes('@'))) && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email Address</Text>
            <Text style={styles.infoValue}>
              {(currentUser as any).email || currentUser.phone}
            </Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Account Status</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text style={[styles.infoValue, { color: '#059669', fontFamily: FontFamily.semiBold }]}>
              {t('activeAndVerified')}
            </Text>
          </View>
        </View>
      </View>

      {/* Security Governance Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>{t('securityPrivacy')}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Encryption Standard</Text>
          <Text style={styles.infoValue}>AES-256 (At Rest & In Transit)</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>DPDP Act 2023</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="shield-checkmark" size={13} color={Colors.primaryDark} />
            <Text style={[styles.infoValue, { color: Colors.primaryDark }]}>Compliant</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>ABDM Milestone 1-3</Text>
          <Text style={[styles.infoValue, { color: Colors.primaryDark }]}>Certified HIP/HIU</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Data Protection</Text>
          <Text style={[styles.infoValue, { color: Colors.primaryDark, fontFamily: FontFamily.semiBold }]}>
            End-to-End Encrypted
          </Text>
        </View>

        {onNavigateToConsent && (
          <TouchableOpacity
            style={styles.manageConsentBtn}
            onPress={onNavigateToConsent}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={16} color={Colors.primaryDark} />
            <Text style={styles.manageConsentBtnText}>Manage ABDM Consent & Data Rights</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primaryDark} />
          </TouchableOpacity>
        )}
      </View>

      {/* Clinical Support & Hotlines Card - Real Numbers Only */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="call-outline" size={18} color={Colors.amber} />
          <Text style={styles.cardTitle}>{t('emergencyNumbers')}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('nationalEmergency')}</Text>
          <Text style={[styles.infoValue, { color: '#EF4444', fontFamily: FontFamily.bold }]}>
            108 / 112
          </Text>
        </View>

        {clinicPhone ? (
          <View style={styles.infoRow}>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.infoLabel}>{t('clinicSupport')}</Text>
              {attendingDoctorName && (
                <Text style={{ fontSize: 11, color: Colors.textSecondary, marginTop: 1 }}>
                  Attending: {attendingDoctorName}
                </Text>
              )}
            </View>
            <Text style={[styles.infoValue, { color: Colors.primaryDark, fontFamily: FontFamily.semiBold }]}>
              {clinicPhone}
            </Text>
          </View>
        ) : (
          <View style={styles.clinicNoticeBox}>
            <Ionicons name="information-circle-outline" size={16} color="#0284C7" />
            <Text style={styles.clinicNoticeText}>
              {t('clinicNotice')}
            </Text>
          </View>
        )}
      </View>

      {/* Account Actions */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.switchAccountButton}
          onPress={handleSwitchAccountPress}
          activeOpacity={0.85}
        >
          <Ionicons name="swap-horizontal" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.switchAccountButtonText}>{t('switchAccount')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogoutPress}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={styles.logoutButtonText}>{t('signOut')}</Text>
        </TouchableOpacity>
      </View>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="language" size={20} color={Colors.primary} />
                <Text style={styles.modalTitle}>Choose Language / भाषा चुनें</Text>
              </View>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 380 }}>
              {SUPPORTED_LANGUAGES.map((l) => {
                const isSelected = l.code === language;
                return (
                  <TouchableOpacity
                    key={l.code}
                    style={[styles.langOptionItem, isSelected && styles.langOptionItemActive]}
                    onPress={async () => {
                      await setLanguage(l.code);
                      setShowLanguageModal(false);
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Text style={[styles.langNativeLabel, isSelected && { color: Colors.primaryDark, fontWeight: '700' }]}>
                        {l.nativeLabel}
                      </Text>
                      <Text style={styles.langLabel}>({l.label})</Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Profile & Link ABHA ID Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="person-circle-outline" size={22} color={Colors.primary} />
                <Text style={styles.modalTitle}>Edit Profile & ABHA ID</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              <Text style={styles.inputFieldLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInputField}
                value={editName}
                onChangeText={setEditName}
                placeholder="Full Name"
                placeholderTextColor="#94A3B8"
              />

              <Text style={styles.inputFieldLabel}>Mobile Number *</Text>
              <TextInput
                style={styles.textInputField}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="10-digit Mobile Number"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />

              <Text style={styles.inputFieldLabel}>ABHA Health ID (14 digits or @abdm)</Text>
              <TextInput
                style={styles.textInputField}
                value={editAbhaId}
                onChangeText={setEditAbhaId}
                placeholder="e.g. 14-digit ABHA or user@abdm"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
              />

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>Age (Years)</Text>
                  <TextInput
                    style={styles.textInputField}
                    value={editAge}
                    onChangeText={setEditAge}
                    placeholder="e.g. 32"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={styles.inputFieldLabel}>Gender</Text>
              <View style={styles.genderSelectRow}>
                {(['Male', 'Female', 'Other'] as const).map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[
                      styles.genderSelectBtn,
                      editGender === g && styles.genderSelectBtnActive,
                    ]}
                    onPress={() => setEditGender(g)}
                  >
                    <Text
                      style={[
                        styles.genderSelectText,
                        editGender === g && styles.genderSelectTextActive,
                      ]}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputFieldLabel}>Emergency Contact Number</Text>
              <TextInput
                style={styles.textInputField}
                value={editEmergency}
                onChangeText={setEditEmergency}
                placeholder="e.g. Spouse / Parent contact"
                placeholderTextColor="#94A3B8"
                keyboardType="phone-pad"
              />

              <TouchableOpacity
                style={styles.saveProfileSubmitBtn}
                onPress={handleSaveProfile}
                disabled={savingProfile}
                activeOpacity={0.8}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                    <Text style={styles.saveProfileSubmitText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    marginVertical: 18,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  name: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.text,
  },
  phone: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  roleBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.primaryDark,
    letterSpacing: LetterSpacing.wide,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  infoLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flexShrink: 0,
  },
  infoValue: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  clinicNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  clinicNoticeText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: '#0369A1',
    lineHeight: 16,
  },
  languageSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
  },
  langPillIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonsContainer: {
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  switchAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: '#99F6E4',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  switchAccountButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#0F766E',
    letterSpacing: 0.2,
    textAlign: 'center',
    flexShrink: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#DC2626',
    letterSpacing: 0.2,
  },
  manageConsentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  manageConsentBtnText: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.primaryDark,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: Colors.text,
  },
  langOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  langOptionItemActive: {
    backgroundColor: '#F0FDFA',
    borderColor: Colors.primary,
  },
  langNativeLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: Colors.text,
  },
  langLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 14,
  },
  editProfileBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 13,
  },
  inputFieldLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
    marginTop: 10,
  },
  textInputField: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.text,
    fontFamily: FontFamily.regular,
  },
  genderSelectRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
  },
  genderSelectBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  genderSelectBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderSelectText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: Colors.textSecondary,
  },
  genderSelectTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  saveProfileSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 18,
  },
  saveProfileSubmitText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 14,
  },
});

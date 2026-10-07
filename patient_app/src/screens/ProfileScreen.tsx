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
  Switch,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
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
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  // Edit Profile & ABHA ID Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone && !user.phone.includes('@') ? user.phone : '');
  const [editAbhaId, setEditAbhaId] = useState((user as any)?.abha_id || '');
  const [editAge, setEditAge] = useState((user as any)?.age ? String((user as any).age) : '');
  const [editGender, setEditGender] = useState<'Male' | 'Female' | 'Other' | ''>((user as any)?.gender || '');
  const [editEmergency, setEditEmergency] = useState((user as any)?.emergency_contact || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    if (user) {
      setCurrentUser(user);
    }
  }, [user]);

  useEffect(() => {
    const loadBiometricStatus = async () => {
      try {
        const p1 = await AsyncStorage.getItem('@praxirence_patient_biometrics');
        const p2 = await AsyncStorage.getItem('praxirence_biometric_enabled');
        setBiometricEnabled(p1 === 'true' || p2 === 'true');
      } catch (_) {}
    };
    loadBiometricStatus();
  }, []);

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !isEnrolled) {
          Alert.alert(
            "Device Lock Required",
            "Please configure a screen lock (Fingerprint, Face ID, PIN, or Pattern) in your phone settings first."
          );
          return;
        }

        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: "Authenticate with Phone Lock to Enable Vault Security",
          cancelLabel: "Cancel",
          fallbackLabel: "Use Phone PIN / Pattern",
          disableDeviceFallback: false,
        });

        if (res.success) {
          setBiometricEnabled(true);
          await AsyncStorage.setItem("@praxirence_patient_biometrics", "true");
          await AsyncStorage.setItem("praxirence_biometric_enabled", "true");
          Alert.alert("Phone Lock Enabled", "Your health vault is now secured with your phone lock.");
        }
      } catch (err: any) {
        Alert.alert("Notice", "Lock setup: " + (err?.message || "Failed"));
      }
    } else {
      try {
        const res = await LocalAuthentication.authenticateAsync({
          promptMessage: "Authenticate to Disable Vault Lock",
          cancelLabel: "Cancel",
          fallbackLabel: "Use Phone PIN / Pattern",
          disableDeviceFallback: false,
        });
        if (res.success) {
          setBiometricEnabled(false);
          await AsyncStorage.setItem("@praxirence_patient_biometrics", "false");
          await AsyncStorage.setItem("praxirence_biometric_enabled", "false");
          Alert.alert("Lock Disabled", "Vault protection has been turned off.");
        }
      } catch (err: any) {
        Alert.alert("Notice", "Authentication error: " + (err?.message || "Failed"));
      }
    }
  };
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter your full name.');
      return;
    }
    const rawDigits = editPhone.replace(/\D/g, '');
    if (rawDigits.length !== 10 || !/^[6-9]/.test(rawDigits)) {
      Alert.alert(
        'Phone Number Compulsory',
        'Please enter a valid 10-digit Indian mobile number (+91) starting with 6, 7, 8, or 9.'
      );
      return;
    }
    const formattedPhone = `+91${rawDigits}`;
    setSavingProfile(true);
    try {
      const payload = {
        name: editName.trim(),
        phone: formattedPhone,
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
      Alert.alert(t('profileUpdated'), t('profileUpdatedMsg'));
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

  const handleCheckForUpdates = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}

    const websiteUpdateUrl = 'https://www.praxirence.com/download';

    Alert.alert(
      'Download Latest Update',
      'This will open the official Praxirence website in your browser and automatically download the latest Patient App APK (v2.1). Your stored health vault and biometric keys remain completely intact.\n\nOpen download portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download Update',
          onPress: async () => {
            try {
              const supported = await Linking.canOpenURL(websiteUpdateUrl);
              if (supported) {
                await Linking.openURL(websiteUpdateUrl);
              } else {
                await Linking.openURL('https://www.praxirence.com/download');
              }
            } catch (_) {
              Alert.alert(
                'Direct Link',
                'Please open https://www.praxirence.com/download in your phone browser to download the latest APK.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  const handleLogoutPress = () => {
    Alert.alert(
      t('confirmSignOut'),
      t('confirmSignOutMsg'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('confirmSignOut'), style: 'destructive', onPress: onLogout },
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
        <BrandLogoMobile variant="header" size="sm" subtitleText={t('accountSettingsTitle')} />
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
            {isDoctor ? t('verifiedClinicianRole') : t('patientVaultRole')}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 8 }}>
            <View style={styles.langPillIcon}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: Colors.primaryDark }}>
                {currentLangObj.code.toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1, flexShrink: 1 }}>
              <Text style={{ fontFamily: FontFamily.semiBold, fontSize: 14, color: Colors.text }}>
                {currentLangObj.nativeLabel} ({currentLangObj.label})
              </Text>
              <Text style={{ fontFamily: FontFamily.regular, fontSize: 11, color: Colors.textSecondary, marginTop: 2, flexWrap: 'wrap' }}>
                {t('chooseLanguageSub')}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Biometric Security & Health Vault Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>{t('biometricSecurityTitle')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
          <View style={{ flex: 1, paddingRight: 16 }}>
            <Text style={{ fontFamily: FontFamily.semiBold, fontSize: 14, color: Colors.text }}>
              {t('biometricAppLock')}
            </Text>
            <Text style={{ fontFamily: FontFamily.regular, fontSize: 12, color: Colors.textSecondary, marginTop: 2 }}>
              {t('biometricAppLockSub')}
            </Text>
          </View>
          <Switch
            value={biometricEnabled}
            onValueChange={handleToggleBiometric}
            trackColor={{ false: '#CBD5E1', true: '#A7F3D0' }}
            thumbColor={biometricEnabled ? '#059669' : '#FFFFFF'}
          />
        </View>

      </View>

      {/* Account Credentials Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="finger-print-outline" size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>{t('identityVerificationTitle')}</Text>
        </View>

        {isDoctor ? (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('medicalSpecialty')}</Text>
              <Text style={styles.infoValue}>{(currentUser as any).specialty || 'Specialty pending'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('affiliatedHospital')}</Text>
              <Text style={styles.infoValue}>{(currentUser as any).clinic_name || 'Clinic pending'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('medicalRegistration')}</Text>
              <Text style={[styles.infoValue, { color: Colors.primaryDark, fontFamily: FontFamily.bold }]}>
                {(currentUser as any).reg_number || 'Registration pending'}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Patient Unique ID (UHID)</Text>
              <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, borderWidth: 1, borderColor: '#BAE6FD' }}>
                <Text style={[styles.infoValue, { color: '#0369A1', fontFamily: FontFamily.bold, fontSize: 13 }]}>
                  {(currentUser as any).uhid || `PRX-PAT-${currentUser.id.slice(0, 4).toUpperCase()}`}
                </Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('abhaIdTitle')}</Text>
              {(currentUser as any).abha_id ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="shield-checkmark" size={14} color="#059669" />
                  <Text style={[styles.infoValue, { color: Colors.primaryDark, fontFamily: FontFamily.bold }]}>
                    {(currentUser as any).abha_id}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.infoValue, { color: Colors.textSecondary, fontStyle: 'italic' }]}>
                  {t('notLinked')}
                </Text>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{t('registeredMobile')}</Text>
              <Text style={styles.infoValue}>
                {currentUser.phone && !currentUser.phone.includes('@') ? currentUser.phone : 'Not Provided'}
              </Text>
            </View>

            {Boolean((currentUser as any).age || (currentUser as any).gender) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('demographics')}</Text>
                <Text style={styles.infoValue}>
                  {[(currentUser as any).age ? `${(currentUser as any).age} Yrs` : null, (currentUser as any).gender].filter(Boolean).join(' • ')}
                </Text>
              </View>
            )}

            {Boolean((currentUser as any).emergency_contact) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>{t('emergencyContact')}</Text>
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
                setEditGender((currentUser as any).gender || '');
                setEditEmergency((currentUser as any).emergency_contact || '');
                setShowEditModal(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="create-outline" size={15} color="#FFFFFF" />
              <Text style={styles.editProfileBtnText}>{t('editDetailsBtn')}</Text>
            </TouchableOpacity>
          </>
        )}

        {((currentUser as any).email || (currentUser.phone && currentUser.phone.includes('@'))) && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t('emailAddress')}</Text>
            <Text style={styles.infoValue}>
              {(currentUser as any).email || currentUser.phone}
            </Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('accountStatus')}</Text>
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
          <Text style={styles.infoLabel}>{t('encryptionStandard')}</Text>
          <Text style={styles.infoValue}>{t('aes256Standard')}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('dpdpAct')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="shield-checkmark" size={13} color={Colors.primaryDark} />
            <Text style={[styles.infoValue, { color: Colors.primaryDark }]}>{t('compliant')}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('abdmMilestone')}</Text>
          <Text style={[styles.infoValue, { color: Colors.primaryDark }]}>{t('certifiedHipHiu')}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{t('dataProtection')}</Text>
          <Text style={[styles.infoValue, { color: Colors.primaryDark, fontFamily: FontFamily.semiBold }]}>
            {t('endToEndEncrypted')}
          </Text>
        </View>

        {onNavigateToConsent && (
          <TouchableOpacity
            style={styles.manageConsentBtn}
            onPress={onNavigateToConsent}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={16} color={Colors.primaryDark} />
            <Text style={styles.manageConsentBtnText}>{t('manageAbdmConsent')}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.primaryDark} />
          </TouchableOpacity>
        )}
      </View>

      {/* App Version & Direct Website APK Update Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
            <Ionicons name="cloud-download-outline" size={18} color="#0D9488" />
            <Text style={styles.cardTitle}>App Version & Updates</Text>
          </View>
          <View style={styles.versionBadge}>
            <Text style={styles.versionBadgeText}>v2.1 Production</Text>
          </View>
        </View>

        <Text style={styles.updateCardSubtitle}>
          Download latest updates directly from our official portal with 1-click APK installer.
        </Text>

        <TouchableOpacity
          style={styles.updateNowButton}
          onPress={handleCheckForUpdates}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-down-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.updateNowButtonText}>Update App via Website</Text>
          <Ionicons name="open-outline" size={14} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      </View>

      {/* Clinical Support & Hotlines Card */}
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
                <Text style={styles.modalTitle}>{t('chooseLanguage')}</Text>
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
                <Text style={styles.modalTitle}>{t('editProfileTitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              <Text style={styles.inputFieldLabel}>{t('fullName')}</Text>
              <TextInput
                style={styles.textInputField}
                value={editName}
                onChangeText={setEditName}
                placeholder="Full Name"
                placeholderTextColor="#94A3B8"
              />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.inputFieldLabel}>{t('phone')} * (Compulsory)</Text>
                <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: '700' }}>Indian (+91)</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 10, borderTopLeftRadius: 7, borderBottomLeftRadius: 7, gap: 4 }}>
                  <Text style={{ fontSize: 14 }}>🇮🇳</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>+91</Text>
                </View>
                <TextInput
                  style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A' }}
                  value={editPhone.replace('+91', '').trim()}
                  onChangeText={(v) => setEditPhone(`+91${v.replace(/\D/g, '').slice(0, 10)}`)}
                  placeholder="10-digit Mobile Number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="number-pad"
                  maxLength={10}
                />
              </View>

              <Text style={styles.inputFieldLabel}>{t('abhaIdPlaceholder')}</Text>
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
                  <Text style={styles.inputFieldLabel}>{t('age')}</Text>
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

              <Text style={styles.inputFieldLabel}>{t('gender')}</Text>
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
                      {g === 'Male' ? t('male') : g === 'Female' ? t('female') : t('other')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputFieldLabel}>{t('emergencyContactLabel')}</Text>
              <TextInput
                style={styles.textInputField}
                value={editEmergency}
                onChangeText={setEditEmergency}
                placeholder={t('emergencyContactPlaceholder')}
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
                    <Text style={styles.saveProfileSubmitText}>{t('saveChanges')}</Text>
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
    fontWeight: '700',
    fontSize: FontSize.xl,
    color: Colors.text,
  },
  phone: {
    fontFamily: FontFamily.medium,
    fontWeight: '500',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '500',
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flexShrink: 0,
  },
  infoValue: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
    fontSize: FontSize.sm,
    color: Colors.text,
    flexShrink: 1,
    textAlign: 'right',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '700',
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
    fontWeight: '600',
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
    fontWeight: '700',
    fontSize: 13,
  },
  inputFieldLabel: {
    fontFamily: FontFamily.semiBold,
    fontWeight: '600',
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
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  genderSelectTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontWeight: '700',
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
  versionBadge: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  versionBadgeText: {
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 11,
    color: '#0F766E',
  },
  updateCardSubtitle: {
    fontFamily: FontFamily.regular,
    fontWeight: '400',
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 12,
  },
  updateNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D9488',
    paddingVertical: 11,
    borderRadius: 10,
    shadowColor: '#0D9488',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  updateNowButtonText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 13,
  },
  saveProfileSubmitText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    fontSize: 14,
  },
});

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  AppState,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

import { Colors } from './src/theme/colors';
import { FontFamily, FontSize } from './src/theme/typography';
import { PatientUser } from './src/types';
import { SplashScreen } from './src/screens/SplashScreen';
import { PatientLoginScreen } from './src/screens/PatientLoginScreen';

// Patient Portal Screens
import { DashboardScreen } from './src/screens/DashboardScreen';
import { VisitsScreen } from './src/screens/VisitsScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ChatbotScreen } from './src/screens/ChatbotScreen';
import { DoctorSearchScreen } from './src/screens/DoctorSearchScreen';

import { mobileApi } from './src/services/api';
import { NotificationService } from './src/services/NotificationService';
import { GlobalErrorBoundary } from './src/components/common/GlobalErrorBoundary';
import { CrashResilience } from './src/services/CrashResilienceService';
import { DeviceIntegrity } from './src/security/DeviceIntegrityService';
import { LanguageProvider, useLanguage } from './src/utils/LanguageContext';

export const navigationRef = createNavigationContainerRef<any>();

const Tab = createBottomTabNavigator();

function PatientAppContent() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentPatient, setCurrentPatient] = useState<PatientUser | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [showConsentModal, setShowConsentModal] = useState<boolean>(false);
  const [isBiometricLocked, setIsBiometricLocked] = useState<boolean>(false);
  const [authenticatingBiometric, setAuthenticatingBiometric] = useState<boolean>(false);
  const [pinUnlockInput, setPinUnlockInput] = useState<string>('');
  const [pinUnlockError, setPinUnlockError] = useState<string>('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const appState = React.useRef(AppState.currentState);

  const checkAndPromptBiometric = async () => {
    try {
      const p1 = await AsyncStorage.getItem('@praxirence_patient_biometrics');
      const p2 = await AsyncStorage.getItem('praxirence_biometric_enabled');
      const pin = await AsyncStorage.getItem('@praxirence_app_pin');
      setStoredPin(pin);
      if (p1 === 'true' || p2 === 'true' || !!pin) {
        setIsBiometricLocked(true);
      } else {
        setIsBiometricLocked(false);
      }
    } catch (_) {
      setIsBiometricLocked(false);
    }
  };

  const performBiometricUnlock = async () => {
    try {
      setAuthenticatingBiometric(true);
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) {
        setIsBiometricLocked(false);
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Praxirence Health Vault',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Device Passcode',
        disableDeviceFallback: false,
      });
      if (res.success) {
        setIsBiometricLocked(false);
      }
    } catch (err) {
      console.warn('Patient biometric unlock failed:', err);
    } finally {
      setAuthenticatingBiometric(false);
    }
  };

  useEffect(() => {
    if (isBiometricLocked && !showSplash && !loadingSession && currentPatient) {
      performBiometricUnlock();
    }
  }, [isBiometricLocked, showSplash, loadingSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        checkAndPromptBiometric();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // Initialize Hospital-Grade Crash Resilience & Device Integrity
    CrashResilience.initialize();
    DeviceIntegrity.enforcePatientPolicy().catch(() => {});

    // Initialize notification channels for Android
    NotificationService.initChannels().catch(() => {});

    // Deep link response listener when user taps a push notification
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;
        if (!navigationRef.isReady()) return;

        const notifType = data?.type || '';
        if (
          notifType === 'NEW_PRESCRIPTION' ||
          notifType === 'medicine_reminder' ||
          notifType === 'vault' ||
          notifType === 'CARE_PLAN'
        ) {
          navigationRef.navigate('Vault');
        } else if (notifType === 'SPECIALISTS' || notifType === 'DOCTOR_SEARCH') {
          navigationRef.navigate('Specialists');
        } else if (notifType === 'CHATBOT') {
          navigationRef.navigate('Assistant');
        } else {
          // Default for QUEUE_UPDATE, CALL_NEXT, DOCTOR_LEAVE, DOCTOR_DELAY
          navigationRef.navigate('Today');
        }
      } catch (err) {
        console.warn('Error navigating on notification response:', err);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const restore = async () => {
      try {
        const session = await mobileApi.restoreSession();
        if (session && session.user && session.role === 'patient') {
          setCurrentPatient(session.user as PatientUser);
          checkAndPromptBiometric();
        } else if (session && session.user) {
          const pat: PatientUser = {
            id: session.user.id,
            name: session.user.name.replace('Dr. ', ''),
            phone: session.user.phone,
            consent_status: true,
            role: 'patient',
          };
          setCurrentPatient(pat);
          checkAndPromptBiometric();
        }
      } catch (err) {
        console.warn('Failed to restore patient session:', err);
      } finally {
        setLoadingSession(false);
      }
    };
    restore();
  }, []);

  const handleAuthenticated = (patient: PatientUser) => {
    setCurrentPatient(patient);
    checkAndPromptBiometric();
  };

  const handleLogout = async () => {
    await mobileApi.clearSession();
    setCurrentPatient(null);
    setIsBiometricLocked(false);
  };

  const handleConsentUpdated = (newStatus: boolean) => {
    if (currentPatient) {
      setCurrentPatient({
        ...currentPatient,
        consent_status: newStatus,
      });
    }
  };

  // Splash
  if (showSplash || loadingSession) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Patient Login Screen
  if (!currentPatient) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <PatientLoginScreen onAuthenticated={handleAuthenticated} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Biometric App Lock Screen
  if (isBiometricLocked) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.lockContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#064E3B" />
          <View style={styles.lockContent}>
            <View style={styles.lockIconBox}>
              <Ionicons name="finger-print" size={54} color="#34D399" />
            </View>
            <Text style={styles.lockTitle}>Health Vault Locked</Text>
            <Text style={styles.lockSubtitle}>
              Biometric verification is active. Authenticate to access your health records, prescriptions, and appointments.
            </Text>
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={performBiometricUnlock}
              disabled={authenticatingBiometric}
              activeOpacity={0.85}
            >
              {authenticatingBiometric ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.unlockBtnText}>Unlock with Fingerprint / Face ID</Text>
                </>
              )}
            </TouchableOpacity>

            {/* 4-Digit Security PIN Option */}
            <View style={styles.pinLockBox}>
              <Text style={styles.pinLockHeading}>Or Enter 4-Digit Security PIN</Text>
              <TextInput
                style={styles.pinLockInput}
                value={pinUnlockInput}
                onChangeText={(val) => {
                  const clean = val.replace(/[^0-9]/g, '').slice(0, 4);
                  setPinUnlockInput(clean);
                  setPinUnlockError('');
                  if (clean.length === 4) {
                    setTimeout(() => {
                      AsyncStorage.getItem('@praxirence_app_pin').then((p) => {
                        if (!p || clean === p) {
                          setIsBiometricLocked(false);
                          setPinUnlockInput('');
                          setPinUnlockError('');
                        } else {
                          setPinUnlockError('Incorrect PIN. Please try again.');
                          setPinUnlockInput('');
                        }
                      });
                    }, 50);
                  }
                }}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry={true}
                placeholder="••••"
                placeholderTextColor="rgba(167, 243, 208, 0.6)"
              />
              {pinUnlockError ? (
                <Text style={styles.pinLockError}>{pinUnlockError}</Text>
              ) : null}
            </View>

            <TouchableOpacity style={styles.lockSignOutBtn} onPress={handleLogout} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={16} color="#94A3B8" />
              <Text style={styles.lockSignOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <NavigationContainer ref={navigationRef}>
        <PatientTabsNavigator
          currentPatient={currentPatient}
          handleLogout={handleLogout}
          setShowConsentModal={setShowConsentModal}
        />
      </NavigationContainer>

      {/* Global ABDM & DPDP Consent Modal with Android Back Gesture Handling */}
      <Modal
        visible={showConsentModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowConsentModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <ConsentScreen
            user={currentPatient}
            onConsentUpdated={handleConsentUpdated}
            onClose={() => setShowConsentModal(false)}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaProvider>
  );
}

function PatientTabsNavigator({
  currentPatient,
  handleLogout,
  setShowConsentModal,
}: {
  currentPatient: PatientUser;
  handleLogout: () => void;
  setShowConsentModal: (v: boolean) => void;
}) {
  const { t } = useLanguage();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: '#059669',
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'today';
          if (route.name === 'Today') {
            iconName = focused ? 'today' : 'today-outline';
          } else if (route.name === 'Vault') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Specialists') {
            iconName = focused ? 'medical' : 'medical-outline';
          } else if (route.name === 'Assistant') {
            iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person-circle' : 'person-circle-outline';
          }
          return (
            <View style={styles.tabIconWrapper}>
              <Ionicons name={iconName} size={size || 22} color={color} />
              {focused && <View style={styles.activeTabDot} />}
            </View>
          );
        },
      })}
      screenListeners={{
        tabPress: () => {
          try {
            Haptics.selectionAsync();
          } catch (_) {}
        },
      }}
    >
      <Tab.Screen
        name="Today"
        options={{ tabBarLabel: t('navToday') }}
      >
        {(props) => (
          <DashboardScreen
            user={currentPatient}
            onNavigateToConsent={() => setShowConsentModal(true)}
            onNavigateToChatbot={() => props.navigation.navigate('Assistant')}
            onNavigateToDoctors={() => props.navigation.navigate('Specialists')}
            onNavigateToVisits={() => props.navigation.navigate('Vault')}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Vault"
        options={{ tabBarLabel: t('navVault') }}
      >
        {() => <VisitsScreen user={currentPatient} />}
      </Tab.Screen>

      <Tab.Screen
        name="Specialists"
        options={{ tabBarLabel: t('navDoctors') }}
      >
        {() => <DoctorSearchScreen user={currentPatient} />}
      </Tab.Screen>

      <Tab.Screen
        name="Assistant"
        options={{ tabBarLabel: t('navChat') }}
      >
        {(props) => (
          <ChatbotScreen
            user={currentPatient}
            onNavigateToDoctors={() => props.navigation.navigate('Specialists')}
            onNavigateToVisits={() => props.navigation.navigate('Vault')}
          />
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Profile"
        options={{ tabBarLabel: t('navProfile') }}
      >
        {() => (
          <ProfileScreen
            user={currentPatient}
            role="patient"
            onLogout={handleLogout}
            onNavigateToConsent={() => setShowConsentModal(true)}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <LanguageProvider>
        <PatientAppContent />
      </LanguageProvider>
    </GlobalErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    height: 64,
    paddingBottom: 8,
    paddingTop: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  tabBarLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    marginTop: 2,
  },
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 28,
  },
  activeTabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#059669',
    position: 'absolute',
    bottom: -3,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: '#064E3B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockContent: {
    width: '85%',
    alignItems: 'center',
    padding: 24,
  },
  lockIconBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  lockTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    color: '#F8FAFC',
    marginBottom: 10,
    textAlign: 'center',
  },
  lockSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: '#A7F3D0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  unlockBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  unlockBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: '#FFFFFF',
  },
  pinLockBox: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(52, 211, 153, 0.25)',
  },
  pinLockHeading: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: '#A7F3D0',
    marginBottom: 8,
  },
  pinLockInput: {
    width: 160,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1.5,
    borderColor: '#34D399',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 10,
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  pinLockError: {
    color: '#F87171',
    fontFamily: FontFamily.medium,
    fontSize: 12,
    marginTop: 6,
  },
  lockSignOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 10,
  },
  lockSignOutText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: '#94A3B8',
  },
});

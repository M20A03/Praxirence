import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
  AppState,
  AppStateStatus,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from './src/theme/colors';
import { FontFamily, FontSize, LetterSpacing } from './src/theme/typography';
import { DoctorUser, PatientSummary } from './src/types';
import { SplashScreen } from './src/screens/SplashScreen';
import { DoctorLoginScreen } from './src/screens/DoctorLoginScreen';

// Doctor Screens
import { DoctorDashboardScreen } from './src/screens/doctor/DoctorDashboardScreen';
import { DoctorPatientsScreen } from './src/screens/doctor/DoctorPatientsScreen';
import { DoctorNewConsultationScreen } from './src/screens/doctor/DoctorNewConsultationScreen';
import { DoctorProfileScreen } from './src/screens/doctor/DoctorProfileScreen';
import DoctorCopilotScreen from './src/screens/doctor/DoctorCopilotScreen';
import { ClinicianOnboardingModal } from './src/components/ClinicianOnboardingModal';

import { mobileApi } from './src/services/api';
import { GlobalErrorBoundary } from './src/components/common/GlobalErrorBoundary';
import { CrashResilience } from './src/services/CrashResilienceService';
import { DeviceIntegrity } from './src/security/DeviceIntegrityService';

export const navigationRef = createNavigationContainerRef<any>();

const Tab = createBottomTabNavigator();

function DoctorAppContent() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentDoctor, setCurrentDoctor] = useState<DoctorUser | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);

  // Biometric App Lock Gatekeeper
  const [isBiometricLocked, setIsBiometricLocked] = useState<boolean>(false);
  const [authenticatingBiometric, setAuthenticatingBiometric] = useState<boolean>(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  // Pre-selected consultation context
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();
  const [selectedPatientName, setSelectedPatientName] = useState<string | undefined>();
  const [selectedComplaint, setSelectedComplaint] = useState<string | undefined>();

  const checkAndPromptBiometric = async () => {
    try {
      const enabled = await AsyncStorage.getItem("praxirence_biometric_enabled");
      if (enabled === "true") {
        setIsBiometricLocked(true);
        performBiometricUnlock();
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
        promptMessage: 'Unlock Praxirence Doctor Workspace',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Phone PIN / Pattern',
        disableDeviceFallback: false,
      });
      if (res.success) {
        setIsBiometricLocked(false);
      }
    } catch (err) {
      console.warn('Biometric unlock failed:', err);
    } finally {
      setAuthenticatingBiometric(false);
    }
  };

  useEffect(() => {
    if (isBiometricLocked && !showSplash && !loadingSession && currentDoctor) {
      performBiometricUnlock();
    }
  }, [isBiometricLocked, showSplash, loadingSession]);

  useEffect(() => {
    // AppState listener for auto-locking upon return from background
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
    // Initialize Hospital-Grade Crash Resilience & Doctor Integrity Check
    CrashResilience.initialize();
    DeviceIntegrity.enforceDoctorPolicy().catch(() => {});

    // Setup Android notification channel for doctor alerts
    if (Platform.OS === 'android') {
      try {
        Notifications.setNotificationChannelAsync('doctor-alerts', {
          name: 'Doctor OPD Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 250],
        }).catch(() => {});
      } catch (_) {}
    }

    // Deep link response listener for doctor notifications
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response?.notification?.request?.content?.data as Record<string, any> | undefined;
        if (!navigationRef.isReady()) return;

        const notifType = data?.type || '';
        if (notifType === 'START_CONSULT' || notifType === 'CONSULTATION') {
          if (data?.patientId) {
            setSelectedPatientId(data.patientId);
            setSelectedPatientName(data.patientName || 'Patient');
            setSelectedComplaint(data.chiefComplaint);
          }
          navigationRef.navigate('NewConsult');
        } else if (notifType === 'CARE_PLAN' || notifType === 'PATIENT_HISTORY') {
          navigationRef.navigate('CarePlans');
        } else {
          navigationRef.navigate('Schedule');
        }
      } catch (err) {
        console.warn('Error handling doctor notification tap:', err);
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
        if (session && session.user && session.role === 'doctor') {
          const u = session.user as any;
          setCurrentDoctor({
            id: u.id,
            name: u.name || '',
            email: u.email || '',
            phone: u.phone || '',
            specialty: u.specialty || '',
            degree: u.degree || '',
            qualifications: u.qualifications || '',
            experience_years: u.experience_years || '',
            designation: u.designation || '',
            languages: u.languages || [],
            clinic_name: u.clinic_name || '',
            reg_number: u.reg_number || '',
            clinic_address: u.clinic_address || '',
            role: 'doctor',
          });
          checkAndPromptBiometric();
        } else if (session && session.user) {
          const u = session.user as any;
          const doc: DoctorUser = {
            id: u.id,
            name: u.name || '',
            email: u.email || '',
            phone: u.phone || '',
            specialty: u.specialty || '',
            degree: u.degree || '',
            qualifications: u.qualifications || '',
            experience_years: u.experience_years || '',
            designation: u.designation || '',
            languages: u.languages || [],
            clinic_name: u.clinic_name || '',
            reg_number: u.reg_number || '',
            clinic_address: u.clinic_address || '',
            role: 'doctor',
          };
          setCurrentDoctor(doc);
          checkAndPromptBiometric();
        }
      } catch (err) {
        console.warn('Failed to restore doctor session:', err);
      } finally {
        setLoadingSession(false);
      }
    };
    restore();
  }, []);

  const handleAuthenticated = (doctor: DoctorUser) => {
    setCurrentDoctor(doctor);
    checkAndPromptBiometric();
  };

  const handleLogout = async () => {
    await mobileApi.clearSession();
    setCurrentDoctor(null);
    setIsBiometricLocked(false);
  };

  // Splash Screen
  if (showSplash || loadingSession) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Doctor Authentication Screen
  if (!currentDoctor) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
          <DoctorLoginScreen onAuthenticated={handleAuthenticated} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Biometric App Lock Screen
  if (isBiometricLocked) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.lockContainer}>
          <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
          <View style={styles.lockContent}>
            <View style={styles.lockIconBox}>
              <Ionicons name="finger-print" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.lockTitle}>Workspace Locked</Text>
            <Text style={styles.lockSubtitle}>
              Authenticate using your phone's fingerprint, Face ID, or system lock PIN/Pattern to access patient consultation records and OPD queues.
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
                  <Text style={styles.unlockBtnText}>Unlock with Phone Biometrics / PIN</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.lockSignOutBtn} onPress={handleLogout} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={16} color="#64748B" />
              <Text style={styles.lockSignOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Mandatory Clinician Onboarding Gatekeeper:
  // Requires registration number, primary degrees, specialty, and clinic name before allowing workspace access
  const isProfileIncomplete = Boolean(
    currentDoctor && (
      !currentDoctor.reg_number?.trim() ||
      !currentDoctor.degree?.trim() ||
      !currentDoctor.specialty?.trim() ||
      !currentDoctor.clinic_name?.trim()
    )
  );

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <NavigationContainer ref={navigationRef}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarHideOnKeyboard: true,
            tabBarActiveTintColor: '#0284C7',
            tabBarInactiveTintColor: '#64748B',
            tabBarStyle: styles.tabBar,
            tabBarLabelStyle: styles.tabBarLabel,
            tabBarIcon: ({ focused, color, size }) => {
              if (route.name === 'Schedule') {
                return (
                  <View style={styles.tabIconWrapper}>
                    <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size || 22} color={color} />
                    {focused && <View style={styles.activeTabDot} />}
                  </View>
                );
              } else if (route.name === 'CarePlans') {
                return (
                  <View style={styles.tabIconWrapper}>
                    <Ionicons name={focused ? 'people' : 'people-outline'} size={size || 22} color={color} />
                    {focused && <View style={styles.activeTabDot} />}
                  </View>
                );
              } else if (route.name === 'NewConsult') {
                return (
                  <View style={styles.consultNavBubble}>
                    <Ionicons name="mic" size={20} color="#FFFFFF" />
                  </View>
                );
              } else if (route.name === 'Copilot') {
                return (
                  <View style={styles.tabIconWrapper}>
                    <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={size || 22} color={color} />
                    {focused && <View style={styles.activeTabDot} />}
                  </View>
                );
              } else if (route.name === 'Profile') {
                return (
                  <View style={styles.tabIconWrapper}>
                    <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size || 22} color={color} />
                    {focused && <View style={styles.activeTabDot} />}
                  </View>
                );
              }
              return null;
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
            name="Schedule"
            options={{ tabBarLabel: 'Schedule' }}
          >
            {(props) => (
              <DoctorDashboardScreen
                doctor={currentDoctor}
                onNavigateToNewVisit={(patientId, patientName, chiefComplaint) => {
                  setSelectedPatientId(patientId);
                  setSelectedPatientName(patientName);
                  setSelectedComplaint(chiefComplaint);
                  props.navigation.navigate('NewConsult');
                }}
                onNavigateToPatients={() => props.navigation.navigate('CarePlans')}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="CarePlans"
            options={{ tabBarLabel: 'Care Plans' }}
          >
            {(props) => (
              <DoctorPatientsScreen
                onSelectPatientForConsultation={(patient: PatientSummary) => {
                  setSelectedPatientId(patient.id);
                  setSelectedPatientName(patient.name);
                  setSelectedComplaint(undefined);
                  props.navigation.navigate('NewConsult');
                }}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="NewConsult"
            options={{ tabBarLabel: 'Consult' }}
          >
            {(props) => (
              <DoctorNewConsultationScreen
                doctor={currentDoctor}
                preselectedPatientId={selectedPatientId}
                preselectedPatientName={selectedPatientName}
                preselectedComplaint={selectedComplaint}
                onConsultationSaved={() => {
                  setSelectedPatientId(undefined);
                  setSelectedPatientName(undefined);
                  setSelectedComplaint(undefined);
                  props.navigation.navigate('Schedule');
                }}
                onCancel={() => {
                  setSelectedPatientId(undefined);
                  setSelectedPatientName(undefined);
                  setSelectedComplaint(undefined);
                  props.navigation.navigate('Schedule');
                }}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Copilot"
            options={{ tabBarLabel: 'AI Copilot' }}
          >
            {() => (
              <DoctorCopilotScreen
                doctor={currentDoctor}
                initialPatientId={selectedPatientId}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Profile"
            options={{ tabBarLabel: 'Doctor ID' }}
          >
            {() => (
              <DoctorProfileScreen
                doctor={currentDoctor}
                onLogout={handleLogout}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>

      {/* Mandatory Clinician Onboarding Gate Modal */}
      {isProfileIncomplete && (
        <ClinicianOnboardingModal
          visible={isProfileIncomplete}
          doctor={currentDoctor}
          onComplete={(updated) => setCurrentDoctor(updated)}
          onLogout={handleLogout}
        />
      )}
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <GlobalErrorBoundary>
      <DoctorAppContent />
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
    fontSize: 11,
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
    backgroundColor: '#0284C7',
    position: 'absolute',
    bottom: -3,
  },
  consultNavBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },
  lockContent: {
    width: "88%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    padding: 28,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  lockIconBox: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#F0F9FF",
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  lockTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    color: "#0F172A",
    marginBottom: 8,
    textAlign: "center",
  },
  lockSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: "#475569",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  unlockBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  unlockBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: "#FFFFFF",
  },
  lockSignOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 20,
    paddingVertical: 10,
  },
  lockSignOutText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: "#64748B",
  },
});

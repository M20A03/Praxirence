import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';

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

  // Pre-selected consultation context
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();
  const [selectedPatientName, setSelectedPatientName] = useState<string | undefined>();
  const [selectedComplaint, setSelectedComplaint] = useState<string | undefined>();

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
          // Default for QUEUE_UPDATE, CALL_NEXT, WALK_IN, etc.
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
            ...u,
            degree: u.degree || 'MBBS, MD (General Medicine)',
            qualifications: u.qualifications || 'Fellowship in Internal Medicine & Diabetology',
            experience_years: u.experience_years || '12+ Yrs Exp',
            designation: u.designation || 'Chief Medical Officer & Senior Physician',
            languages: u.languages || ['English', 'Hindi', 'Hinglish'],
          });
        } else if (session && session.user) {
          const u = session.user as any;
          const doc: DoctorUser = {
            id: u.id,
            name: u.name?.startsWith('Dr.') ? u.name : `Dr. ${u.name || 'Mayank Raj Gupta'}`,
            email: u.email || 'doctor@praxirence.com',
            phone: u.phone || '+919876543210',
            specialty: u.specialty || 'Internal Medicine & Pulmonology',
            degree: u.degree || 'MBBS, MD (General Medicine)',
            qualifications: u.qualifications || 'Fellowship in Internal Medicine & Diabetology',
            experience_years: u.experience_years || '12+ Yrs Exp',
            designation: u.designation || 'Chief Medical Officer & Senior Physician',
            languages: u.languages || ['English', 'Hindi', 'Hinglish'],
            clinic_name: u.clinic_name || 'Praxirence Super-Speciality Clinic',
            reg_number: u.reg_number || 'NMC-2024-84920',
            role: 'doctor',
          };
          setCurrentDoctor(doc);
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
  };

  const handleLogout = async () => {
    await mobileApi.clearSession();
    setCurrentDoctor(null);
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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <NavigationContainer ref={navigationRef}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#0284C7',
            tabBarInactiveTintColor: '#64748B',
            tabBarStyle: styles.tabBar,
            tabBarLabelStyle: styles.tabBarLabel,
            tabBarIcon: ({ focused, color, size }) => {
              if (route.name === 'Schedule') {
                return <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={size || 22} color={color} />;
              } else if (route.name === 'CarePlans') {
                return <Ionicons name={focused ? 'people' : 'people-outline'} size={size || 22} color={color} />;
              } else if (route.name === 'NewConsult') {
                return (
                  <View style={styles.consultNavBubble}>
                    <Ionicons name="mic" size={20} color="#FFFFFF" />
                  </View>
                );
              } else if (route.name === 'Profile') {
                return <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size || 22} color={color} />;
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
});

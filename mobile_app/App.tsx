import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Colors } from './src/theme/colors';
import { FontFamily, FontSize, LetterSpacing } from './src/theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { UserRole, ActiveUser, DoctorUser, PatientUser, PatientSummary } from './src/types';
import { SplashScreen } from './src/screens/SplashScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RoleSelectScreen } from './src/screens/RoleSelectScreen';

// Patient Portal Screens
import { DashboardScreen } from './src/screens/DashboardScreen';
import { VisitsScreen } from './src/screens/VisitsScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ChatbotScreen } from './src/screens/ChatbotScreen';
import { DoctorSearchScreen } from './src/screens/DoctorSearchScreen';

// Doctor Portal Screens
import { DoctorDashboardScreen } from './src/screens/doctor/DoctorDashboardScreen';
import { DoctorPatientsScreen } from './src/screens/doctor/DoctorPatientsScreen';
import { DoctorNewConsultationScreen } from './src/screens/doctor/DoctorNewConsultationScreen';

import { mobileApi } from './src/services/api';

type PatientTab = 'today' | 'visits' | 'chatbot' | 'doctors' | 'consent' | 'profile';
type DoctorTab = 'overview' | 'patients' | 'new_consult' | 'profile';

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<ActiveUser | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('patient');
  const [loadingSession, setLoadingSession] = useState<boolean>(true);


  // Authentication Navigation Stages: 'login' | 'role_select' | 'authenticated'
  const [authStage, setAuthStage] = useState<'login' | 'role_select' | 'authenticated'>('login');
  const [verifiedPhone, setVerifiedPhone] = useState<string>('+919876543210');

  // Active Tabs for each role
  const [patientTab, setPatientTab] = useState<PatientTab>('today');
  const [doctorTab, setDoctorTab] = useState<DoctorTab>('overview');
  const [selectedPatientForConsult, setSelectedPatientForConsult] = useState<string | undefined>();

  useEffect(() => {
    const restore = async () => {
      try {
        const session = await mobileApi.restoreSession();
        if (session && session.user && session.role) {
          setActiveRole(session.role);
          setCurrentUser(session.user);
          setAuthStage('authenticated');
        } else {
          setAuthStage('login');
        }
      } catch (err) {
        console.warn('Failed to restore mobile session:', err);
        setAuthStage('login');
      } finally {
        setLoadingSession(false);
      }
    };
    restore();
  }, []);

  // Callback when OTP code is verified:
  // As requested by user: all first login with mobile number & WhatsApp OTP,
  // then navigate to interface for creating/selecting account as Doctor or Patient.
  const handleOtpVerified = async (phone: string) => {
    setVerifiedPhone(phone);
    setAuthStage('role_select');
  };

  const handleRoleSelected = (role: UserRole, user: ActiveUser) => {
    setActiveRole(role);
    setCurrentUser(user);
    setAuthStage('authenticated');
    if (role === 'doctor') {
      setDoctorTab('overview');
    } else {
      setPatientTab('today');
    }
  };

  const handleSwitchRole = () => {
    if (activeRole === 'doctor') {
      // Switch to Patient Portal
      setActiveRole('patient');
      setPatientTab('today');
      // Create or use patient persona
      if (currentUser) {
        const patientPersona: PatientUser = {
          id: currentUser.id,
          name: currentUser.name.replace('Dr. ', ''),
          phone: currentUser.phone,
          consent_status: true,
          role: 'patient',
        };
        setCurrentUser(patientPersona);
        mobileApi.saveSession('patient', 'token_patient_view', patientPersona);
      }
    } else {
      // Switch to Doctor Portal
      setActiveRole('doctor');
      setDoctorTab('overview');
      if (currentUser) {
        const doctorPersona: DoctorUser = {
          id: currentUser.id,
          name: currentUser.name.startsWith('Dr.') ? currentUser.name : `Dr. ${currentUser.name}`,
          email: 'doctor@praxirence.com',
          phone: currentUser.phone,
          specialty: 'Chief Medical Officer & Physician',
          clinic_name: 'Praxirence Clinical Centre',
          reg_number: 'NMC-2024-84920',
          role: 'doctor',
        };
        setCurrentUser(doctorPersona);
        mobileApi.saveSession('doctor', 'token_doctor_view', doctorPersona);
      }
    }
  };

  const handleLogout = async () => {
    await mobileApi.clearSession();
    setCurrentUser(null);
    setAuthStage('login');
    setPatientTab('today');
    setDoctorTab('overview');
  };

  const handleConsentUpdated = (newStatus: boolean) => {
    if (currentUser && activeRole === 'patient') {
      setCurrentUser({
        ...(currentUser as PatientUser),
        consent_status: newStatus,
      });
    }
  };

  const handleStartConsultationForPatient = (patient: PatientSummary) => {
    setSelectedPatientForConsult(patient.id);
    setDoctorTab('new_consult');
  };

  // Opening Loading / Splash Page
  if (showSplash || loadingSession) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }


  // Stage 1: Phone + OTP Sign-in
  if (authStage === 'login') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <LoginScreen
          onOtpVerified={handleOtpVerified}
          onAuthenticated={handleRoleSelected}
        />
      </SafeAreaView>
    );
  }

  // Stage 2: Account Role Selection (Doctor or Patient)
  if (authStage === 'role_select') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <RoleSelectScreen
          verifiedPhone={verifiedPhone}
          onRoleSelected={handleRoleSelected}
          onBackToLogin={() => setAuthStage('login')}
        />
      </SafeAreaView>
    );
  }

  // Stage 3: Authenticated Portals
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.container}>

        {/* Doctor Mode Views */}
        {activeRole === 'doctor' && (
          <>
            <View style={styles.screenContainer}>
              {doctorTab === 'overview' && (
                <DoctorDashboardScreen
                  doctor={currentUser as DoctorUser}
                  onNavigateToNewVisit={(patientId) => {
                    setSelectedPatientForConsult(patientId);
                    setDoctorTab('new_consult');
                  }}
                  onNavigateToPatients={() => setDoctorTab('patients')}
                />
              )}
              {doctorTab === 'patients' && (
                <DoctorPatientsScreen
                  onSelectPatientForConsultation={handleStartConsultationForPatient}
                />
              )}
              {doctorTab === 'new_consult' && (
                <DoctorNewConsultationScreen
                  doctor={currentUser as DoctorUser}
                  preselectedPatientId={selectedPatientForConsult}
                  onConsultationSaved={() => setDoctorTab('overview')}
                  onCancel={() => setDoctorTab('overview')}
                />
              )}
              {doctorTab === 'profile' && (
                <ProfileScreen
                  user={currentUser!}
                  role="doctor"
                  onLogout={handleLogout}
                />
              )}
            </View>

            {/* Doctor Navigation Tab Bar with Vector Icons */}
            <View style={styles.tabBarWrapper}>
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setDoctorTab('overview')}
                >
                  <Ionicons
                    name={doctorTab === 'overview' ? 'stats-chart' : 'stats-chart-outline'}
                    size={21}
                    color={doctorTab === 'overview' ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, doctorTab === 'overview' && styles.activeTabLabel]}>
                    Overview
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setDoctorTab('patients')}
                >
                  <Ionicons
                    name={doctorTab === 'patients' ? 'people' : 'people-outline'}
                    size={21}
                    color={doctorTab === 'patients' ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, doctorTab === 'patients' && styles.activeTabLabel]}>
                    Patients
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => {
                    setSelectedPatientForConsult(undefined);
                    setDoctorTab('new_consult');
                  }}
                >
                  <Ionicons
                    name={doctorTab === 'new_consult' ? 'add-circle' : 'add-circle-outline'}
                    size={23}
                    color={doctorTab === 'new_consult' ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, doctorTab === 'new_consult' && styles.activeTabLabel]}>
                    New Visit
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setDoctorTab('profile')}
                >
                  <Ionicons
                    name={doctorTab === 'profile' ? 'settings' : 'settings-outline'}
                    size={21}
                    color={doctorTab === 'profile' ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, doctorTab === 'profile' && styles.activeTabLabel]}>
                    Settings
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Patient Mode Views */}
        {activeRole === 'patient' && (
          <>
            <View style={styles.screenContainer}>
              {patientTab === 'today' && (
                <DashboardScreen
                  user={currentUser as PatientUser}
                  onNavigateToConsent={() => setPatientTab('consent')}
                  onNavigateToChatbot={() => setPatientTab('chatbot')}
                  onNavigateToDoctors={() => setPatientTab('doctors')}
                  onNavigateToVisits={() => setPatientTab('visits')}
                />
              )}
              {patientTab === 'visits' && <VisitsScreen user={currentUser as PatientUser} />}
              {patientTab === 'chatbot' && (
                <ChatbotScreen
                  user={currentUser as PatientUser}
                  onNavigateToDoctors={() => setPatientTab('doctors')}
                  onNavigateToVisits={() => setPatientTab('visits')}
                />
              )}
              {patientTab === 'doctors' && (
                <DoctorSearchScreen
                  user={currentUser as PatientUser}
                  onSelectDoctorForVisit={() => setPatientTab('today')}
                />
              )}
              {patientTab === 'consent' && (
                <ConsentScreen
                  user={currentUser as PatientUser}
                  onConsentUpdated={handleConsentUpdated}
                />
              )}
              {patientTab === 'profile' && (
                <ProfileScreen
                  user={currentUser!}
                  role="patient"
                  onLogout={handleLogout}
                  onDoctorVerified={(docUser) => {
                    setCurrentUser(docUser);
                    setActiveRole('doctor');
                    setDoctorTab('overview');
                  }}
                />
              )}
            </View>

            {/* Patient Navigation Tab Bar with Vector Icons */}
            <View style={styles.tabBarWrapper}>
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setPatientTab('today')}
                >
                  <Ionicons
                    name={patientTab === 'today' ? 'calendar' : 'calendar-outline'}
                    size={21}
                    color={patientTab === 'today' ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, patientTab === 'today' && styles.activeTabLabel]}>
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setPatientTab('visits')}
                >
                  <Ionicons
                    name={patientTab === 'visits' ? 'document-text' : 'document-text-outline'}
                    size={21}
                    color={patientTab === 'visits' ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, patientTab === 'visits' && styles.activeTabLabel]}>
                    Visits
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setPatientTab('chatbot')}
                >
                  <Ionicons
                    name={patientTab === 'chatbot' ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'}
                    size={21}
                    color={patientTab === 'chatbot' ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, patientTab === 'chatbot' && styles.activeTabLabel]}>
                    AI Bot
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setPatientTab('doctors')}
                >
                  <Ionicons
                    name={patientTab === 'doctors' ? 'medkit' : 'medkit-outline'}
                    size={21}
                    color={patientTab === 'doctors' ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, patientTab === 'doctors' && styles.activeTabLabel]}>
                    Doctors
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setPatientTab('profile')}
                >
                  <Ionicons
                    name={(patientTab === 'profile' || patientTab === 'consent') ? 'person' : 'person-outline'}
                    size={21}
                    color={(patientTab === 'profile' || patientTab === 'consent') ? Colors.primary : Colors.textMuted}
                  />
                  <Text style={[styles.tabLabel, (patientTab === 'profile' || patientTab === 'consent') && styles.activeTabLabel]}>
                    Settings
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenContainer: {
    flex: 1,
  },
  tabBarWrapper: {
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 3,
  },
  tabBar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 680,
    paddingVertical: 10,
    paddingBottom: 14,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 3,
    opacity: 0.55,
  },
  activeTabIcon: {
    opacity: 1,
    transform: [{ scale: 1.15 }],
  },
  tabLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    letterSpacing: LetterSpacing.wide,
  },
  activeTabLabel: {
    color: Colors.primaryDark,
    fontFamily: FontFamily.bold,
  },
});

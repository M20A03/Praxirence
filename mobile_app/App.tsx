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
import { UserRole, ActiveUser, DoctorUser, PatientUser, PatientSummary } from './src/types';
import { SplashScreen } from './src/screens/SplashScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RoleSelectScreen } from './src/screens/RoleSelectScreen';

// Patient Portal Screens
import { DashboardScreen } from './src/screens/DashboardScreen';
import { VisitsScreen } from './src/screens/VisitsScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

// Doctor Portal Screens
import { DoctorDashboardScreen } from './src/screens/doctor/DoctorDashboardScreen';
import { DoctorPatientsScreen } from './src/screens/doctor/DoctorPatientsScreen';
import { DoctorNewConsultationScreen } from './src/screens/doctor/DoctorNewConsultationScreen';

import { mobileApi } from './src/services/api';

type PatientTab = 'today' | 'visits' | 'consent' | 'profile';
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
        <LoginScreen onOtpVerified={handleOtpVerified} />
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
                  onSwitchToPatientRole={handleSwitchRole}
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
                  onSwitchRole={handleSwitchRole}
                  onLogout={handleLogout}
                />
              )}
            </View>

            {/* Doctor Navigation Tab Bar */}
            <View style={styles.tabBarWrapper}>
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setDoctorTab('overview')}
                >
                  <Text style={[styles.tabIcon, doctorTab === 'overview' && styles.activeTabIcon]}>
                    📊
                  </Text>
                  <Text style={[styles.tabLabel, doctorTab === 'overview' && styles.activeTabLabel]}>
                    Overview
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setDoctorTab('patients')}
                >
                  <Text style={[styles.tabIcon, doctorTab === 'patients' && styles.activeTabIcon]}>
                    👥
                  </Text>
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
                  <Text style={[styles.tabIcon, doctorTab === 'new_consult' && styles.activeTabIcon]}>
                    ➕
                  </Text>
                  <Text style={[styles.tabLabel, doctorTab === 'new_consult' && styles.activeTabLabel]}>
                    New Visit
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setDoctorTab('profile')}
                >
                  <Text style={[styles.tabIcon, doctorTab === 'profile' && styles.activeTabIcon]}>
                    👨‍⚕️
                  </Text>
                  <Text style={[styles.tabLabel, doctorTab === 'profile' && styles.activeTabLabel]}>
                    Profile
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
                  onSwitchToDoctorRole={handleSwitchRole}
                />
              )}
              {patientTab === 'visits' && <VisitsScreen user={currentUser as PatientUser} />}
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
                  onSwitchRole={handleSwitchRole}
                  onLogout={handleLogout}
                />
              )}
            </View>

            {/* Patient Navigation Tab Bar */}
            <View style={styles.tabBarWrapper}>
              <View style={styles.tabBar}>
                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setPatientTab('today')}
                >
                  <Text style={[styles.tabIcon, patientTab === 'today' && styles.activeTabIcon]}>
                    💊
                  </Text>
                  <Text style={[styles.tabLabel, patientTab === 'today' && styles.activeTabLabel]}>
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setPatientTab('visits')}
                >
                  <Text style={[styles.tabIcon, patientTab === 'visits' && styles.activeTabIcon]}>
                    📋
                  </Text>
                  <Text style={[styles.tabLabel, patientTab === 'visits' && styles.activeTabLabel]}>
                    Visits
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setPatientTab('consent')}
                >
                  <Text style={[styles.tabIcon, patientTab === 'consent' && styles.activeTabIcon]}>
                    🛡️
                  </Text>
                  <Text style={[styles.tabLabel, patientTab === 'consent' && styles.activeTabLabel]}>
                    Consent
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.tabItem}
                  onPress={() => setPatientTab('profile')}
                >
                  <Text style={[styles.tabIcon, patientTab === 'profile' && styles.activeTabIcon]}>
                    👤
                  </Text>
                  <Text style={[styles.tabLabel, patientTab === 'profile' && styles.activeTabLabel]}>
                    Profile
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

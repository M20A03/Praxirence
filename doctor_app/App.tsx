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
import { DoctorUser, PatientSummary } from './src/types';
import { SplashScreen } from './src/screens/SplashScreen';
import { DoctorLoginScreen } from './src/screens/DoctorLoginScreen';

// Doctor Screens
import { DoctorDashboardScreen } from './src/screens/doctor/DoctorDashboardScreen';
import { DoctorPatientsScreen } from './src/screens/doctor/DoctorPatientsScreen';
import { DoctorNewConsultationScreen } from './src/screens/doctor/DoctorNewConsultationScreen';
import { DoctorProfileScreen } from './src/screens/doctor/DoctorProfileScreen';

import { mobileApi } from './src/services/api';

type DoctorTab = 'schedule' | 'patients' | 'new_consult' | 'profile';

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentDoctor, setCurrentDoctor] = useState<DoctorUser | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);

  // Navigation State
  const [activeTab, setActiveTab] = useState<DoctorTab>('schedule');

  // Pre-selected consultation context
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>();
  const [selectedPatientName, setSelectedPatientName] = useState<string | undefined>();
  const [selectedComplaint, setSelectedComplaint] = useState<string | undefined>();

  useEffect(() => {
    const restore = async () => {
      try {
        const session = await mobileApi.restoreSession();
        if (session && session.user && session.role === 'doctor') {
          setCurrentDoctor(session.user as DoctorUser);
        } else if (session && session.user) {
          // If stored session was not doctor, cast to default doctor profile
          const doc: DoctorUser = {
            id: session.user.id,
            name: session.user.name.startsWith('Dr.') ? session.user.name : `Dr. ${session.user.name}`,
            email: 'doctor@praxirence.com',
            phone: session.user.phone,
            specialty: 'Chief Medical Officer & Physician',
            clinic_name: 'Praxirence Clinical Centre',
            reg_number: 'NMC-2024-84920',
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
    setActiveTab('schedule');
  };

  const handleLogout = async () => {
    await mobileApi.clearSession();
    setCurrentDoctor(null);
    setActiveTab('schedule');
  };

  const handleStartConsultationFromQueue = (patientId?: string, patientName?: string, chiefComplaint?: string) => {
    setSelectedPatientId(patientId);
    setSelectedPatientName(patientName);
    setSelectedComplaint(chiefComplaint);
    setActiveTab('new_consult');
  };

  const handleStartConsultationForPatient = (patient: PatientSummary) => {
    setSelectedPatientId(patient.id);
    setSelectedPatientName(patient.name);
    setSelectedComplaint(undefined);
    setActiveTab('new_consult');
  };

  // Splash Screen
  if (showSplash || loadingSession) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Doctor Authentication Screen
  if (!currentDoctor) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <DoctorLoginScreen onAuthenticated={handleAuthenticated} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Main Content Area */}
      <View style={styles.container}>
        {activeTab === 'schedule' && (
          <DoctorDashboardScreen
            doctor={currentDoctor}
            onNavigateToNewVisit={handleStartConsultationFromQueue}
            onNavigateToPatients={() => setActiveTab('patients')}
          />
        )}

        {activeTab === 'patients' && (
          <DoctorPatientsScreen
            onSelectPatientForConsultation={handleStartConsultationForPatient}
          />
        )}

        {activeTab === 'new_consult' && (
          <DoctorNewConsultationScreen
            doctor={currentDoctor}
            preselectedPatientId={selectedPatientId}
            preselectedPatientName={selectedPatientName}
            preselectedComplaint={selectedComplaint}
            onConsultationSaved={() => {
              setSelectedPatientId(undefined);
              setSelectedPatientName(undefined);
              setSelectedComplaint(undefined);
              setActiveTab('schedule');
            }}
            onCancel={() => {
              setSelectedPatientId(undefined);
              setSelectedPatientName(undefined);
              setSelectedComplaint(undefined);
              setActiveTab('schedule');
            }}
          />
        )}

        {activeTab === 'profile' && (
          <DoctorProfileScreen
            doctor={currentDoctor}
            onLogout={handleLogout}
          />
        )}
      </View>

      {/* Bottom Navigation Bar for Doctor App - Clean Light Theme */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('schedule')}
        >
          <Ionicons
            name={activeTab === 'schedule' ? 'calendar' : 'calendar-outline'}
            size={22}
            color={activeTab === 'schedule' ? '#0284C7' : '#64748B'}
          />
          <Text style={[styles.navLabel, activeTab === 'schedule' && styles.navLabelActive]}>
            Schedule
          </Text>
          {activeTab === 'schedule' && <View style={styles.navActiveBar} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('patients')}
        >
          <Ionicons
            name={activeTab === 'patients' ? 'people' : 'people-outline'}
            size={22}
            color={activeTab === 'patients' ? '#0284C7' : '#64748B'}
          />
          <Text style={[styles.navLabel, activeTab === 'patients' && styles.navLabelActive]}>
            Care Plans
          </Text>
          {activeTab === 'patients' && <View style={styles.navActiveBar} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => {
            setSelectedPatientId(undefined);
            setSelectedPatientName(undefined);
            setSelectedComplaint(undefined);
            setActiveTab('new_consult');
          }}
        >
          <View style={styles.consultNavBubble}>
            <Ionicons name="mic" size={20} color="#ffffff" />
          </View>
          <Text style={[styles.navLabel, activeTab === 'new_consult' && styles.navLabelActive]}>
            Consult
          </Text>
          {activeTab === 'new_consult' && <View style={styles.navActiveBar} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons
            name={activeTab === 'profile' ? 'person-circle' : 'person-circle-outline'}
            size={22}
            color={activeTab === 'profile' ? '#0284C7' : '#64748B'}
          />
          <Text style={[styles.navLabel, activeTab === 'profile' && styles.navLabelActive]}>
            Doctor ID
          </Text>
          {activeTab === 'profile' && <View style={styles.navActiveBar} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 8,
    paddingBottom: 14,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 4,
  },
  navLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#0284C7',
    fontWeight: '700',
  },
  navActiveBar: {
    position: 'absolute',
    top: -8,
    width: 28,
    height: 3,
    backgroundColor: '#0284C7',
    borderRadius: 2,
  },
  consultNavBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284C7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});

import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { Colors } from './src/theme/colors';
import { FontFamily, FontSize, LetterSpacing } from './src/theme/typography';
import { Ionicons } from '@expo/vector-icons';
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

type PatientTab = 'today' | 'visits' | 'chatbot' | 'doctors' | 'consent' | 'profile';

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentPatient, setCurrentPatient] = useState<PatientUser | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);

  // Active Tab
  const [activeTab, setActiveTab] = useState<PatientTab>('today');

  useEffect(() => {
    const restore = async () => {
      try {
        const session = await mobileApi.restoreSession();
        if (session && session.user && session.role === 'patient') {
          setCurrentPatient(session.user as PatientUser);
        } else if (session && session.user) {
          // Default to patient user
          const pat: PatientUser = {
            id: session.user.id,
            name: session.user.name.replace('Dr. ', ''),
            phone: session.user.phone,
            consent_status: true,
            role: 'patient',
          };
          setCurrentPatient(pat);
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
    setActiveTab('today');
  };

  const handleLogout = async () => {
    await mobileApi.clearSession();
    setCurrentPatient(null);
    setActiveTab('today');
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
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <PatientLoginScreen onAuthenticated={handleAuthenticated} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Main Content Area */}
      <View style={styles.container}>
        {activeTab === 'today' && (
          <DashboardScreen
            user={currentPatient}
            onNavigateToConsent={() => setActiveTab('consent')}
            onNavigateToChatbot={() => setActiveTab('chatbot')}
            onNavigateToDoctors={() => setActiveTab('doctors')}
            onNavigateToVisits={() => setActiveTab('visits')}
          />
        )}

        {activeTab === 'visits' && (
          <VisitsScreen
            user={currentPatient}
          />
        )}

        {activeTab === 'chatbot' && (
          <ChatbotScreen
            user={currentPatient}
            onNavigateToDoctors={() => setActiveTab('doctors')}
            onNavigateToVisits={() => setActiveTab('visits')}
          />
        )}

        {activeTab === 'doctors' && (
          <DoctorSearchScreen
            user={currentPatient}
          />
        )}

        {/* The Dedicated Last Page / Tab: Patient Consent & Data Concerns Center */}
        {activeTab === 'consent' && (
          <ConsentScreen
            user={currentPatient}
            onConsentUpdated={handleConsentUpdated}
          />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen
            user={currentPatient}
            role="patient"
            onLogout={handleLogout}
          />
        )}
      </View>

      {/* Bottom Navigation Bar for Patient App - Clean Light Theme */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('today')}
        >
          <Ionicons
            name={activeTab === 'today' ? 'today' : 'today-outline'}
            size={22}
            color={activeTab === 'today' ? '#059669' : '#64748B'}
          />
          <Text style={[styles.navLabel, activeTab === 'today' && styles.navLabelActive]}>
            Today
          </Text>
          {activeTab === 'today' && <View style={styles.navActiveBar} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('visits')}
        >
          <Ionicons
            name={activeTab === 'visits' ? 'document-text' : 'document-text-outline'}
            size={22}
            color={activeTab === 'visits' ? '#059669' : '#64748B'}
          />
          <Text style={[styles.navLabel, activeTab === 'visits' && styles.navLabelActive]}>
            Vault
          </Text>
          {activeTab === 'visits' && <View style={styles.navActiveBar} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('chatbot')}
        >
          <Ionicons
            name={activeTab === 'chatbot' ? 'chatbubbles' : 'chatbubbles-outline'}
            size={22}
            color={activeTab === 'chatbot' ? '#059669' : '#64748B'}
          />
          <Text style={[styles.navLabel, activeTab === 'chatbot' && styles.navLabelActive]}>
            AI Care
          </Text>
          {activeTab === 'chatbot' && <View style={styles.navActiveBar} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('doctors')}
        >
          <Ionicons
            name={activeTab === 'doctors' ? 'medkit' : 'medkit-outline'}
            size={22}
            color={activeTab === 'doctors' ? '#059669' : '#64748B'}
          />
          <Text style={[styles.navLabel, activeTab === 'doctors' && styles.navLabelActive]}>
            Doctors
          </Text>
          {activeTab === 'doctors' && <View style={styles.navActiveBar} />}
        </TouchableOpacity>

        {/* The Dedicated Consent & Data Concerns Center (Last Page) */}
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('consent')}
        >
          <Ionicons
            name={activeTab === 'consent' ? 'shield-checkmark' : 'shield-checkmark-outline'}
            size={22}
            color={activeTab === 'consent' ? '#059669' : '#64748B'}
          />
          <Text style={[styles.navLabel, activeTab === 'consent' && styles.navLabelActive]}>
            Privacy
          </Text>
          {activeTab === 'consent' && <View style={styles.navActiveBar} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('profile')}
        >
          <Ionicons
            name={activeTab === 'profile' ? 'person' : 'person-outline'}
            size={22}
            color={activeTab === 'profile' ? '#059669' : '#64748B'}
          />
          <Text style={[styles.navLabel, activeTab === 'profile' && styles.navLabelActive]}>
            Profile
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
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  navLabelActive: {
    color: '#059669',
    fontWeight: '700',
  },
  navActiveBar: {
    position: 'absolute',
    top: -8,
    width: 24,
    height: 3,
    backgroundColor: '#059669',
    borderRadius: 2,
  },
});

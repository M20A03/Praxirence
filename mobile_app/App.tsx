import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { Colors } from './src/theme/colors';
import { PatientUser } from './src/types';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { VisitsScreen } from './src/screens/VisitsScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

type TabType = 'today' | 'visits' | 'consent' | 'profile';

export default function App() {
  const [currentUser, setCurrentUser] = useState<PatientUser | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('today');

  const handleLoginSuccess = (user: PatientUser) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTab('today');
  };

  const handleConsentUpdated = (newStatus: boolean) => {
    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        consent_status: newStatus,
      });
    }
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.container}>
        {/* Main Active Tab Screen */}
        <View style={styles.screenContainer}>
          {activeTab === 'today' && (
            <DashboardScreen
              user={currentUser}
              onNavigateToConsent={() => setActiveTab('consent')}
            />
          )}
          {activeTab === 'visits' && <VisitsScreen user={currentUser} />}
          {activeTab === 'consent' && (
            <ConsentScreen
              user={currentUser}
              onConsentUpdated={handleConsentUpdated}
            />
          )}
          {activeTab === 'profile' && (
            <ProfileScreen user={currentUser} onLogout={handleLogout} />
          )}
        </View>

        {/* Intuitive Bottom Navigation Tab Bar */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab('today')}
          >
            <Text style={[styles.tabIcon, activeTab === 'today' && styles.activeTabIcon]}>
              💊
            </Text>
            <Text style={[styles.tabLabel, activeTab === 'today' && styles.activeTabLabel]}>
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab('visits')}
          >
            <Text style={[styles.tabIcon, activeTab === 'visits' && styles.activeTabIcon]}>
              📋
            </Text>
            <Text style={[styles.tabLabel, activeTab === 'visits' && styles.activeTabLabel]}>
              Visits
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab('consent')}
          >
            <Text style={[styles.tabIcon, activeTab === 'consent' && styles.activeTabIcon]}>
              🛡️
            </Text>
            <Text style={[styles.tabLabel, activeTab === 'consent' && styles.activeTabLabel]}>
              Consent
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tabItem}
            onPress={() => setActiveTab('profile')}
          >
            <Text style={[styles.tabIcon, activeTab === 'profile' && styles.activeTabIcon]}>
              👤
            </Text>
            <Text style={[styles.tabLabel, activeTab === 'profile' && styles.activeTabLabel]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
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
    opacity: 0.6,
  },
  activeTabIcon: {
    opacity: 1,
    transform: [{ scale: 1.15 }],
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  activeTabLabel: {
    color: Colors.primaryLight,
    fontWeight: '700',
  },
});

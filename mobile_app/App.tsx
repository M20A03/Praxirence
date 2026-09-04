import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { Colors } from './src/theme/colors';
import { PatientUser } from './src/types';
import { LoginScreen } from './src/screens/LoginScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { VisitsScreen } from './src/screens/VisitsScreen';
import { ConsentScreen } from './src/screens/ConsentScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { mobileApi } from './src/services/api';

type TabType = 'today' | 'visits' | 'consent' | 'profile';

export default function App() {
  const [currentUser, setCurrentUser] = useState<PatientUser | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabType>('today');

  useEffect(() => {
    const restore = async () => {
      try {
        const user = await mobileApi.restoreSession();
        if (user) {
          setCurrentUser(user);
        }
      } catch (err) {
        console.warn('Failed to restore mobile session:', err);
      } finally {
        setLoadingSession(false);
      }
    };
    restore();
  }, []);

  const handleLoginSuccess = (user: PatientUser) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await mobileApi.clearSession();
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

  if (loadingSession) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ color: Colors.textSecondary, marginTop: 12, fontSize: 13 }}>
          Verifying Clinical Vault Session...
        </Text>
      </SafeAreaView>
    );
  }

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
        <View style={styles.tabBarWrapper}>
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

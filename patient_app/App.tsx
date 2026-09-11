import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

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

const Tab = createBottomTabNavigator();

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [currentPatient, setCurrentPatient] = useState<PatientUser | null>(null);
  const [loadingSession, setLoadingSession] = useState<boolean>(true);

  useEffect(() => {
    const restore = async () => {
      try {
        const session = await mobileApi.restoreSession();
        if (session && session.user && session.role === 'patient') {
          setCurrentPatient(session.user as PatientUser);
        } else if (session && session.user) {
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
  };

  const handleLogout = async () => {
    await mobileApi.clearSession();
    setCurrentPatient(null);
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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
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
              } else if (route.name === 'Assistant') {
                iconName = focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline';
              } else if (route.name === 'Specialists') {
                iconName = focused ? 'search' : 'search-outline';
              } else if (route.name === 'Consent') {
                iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
              } else if (route.name === 'Profile') {
                iconName = focused ? 'person-circle' : 'person-circle-outline';
              }
              return <Ionicons name={iconName} size={size || 22} color={color} />;
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
            options={{ tabBarLabel: 'Today' }}
          >
            {(props) => (
              <DashboardScreen
                user={currentPatient}
                onNavigateToConsent={() => props.navigation.navigate('Consent')}
                onNavigateToChatbot={() => props.navigation.navigate('Assistant')}
                onNavigateToDoctors={() => props.navigation.navigate('Specialists')}
                onNavigateToVisits={() => props.navigation.navigate('Vault')}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Vault"
            options={{ tabBarLabel: 'Vault' }}
          >
            {() => <VisitsScreen user={currentPatient} />}
          </Tab.Screen>

          <Tab.Screen
            name="Assistant"
            options={{ tabBarLabel: 'AI Chat' }}
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
            name="Specialists"
            options={{ tabBarLabel: 'Doctors' }}
          >
            {() => <DoctorSearchScreen user={currentPatient} />}
          </Tab.Screen>

          <Tab.Screen
            name="Consent"
            options={{ tabBarLabel: 'Consent' }}
          >
            {() => (
              <ConsentScreen
                user={currentPatient}
                onConsentUpdated={handleConsentUpdated}
              />
            )}
          </Tab.Screen>

          <Tab.Screen
            name="Profile"
            options={{ tabBarLabel: 'Profile' }}
          >
            {() => (
              <ProfileScreen
                user={currentPatient}
                role="patient"
                onLogout={handleLogout}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
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
});

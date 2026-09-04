import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { ActiveUser, UserRole } from '../types';

interface ProfileScreenProps {
  user: ActiveUser;
  role: UserRole;
  onSwitchRole: () => void;
  onLogout: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  role,
  onSwitchRole,
  onLogout,
}) => {
  const isDoctor = role === 'doctor';

  const handleLogoutPress = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from Praxirence Clinical Vault?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: onLogout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {isDoctor ? '👨‍⚕️' : (user.name ? user.name.charAt(0).toUpperCase() : '👤')}
          </Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>
            {isDoctor ? '✓ Verified Clinician' : '✓ Patient Health Vault'}
          </Text>
        </View>
      </View>

      {/* Role Switcher Action Card */}
      <TouchableOpacity
        style={styles.switchRoleCard}
        onPress={onSwitchRole}
        activeOpacity={0.88}
      >
        <View style={styles.switchIconCircle}>
          <Text style={{ fontSize: 20 }}>🔄</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.switchTitle}>
            {isDoctor ? 'Switch to Patient Vault' : 'Switch to Doctor Workspace'}
          </Text>
          <Text style={styles.switchSubtitle}>
            {isDoctor
              ? 'View medication schedule, prescription viewer & patient consent'
              : 'Create prescriptions, manage patients & deliver WhatsApp care plans'}
          </Text>
        </View>
        <Text style={styles.switchArrow}>→</Text>
      </TouchableOpacity>

      {/* Clinical / Account Details */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account Credentials</Text>
        {isDoctor && (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Specialty:</Text>
              <Text style={styles.infoValue}>{(user as any).specialty || 'General Physician'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Clinic:</Text>
              <Text style={styles.infoValue}>{(user as any).clinic_name || 'Praxirence Centre'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reg Number:</Text>
              <Text style={styles.infoValue}>{(user as any).reg_number || 'NMC-2024-84920'}</Text>
            </View>
          </>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Mobile Number:</Text>
          <Text style={styles.infoValue}>{user.phone}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Cloud Vault:</Text>
          <Text style={styles.infoValue}>Railway Production (Live)</Text>
        </View>
      </View>

      {/* Emergency & Support Contacts */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Emergency Clinic Contacts</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Clinic Helpline:</Text>
          <Text style={styles.infoValue}>+91 98765 43210</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>WhatsApp Care Line:</Text>
          <Text style={styles.infoValue}>Meta Cloud API Active</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Encryption:</Text>
          <Text style={styles.infoValue}>AES-256 (At Rest & In Transit)</Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress}>
        <Text style={styles.logoutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginVertical: 18,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xxl,
    color: Colors.primary,
  },
  name: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    lineHeight: 26,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  phone: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: 'rgba(13, 148, 136, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  roleBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    letterSpacing: LetterSpacing.wider,
    color: Colors.primaryDark,
    textTransform: 'uppercase',
  },
  switchRoleCard: {
    backgroundColor: Colors.primarySurface,
    borderWidth: 1.5,
    borderColor: 'rgba(13, 148, 136, 0.35)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  switchIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  switchTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    letterSpacing: LetterSpacing.tight,
    color: Colors.primaryDark,
  },
  switchSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  switchArrow: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.bold,
    color: Colors.primaryDark,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  infoLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  logoutButton: {
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.25)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    fontFamily: FontFamily.bold,
    color: Colors.rose,
    fontSize: FontSize.base,
    letterSpacing: LetterSpacing.wide,
  },
});

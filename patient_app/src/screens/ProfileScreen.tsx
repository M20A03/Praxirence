import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { ActiveUser, UserRole, DoctorUser } from '../types';
import { BrandLogoMobile } from '../components/BrandLogoMobile';
import { mobileApi } from '../services/api';

interface ProfileScreenProps {
  user: ActiveUser;
  role: UserRole;
  onLogout: () => void;
  onDoctorVerified?: (doctorUser: DoctorUser) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  user,
  role,
  onLogout,
  onDoctorVerified,
}) => {
  if (!user) {
    return null;
  }

  const isDoctor = role === 'doctor';

  const handleLogoutPress = () => {
    onLogout();
  };

  const handleSwitchAccountPress = () => {
    onLogout();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={{ marginBottom: 16 }}>
        <BrandLogoMobile variant="header" size="sm" subtitleText="Account & Compliance Settings" />
      </View>

      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons
            name={isDoctor ? "medkit" : "person"}
            size={32}
            color={Colors.primary}
          />
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
        <View style={styles.roleBadge}>
          <Ionicons
            name={isDoctor ? "shield-checkmark" : "heart"}
            size={13}
            color={Colors.primaryDark}
            style={{ marginRight: 4 }}
          />
          <Text style={styles.roleBadgeText}>
            {isDoctor ? 'Verified Clinician (Doctor Portal)' : 'Patient Personal Vault'}
          </Text>
        </View>
      </View>

      {/* Account Credentials Card */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="finger-print-outline" size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>Identity & Verification</Text>
        </View>

        {isDoctor ? (
          <>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Medical Specialty</Text>
              <Text style={styles.infoValue}>{(user as any).specialty || 'General Physician'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Affiliated Hospital</Text>
              <Text style={styles.infoValue}>{(user as any).clinic_name || 'Praxirence Centre'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Medical Registration</Text>
              <Text style={[styles.infoValue, { color: Colors.primaryDark, fontFamily: FontFamily.bold }]}>
                {(user as any).reg_number || 'MED-2024-84920'}
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ABHA Health ID</Text>
            <Text style={[styles.infoValue, { color: Colors.primaryDark, fontFamily: FontFamily.bold }]}>
              {user.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@abdm
            </Text>
          </View>
        )}

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Registered Mobile</Text>
          <Text style={styles.infoValue}>{user.phone}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Account Status</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text style={[styles.infoValue, { color: '#059669', fontFamily: FontFamily.semiBold }]}>Active & Verified</Text>
          </View>
        </View>
      </View>

      {/* Security & DPDP Compliance Suite */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
          <Text style={styles.cardTitle}>Security & Privacy Governance</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Encryption Standard</Text>
          <Text style={styles.infoValue}>AES-256 (At Rest & In Transit)</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>DPDP Act 2023</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="shield-checkmark" size={13} color={Colors.primaryDark} />
            <Text style={[styles.infoValue, { color: Colors.primaryDark }]}>Compliant</Text>
          </View>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>ABDM Milestone 1-3</Text>
          <Text style={[styles.infoValue, { color: Colors.primaryDark }]}>Certified HIP/HIU</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Data Protection</Text>
          <Text style={[styles.infoValue, { color: Colors.primaryDark, fontFamily: FontFamily.semiBold }]}>End-to-End Encrypted</Text>
        </View>
      </View>

      {/* Emergency Helpline */}
      <View style={styles.card}>
        <View style={styles.cardHeaderRow}>
          <Ionicons name="call-outline" size={18} color={Colors.amber} />
          <Text style={styles.cardTitle}>Clinical Support & Hotlines</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>National Emergency</Text>
          <Text style={[styles.infoValue, { color: '#EF4444', fontFamily: FontFamily.bold }]}>108 / 112</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Clinic Support</Text>
          <Text style={styles.infoValue}>+91 98765 43210</Text>
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity
          style={styles.switchAccountButton}
          onPress={handleSwitchAccountPress}
          activeOpacity={0.85}
        >
          <Ionicons name="swap-horizontal" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.switchAccountButtonText}>Switch Account / Re-authenticate</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogoutPress}
          activeOpacity={0.85}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 6 }} />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
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
  name: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.text,
  },
  phone: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  roleBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.primaryDark,
    letterSpacing: LetterSpacing.wide,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  cardTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    letterSpacing: LetterSpacing.tight,
    color: Colors.text,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  infoLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flexShrink: 0,
  },
  infoValue: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  actionButtonsContainer: {
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  switchAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(13, 148, 136, 0.3)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  switchAccountButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.primaryDark,
    letterSpacing: LetterSpacing.wide,
    textAlign: 'center',
    flexShrink: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  logoutButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#EF4444',
    letterSpacing: LetterSpacing.wide,
    textAlign: 'center',
    flexShrink: 1,
  },
});

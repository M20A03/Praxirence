import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { DoctorUser, PatientUser } from '../types';
import { mobileApi } from '../services/api';
import { BrandLogoMobile } from '../components/BrandLogoMobile';

interface DoctorSearchScreenProps {
  user: PatientUser;
  onSelectDoctorForVisit?: (doctor: DoctorUser) => void;
  onOpenChatWithDoctor?: (doctorName: string) => void;
}

const SPECIALTY_FILTERS = [
  'All',
  'General Physician',
  'Cardiology',
  'Pediatrics',
  'Pulmonology',
  'Orthopedics',
];

export const DoctorSearchScreen: React.FC<DoctorSearchScreenProps> = ({
  user,
  onSelectDoctorForVisit,
  onOpenChatWithDoctor,
}) => {
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('All');

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const list = await mobileApi.getDoctors();
      setDoctors(list);
    } catch (err) {
      console.log('Error fetching doctor directory:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleBookConsultation = (doctor: DoctorUser) => {
    Alert.alert(
      'Book Clinical Encounter',
      `Would you like to initiate a consultation with ${doctor.name} (${doctor.specialty}) at ${doctor.clinic_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Booking',
          onPress: () => {
            Alert.alert(
              'Encounter Scheduled',
              `Your appointment request has been submitted to ${doctor.name}. Your care coordinator will verify and notify you via WhatsApp.`
            );
            if (onSelectDoctorForVisit) {
              onSelectDoctorForVisit(doctor);
            }
          },
        },
      ]
    );
  };

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch =
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.clinic_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesSpecialty =
      selectedSpecialty === 'All' ||
      doc.specialty.toLowerCase().includes(selectedSpecialty.toLowerCase());

    return matchesSearch && matchesSpecialty;
  });

  return (
    <View style={styles.container}>
      {/* Top Clinical Header with Brand Logo and Doctors Emblem */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <BrandLogoMobile variant="header" size="sm" subtitleText="Verified Clinician Directory" />
          <Image source={require('../../assets/features/doctors.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
        </View>
      </View>

      {/* Live Search Input Bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search doctors, specialty, hospital..."
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Specialty Filter Pills */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {SPECIALTY_FILTERS.map((specialty) => (
            <TouchableOpacity
              key={specialty}
              style={[
                styles.filterPill,
                selectedSpecialty === specialty && styles.filterPillActive,
              ]}
              onPress={() => setSelectedSpecialty(specialty)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedSpecialty === specialty && styles.filterPillTextActive,
                ]}
              >
                {specialty}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Verified Doctors Directory List */}
      <ScrollView
        style={styles.listScroll}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchDoctors();
            }}
            tintColor={Colors.primary}
          />
        }
      >
        <View style={styles.directoryStatusRow}>
          <Text style={styles.directoryCountText}>
            {filteredDoctors.length} {filteredDoctors.length === 1 ? 'Verified Doctor' : 'Verified Doctors'}
          </Text>
          <View style={styles.liveDbBadge}>
            <View style={styles.liveDbDot} />
            <Text style={styles.liveDbText}>Live Cloud Registry</Text>
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Fetching certified clinicians...</Text>
          </View>
        ) : filteredDoctors.length === 0 ? (
          <View style={styles.emptyCard}>
            <Image source={require('../../assets/features/doctors.png')} style={{ width: 64, height: 64, marginBottom: 16, opacity: 0.7 }} resizeMode="contain" />
            <Text style={styles.emptyTitle}>No Clinicians Found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your specialty filter or search keywords.
            </Text>
          </View>
        ) : (
          filteredDoctors.map((doc) => (
            <View key={doc.id} style={styles.doctorCard}>
              <View style={styles.doctorCardTop}>
                {/* Doctor Avatar with Emblem */}
                <View style={styles.doctorAvatarBox}>
                  <Image source={require('../../assets/features/doctors.png')} style={{ width: 38, height: 38 }} resizeMode="contain" />
                </View>

                {/* Doctor Info */}
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.doctorName}>{doc.name}</Text>
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={11} color={Colors.primary} style={{ marginRight: 3 }} />
                      <Text style={styles.verifiedBadgeText}>Verified</Text>
                    </View>
                  </View>

                  <Text style={styles.doctorSpecialty}>{doc.specialty}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Ionicons name="business-outline" size={13} color={Colors.textSecondary} />
                    <Text style={styles.doctorClinic}>{doc.clinic_name}</Text>
                  </View>
                  <Text style={styles.doctorReg}>Reg: {doc.reg_number}</Text>
                </View>
              </View>

              {/* Consultation Features & Booking Actions */}
              <View style={styles.doctorCardFooter}>
                <View style={styles.scheduleBadge}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
                    <Text style={styles.scheduleText}>Mon-Sat: 09:00 - 18:00</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.bookButton}
                  onPress={() => handleBookConsultation(doc)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name="calendar-outline" size={14} color="#ffffff" />
                    <Text style={styles.bookButtonText}>Book Encounter</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.text,
    padding: 0,
  },
  clearSearchIcon: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 4,
  },
  filtersWrapper: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: Colors.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  listScroll: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 28,
  },
  directoryStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  directoryCountText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: LetterSpacing.wide,
  },
  liveDbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  liveDbDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 5,
  },
  liveDbText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#059669',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  doctorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(13, 148, 136, 0.18)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  doctorCardTop: {
    flexDirection: 'row',
  },
  doctorAvatarBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(13, 148, 136, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(13, 148, 136, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  doctorAvatarText: {
    fontSize: 26,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  doctorName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    flex: 1,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: '#059669',
  },
  doctorSpecialty: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.caption,
    color: Colors.primary,
    marginBottom: 4,
  },
  doctorClinic: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.caption,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  doctorReg: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  doctorCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  scheduleBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scheduleText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  bookButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  bookButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
    color: '#FFFFFF',
  },
});

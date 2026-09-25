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
  Modal,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, LetterSpacing } from '../theme';
import { DoctorUser, PatientUser, DoctorSlot, DoctorAvailabilityResponse } from '../types';
import { mobileApi } from '../services/api';
import { BrandLogoMobile } from '../components/BrandLogoMobile';
import * as Location from 'expo-location';

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

const CITY_FILTERS = [
  'All Cities',
  'Bangalore',
  'Lucknow',
  'Kanpur',
  'Mysore',
  'Noida',
  'Varanasi',
  'Delhi',
  'Mumbai',
];

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Lucknow: { lat: 26.8467, lng: 80.9462 },
  Kanpur: { lat: 26.4499, lng: 80.3319 },
  Mysore: { lat: 12.2958, lng: 76.6394 },
  Noida: { lat: 28.5355, lng: 77.3910 },
  Varanasi: { lat: 25.3176, lng: 82.9739 },
  Delhi: { lat: 28.6139, lng: 77.2090 },
  Mumbai: { lat: 19.0760, lng: 72.8777 },
};

const SYMPTOM_QUICK_CHIPS = [
  'Fever & Chills',
  'Cough & Cold',
  'Routine Checkup',
  'BP & Sugar Check',
  'Joint Pain',
  'Follow-up Review',
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
  const [selectedCity, setSelectedCity] = useState<string>('All Cities');
  const [isNearbyOnly, setIsNearbyOnly] = useState<boolean>(false);

  // Booking Modal State
  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorUser | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [availability, setAvailability] = useState<DoctorAvailabilityResponse | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [bookingType, setBookingType] = useState<'in_person' | 'video' | 'chat'>('in_person');
  const [chiefComplaint, setChiefComplaint] = useState<string>('');
  const [bookingInProgress, setBookingInProgress] = useState<boolean>(false);

  // Booking Confirmation Modal State
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [confirmedBookingData, setConfirmedBookingData] = useState<any>(null);

  // Dynamic device GPS coordinates
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locatingUser, setLocatingUser] = useState<boolean>(false);

  useEffect(() => {
    fetchDoctors();
  }, [selectedSpecialty, selectedCity, isNearbyOnly]);

  useEffect(() => {
    const onBackPress = () => {
      if (showSuccessModal) {
        setShowSuccessModal(false);
        return true;
      }
      if (showBookingModal) {
        setShowBookingModal(false);
        return true;
      }
      return false;
    };
    const backSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backSub.remove();
  }, [showSuccessModal, showBookingModal]);

  const acquireDeviceLocation = async (): Promise<{ lat: number; lng: number }> => {
    try {
      setLocatingUser(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (pos && pos.coords) {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setDeviceCoords(coords);
          return coords;
        }
      }
    } catch (e) {
      console.log('GPS location acquisition notice, using regional fallback:', e);
    } finally {
      setLocatingUser(false);
    }

    if (selectedCity && CITY_COORDINATES[selectedCity]) {
      return CITY_COORDINATES[selectedCity];
    }
    return CITY_COORDINATES['Bangalore'];
  };

  const handleToggleNearby = async () => {
    const nextVal = !isNearbyOnly;
    setIsNearbyOnly(nextVal);
    if (nextVal && !deviceCoords) {
      await acquireDeviceLocation();
    }
  };

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (selectedSpecialty !== 'All') params.specialty = selectedSpecialty;
      if (selectedCity !== 'All Cities') params.city = selectedCity;
      if (isNearbyOnly) {
        const coords = deviceCoords || (await acquireDeviceLocation());
        params.lat = coords.lat;
        params.lng = coords.lng;
        params.radius_km = 50; // within 50km
      }
      const list = await mobileApi.getDoctors(params);
      setDoctors(list);
    } catch (err) {
      console.log('Error fetching doctor directory:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generate14Days = () => {
    const days = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const dayName = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      days.push({ iso, dayName, dayNum, monthName });
    }
    return days;
  };

  const handleOpenBookingModal = async (doctor: DoctorUser) => {
    setSelectedDoctor(doctor);
    const todayIso = new Date().toISOString().split('T')[0];
    setSelectedDate(todayIso);
    setSelectedSlot('');
    setChiefComplaint('');
    setShowBookingModal(true);
    await loadDoctorSlots(doctor.id, todayIso);
  };

  const loadDoctorSlots = async (doctorId: string, dateStr: string) => {
    setLoadingAvailability(true);
    try {
      const avail = await mobileApi.getDoctorAvailability(doctorId, dateStr);
      setAvailability(avail);
      // Auto-select first available slot
      const firstOpen = avail.slots.find((s) => s.available);
      if (firstOpen) {
        setSelectedSlot(firstOpen.time);
      } else {
        setSelectedSlot('');
      }
    } catch (e) {
      console.warn('Error loading doctor availability:', e);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const handleSelectDate = async (isoDate: string) => {
    setSelectedDate(isoDate);
    setSelectedSlot('');
    if (selectedDoctor) {
      await loadDoctorSlots(selectedDoctor.id, isoDate);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedDoctor) return;
    if (!selectedSlot) {
      Alert.alert('Select Slot', 'Please choose an available appointment time slot.');
      return;
    }

    setBookingInProgress(true);
    try {
      const res = await mobileApi.bookAppointmentSlot({
        doctor_id: selectedDoctor.id,
        patient_id: user.id || 'pat-default-01',
        appointment_date: selectedDate,
        time_slot: selectedSlot,
        chief_complaint: chiefComplaint || 'Clinical Consultation Assessment',
        booking_type: bookingType,
      });

      setShowBookingModal(false);
      setConfirmedBookingData({
        ...res.appointment,
        token_number: res.token_number || res.appointment?.token_number || 1,
        token_display: res.token_display || res.appointment?.token_display || 'PX-01',
        patients_ahead: res.patients_ahead ?? res.appointment?.patients_ahead ?? 0,
        estimated_wait_mins: res.estimated_wait_mins ?? res.appointment?.estimated_wait_mins ?? 0,
      });
      setShowSuccessModal(true);

      if (onSelectDoctorForVisit) {
        onSelectDoctorForVisit(selectedDoctor);
      }
    } catch (err: any) {
      Alert.alert('Booking Notice', err.message || 'Could not confirm booking. Please try another slot.');
    } finally {
      setBookingInProgress(false);
    }
  };

  const filteredDoctors = doctors.filter((doc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (doc.name || '').toLowerCase().includes(q) ||
      (doc.specialty || '').toLowerCase().includes(q) ||
      (doc.clinic_name || '').toLowerCase().includes(q) ||
      (doc.city && doc.city.toLowerCase().includes(q)) ||
      (doc.clinic_address && doc.clinic_address.toLowerCase().includes(q))
    );
  });

  const fourteenDays = generate14Days();
  const morningSlots = availability?.slots.filter((s) => (s?.time || '').includes('AM')) || [];
  const afternoonSlots = availability?.slots.filter((s) => (s?.time || '').includes('PM')) || [];

  return (
    <View style={styles.container}>
      {/* Top Clinical Header with Brand Logo and Verified Clinicians Badge */}
      <View style={styles.topHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <BrandLogoMobile variant="header" size="sm" subtitleText="Verified Clinician Directory & Scheduling" />
          <Image source={require('../../assets/features/doctors.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
        </View>
      </View>

      {/* Live Search Input Bar */}
      <View style={styles.searchBarWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search doctor, specialty, city, hospital..."
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

      {/* Geolocation & Nearby Proximity Filter Strip */}
      <View style={styles.locationBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.locationScroll}>
          {/* Nearby Toggle Button */}
          <TouchableOpacity
            style={[styles.nearbyPill, isNearbyOnly && styles.nearbyPillActive]}
            onPress={handleToggleNearby}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isNearbyOnly ? "navigate" : "navigate-outline"}
              size={13}
              color={isNearbyOnly ? '#FFFFFF' : Colors.primaryDark}
            />
            <Text style={[styles.nearbyPillText, isNearbyOnly && styles.nearbyPillTextActive]}>
              Nearby Doctors (GPS)
            </Text>
          </TouchableOpacity>

          {/* City Selector Pills */}
          {CITY_FILTERS.map((city) => (
            <TouchableOpacity
              key={city}
              style={[
                styles.cityPill,
                selectedCity === city && !isNearbyOnly && styles.cityPillActive,
              ]}
              onPress={() => {
                setIsNearbyOnly(false);
                setSelectedCity(city);
              }}
            >
              <Text
                style={[
                  styles.cityPillText,
                  selectedCity === city && !isNearbyOnly && styles.cityPillTextActive,
                ]}
              >
                {city}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
            {isNearbyOnly ? ' Nearby' : selectedCity !== 'All Cities' ? ` in ${selectedCity}` : ''}
          </Text>
          <View style={styles.liveDbBadge}>
            <View style={styles.liveDbDot} />
            <Text style={styles.liveDbText}>Live Cloud Registry</Text>
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Fetching certified clinicians & practice slots...</Text>
          </View>
        ) : filteredDoctors.length === 0 ? (
          <View style={styles.emptyCard}>
            <Image source={require('../../assets/features/doctors.png')} style={{ width: 64, height: 64, marginBottom: 16, opacity: 0.7 }} resizeMode="contain" />
            <Text style={styles.emptyTitle}>No Clinicians Found</Text>
            <Text style={styles.emptySubtitle}>
              Try adjusting your city filter, radius, or search keywords.
            </Text>
          </View>
        ) : (
          filteredDoctors.map((doc) => {
            const isAvailToday = doc.is_available_today !== false;
            return (
              <View key={doc.id} style={styles.doctorCard}>
                <View style={styles.doctorCardTop}>
                  {/* Doctor Avatar with Emblem */}
                  <View style={styles.doctorAvatarBox}>
                    <Image source={require('../../assets/features/doctors.png')} style={{ width: 38, height: 38 }} resizeMode="contain" />
                  </View>

                  {/* Doctor Info */}
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.doctorName}>
                        {doc.name.startsWith('Dr.') ? doc.name : `Dr. ${doc.name}`}
                      </Text>
                      <Ionicons name="checkmark-circle" size={15} color="#0284C7" />
                    </View>

                    {/* Medical Degree - Clean Typography */}
                    <Text style={styles.doctorDegreeText} numberOfLines={1}>
                      {doc.degree || 'MBBS, MD (General Medicine)'}
                    </Text>

                    {/* Clinical Designation & Specialty */}
                    <Text style={styles.doctorDesignation}>
                      {doc.designation || 'Senior Consultant'} • {doc.specialty}
                    </Text>

                    {/* Clinic & Location Details */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <Ionicons name="business-outline" size={13} color={Colors.textSecondary} />
                      <Text style={styles.doctorClinic} numberOfLines={1}>{doc.clinic_name}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Ionicons name="location-outline" size={13} color={Colors.primary} />
                      <Text style={styles.doctorAddress} numberOfLines={1}>
                        {doc.clinic_address || 'Clinic Centre'}, {doc.city || 'Bangalore'}
                      </Text>
                    </View>

                    {/* Distance, Experience & Fee Row */}
                    <View style={styles.badgesRow}>
                      <View style={styles.experienceBadge}>
                        <Ionicons name="star" size={10} color="#D97706" />
                        <Text style={styles.experienceBadgeText}>
                          {doc.experience_years ? (typeof doc.experience_years === 'number' ? `${doc.experience_years}+ Yrs` : doc.experience_years) : '12+ Yrs'}
                        </Text>
                      </View>

                      {doc.distance_km !== undefined && doc.distance_km !== null && (
                        <View style={styles.distanceBadge}>
                          <Ionicons name="pin" size={10} color="#0284C7" />
                          <Text style={styles.distanceBadgeText}>{doc.distance_km} km away</Text>
                        </View>
                      )}

                      <View style={[styles.availabilityBadge, isAvailToday ? styles.availGreen : styles.availAmber]}>
                        <View style={[styles.availDot, isAvailToday ? { backgroundColor: '#10B981' } : { backgroundColor: '#F59E0B' }]} />
                        <Text style={[styles.availText, isAvailToday ? { color: '#047857' } : { color: '#B45309' }]}>
                          {isAvailToday ? 'Available Today' : 'On Leave Today'}
                        </Text>
                      </View>

                      <View style={styles.feeBadge}>
                        <Text style={styles.feeBadgeText}>₹{doc.consultation_fee || 500}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Consultation Hours & Direct Time-Slot Booking */}
                <View style={styles.doctorCardFooter}>
                  <View style={styles.scheduleBadge}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="time-outline" size={13} color={Colors.textSecondary} />
                      <Text style={styles.scheduleText}>
                        {doc.working_hours_start || '09:00'} - {doc.working_hours_end || '18:00'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.bookButton}
                    onPress={() => handleOpenBookingModal(doc)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="calendar-outline" size={14} color="#ffffff" />
                      <Text style={styles.bookButtonText}>Book Slot</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ==================== STEP-BY-STEP TIME-SLOT BOOKING MODAL ==================== */}
      <Modal
        visible={showBookingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBookingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            {/* Modal Drag Handle & Header */}
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sheetDoctorName}>
                    {selectedDoctor?.name?.startsWith('Dr.') ? selectedDoctor.name : `Dr. ${selectedDoctor?.name}`}
                  </Text>
                  <Ionicons name="checkmark-circle" size={17} color="#0284C7" />
                </View>
                {/* Degree - Clean Typography */}
                <Text style={styles.sheetDegreeText}>
                  {selectedDoctor?.degree || 'MBBS, MD (General Medicine)'}
                </Text>
                <Text style={styles.sheetSpecialtyText}>
                  {selectedDoctor?.designation || 'Senior Consultant'} • {selectedDoctor?.specialty}
                </Text>
                <Text style={styles.sheetClinicText}>
                  {selectedDoctor?.clinic_name} • NMC: {selectedDoctor?.reg_number}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
                  <Text style={styles.sheetAddressText}>
                    {selectedDoctor?.clinic_address}, {selectedDoctor?.city}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.closeSheetBtn}
                onPress={() => setShowBookingModal(false)}
              >
                <Ionicons name="close" size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              {/* STEP 1: 14-DAY CALENDAR DATE SELECTOR */}
              <View style={styles.stepSection}>
                <View style={styles.stepHeaderRow}>
                  <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>1</Text></View>
                  <Text style={styles.stepTitle}>Select Date / तारीख चुनें</Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.calendarStrip}>
                  {fourteenDays.map((d) => {
                    const isSelected = selectedDate === d.iso;
                    return (
                      <TouchableOpacity
                        key={d.iso}
                        style={[styles.dateCard, isSelected && styles.dateCardActive]}
                        onPress={() => handleSelectDate(d.iso)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dateCardDay, isSelected && styles.dateCardDayActive]}>{d.dayName}</Text>
                        <Text style={[styles.dateCardNum, isSelected && styles.dateCardNumActive]}>{d.dayNum}</Text>
                        <Text style={[styles.dateCardMonth, isSelected && styles.dateCardMonthActive]}>{d.monthName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* LIVE AVAILABILITY WARNING / LEAVE BANNER */}
              {loadingAvailability ? (
                <View style={{ paddingVertical: 18, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, marginTop: 6 }}>
                    Checking clinician leave calendar and live slots...
                  </Text>
                </View>
              ) : availability && !availability.is_available ? (
                <View style={styles.leaveAlertCard}>
                  <Ionicons name="alert-circle" size={22} color="#D97706" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.leaveAlertTitle}>Clinician Unavailable / अवकाश पर हैं</Text>
                    <Text style={styles.leaveAlertDesc}>
                      {availability.reason || 'Doctor is not available on this date.'} Please select another day above.
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  {/* STEP 2: TIME SLOTS GRID */}
                  <View style={styles.stepSection}>
                    <View style={styles.stepHeaderRow}>
                      <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>2</Text></View>
                      <Text style={styles.stepTitle}>Select Time Slot / समय चुनें</Text>
                    </View>

                    {/* Morning Slots */}
                    {morningSlots.length > 0 && (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={styles.slotGroupTitle}>Morning Session (सुबह)</Text>
                        <View style={styles.slotsGrid}>
                          {morningSlots.map((slot) => {
                            const isSelected = selectedSlot === slot.time;
                            const isBooked = !slot.available;
                            return (
                              <TouchableOpacity
                                key={slot.time}
                                style={[
                                  styles.slotPill,
                                  isSelected && styles.slotPillSelected,
                                  isBooked && styles.slotPillBooked,
                                ]}
                                onPress={() => !isBooked && setSelectedSlot(slot.time)}
                                disabled={isBooked}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.slotPillText,
                                    isSelected && styles.slotPillTextSelected,
                                    isBooked && styles.slotPillTextBooked,
                                  ]}
                                >
                                  {slot.time}
                                </Text>
                                {isBooked && <Text style={styles.bookedTag}>Booked</Text>}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Afternoon Slots */}
                    {afternoonSlots.length > 0 && (
                      <View style={{ marginBottom: 8 }}>
                        <Text style={styles.slotGroupTitle}>Afternoon & Evening (दोपहर / शाम)</Text>
                        <View style={styles.slotsGrid}>
                          {afternoonSlots.map((slot) => {
                            const isSelected = selectedSlot === slot.time;
                            const isBooked = !slot.available;
                            return (
                              <TouchableOpacity
                                key={slot.time}
                                style={[
                                  styles.slotPill,
                                  isSelected && styles.slotPillSelected,
                                  isBooked && styles.slotPillBooked,
                                ]}
                                onPress={() => !isBooked && setSelectedSlot(slot.time)}
                                disabled={isBooked}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.slotPillText,
                                    isSelected && styles.slotPillTextSelected,
                                    isBooked && styles.slotPillTextBooked,
                                  ]}
                                >
                                  {slot.time}
                                </Text>
                                {isBooked && <Text style={styles.bookedTag}>Booked</Text>}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>

                  {/* STEP 3: CONSULTATION MODE & SYMPTOMS */}
                  <View style={styles.stepSection}>
                    <View style={styles.stepHeaderRow}>
                      <View style={styles.stepNumberBadge}><Text style={styles.stepNumberText}>3</Text></View>
                      <Text style={styles.stepTitle}>Visit Type & Symptoms / लक्षण</Text>
                    </View>

                    {/* Consultation Type Selector */}
                    <View style={styles.consultTypeRow}>
                      {[
                        { id: 'in_person', label: 'In-Person Clinic', icon: 'business-outline' },
                        { id: 'video', label: 'Video Call', icon: 'videocam-outline' },
                        { id: 'chat', label: 'Chat Triage', icon: 'chatbubbles-outline' },
                      ].map((t) => (
                        <TouchableOpacity
                          key={t.id}
                          style={[styles.consultTypeBtn, bookingType === t.id && styles.consultTypeBtnActive]}
                          onPress={() => setBookingType(t.id as any)}
                          activeOpacity={0.7}
                        >
                          <Ionicons
                            name={t.icon as any}
                            size={14}
                            color={bookingType === t.id ? '#FFFFFF' : Colors.textPrimary}
                          />
                          <Text style={[styles.consultTypeBtnText, bookingType === t.id && styles.consultTypeBtnTextActive]}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Quick Symptom Chips */}
                    <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 }}>
                      Common Chief Complaints:
                    </Text>
                    <View style={styles.symptomChipsRow}>
                      {SYMPTOM_QUICK_CHIPS.map((chip) => {
                        const isChosen = chiefComplaint === chip;
                        return (
                          <TouchableOpacity
                            key={chip}
                            style={[styles.symptomChip, isChosen && styles.symptomChipActive]}
                            onPress={() => setChiefComplaint(chip)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.symptomChipText, isChosen && styles.symptomChipTextActive]}>
                              {chip}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Custom Notes Input */}
                    <TextInput
                      style={styles.complaintInput}
                      placeholder="Enter specific symptoms or notes for the doctor..."
                      placeholderTextColor={Colors.textSecondary}
                      value={chiefComplaint}
                      onChangeText={setChiefComplaint}
                    />
                  </View>
                </>
              )}
            </ScrollView>

            {/* CONFIRM BOOKING BOTTOM ACTION BAR */}
            <View style={styles.modalFooter}>
              <View>
                <Text style={styles.feeLabel}>Consultation Fee</Text>
                <Text style={styles.feeValue}>₹{selectedDoctor?.consultation_fee || 500}</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  (!selectedSlot || (availability && !availability.is_available) || bookingInProgress) && { opacity: 0.5 },
                ]}
                onPress={handleConfirmBooking}
                disabled={!selectedSlot || (availability && !availability.is_available) || bookingInProgress}
                activeOpacity={0.8}
              >
                {bookingInProgress ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="checkmark-done" size={16} color="#ffffff" />
                    <Text style={styles.confirmBtnText}>Confirm Slot & Book</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================== ENCOUNTER CONFIRMED POPUP MODAL ==================== */}
      <Modal
        visible={showSuccessModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark-circle" size={44} color="#059669" />
            </View>

            <Text style={styles.successTitle}>Encounter Reserved!</Text>
            <Text style={styles.successSubtitle}>
              Your appointment has been confirmed in the cloud clinical schedule.
            </Text>

            {/* Live OPD Queue Token & Position Banner */}
            <View style={styles.tokenHighlightBox}>
              <View style={styles.tokenHighlightHeader}>
                <Ionicons name="receipt-outline" size={15} color={Colors.primary} />
                <Text style={styles.tokenHighlightTitle}>OPD CLINIC TOKEN</Text>
              </View>
              <Text style={styles.tokenHighlightNumber}>
                {confirmedBookingData?.token_display || `PX-${(confirmedBookingData?.token_number || 1).toString().padStart(2, '0')}`}
              </Text>
              <View style={styles.queueStatsPillsRow}>
                <View style={styles.queueStatsPill}>
                  <Ionicons name="people" size={12} color="#0284C7" />
                  <Text style={styles.queueStatsPillText}>
                    {confirmedBookingData?.patients_ahead && confirmedBookingData.patients_ahead > 0
                      ? `${confirmedBookingData.patients_ahead} patient${confirmedBookingData.patients_ahead > 1 ? 's' : ''} ahead`
                      : 'First in queue'}
                  </Text>
                </View>
                <View style={[styles.queueStatsPill, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="time" size={12} color="#D97706" />
                  <Text style={[styles.queueStatsPillText, { color: '#B45309' }]}>
                    {confirmedBookingData?.estimated_wait_mins && confirmedBookingData.estimated_wait_mins > 0
                      ? `~${confirmedBookingData.estimated_wait_mins}m wait`
                      : 'No wait'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.bookingSummaryBox}>
              <View style={styles.summaryRow}>
                <Ionicons name="person-outline" size={14} color={Colors.primary} />
                <Text style={styles.summaryLabel}>Doctor:</Text>
                <Text style={styles.summaryValue}>{confirmedBookingData?.doctor_name}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                <Text style={styles.summaryLabel}>Date & Time:</Text>
                <Text style={styles.summaryValue}>
                  {confirmedBookingData?.appointment_date} at {confirmedBookingData?.time_slot}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Ionicons name="location-outline" size={14} color={Colors.primary} />
                <Text style={styles.summaryLabel}>Clinic Address:</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {confirmedBookingData?.clinic_address}
                </Text>
              </View>
            </View>

            <View style={styles.confirmationNoticeBox}>
              <Ionicons name="checkmark-done-circle" size={16} color="#16A34A" />
              <Text style={styles.confirmationNoticeText}>
                Instant confirmation and token active in your Praxirence Care Vault
              </Text>
            </View>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => setShowSuccessModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.doneBtnText}>View in My Care Visits</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.body,
    color: Colors.text,
    padding: 0,
  },
  locationBarWrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  locationScroll: {
    paddingHorizontal: 16,
    gap: 8,
    alignItems: 'center',
  },
  nearbyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: '#7DD3FC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  nearbyPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  nearbyPillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.primaryDark,
  },
  nearbyPillTextActive: {
    color: '#FFFFFF',
  },
  cityPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cityPillActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  cityPillText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  cityPillTextActive: {
    color: '#FFFFFF',
  },
  filtersWrapper: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 32,
  },
  directoryStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  directoryCountText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  liveDbBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  liveDbDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveDbText: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: '#16A34A',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  doctorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  doctorCardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  doctorAvatarBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  doctorName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.text,
    flex: 1,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 9,
    color: Colors.primaryDark,
  },
  doctorSpecialty: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#64748B',
  },
  doctorDegreeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11.5,
    color: '#334155',
    marginTop: 2,
    marginBottom: 2,
  },
  doctorDesignation: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: '#0284C7',
    marginTop: 1,
  },
  doctorClinic: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  doctorAddress: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  distanceBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#0284C7',
  },
  experienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  experienceBadgeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#92400E',
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  availGreen: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  availAmber: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  availDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  availText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
  },
  feeBadge: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  feeBadgeText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.textPrimary,
  },
  doctorCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  scheduleBadge: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  scheduleText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  bookButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bookButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
  },

  // MODAL BOTTOM SHEET
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    marginBottom: 12,
  },
  sheetDoctorName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
  },
  sheetDegreeText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
    marginBottom: 2,
  },
  sheetClinicText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#475569',
    marginTop: 1,
  },
  sheetSpecialtyText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primaryDark,
    marginTop: 1,
  },
  sheetAddressText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeSheetBtn: {
    padding: 4,
  },
  stepSection: {
    marginBottom: 16,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  stepNumberBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  stepTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  calendarStrip: {
    gap: 8,
    paddingVertical: 2,
  },
  dateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 56,
  },
  dateCardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dateCardDay: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  dateCardDayActive: {
    color: '#FFFFFF',
  },
  dateCardNum: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.body,
    color: Colors.text,
    marginVertical: 2,
  },
  dateCardNumActive: {
    color: '#FFFFFF',
  },
  dateCardMonth: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  dateCardMonthActive: {
    color: '#FFFFFF',
  },
  leaveAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  leaveAlertTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#92400E',
  },
  leaveAlertDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 15,
  },
  slotGroupTitle: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  slotPillSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  slotPillBooked: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  slotPillText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textPrimary,
  },
  slotPillTextSelected: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  slotPillTextBooked: {
    color: '#94A3B8',
    textDecorationLine: 'line-through',
  },
  bookedTag: {
    fontSize: 8,
    color: '#EF4444',
    fontWeight: '700',
    marginTop: 1,
  },
  consultTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  consultTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  consultTypeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  consultTypeBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.textPrimary,
  },
  consultTypeBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  symptomChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  symptomChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  symptomChipActive: {
    backgroundColor: '#CCFBF1',
    borderColor: Colors.primary,
  },
  symptomChipText: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.textSecondary,
  },
  symptomChipTextActive: {
    color: Colors.primaryDark,
    fontFamily: FontFamily.bold,
  },
  complaintInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.text,
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 10,
  },
  feeLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    color: Colors.textSecondary,
  },
  feeValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: '#FFFFFF',
  },

  // SUCCESS ENCOUNTER MODAL
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    marginHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  successIconCircle: {
    marginBottom: 12,
  },
  successTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'center',
  },
  successSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    marginBottom: 16,
  },
  tokenHighlightBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  tokenHighlightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tokenHighlightTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 1,
  },
  tokenHighlightNumber: {
    fontFamily: FontFamily.bold,
    fontSize: 28,
    color: '#15803D',
    letterSpacing: 1.5,
    marginVertical: 4,
  },
  queueStatsPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  queueStatsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  queueStatsPillText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    color: '#0369A1',
  },
  bookingSummaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  summaryLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    color: Colors.textSecondary,
    width: 90,
  },
  summaryValue: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    color: Colors.text,
    flex: 1,
  },
  confirmationNoticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
    width: '100%',
  },
  confirmationNoticeText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: '#15803D',
    flex: 1,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  doneBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
    color: '#FFFFFF',
  },
});

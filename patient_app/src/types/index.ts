export type UserRole = 'doctor' | 'patient';

export interface DoctorUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialty: string;
  clinic_name: string;
  reg_number: string;
  role: 'doctor';
  degree?: string; // e.g. "MBBS, MD (Medicine), DNB"
  qualifications?: string; // e.g. "Fellowship in Internal Medicine & Diabetology"
  experience_years?: number | string; // e.g. "12+ Yrs Exp"
  languages?: string[]; // e.g. ["English", "Hindi", "Hinglish"]
  designation?: string; // e.g. "Senior Consultant Physician"
  city?: string;
  state?: string;
  pincode?: string;
  clinic_address?: string;
  latitude?: number;
  longitude?: number;
  distance_km?: number;
  available_days?: string[];
  working_hours_start?: string;
  working_hours_end?: string;
  slot_duration_mins?: number;
  unavailable_dates?: string[];
  consultation_fee?: number;
  is_available_today?: boolean;
}

export interface DoctorSlot {
  time: string;
  available: boolean;
  reason?: string;
}

export interface DoctorAvailabilityResponse {
  doctor_id: string;
  doctor_name: string;
  date: string;
  day_of_week: string;
  is_available: boolean;
  reason?: string;
  working_hours: {
    start: string;
    end: string;
    slot_duration_mins?: number;
  };
  slots: DoctorSlot[];
  total_slots: number;
  available_slots_count: number;
}

export interface BookAppointmentSlotRequest {
  doctor_id: string;
  patient_id: string;
  appointment_date: string; // YYYY-MM-DD
  time_slot: string; // e.g. "10:30 AM"
  chief_complaint?: string;
  booking_type?: 'in_person' | 'video' | 'chat';
}

export interface BookAppointmentSlotResponse {
  success: boolean;
  visit_id: string;
  message: string;
  status: string;
  token_number?: number;
  token_display?: string;
  patients_ahead?: number;
  estimated_wait_mins?: number;
  appointment: {
    id: string;
    doctor_id: string;
    doctor_name: string;
    doctor_specialty: string;
    clinic_name: string;
    clinic_address: string;
    patient_id: string;
    patient_name: string;
    appointment_date: string;
    time_slot: string;
    booking_type: string;
    chief_complaint?: string;
    token_number?: number;
    token_display?: string;
    patients_ahead?: number;
    estimated_wait_mins?: number;
    status: string;
  };
}

export interface QueueStatusResponse {
  visit_id: string;
  doctor_id: string;
  doctor_name: string;
  patient_id: string;
  patient_name: string;
  appointment_date: string;
  time_slot: string;
  token_number: number;
  token_display: string;
  current_serving_token?: string;
  current_serving_token_number?: number;
  patients_ahead: number;
  estimated_wait_mins: number;
  status: string;
  clinic_name?: string;
  clinic_address?: string;
  doctor_delay_mins?: number;
  recommended_departure_time?: string;
  triage?: string;
}

export interface PatientUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  age?: number | string;
  gender?: string;
  language?: string;
  emergency_contact?: string;
  consent_status: boolean;
  consent_updated_at?: string;
  role?: 'patient';
  family_relation?: string;
}

export type ActiveUser = DoctorUser | PatientUser;

export interface FamilyMemberProfile {
  id: string;
  name: string;
  dob?: string;
  family_relation: string;
  phone?: string;
  is_primary?: boolean;
}

export interface PatientSummary {
  id: string;
  name: string;
  phone: string;
  consent_status: boolean;
  role: 'patient';
  created_at?: string;
}

export interface MedicineItem {
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  duration_days?: number;
  meal_relation?: 'before_meal' | 'after_meal' | 'empty_stomach' | 'with_meal';
  is_sos?: boolean;
}

export interface ReminderItem {
  medicine_name: string;
  dosage: string;
  time: string; // 24h format e.g. 08:30
  frequency: string;
  instructions?: string;
  meal_relation?: 'before_meal' | 'after_meal' | 'empty_stomach' | 'with_meal';
  is_sos?: boolean;
}

export interface Visit {
  id: string;
  patient_id: string;
  doctor_id?: string;
  date: string;
  diagnosis?: string;
  patient_summary?: string;
  doctor_advice?: string;
  raw_transcription?: string;
  medicines: MedicineItem[];
  reminders: ReminderItem[];
  status: 'scheduled' | 'draft' | 'approved' | 'sent' | 'completed' | 'cancelled' | 'in_progress' | 'reschedule_required' | 'deferred' | 'skipped';
  doctor_name?: string;
  specialty?: string;
  clinic_name?: string;
  clinic_address?: string;
  created_at?: string;
  patient_name?: string;
  patient_phone?: string;
  appointment_date?: string;
  time_slot?: string;
  booking_type?: string;
  chief_complaint?: string;
  token_number?: number;
  token_display?: string;
  patients_ahead?: number;
  estimated_wait_mins?: number;
  signature_hash?: string;
  approved_at?: string;
}

export interface ConsultationSummarizeResult {
  patient_summary: string;
  doctor_advice: string;
  warning_signs: string[];
  diagnosis: string;
  medicines: MedicineItem[];
  reminders: ReminderItem[];
  follow_up_days?: number;
}

export interface ConsentDocument {
  title: string;
  version: string;
  summary: string;
  bullet_points: string[];
  plain_language_text: string;
  consent_status: boolean;
  consent_updated_at?: string;
}

export interface VitalsRecord {
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  heartRate: number;
  spo2: number;
  bloodSugar?: number;
  recordedAt: string;
  statusNote?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  language?: string;
  medicinesReferenced?: MedicineItem[];
  recommendedDoctors?: {
    id: string;
    name: string;
    specialty: string;
    clinic_name: string;
    reg_number: string;
    phone?: string;
  }[];
  quickSuggestions?: string[];
}


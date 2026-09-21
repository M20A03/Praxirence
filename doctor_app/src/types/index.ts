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
  city?: string;
  state?: string;
  pincode?: string;
  clinic_address?: string;
  latitude?: number;
  longitude?: number;
  available_days?: string[];
  working_hours_start?: string;
  working_hours_end?: string;
  slot_duration_mins?: number;
  unavailable_dates?: string[];
  consultation_fee?: number;
  is_available_today?: boolean;
  current_delay_mins?: number;
  delay_updated_at?: string;
}

export interface DoctorScheduleConfig {
  available_days: string[];
  working_hours_start: string;
  working_hours_end: string;
  slot_duration_mins: number;
  unavailable_dates: string[];
  clinic_address?: string;
  city?: string;
  consultation_fee?: number;
}

export interface PatientUser {
  id: string;
  name: string;
  phone: string;
  consent_status: boolean;
  consent_updated_at?: string;
  role?: 'patient';
}

export type ActiveUser = DoctorUser | PatientUser;

export interface PatientSummary {
  id: string;
  name: string;
  phone: string;
  consent_status: boolean;
  role: 'patient';
  created_at?: string;
  age?: number | string;
  gender?: string;
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
  status: 'draft' | 'approved' | 'sent' | 'scheduled' | 'in_progress' | 'completed' | 'deferred' | 'skipped' | 'reschedule_required';
  doctor_name?: string;
  patient_name?: string;
  patient_phone?: string;
  token_number?: number;
  token_display?: string;
  skip_count?: number;
  signature_hash?: string;
  retention_until?: string;
}

export interface ConsultationSummarizeResult {
  patient_summary: string;
  doctor_advice: string;
  warning_signs: string[];
  diagnosis: string;
  medicines: MedicineItem[];
  reminders: ReminderItem[];
  follow_up_days?: number;
  conversation?: string;
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

export interface UpcomingScheduleItem {
  token: string;
  token_number?: number;
  visit_id?: string;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  time: string;
  appointment_date?: string;
  chief_complaint: string;
  triage: 'Urgent' | 'Priority' | 'Routine' | string;
  status: 'Waiting in Clinic' | 'In Waiting Room' | 'Scheduled Today' | 'Follow-Up Visit' | 'In Consultation' | string;
  dob?: string;
  consent_status?: boolean;
  skip_count?: number;
}

export interface UpcomingScheduleResponse {
  date: string;
  doctor_name: string;
  total_scheduled: number;
  in_waiting: number;
  completed?: number;
  queue: UpcomingScheduleItem[];
}

export interface CallNextPatientResponse {
  success: boolean;
  message: string;
  completed_visit_id?: string;
  serving_visit_id?: string;
  token_called?: string;
  patient_name?: string;
  patient_phone?: string;
  remaining_in_queue?: number;
}


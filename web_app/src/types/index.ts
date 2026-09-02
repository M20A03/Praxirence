export interface DoctorUser {
  id: string;
  email: string;
  name: string;
  specialty?: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  dob?: string;
  consent_status: boolean;
  consent_updated_at?: string;
  created_at: string;
}

export interface MedicineItem {
  name: string;
  dosage: string;
  frequency: string;
  instructions?: string;
  duration_days?: number;
}

export interface ReminderItem {
  medicine_name: string;
  dosage: string;
  time: string; // 24-hour time HH:MM
  frequency: string;
  instructions?: string;
}

export interface Visit {
  id: string;
  patient_id: string;
  doctor_id?: string;
  date: string;
  audio_file_path?: string;
  keep_recording: boolean;
  raw_transcription?: string;
  diagnosis?: string;
  medicines: MedicineItem[];
  reminders: ReminderItem[];
  status: 'draft' | 'approved' | 'sent';
  approved_at?: string;
  whatsapp_message_id?: string;
  created_at: string;
  patient_name?: string;
  patient_phone?: string;
  doctor_name?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: string;
  user: DoctorUser;
}

export interface VisitApproveResponse {
  visit_id: string;
  status: string;
  whatsapp_status: string;
  scheduled_reminders_count: number;
  message: string;
}

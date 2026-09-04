export interface DoctorUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  specialty?: string;
  clinic_name?: string;
  reg_number?: string;
}

export interface PatientUser {
  id: string;
  name: string;
  phone: string;
  consent_status: boolean;
  consent_updated_at?: string;
}

export interface DirectoryAccount {
  id: string;
  name: string;
  email?: string;
  phone: string;
  role: 'doctor' | 'patient';
  specialty?: string;
  clinic_name?: string;
  reg_number?: string;
  consent_status?: boolean;
}

export interface DirectoryResponse {
  doctors: DirectoryAccount[];
  patients: DirectoryAccount[];
}

export interface CheckPhoneResponse {
  registered: boolean;
  role?: 'doctor' | 'patient' | null;
  name?: string | null;
  message: string;
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
  care_plan?: any;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  role: 'doctor' | 'patient';
  user: any;
}

export interface VisitApproveResponse {
  success: boolean;
  message: string;
  visit_id: string;
  patient_id: string;
  phone: string;
  whatsapp_status?: string;
  scheduled_reminders_count: number;
}

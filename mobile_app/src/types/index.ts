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
  medicines: MedicineItem[];
  reminders: ReminderItem[];
  status: 'draft' | 'approved' | 'sent';
  doctor_name?: string;
  patient_name?: string;
  patient_phone?: string;
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


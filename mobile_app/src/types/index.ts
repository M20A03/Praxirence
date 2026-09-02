export interface PatientUser {
  id: string;
  name: string;
  phone: string;
  consent_status: boolean;
  consent_updated_at?: string;
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

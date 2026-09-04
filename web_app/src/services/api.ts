import { 
  DoctorUser, 
  PatientUser,
  Patient, 
  Visit, 
  VisitApproveResponse, 
  AuthResponse,
  DirectoryResponse,
  CheckPhoneResponse
} from '../types';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'https://praxirence-production.up.railway.app'
).replace(/\/+$/, '');

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('praxirence_token');
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (token && token !== 'null' && token !== 'undefined') {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('praxirence_token');
      localStorage.removeItem('praxirence_doctor');
      localStorage.removeItem('praxirence_patient');
      localStorage.removeItem('praxirence_role');
      window.dispatchEvent(new Event('auth_change'));
    }
    const text = await response.text();
    let message = `Request failed with status ${response.status}`;
    try {
      const errorData = JSON.parse(text);
      message = errorData.detail || errorData.message || message;
    } catch {
      if (text && text.length < 250 && !text.includes('<!DOCTYPE')) {
        message = text;
      }
    }
    throw new Error(message);
  }
  return response.json();
}

export const api = {
  // Directory & Account Lookup
  async getAuthDirectory(): Promise<DirectoryResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/directory`);
    return await handleResponse<DirectoryResponse>(res);
  },

  async checkNumber(phone: string): Promise<CheckPhoneResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/check-number?phone=${encodeURIComponent(phone.trim())}`);
    return await handleResponse<CheckPhoneResponse>(res);
  },

  // Session Hydration & Validation
  async getMe(): Promise<{ role: 'doctor' | 'patient'; user: any }> {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ role: 'doctor' | 'patient'; user: any }>(res);
  },

  // Doctor Authentication
  async loginDoctor(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/doctor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    return await handleResponse<AuthResponse>(res);
  },

  async loginDoctorGoogle(data?: { email?: string; name?: string; id_token?: string; google_id?: string }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/doctor/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || { email: 'doctor@praxirence.com', name: 'Dr. Mayank Raj' }),
    });
    return await handleResponse<AuthResponse>(res);
  },

  async requestDoctorOtp(phone: string, channel: 'whatsapp' | 'sms' = 'whatsapp'): Promise<{ success: boolean; message: string; demo_code?: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/doctor/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim(), channel }),
    });
    return await handleResponse<{ success: boolean; message: string; demo_code?: string }>(res);
  },

  async verifyDoctorOtp(phone: string, code: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/doctor/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
    });
    return await handleResponse<AuthResponse>(res);
  },

  async registerDoctor(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    specialty?: string;
    clinic_name?: string;
    reg_number?: string;
  }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/doctor/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name.trim(),
        email: data.email.trim(),
        password: data.password,
        phone: data.phone ? data.phone.trim() : undefined,
        specialty: data.specialty || 'General Physician',
        clinic_name: data.clinic_name || 'Praxirence Clinical Centre',
        reg_number: data.reg_number || 'NMC-2024-84920'
      }),
    });
    const authRes = await handleResponse<AuthResponse>(res);
    if (data.clinic_name) localStorage.setItem('praxirence_clinic_name', data.clinic_name);
    if (data.name) localStorage.setItem('praxirence_doctor_name', data.name);
    if (data.specialty) localStorage.setItem('praxirence_doctor_specialty', data.specialty);
    if (data.reg_number) localStorage.setItem('praxirence_doctor_reg', data.reg_number);
    return authRes;
  },

  // Patient Authentication
  async requestPatientOtp(phone: string, channel: 'whatsapp' | 'sms' = 'whatsapp'): Promise<{ success: boolean; message: string; demo_code?: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim(), channel }),
    });
    return await handleResponse<{ success: boolean; message: string; demo_code?: string }>(res);
  },

  async verifyPatientOtp(phone: string, code: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
    });
    return await handleResponse<AuthResponse>(res);
  },

  async registerPatient(data: {
    name: string;
    phone: string;
    dob?: string;
    gender?: string;
  }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/patient/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name.trim(),
        phone: data.phone.trim(),
        dob: data.dob || null,
        gender: data.gender || 'Other',
      }),
    });
    return await handleResponse<AuthResponse>(res);
  },

  // Patient Portal Web API
  async getMyPatientPortal(): Promise<{
    patient: PatientUser;
    visits: Visit[];
    active_prescription?: any;
    active_care_plan?: any;
  }> {
    const res = await fetch(`${API_BASE_URL}/patients/me/portal`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse<{
      patient: PatientUser;
      visits: Visit[];
      active_prescription?: any;
      active_care_plan?: any;
    }>(res);
  },

  async updateMyConsent(consentStatus: boolean, otpCode?: string): Promise<{ success: boolean; message: string }> {
    const patientStr = localStorage.getItem('praxirence_patient');
    const patientId = patientStr ? JSON.parse(patientStr).id : null;
    if (!patientId) throw new Error('Patient ID not available in session');

    const res = await fetch(`${API_BASE_URL}/patients/${patientId}/consent`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent_status: consentStatus, otp_code: otpCode }),
    });
    return await handleResponse<{ success: boolean; message: string }>(res);
  },

  // Clinician Patients Management
  async searchPatients(query: string = ''): Promise<Patient[]> {
    const url = query.trim()
      ? `${API_BASE_URL}/patients?query=${encodeURIComponent(query.trim())}`
      : `${API_BASE_URL}/patients`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    return await handleResponse<Patient[]>(res);
  },

  async createPatient(name: string, phone: string, dob?: string): Promise<Patient> {
    const res = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), dob: dob || null }),
    });
    return await handleResponse<Patient>(res);
  },

  async getPatient(id: string): Promise<Patient> {
    const res = await fetch(`${API_BASE_URL}/patients/${id}`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse<Patient>(res);
  },

  // Visits & Prescriptions
  async getVisits(patientId: string): Promise<Visit[]> {
    const res = await fetch(`${API_BASE_URL}/patients/${patientId}/visits`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse<Visit[]>(res);
  },

  async createVisit(patientId: string, audioFile?: File): Promise<Visit> {
    const formData = new FormData();
    formData.append('patient_id', patientId);
    if (audioFile) {
      formData.append('audio_file', audioFile);
    }
    const token = localStorage.getItem('praxirence_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/visits`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return await handleResponse<Visit>(res);
  },

  async updateVisit(id: string, data: Partial<Visit>): Promise<Visit> {
    const res = await fetch(`${API_BASE_URL}/visits/${id}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await handleResponse<Visit>(res);
  },

  async approveVisit(id: string, language: string = 'en'): Promise<VisitApproveResponse> {
    const res = await fetch(`${API_BASE_URL}/visits/${id}/approve`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ language }),
    });
    return await handleResponse<VisitApproveResponse>(res);
  },

  async generateCarePlan(visitId: string, transcription?: string, audioFile?: File): Promise<Visit> {
    const formData = new FormData();
    if (transcription) {
      formData.append('transcription', transcription);
    }
    if (audioFile) {
      formData.append('audio_file', audioFile);
    }
    const token = localStorage.getItem('praxirence_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/visits/${visitId}/generate-careplan`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return await handleResponse<Visit>(res);
  },

  async uploadAudio(
    patientId: string,
    audioBlob: Blob,
    keepRecording: boolean,
    fileName: string = 'recording.wav'
  ): Promise<Visit> {
    const formData = new FormData();
    formData.append('patient_id', patientId);
    formData.append('audio_file', audioBlob, fileName);
    formData.append('keep_recording', String(keepRecording));

    const token = localStorage.getItem('praxirence_token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/recordings/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return await handleResponse<Visit>(res);
  },

  async getVisit(id: string): Promise<Visit> {
    const res = await fetch(`${API_BASE_URL}/visits/${id}`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse<Visit>(res);
  },

  async getPatientVisits(patientId: string): Promise<Visit[]> {
    return this.getVisits(patientId);
  },

  async updatePatientConsent(patientId: string, consentStatus: boolean): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/patients/${patientId}/consent`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent_status: consentStatus }),
    });
    return await handleResponse<any>(res);
  },
};

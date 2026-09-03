import { DoctorUser, Patient, Visit, VisitApproveResponse, AuthResponse } from '../types';

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://praxirence-production.up.railway.app')
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
  // Doctor Authentication
  async loginDoctor(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/doctor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    return await handleResponse<AuthResponse>(res);
  },

  async registerDoctor(data: {
    name: string;
    email: string;
    password: string;
    specialty?: string;
    clinic_name?: string;
    reg_number?: string;
  }): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/doctor/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        email: data.email.trim(),
        password: data.password,
        specialty: data.specialty || 'General Physician',
      }),
    });
    const authRes = await handleResponse<AuthResponse>(res);
    if (data.clinic_name) localStorage.setItem('praxirence_clinic_name', data.clinic_name);
    if (data.name) localStorage.setItem('praxirence_doctor_name', data.name);
    if (data.specialty) localStorage.setItem('praxirence_doctor_specialty', data.specialty);
    if (data.reg_number) localStorage.setItem('praxirence_doctor_reg', data.reg_number);
    return authRes;
  },

  // Patients Management
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

  async updateConsent(patientId: string, consentStatus: boolean): Promise<Patient> {
    const res = await fetch(`${API_BASE_URL}/patients/${patientId}/consent`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent_status: consentStatus }),
    });
    return await handleResponse<Patient>(res);
  },

  async updatePatientConsent(patientId: string, consentStatus: boolean): Promise<Patient> {
    return this.updateConsent(patientId, consentStatus);
  },

  async getPatientVisits(patientId: string): Promise<Visit[]> {
    const res = await fetch(`${API_BASE_URL}/patients/${patientId}/visits`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse<Visit[]>(res);
  },

  // Consultation Audio & Care Plan
  async uploadAudio(
    patientId: string,
    audioBlob: Blob,
    keepRecording: boolean = false,
    fileName: string = 'recording.wav'
  ): Promise<Visit> {
    const formData = new FormData();
    formData.append('patient_id', patientId);
    formData.append('keep_recording', String(keepRecording));
    formData.append('audio_file', audioBlob, fileName);

    const headers = getAuthHeaders() as Record<string, string>;
    delete headers['Content-Type'];

    const res = await fetch(`${API_BASE_URL}/visits/upload-audio`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return await handleResponse<Visit>(res);
  },

  async getVisit(visitId: string): Promise<Visit> {
    const res = await fetch(`${API_BASE_URL}/visits/${visitId}`, {
      headers: getAuthHeaders(),
    });
    return await handleResponse<Visit>(res);
  },

  async updateVisit(
    visitId: string,
    data: {
      diagnosis?: string;
      medicines?: any[];
      reminders?: any[];
      keep_recording?: boolean;
    }
  ): Promise<Visit> {
    const res = await fetch(`${API_BASE_URL}/visits/${visitId}`, {
      method: 'PUT',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await handleResponse<Visit>(res);
  },

  async approveVisit(visitId: string): Promise<VisitApproveResponse> {
    const res = await fetch(`${API_BASE_URL}/visits/${visitId}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return await handleResponse<VisitApproveResponse>(res);
  },

  async deleteRecording(filename: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/recordings/${filename}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return await handleResponse<{ success: boolean; message: string }>(res);
  },

  // System Health & Heartbeat
  async checkHealth(): Promise<{ status: string; version: string; service: string }> {
    const res = await fetch(`${API_BASE_URL}/health`);
    return await handleResponse<{ status: string; version: string; service: string }>(res);
  }
};

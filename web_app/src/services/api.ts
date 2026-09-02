import { DoctorUser, Patient, Visit, VisitApproveResponse, AuthResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('praxirence_token');
  const headers: HeadersInit = {
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('praxirence_token');
      localStorage.removeItem('praxirence_doctor');
      // Dispatch auth event so UI updates
      window.dispatchEvent(new Event('auth_change'));
    }
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.detail || `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return response.json();
}

export const api = {
  // Doctor Auth
  async loginDoctor(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE_URL}/auth/doctor/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<AuthResponse>(res);
  },

  // Patients
  async searchPatients(query: string = ''): Promise<Patient[]> {
    const url = query
      ? `${API_BASE_URL}/patients?query=${encodeURIComponent(query)}`
      : `${API_BASE_URL}/patients`;
    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Patient[]>(res);
  },

  async createPatient(name: string, phone: string, dob?: string): Promise<Patient> {
    const res = await fetch(`${API_BASE_URL}/patients`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, phone, dob: dob || null }),
    });
    return handleResponse<Patient>(res);
  },

  async getPatient(id: string): Promise<Patient> {
    const res = await fetch(`${API_BASE_URL}/patients/${id}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Patient>(res);
  },

  async getPatientVisits(patientId: string): Promise<Visit[]> {
    const res = await fetch(`${API_BASE_URL}/patients/${patientId}/visits`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Visit[]>(res);
  },

  // Visits & Audio Recording
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

    const headers = getAuthHeaders();
    // Do not set Content-Type header so browser sets multipart boundary automatically
    delete (headers as any)['Content-Type'];

    const res = await fetch(`${API_BASE_URL}/visits/upload-audio`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return handleResponse<Visit>(res);
  },

  async getVisit(visitId: string): Promise<Visit> {
    const res = await fetch(`${API_BASE_URL}/visits/${visitId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<Visit>(res);
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
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<Visit>(res);
  },

  async approveVisit(visitId: string): Promise<VisitApproveResponse> {
    const res = await fetch(`${API_BASE_URL}/visits/${visitId}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<VisitApproveResponse>(res);
  },

  async deleteRecording(filename: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/recordings/${filename}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ success: boolean; message: string }>(res);
  },
};

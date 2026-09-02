import { PatientUser, Visit, ConsentDocument } from '../types';

// In local mobile development with Expo, adjust to your host machine's IP (e.g. 10.0.2.2 for Android emulator or LAN IP)
const API_BASE_URL = 'http://localhost:8000';

let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

const getHeaders = () => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
};

export const mobileApi = {
  async requestOtp(phone: string): Promise<{ success: boolean; message: string; demo_code?: string }> {
    const res = await fetch(`${API_BASE_URL}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to request OTP');
    }
    return res.json();
  },

  async verifyOtp(phone: string, code: string): Promise<{ access_token: string; user: PatientUser }> {
    const res = await fetch(`${API_BASE_URL}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Invalid OTP code');
    }
    const data = await res.json();
    setAuthToken(data.access_token);
    return data;
  },

  async getVisits(patientId: string): Promise<Visit[]> {
    const res = await fetch(`${API_BASE_URL}/patients/${patientId}/visits`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load consultation visits');
    return res.json();
  },

  async getConsent(patientId: string): Promise<ConsentDocument> {
    const res = await fetch(`${API_BASE_URL}/patients/${patientId}/consent`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load consent document');
    return res.json();
  },

  async updateConsent(patientId: string, consentStatus: boolean, otpCode?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/patients/${patientId}/consent`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ consent_status: consentStatus, otp_code: otpCode }),
    });
    if (!res.ok) throw new Error('Failed to update consent status');
    return res.json();
  },
};

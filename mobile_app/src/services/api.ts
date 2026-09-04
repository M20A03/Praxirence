import AsyncStorage from '@react-native-async-storage/async-storage';
import { PatientUser, Visit, ConsentDocument } from '../types';

// Production Railway Backend for Android devices, emulators, and Expo Go
const API_BASE_URL = 'https://praxirence-production.up.railway.app';

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
  async restoreSession(): Promise<PatientUser | null> {
    try {
      const token = await AsyncStorage.getItem('praxirence_mobile_token');
      const userStr = await AsyncStorage.getItem('praxirence_mobile_user');
      if (!token || !userStr) return null;

      setAuthToken(token);
      // Validate session with live backend
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        await this.clearSession();
        return null;
      }

      const verified = await res.json();
      return verified.user;
    } catch (e) {
      console.warn('Session restoration failed:', e);
      return null;
    }
  },

  async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem('praxirence_mobile_token');
      await AsyncStorage.removeItem('praxirence_mobile_user');
    } catch (e) {
      console.warn('Error clearing session:', e);
    }
    setAuthToken(null);
  },

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
    try {
      await AsyncStorage.setItem('praxirence_mobile_token', data.access_token);
      await AsyncStorage.setItem('praxirence_mobile_user', JSON.stringify(data.user));
    } catch (e) {
      console.warn('Failed to persist mobile session:', e);
    }
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

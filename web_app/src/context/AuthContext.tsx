import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DoctorUser, PatientUser, AuthResponse } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: (DoctorUser & PatientUser) | any;
  role: 'doctor' | 'patient' | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginDoctorPassword: (email: string, pass: string) => Promise<AuthResponse>;
  loginDoctorOtp: (phone: string, code: string) => Promise<AuthResponse>;
  loginDoctorGoogle: (data?: any) => Promise<AuthResponse>;
  loginPatientOtp: (phone: string, code: string) => Promise<AuthResponse>;
  registerDoctor: (data: any) => Promise<AuthResponse>;
  registerPatient: (data: any) => Promise<AuthResponse>;
  logout: () => void;
  updateUser: (updatedUser: any) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('praxirence_token');
      if (!saved || saved === 'undefined' || saved === 'null') return null;
      if (saved === 'praxirence-jwt-session' || saved === 'praxirence-registered-jwt') {
        localStorage.removeItem('praxirence_token');
        return null;
      }
      return saved;
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState<'doctor' | 'patient' | null>(() => {
    try {
      return (localStorage.getItem('praxirence_role') as 'doctor' | 'patient') || null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<any>(() => {
    try {
      const savedDoc = localStorage.getItem('praxirence_doctor');
      if (savedDoc && savedDoc !== 'undefined' && savedDoc !== 'null') {
        return JSON.parse(savedDoc);
      }
      const savedPat = localStorage.getItem('praxirence_patient');
      if (savedPat && savedPat !== 'undefined' && savedPat !== 'null') {
        return JSON.parse(savedPat);
      }
      return null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState<boolean>(true);

  // Validate session on mount via /auth/me
  useEffect(() => {
    const hydrateSession = async () => {
      const currentToken = localStorage.getItem('praxirence_token');
      if (!currentToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.getMe();
        setRole(res.role);
        setUser(res.user);
        localStorage.setItem('praxirence_role', res.role);
        if (res.role === 'doctor') {
          localStorage.setItem('praxirence_doctor', JSON.stringify(res.user));
        } else {
          localStorage.setItem('praxirence_patient', JSON.stringify(res.user));
        }
      } catch (err) {
        console.warn('Session verification failed on mount, resetting state:', err);
        logout();
      } finally {
        setLoading(false);
      }
    };

    hydrateSession();

    const handleAuthChange = () => {
      hydrateSession();
    };

    window.addEventListener('auth_change', handleAuthChange);
    return () => window.removeEventListener('auth_change', handleAuthChange);
  }, []);

  const saveAuthSession = (authRes: AuthResponse) => {
    setToken(authRes.access_token);
    setRole(authRes.role);
    setUser(authRes.user);

    try {
      localStorage.setItem('praxirence_token', authRes.access_token);
      localStorage.setItem('praxirence_role', authRes.role);
      if (authRes.role === 'doctor') {
        localStorage.setItem('praxirence_doctor', JSON.stringify(authRes.user));
        localStorage.removeItem('praxirence_patient');
      } else {
        localStorage.setItem('praxirence_patient', JSON.stringify(authRes.user));
        localStorage.removeItem('praxirence_doctor');
      }
    } catch (e) {
      console.warn('Storage write error:', e);
    }
  };

  const loginDoctorPassword = async (email: string, pass: string): Promise<AuthResponse> => {
    const data = await api.loginDoctor(email, pass);
    saveAuthSession(data);
    return data;
  };

  const loginDoctorOtp = async (phone: string, code: string): Promise<AuthResponse> => {
    const data = await api.verifyDoctorOtp(phone, code);
    saveAuthSession(data);
    return data;
  };

  const loginDoctorGoogle = async (authData?: any): Promise<AuthResponse> => {
    const data = await api.loginDoctorGoogle(authData);
    saveAuthSession(data);
    return data;
  };

  const loginPatientOtp = async (phone: string, code: string): Promise<AuthResponse> => {
    const data = await api.verifyPatientOtp(phone, code);
    saveAuthSession(data);
    return data;
  };

  const registerDoctor = async (data: any): Promise<AuthResponse> => {
    const res = await api.registerDoctor(data);
    saveAuthSession(res);
    return res;
  };

  const registerPatient = async (data: any): Promise<AuthResponse> => {
    const res = await api.registerPatient(data);
    saveAuthSession(res);
    return res;
  };

  const logout = () => {
    try {
      localStorage.removeItem('praxirence_token');
      localStorage.removeItem('praxirence_role');
      localStorage.removeItem('praxirence_doctor');
      localStorage.removeItem('praxirence_patient');
    } catch (e) {
      console.warn('Storage clear error:', e);
    }
    setToken(null);
    setRole(null);
    setUser(null);
  };

  const updateUser = (updatedUser: any) => {
    setUser(updatedUser);
    try {
      if (role === 'doctor') {
        localStorage.setItem('praxirence_doctor', JSON.stringify(updatedUser));
      } else if (role === 'patient') {
        localStorage.setItem('praxirence_patient', JSON.stringify(updatedUser));
      }
    } catch (e) {
      console.warn('Storage update error:', e);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        loginDoctorPassword,
        loginDoctorOtp,
        loginDoctorGoogle,
        loginPatientOtp,
        registerDoctor,
        registerPatient,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DoctorProfileModal } from './components/DoctorProfileModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DoctorUser } from './types';

const getInitialDoctor = (): DoctorUser | null => {
  try {
    const saved = localStorage.getItem('praxirence_doctor');
    if (!saved || saved === 'undefined' || saved === 'null') return null;
    return JSON.parse(saved);
  } catch (e) {
    console.warn('Failed to parse saved doctor session; clearing corrupt storage.', e);
    localStorage.removeItem('praxirence_doctor');
    localStorage.removeItem('praxirence_token');
    return null;
  }
};

const getInitialToken = (): string | null => {
  try {
    const token = localStorage.getItem('praxirence_token');
    if (!token || token === 'undefined' || token === 'null') return null;
    // Automatically purge old mock/in-memory tokens that cause 401 on production Railway backend
    if (token === 'praxirence-jwt-session' || token === 'praxirence-registered-jwt') {
      localStorage.removeItem('praxirence_token');
      localStorage.removeItem('praxirence_doctor');
      return null;
    }
    return token;
  } catch (e) {
    return null;
  }
};

export const AppContent: React.FC = () => {
  const [token, setToken] = useState<string | null>(getInitialToken);
  const [doctor, setDoctor] = useState<DoctorUser | null>(getInitialDoctor);
  const [isDoctorProfileOpen, setIsDoctorProfileOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const handleAuthChange = () => {
      setToken(getInitialToken());
      setDoctor(getInitialDoctor());
    };

    const handleCustomToast = (e: any) => {
      if (e.detail) {
        addToast(e.detail);
      }
    };

    window.addEventListener('auth_change', handleAuthChange);
    window.addEventListener('praxirence_toast' as any, handleCustomToast);
    return () => {
      window.removeEventListener('auth_change', handleAuthChange);
      window.removeEventListener('praxirence_toast' as any, handleCustomToast);
    };
  }, []);

  const handleLoginSuccess = (newToken: string, newDoctor: DoctorUser) => {
    try {
      localStorage.setItem('praxirence_token', newToken);
      localStorage.setItem('praxirence_doctor', JSON.stringify(newDoctor));
    } catch (e) {
      console.warn('Unable to write to localStorage:', e);
    }
    setToken(newToken);
    setDoctor(newDoctor);
    addToast({
      type: 'success',
      title: 'Welcome, ' + newDoctor.name,
      message: 'Authenticated securely with Praxirence Clinical Portal.',
    });
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem('praxirence_token');
      localStorage.removeItem('praxirence_doctor');
    } catch (e) {
      console.warn('Unable to clear localStorage:', e);
    }
    setToken(null);
    setDoctor(null);
    addToast({
      type: 'info',
      title: 'Signed Out',
      message: 'You have been safely signed out.',
    });
  };

  if (!token || !doctor) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        doctor={doctor}
        onLogout={handleLogout}
        onOpenDoctorProfile={() => setIsDoctorProfileOpen(true)}
      />

      <DashboardPage />

      {/* Doctor & Clinic Profile Settings Modal */}
      <DoctorProfileModal
        doctor={doctor}
        isOpen={isDoctorProfileOpen}
        onClose={() => setIsDoctorProfileOpen(false)}
        onProfileUpdated={(updated) => {
          setDoctor(updated);
          localStorage.setItem('praxirence_doctor', JSON.stringify(updated));
          addToast({
            type: 'success',
            title: 'Profile Updated',
            message: 'Clinical credentials and prescription letterhead updated.',
          });
        }}
      />

      {/* Global Floating Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;

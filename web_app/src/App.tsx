import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
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
    return token;
  } catch (e) {
    return null;
  }
};

export const AppContent: React.FC = () => {
  const [token, setToken] = useState<string | null>(getInitialToken);
  const [doctor, setDoctor] = useState<DoctorUser | null>(getInitialDoctor);

  useEffect(() => {
    const handleAuthChange = () => {
      setToken(getInitialToken());
      setDoctor(getInitialDoctor());
    };

    window.addEventListener('auth_change', handleAuthChange);
    return () => window.removeEventListener('auth_change', handleAuthChange);
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
  };

  if (!token || !doctor) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar doctor={doctor} onLogout={handleLogout} />
      <DashboardPage />
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

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { DoctorUser } from './types';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('praxirence_token'));
  const [doctor, setDoctor] = useState<DoctorUser | null>(() => {
    const saved = localStorage.getItem('praxirence_doctor');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const handleAuthChange = () => {
      setToken(localStorage.getItem('praxirence_token'));
      const saved = localStorage.getItem('praxirence_doctor');
      setDoctor(saved ? JSON.parse(saved) : null);
    };

    window.addEventListener('auth_change', handleAuthChange);
    return () => window.removeEventListener('auth_change', handleAuthChange);
  }, []);

  const handleLoginSuccess = (newToken: string, newDoctor: DoctorUser) => {
    localStorage.setItem('praxirence_token', newToken);
    localStorage.setItem('praxirence_doctor', JSON.stringify(newDoctor));
    setToken(newToken);
    setDoctor(newDoctor);
  };

  const handleLogout = () => {
    localStorage.removeItem('praxirence_token');
    localStorage.removeItem('praxirence_doctor');
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

export default App;

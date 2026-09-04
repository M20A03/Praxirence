import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PatientPortalPage } from './pages/PatientPortalPage';
import { DoctorProfileModal } from './components/DoctorProfileModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Activity } from 'lucide-react';

export const AppContent: React.FC = () => {
  const { user, role, isAuthenticated, loading, logout, updateUser } = useAuth();
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
    const handleCustomToast = (e: any) => {
      if (e.detail) {
        addToast(e.detail);
      }
    };
    window.addEventListener('praxirence_toast' as any, handleCustomToast);
    return () => {
      window.removeEventListener('praxirence_toast' as any, handleCustomToast);
    };
  }, []);

  // Hydration loader
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-app)'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(6, 182, 212, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <Activity size={28} color="#06b6d4" className="animate-spin" />
        </div>
        <div style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.95rem' }}>
          Verifying Clinical Session...
        </div>
      </div>
    );
  }

  // Unauthenticated -> Show Unified Login Page
  if (!isAuthenticated || !user || !role) {
    return (
      <>
        <LoginPage />
        <ToastContainer toasts={toasts} onDismiss={removeToast} />
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        user={user}
        role={role}
        onLogout={logout}
        onOpenDoctorProfile={() => setIsDoctorProfileOpen(true)}
      />

      {/* Role-Based Active View */}
      {role === 'doctor' ? (
        <DashboardPage />
      ) : (
        <PatientPortalPage />
      )}

      {/* Doctor & Clinic Profile Settings Modal */}
      {role === 'doctor' && (
        <DoctorProfileModal
          doctor={user}
          isOpen={isDoctorProfileOpen}
          onClose={() => setIsDoctorProfileOpen(false)}
          onProfileUpdated={(updated) => {
            updateUser(updated);
            addToast({
              type: 'success',
              title: 'Profile Updated',
              message: 'Clinical credentials and prescription letterhead updated.',
            });
          }}
        />
      )}

      {/* Global Floating Toasts */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;

import React, { useState } from 'react';
import { Stethoscope, Lock, Mail, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { DoctorUser } from '../types';

interface LoginPageProps {
  onLoginSuccess: (token: string, doctor: DoctorUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('doctor@praxirence.com');
  const [password, setPassword] = useState('Doctor123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await api.loginDoctor(email, password);
      onLoginSuccess(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoDoctorLogin = async () => {
    setEmail('doctor@praxirence.com');
    setPassword('Doctor123!');
    setError(null);
    setLoading(true);

    try {
      const data = await api.loginDoctor('doctor@praxirence.com', 'Doctor123!');
      onLoginSuccess(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '36px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--emerald-500), var(--cyan-500))',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)'
          }}>
            <Stethoscope size={30} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Praxirence</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Doctor Clinical Consultation Portal
          </p>
          <div style={{ marginTop: '8px' }}>
            <span className="badge badge-success">
              <ShieldCheck size={12} /> HIPAA-Ready & AES-256 Encrypted
            </span>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.15)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            color: '#fb7185',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Doctor Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                required
                className="input-field"
                style={{ paddingLeft: '42px' }}
                placeholder="doctor@praxirence.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                required
                className="input-field"
                style={{ paddingLeft: '42px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px', padding: '12px' }}
          >
            <span>{loading ? 'Authenticating...' : 'Sign In as Doctor'}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{
          position: 'relative',
          textAlign: 'center',
          margin: '24px 0',
        }}>
          <hr style={{ borderColor: 'var(--border-color)' }} />
          <span style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--bg-card)',
            padding: '0 12px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)'
          }}>
            OR QUICK DEMO ACCESS
          </span>
        </div>

        <button
          type="button"
          onClick={handleDemoDoctorLogin}
          disabled={loading}
          className="btn btn-secondary"
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(6, 182, 212, 0.15))',
            borderColor: 'rgba(139, 92, 246, 0.3)'
          }}
        >
          <Sparkles size={16} color="var(--purple-500)" />
          <span>Instant 1-Click Doctor Demo</span>
        </button>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { PatientSearch } from '../components/PatientSearch';
import { AudioRecorder } from '../components/AudioRecorder';
import { CarePlanEditor } from '../components/CarePlanEditor';
import { VisitTimeline } from '../components/VisitTimeline';
import { DownloadApkModal } from '../components/DownloadApkModal';
import { Patient, Visit } from '../types';
import { api } from '../services/api';
import {
  Users,
  Calendar,
  Stethoscope,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Smartphone,
  Send,
  ShieldCheck,
  Activity,
  UserCheck,
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Load initial patients roster from PostgreSQL
  const loadPatients = async () => {
    try {
      setLoadingPatients(true);
      const data = await api.searchPatients('');
      setPatients(data);
      if (data.length > 0 && !selectedPatient) {
        setSelectedPatient(data[0]);
      }
    } catch (err) {
      console.error('Failed to load patient roster:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveVisit(null);
  };

  const handleCarePlanGenerated = (visit: Visit) => {
    setActiveVisit(visit);
  };

  const handleVisitApproved = (updatedVisit: Visit) => {
    setActiveVisit(updatedVisit);
    loadPatients();
  };

  return (
    <main className="container" style={{ padding: '28px 20px 60px' }}>
      {/* Institutional Clinic Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Clinical Consultation Console
            </h1>
            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
              Live EHR Connected
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            AI-Augmented Speech-to-CarePlan • Instant Multi-Lingual WhatsApp Delivery • NMC Compliant
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsApkModalOpen(true)}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '8px 16px' }}
          >
            <Smartphone size={16} style={{ color: 'var(--teal-500)' }} />
            <span>Patient App APK</span>
          </button>
        </div>
      </div>

      {/* Real Clinical Operations Status Bar */}
      <div className="kpi-grid" style={{ marginBottom: '28px' }}>
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: 'var(--teal-subtle)', color: 'var(--teal-600)' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Registered Patients
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {patients.length} Enrolled
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: 'rgba(37, 211, 102, 0.12)', color: '#25D366' }}>
            <Send size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              WhatsApp Gateway
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              Meta Cloud API • Ready
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            <Stethoscope size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Current Consultation
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {selectedPatient ? selectedPatient.name : 'Select Patient'}
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#a855f7' }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              HIPAA & DPDP Status
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              Encrypted • Auto-Purge
            </div>
          </div>
        </div>
      </div>

      {/* Patient Search & Selection Bar */}
      <PatientSearch
        selectedPatient={selectedPatient}
        onSelectPatient={handleSelectPatient}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Workspace Area: Live Consultation Console */}
      {selectedPatient ? (
        <div style={{ marginTop: '24px' }}>
          {!activeVisit ? (
            <AudioRecorder
              patient={selectedPatient}
              onCarePlanGenerated={handleCarePlanGenerated}
            />
          ) : (
            <div>
              {/* Back to Voice Recorder trigger bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                padding: '12px 18px',
                background: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-success">Consultation #{activeVisit.id.slice(0, 8)}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Extracted on {new Date(activeVisit.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <button
                  onClick={() => setActiveVisit(null)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  <Stethoscope size={14} /> New Consultation for {selectedPatient.name}
                </button>
              </div>

              {/* Care Plan Editor & Digital Prescription Workflow */}
              <CarePlanEditor
                visit={activeVisit}
                patient={selectedPatient}
                onVisitApproved={handleVisitApproved}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{
          textAlign: 'center',
          padding: '60px 24px',
          marginTop: '24px',
          border: '2px dashed var(--border-color)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--teal-subtle)',
            color: 'var(--teal-600)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <Users size={28} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            No Patient Selected
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '440px', margin: '8px auto 20px' }}>
            Use the patient search bar above to select a registered patient, or click "+ Add Patient" to register a new clinic attendee.
          </p>
        </div>
      )}

      {/* Patient Visit Timeline Drawer */}
      {selectedPatient && (
        <VisitTimeline
          patient={selectedPatient}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* Patient APK Download Modal */}
      <DownloadApkModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
      />
    </main>
  );
};

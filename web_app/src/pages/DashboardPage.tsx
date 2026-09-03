import React, { useState } from 'react';
import { PatientSearch } from '../components/PatientSearch';
import { AudioRecorder } from '../components/AudioRecorder';
import { CarePlanEditor } from '../components/CarePlanEditor';
import { VisitTimeline } from '../components/VisitTimeline';
import { Patient, Visit } from '../types';
import { UserCheck, Sparkles, AlertCircle, PlusCircle, Activity, Mic, Brain, Send } from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleSelectPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveVisit(null); // Reset active visit when patient changes
  };

  const handleCarePlanGenerated = (visit: Visit) => {
    setActiveVisit(visit);
  };

  const handleVisitApproved = (updatedVisit: Visit) => {
    setActiveVisit(updatedVisit);
  };

  const handleStartNewConsultation = () => {
    setActiveVisit(null);
  };

  return (
    <main className="container" style={{ padding: '32px 24px' }}>
      {/* Clinic Operational KPI Bar */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Activity size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Daily Consultations
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              14 Completed
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
            <Mic size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Whisper LoRA ASR
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              0.0% WER • Realtime
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed' }}>
            <Brain size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              CarePlan QLoRA LLM
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              Mistral-7B • 100.0 Match
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box" style={{ background: 'rgba(37, 211, 102, 0.15)', color: '#25D366' }}>
            <Send size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              WhatsApp Delivery
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              Meta Cloud API • Active
            </div>
          </div>
        </div>
      </div>

      {/* Patient Search and Quick Add Bar */}
      <PatientSearch
        selectedPatient={selectedPatient}
        onSelectPatient={handleSelectPatient}
        onOpenHistory={() => setIsHistoryOpen(true)}
      />

      {/* Main Consultation Workflow Area */}
      {!selectedPatient ? (
        <div className="card" style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'var(--bg-subtle)',
          border: '1px dashed var(--border-color)',
          marginTop: '20px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'var(--bg-subtle)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px'
          }}>
            <UserCheck size={32} color="var(--cyan-500)" />
          </div>
          <h2 style={{ fontSize: '1.4rem' }}>Select or Quick Add a Patient to Begin Consultation</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: '500px', margin: '8px auto 0', fontSize: '0.925rem' }}>
            Search by patient name or encrypted phone number above, or click 'Quick Add Patient' for walk-in consultations.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Step 1: Voice Consultation Recorder */}
          {!activeVisit ? (
            <AudioRecorder
              patient={selectedPatient}
              onCarePlanGenerated={handleCarePlanGenerated}
            />
          ) : (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}>
                <span className="badge badge-purple" style={{ fontSize: '0.8rem', padding: '6px 14px' }}>
                  <Sparkles size={14} /> Active Care Plan
                </span>
                <button
                  onClick={handleStartNewConsultation}
                  className="btn btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.825rem' }}
                >
                  <PlusCircle size={15} />
                  <span>Start Another Consultation</span>
                </button>
              </div>

              {/* Step 2: AI Care Plan Review & WhatsApp Dispatch */}
              <CarePlanEditor
                visit={activeVisit}
                patient={selectedPatient}
                onVisitApproved={handleVisitApproved}
              />
            </div>
          )}
        </div>
      )}

      {/* Patient Past Visit History Modal */}
      {selectedPatient && (
        <VisitTimeline
          patient={selectedPatient}
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </main>
  );
};

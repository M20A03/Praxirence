import React, { useEffect, useState } from 'react';
import { X, Calendar, User, Clock, Pill, CheckCircle2, MessageSquare } from 'lucide-react';
import { Visit, Patient } from '../types';
import { api } from '../services/api';

interface VisitTimelineProps {
  patient: Patient;
  isOpen: boolean;
  onClose: () => void;
}

export const VisitTimeline: React.FC<VisitTimelineProps> = ({
  patient,
  isOpen,
  onClose,
}) => {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadVisits();
    }
  }, [isOpen, patient.id]);

  const loadVisits = async () => {
    try {
      setLoading(true);
      const data = await api.getPatientVisits(patient.id);
      setVisits(data);
    } catch (err) {
      console.error('Failed to load visit history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '780px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2>Consultation Visit History</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Past clinical encounters and care plans for {patient.name} ({patient.phone})
            </p>
          </div>
          <button onClick={onClose} className="btn-icon">
            <X size={22} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading consultation history...
          </div>
        ) : visits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No past consultation records found for this patient.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {visits.map((visit, index) => (
              <div
                key={visit.id}
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  position: 'relative'
                }}
              >
                {/* Header info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={16} color="var(--cyan-500)" />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      {new Date(visit.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      • Dr. {visit.doctor_name || 'Care Team'}
                    </span>
                  </div>

                  <div>
                    {visit.status === 'sent' || visit.status === 'approved' ? (
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                        <CheckCircle2 size={12} /> WhatsApp Dispatched
                      </span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                        Draft
                      </span>
                    )}
                  </div>
                </div>

                {/* Diagnosis */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                    Diagnosis
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {visit.diagnosis || 'General Health Consultation'}
                  </div>
                </div>

                {/* Medicines */}
                {visit.medicines && visit.medicines.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                      Prescriptions ({visit.medicines.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {visit.medicines.map((med, mIdx) => (
                        <div
                          key={mIdx}
                          style={{
                            background: 'var(--bg-subtle)',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '6px 12px',
                            fontSize: '0.825rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Pill size={14} color="var(--emerald-400)" />
                          <span style={{ fontWeight: 600 }}>{med.name}</span>
                          <span style={{ color: 'var(--text-muted)' }}>({med.dosage})</span>
                          <span style={{ color: 'var(--emerald-400)', fontSize: '0.75rem' }}>{med.frequency}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reminders summary */}
                {visit.reminders && visit.reminders.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                      Active Reminders
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {visit.reminders.map((r, rIdx) => (
                        <span key={rIdx} className="badge badge-cyan" style={{ fontSize: '0.75rem' }}>
                          ⏰ {r.time} - {r.medicine_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

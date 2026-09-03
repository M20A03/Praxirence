import React, { useState } from 'react';
import {
  FileCheck,
  Pill,
  Clock,
  Plus,
  Trash2,
  Send,
  CheckCircle,
  Sparkles,
  Save,
  MessageSquare,
  AlertCircle,
  Printer
} from 'lucide-react';
import { Visit, MedicineItem, ReminderItem, Patient } from '../types';
import { api } from '../services/api';
import { WhatsAppPreviewModal } from './WhatsAppPreviewModal';
import { PrescriptionModal } from './PrescriptionModal';

interface CarePlanEditorProps {
  visit: Visit;
  patient: Patient;
  onVisitApproved: (updatedVisit: Visit) => void;
}

export const CarePlanEditor: React.FC<CarePlanEditorProps> = ({
  visit,
  patient,
  onVisitApproved,
}) => {
  const [diagnosis, setDiagnosis] = useState(visit.diagnosis || '');
  const [medicines, setMedicines] = useState<MedicineItem[]>(visit.medicines || []);
  const [reminders, setReminders] = useState<ReminderItem[]>(visit.reminders || []);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [approvalResult, setApprovalResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWhatsAppPreview, setShowWhatsAppPreview] = useState(false);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);

  // Add new medicine row
  const handleAddMedicine = () => {
    setMedicines([
      ...medicines,
      {
        name: '',
        dosage: '500mg',
        frequency: 'Twice daily after meals (1-0-1)',
        instructions: 'Take after meals with water',
        duration_days: 5,
      },
    ]);
  };

  // Update specific medicine field
  const handleMedicineChange = (index: number, field: keyof MedicineItem, value: any) => {
    const updated = [...medicines];
    updated[index] = { ...updated[index], [field]: value };
    setMedicines(updated);
  };

  // Remove medicine row
  const handleRemoveMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  // Add reminder
  const handleAddReminder = () => {
    setReminders([
      ...reminders,
      {
        medicine_name: medicines[0]?.name || 'Medication',
        dosage: medicines[0]?.dosage || '1 dose',
        time: '08:00',
        frequency: 'daily',
        instructions: 'Take after breakfast',
      },
    ]);
  };

  // Update reminder field
  const handleReminderChange = (index: number, field: keyof ReminderItem, value: any) => {
    const updated = [...reminders];
    updated[index] = { ...updated[index], [field]: value };
    setReminders(updated);
  };

  // Remove reminder
  const handleRemoveReminder = (index: number) => {
    setReminders(reminders.filter((_, i) => i !== index));
  };

  // Save changes
  const handleSaveDraft = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.updateVisit(visit.id, {
        diagnosis,
        medicines,
        reminders,
      });

      window.dispatchEvent(new CustomEvent('praxirence_toast', {
        detail: {
          type: 'info',
          title: 'Draft Saved',
          message: 'Prescription changes saved successfully.',
        }
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  // Approve & Send via WhatsApp
  const handleApproveAndSend = async () => {
    try {
      setApproving(true);
      setError(null);

      // Save latest edits first
      await api.updateVisit(visit.id, {
        diagnosis,
        medicines,
        reminders,
      });

      // Trigger approval and background WhatsApp dispatch
      const res = await api.approveVisit(visit.id);
      setApprovalResult(res.message);
      setShowWhatsAppPreview(true);

      window.dispatchEvent(new CustomEvent('praxirence_toast', {
        detail: {
          type: 'success',
          title: 'Care Plan Dispatched via WhatsApp',
          message: `Digital prescription & reminder alarms sent to ${patient.name} (${patient.phone}).`,
        }
      }));

      const refreshed = await api.getVisit(visit.id);
      onVisitApproved(refreshed);
    } catch (err: any) {
      setError(err.message || 'Approval and WhatsApp delivery failed.');
    } finally {
      setApproving(false);
    }
  };

  const isApprovedOrSent = visit.status === 'approved' || visit.status === 'sent';

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--emerald-500), var(--cyan-500))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <FileCheck size={20} />
          </div>
          <div>
            <h3>Clinical Care Plan & Prescription Review</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Generated by fine-tuned Mistral-7B / Llama-3-8B from Whisper consultation transcript. Review and adjust below.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowWhatsAppPreview(true)}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            title="Preview how this prescription appears in WhatsApp"
          >
            <MessageSquare size={14} color="#25D366" />
            <span>Preview WhatsApp</span>
          </button>

          {isApprovedOrSent ? (
            <span className="badge badge-success" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
              <CheckCircle size={14} /> Care Plan Approved & Sent
            </span>
          ) : (
            <span className="badge badge-warning" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>
              <Sparkles size={14} /> AI Draft - Pending Doctor Approval
            </span>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.15)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          color: '#fb7185',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      {approvalResult && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          color: 'var(--emerald-400)',
          padding: '16px 20px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle size={24} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--emerald-400)' }}>
                WhatsApp Care Plan Successfully Dispatched!
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {approvalResult} Formatted message sent to {patient.phone}.
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowWhatsAppPreview(true)}
            className="btn btn-whatsapp"
            style={{ padding: '8px 16px', fontSize: '0.825rem' }}
          >
            <MessageSquare size={16} />
            <span>View WhatsApp Message</span>
          </button>
        </div>
      )}

      {/* Transcription Preview Modal/Details */}
      {visit.raw_transcription && (
        <details style={{
          marginBottom: '20px',
          background: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          border: '1px solid var(--border-color)'
        }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', color: 'var(--cyan-500)' }}>
            🎙️ View Raw Whisper Consultation Transcription
          </summary>
          <p style={{
            marginTop: '10px',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6
          }}>
            {visit.raw_transcription}
          </p>
        </details>
      )}

      {/* Section 1: Diagnosis */}
      <div className="input-group">
        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Primary Medical Diagnosis / Assessment</span>
        </label>
        <textarea
          className="textarea-field"
          style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="e.g. Acute Bronchitis with Mild Pyrexia & Bronchospasm"
          rows={2}
          disabled={isApprovedOrSent}
        />
      </div>

      {/* Section 2: Medicines Table */}
      <div style={{ marginTop: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pill size={18} color="var(--emerald-400)" />
            <h4 style={{ fontSize: '1rem' }}>Prescribed Medications ({medicines.length})</h4>
          </div>
          {!isApprovedOrSent && (
            <button
              type="button"
              onClick={handleAddMedicine}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              <Plus size={14} />
              <span>Add Medicine</span>
            </button>
          )}
        </div>

        <div className="table-container desktop-only">
          <table className="styled-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Medicine Name</th>
                <th style={{ width: '15%' }}>Dosage</th>
                <th style={{ width: '25%' }}>Frequency</th>
                <th style={{ width: '20%' }}>Instructions</th>
                <th style={{ width: '10%' }}>Days</th>
                {!isApprovedOrSent && <th style={{ width: '5%' }}></th>}
              </tr>
            </thead>
            <tbody>
              {medicines.map((med, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '8px 10px', fontSize: '0.9rem', fontWeight: 600 }}
                      value={med.name}
                      onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                      placeholder="e.g. Amoxicillin"
                      disabled={isApprovedOrSent}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '8px 10px', fontSize: '0.9rem' }}
                      value={med.dosage}
                      onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                      placeholder="e.g. 500mg"
                      disabled={isApprovedOrSent}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '8px 10px', fontSize: '0.9rem' }}
                      value={med.frequency}
                      onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                      placeholder="e.g. Twice daily (1-0-1)"
                      disabled={isApprovedOrSent}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="input-field"
                      style={{ padding: '8px 10px', fontSize: '0.9rem' }}
                      value={med.instructions || ''}
                      onChange={(e) => handleMedicineChange(idx, 'instructions', e.target.value)}
                      placeholder="After food"
                      disabled={isApprovedOrSent}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input-field"
                      style={{ padding: '8px 10px', fontSize: '0.9rem' }}
                      value={med.duration_days || 5}
                      onChange={(e) => handleMedicineChange(idx, 'duration_days', parseInt(e.target.value) || 1)}
                      disabled={isApprovedOrSent}
                    />
                  </td>
                  {!isApprovedOrSent && (
                    <td>
                      <button
                        type="button"
                        onClick={() => handleRemoveMedicine(idx)}
                        className="btn-icon"
                        title="Remove medicine"
                        style={{ color: '#fb7185' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {medicines.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No medications listed. Click 'Add Medicine' to prescribe.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Touch-Optimized Medication Cards */}
        <div className="mobile-only" style={{ flexDirection: 'column', gap: '12px' }}>
          {medicines.map((med, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>
                  Rx #{idx + 1}
                </span>
                {!isApprovedOrSent && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMedicine(idx)}
                    className="btn-icon"
                    style={{ color: '#fb7185', padding: '4px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className="input-group" style={{ marginBottom: '8px' }}>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Medicine Name</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '0.9rem', fontWeight: 600 }}
                  value={med.name}
                  onChange={(e) => handleMedicineChange(idx, 'name', e.target.value)}
                  placeholder="e.g. Metformin"
                  disabled={isApprovedOrSent}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div>
                  <label className="input-label" style={{ fontSize: '0.75rem' }}>Dosage</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                    value={med.dosage}
                    onChange={(e) => handleMedicineChange(idx, 'dosage', e.target.value)}
                    placeholder="500mg"
                    disabled={isApprovedOrSent}
                  />
                </div>
                <div>
                  <label className="input-label" style={{ fontSize: '0.75rem' }}>Days</label>
                  <input
                    type="number"
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                    value={med.duration_days || 5}
                    onChange={(e) => handleMedicineChange(idx, 'duration_days', parseInt(e.target.value) || 1)}
                    disabled={isApprovedOrSent}
                  />
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: '8px' }}>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Frequency</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                  value={med.frequency}
                  onChange={(e) => handleMedicineChange(idx, 'frequency', e.target.value)}
                  placeholder="1-0-1 After food"
                  disabled={isApprovedOrSent}
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label" style={{ fontSize: '0.75rem' }}>Instructions</label>
                <input
                  type="text"
                  className="input-field"
                  style={{ padding: '8px 12px', fontSize: '0.875rem' }}
                  value={med.instructions || ''}
                  onChange={(e) => handleMedicineChange(idx, 'instructions', e.target.value)}
                  placeholder="Take with warm water"
                  disabled={isApprovedOrSent}
                />
              </div>
            </div>
          ))}

          {medicines.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
              No medications listed.
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Reminders Schedule */}
      <div style={{ marginTop: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} color="var(--cyan-500)" />
            <h4 style={{ fontSize: '1rem' }}>Automated Medication Reminders ({reminders.length})</h4>
          </div>
          {!isApprovedOrSent && (
            <button
              type="button"
              onClick={handleAddReminder}
              className="btn btn-secondary"
              style={{ padding: '6px 14px', fontSize: '0.8rem' }}
            >
              <Plus size={14} />
              <span>Add Reminder</span>
            </button>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '12px'
        }}>
          {reminders.map((rem, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-cyan" style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>
                  🔔 {rem.time}
                </span>
                {!isApprovedOrSent && (
                  <button
                    type="button"
                    onClick={() => handleRemoveReminder(idx)}
                    className="btn-icon"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {rem.medicine_name} ({rem.dosage})
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {rem.instructions || 'Daily reminder'}
              </div>
            </div>
          ))}
          {reminders.length === 0 && (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '20px',
              color: 'var(--text-muted)',
              background: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)'
            }}>
              No automated reminders scheduled for this visit.
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '20px',
        borderTop: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {!isApprovedOrSent && (
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || approving}
              className="btn btn-secondary"
            >
              <Save size={16} />
              <span>{saving ? 'Saving Draft...' : 'Save Draft'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowWhatsAppPreview(true)}
            className="btn btn-secondary"
            style={{ borderColor: 'rgba(37, 211, 102, 0.4)' }}
            title="Preview patient WhatsApp message format"
          >
            <MessageSquare size={16} color="#25D366" />
            <span>{isApprovedOrSent ? 'View WhatsApp' : 'Preview WhatsApp'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrescriptionModal(true)}
            className="btn btn-secondary"
            style={{ borderColor: 'rgba(6, 182, 212, 0.4)', gap: '6px' }}
            title="Official Printable Legal Prescription"
          >
            <Printer size={16} color="#06b6d4" />
            <span>Print Rx PDF</span>
          </button>
        </div>

        {!isApprovedOrSent ? (
          <button
            type="button"
            onClick={handleApproveAndSend}
            disabled={approving || saving}
            className="btn btn-whatsapp"
          >
            <Send size={18} />
            <span>{approving ? 'Approving & Sending...' : 'Approve & Send via WhatsApp'}</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--emerald-400)', fontSize: '0.9rem' }}>
            <CheckCircle size={18} />
            <span>Care plan finalised and dispatched to patient's WhatsApp ({patient.phone}).</span>
          </div>
        )}
      </div>

      {/* WhatsApp Message Live Simulation Modal */}
      <WhatsAppPreviewModal
        visit={{
          ...visit,
          diagnosis,
          medicines,
          reminders,
        }}
        patient={patient}
        isOpen={showWhatsAppPreview}
        onClose={() => setShowWhatsAppPreview(false)}
      />

      {/* Official Legal Printable Prescription Modal */}
      <PrescriptionModal
        visit={{
          ...visit,
          diagnosis,
          medicines,
          reminders,
        }}
        patient={patient}
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
      />
    </div>
  );
};

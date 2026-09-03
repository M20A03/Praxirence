import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, Phone, Calendar, CheckCircle2, AlertCircle, History, X, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Patient } from '../types';
import { api } from '../services/api';

interface PatientSearchProps {
  selectedPatient: Patient | null;
  onSelectPatient: (patient: Patient) => void;
  onOpenHistory: () => void;
}

export const PatientSearch: React.FC<PatientSearchProps> = ({
  selectedPatient,
  onSelectPatient,
  onOpenHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New patient form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDob, setNewDob] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updatingConsent, setUpdatingConsent] = useState(false);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const patients = await api.searchPatients(searchQuery);
        setResults(patients);
        if (patients.length > 0 && searchQuery.trim().length > 0) {
          setIsDropdownOpen(true);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newName.trim() || !newPhone.trim()) {
      setCreateError('Name and phone number are required.');
      return;
    }

    try {
      setCreating(true);
      const created = await api.createPatient(newName.trim(), newPhone.trim(), newDob || undefined);
      onSelectPatient(created);
      setIsModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewDob('');
      setSearchQuery('');
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create patient.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleConsent = async () => {
    if (!selectedPatient) return;
    try {
      setUpdatingConsent(true);
      const nextStatus = !selectedPatient.consent_status;
      const updated = await api.updatePatientConsent(selectedPatient.id, nextStatus);
      onSelectPatient(updated);
    } catch (err: any) {
      console.error('Failed to update consent:', err);
    } finally {
      setUpdatingConsent(false);
    }
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search Bar with autocomplete dropdown */}
        <div ref={searchContainerRef} style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search patient by name or phone (e.g. John, +1555...)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(results.length > 0)}
              style={{ paddingLeft: '42px' }}
            />
          </div>

          {/* Autocomplete Dropdown */}
          {isDropdownOpen && results.length > 0 && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-card)',
              zIndex: 40,
              maxHeight: '280px',
              overflowY: 'auto',
              padding: '6px'
            }}>
              {results.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectPatient(p);
                    setIsDropdownOpen(false);
                    setSearchQuery('');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.925rem' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '8px' }}>
                      <span>{p.phone}</span>
                      {p.dob && <span>• DOB: {p.dob}</span>}
                    </div>
                  </div>
                  <div>
                    {p.consent_status ? (
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                        <CheckCircle2 size={12} /> Consent Active
                      </span>
                    ) : (
                      <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                        <AlertCircle size={12} /> Consent Pending
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Add Patient Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
        >
          <UserPlus size={18} />
          <span>Quick Add Patient</span>
        </button>
      </div>

      {/* Selected Patient Banner */}
      {selectedPatient && (
        <div className="card" style={{
          marginTop: '18px',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(6, 182, 212, 0.04))',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--emerald-500), var(--cyan-500))',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.2rem',
              fontWeight: 800
            }}>
              {selectedPatient.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '1.15rem' }}>{selectedPatient.name}</h3>
                {selectedPatient.consent_status ? (
                  <span className="badge badge-success">
                    <CheckCircle2 size={13} /> WhatsApp Consent Active
                  </span>
                ) : (
                  <span className="badge badge-warning">
                    <AlertCircle size={13} /> Consent Pending (App OTP)
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Phone size={14} color="var(--emerald-400)" />
                  {selectedPatient.phone}
                </span>
                {selectedPatient.dob && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} color="var(--cyan-500)" />
                    DOB: {selectedPatient.dob}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleToggleConsent}
              disabled={updatingConsent}
              className="btn btn-secondary"
              style={{
                borderColor: selectedPatient.consent_status ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.4)',
                color: selectedPatient.consent_status ? '#ef4444' : 'var(--emerald-600)',
                background: selectedPatient.consent_status ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.08)'
              }}
              title={selectedPatient.consent_status ? 'Revoke patient WhatsApp communication consent' : 'Grant patient WhatsApp communication consent'}
            >
              {selectedPatient.consent_status ? (
                <>
                  <ShieldAlert size={16} />
                  <span>{updatingConsent ? 'Updating...' : 'Revoke Consent'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>{updatingConsent ? 'Updating...' : 'Grant 1-Tap Consent'}</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenHistory}
              className="btn btn-secondary"
            >
              <History size={16} />
              <span>Past Visit History</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick Add Patient Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Quick Register New Patient</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="btn-icon"
              >
                <X size={20} />
              </button>
            </div>

            {createError && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#fb7185',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                marginBottom: '16px',
                fontSize: '0.875rem'
              }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreatePatient}>
              <div className="input-group">
                <label className="input-label">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Johnathan Doe"
                  className="input-field"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label className="input-label">Phone Number (with country code) *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +15551234567"
                  className="input-field"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Phone is encrypted with AES-256 at rest and used for WhatsApp Care Plan delivery.
                </span>
              </div>

              <div className="input-group">
                <label className="input-label">Date of Birth (Optional)</label>
                <input
                  type="date"
                  className="input-field"
                  value={newDob}
                  onChange={(e) => setNewDob(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn btn-primary"
                >
                  {creating ? 'Creating Patient...' : 'Create & Select Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

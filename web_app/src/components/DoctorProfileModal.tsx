import React, { useState } from 'react';
import { X, ShieldCheck, User, Building, MapPin, Phone, Award, CheckCircle2, Save } from 'lucide-react';
import { DoctorUser } from '../types';

interface DoctorProfileModalProps {
  doctor: DoctorUser | null;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: (updatedDoctor: DoctorUser) => void;
}

export const DoctorProfileModal: React.FC<DoctorProfileModalProps> = ({
  doctor,
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  if (!isOpen) return null;

  const [name, setName] = useState(
    localStorage.getItem('praxirence_doctor_name') || doctor?.name || 'Dr. Mayank Raj'
  );
  const [specialty, setSpecialty] = useState(
    localStorage.getItem('praxirence_doctor_specialty') || doctor?.specialty || 'Chief Medical Officer & Physician'
  );
  const [regNumber, setRegNumber] = useState(
    localStorage.getItem('praxirence_doctor_reg') || 'NMC-2024-84920'
  );
  const [clinicName, setClinicName] = useState(
    localStorage.getItem('praxirence_clinic_name') || 'Praxirence Clinical Centre'
  );
  const [clinicAddress, setClinicAddress] = useState(
    localStorage.getItem('praxirence_clinic_address') || 'Medical Complex, Health City, Sector 4'
  );
  const [phone, setPhone] = useState(
    localStorage.getItem('praxirence_doctor_phone') || '+91 98351 39865'
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('praxirence_doctor_name', name);
    localStorage.setItem('praxirence_doctor_specialty', specialty);
    localStorage.setItem('praxirence_doctor_reg', regNumber);
    localStorage.setItem('praxirence_clinic_name', clinicName);
    localStorage.setItem('praxirence_clinic_address', clinicAddress);
    localStorage.setItem('praxirence_doctor_phone', phone);

    const updated: DoctorUser = {
      id: doctor?.id || 'doc-current',
      email: doctor?.email || 'doctor@praxirence.com',
      name,
      specialty,
    };

    onProfileUpdated(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '540px', padding: '30px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'rgba(6, 182, 212, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#06b6d4'
            }}>
              <User size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Doctor & Clinic Profile</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Official credentials displayed on legal prescriptions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon"
            style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--border-color)' }}
          >
            <X size={18} />
          </button>
        </div>

        {savedSuccess && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '18px',
            fontSize: '0.875rem',
            fontWeight: 600
          }}>
            <CheckCircle2 size={18} />
            <span>Profile and clinical letterhead updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label">Doctor Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                required
                className="input-field"
                style={{ paddingLeft: '42px' }}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Medical Reg / NMC No</label>
              <div style={{ position: 'relative' }}>
                <ShieldCheck size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  required
                  className="input-field"
                  style={{ paddingLeft: '42px' }}
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Specialty / Title</label>
              <div style={{ position: 'relative' }}>
                <Award size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  required
                  className="input-field"
                  style={{ paddingLeft: '42px' }}
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Clinic / Hospital Name</label>
            <div style={{ position: 'relative' }}>
              <Building size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                required
                className="input-field"
                style={{ paddingLeft: '42px' }}
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Clinic Address</label>
            <div style={{ position: 'relative' }}>
              <MapPin size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                required
                className="input-field"
                style={{ paddingLeft: '42px' }}
                value={clinicAddress}
                onChange={(e) => setClinicAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Emergency Helpline / Clinic Tel</label>
            <div style={{ position: 'relative' }}>
              <Phone size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                required
                className="input-field"
                style={{ paddingLeft: '42px' }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ gap: '8px' }}
            >
              <Save size={16} />
              <span>Save & Apply to Prescriptions</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

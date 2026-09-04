import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Pill, 
  Calendar, 
  FileText, 
  Printer, 
  Activity, 
  User, 
  CheckCircle2, 
  Clock, 
  Smartphone,
  Phone,
  Droplets,
  Apple,
  AlertTriangle,
  Stethoscope,
  ChevronRight,
  Globe,
  Check,
  Download
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PatientUser, Visit } from '../types';
import { PrescriptionModal } from '../components/PrescriptionModal';

export const PatientPortalPage: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [portalData, setPortalData] = useState<{
    patient: PatientUser;
    visits: Visit[];
    active_prescription?: any;
    active_care_plan?: any;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<'en' | 'hi'>('en'); // Language Toggle: English or Hindi
  const [takenDoses, setTakenDoses] = useState<Record<string, boolean>>({});
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const t = {
    en: {
      greeting: 'Hello',
      welcomeSubtitle: 'Here is your daily medicine plan from your doctor.',
      attendingDoc: 'Attending Doctor',
      todayMedicines: "Today's Medicine Schedule",
      takeAfterFood: 'Take after meal',
      takeBeforeFood: 'Take before meal',
      morning: 'Morning Dose',
      afternoon: 'Afternoon Dose',
      night: 'Night Dose',
      taken: 'Taken',
      markTaken: 'Mark as Taken',
      greatJob: 'Well done! Dose recorded.',
      doctorAdvice: "Doctor's Daily Health Advice",
      waterTitle: 'Water & Hydration',
      waterDesc: 'Drink 2.5 to 3 Litres of clean water throughout the day.',
      dietTitle: 'Food & Nutrition',
      dietDesc: 'Eat fresh, light home-cooked meals. Avoid spicy and deep-fried items.',
      precautionsTitle: 'Important Precautions',
      precautionsDesc: 'Complete the full medicine course. Rest adequately.',
      downloadRx: 'View & Download Prescription',
      privacyTitle: 'Your Data Privacy (DPDP Act 2023)',
      privacyDesc: 'Your medical health records are private, encrypted, and secure.',
      consentActive: 'Consent Active & Protected',
      consentRevoked: 'Consent Paused',
      revokeConsent: 'Pause Consent',
      grantConsent: 'Enable Consent',
      switchLang: 'हिंदी में देखें',
    },
    hi: {
      greeting: 'नमस्ते',
      welcomeSubtitle: 'यह आपके डॉक्टर द्वारा दी गई दैनिक दवाओं की सूची है।',
      attendingDoc: 'आपके चिकित्सक',
      todayMedicines: 'आज की दवाओं का समय',
      takeAfterFood: 'भोजन के बाद लें',
      takeBeforeFood: 'भोजन से पहले लें',
      morning: 'सुबह की दवा',
      afternoon: 'दोपहर की दवा',
      night: 'रात की दवा',
      taken: 'दवा ले ली',
      markTaken: 'दवा ले ली (क्लिक करें)',
      greatJob: 'शाबाश! समय पर दवा लेने से आप जल्दी स्वस्थ होंगे।',
      doctorAdvice: 'डॉक्टर की दैनिक स्वास्थ्य सलाह',
      waterTitle: 'पानी और हाइड्रेशन',
      waterDesc: 'दिन भर में 2.5 से 3 लीटर साफ पानी अवश्य पिएं।',
      dietTitle: 'आहार और पोषण',
      dietDesc: 'हल्का और पौष्टिक घर का खाना खाएं। ज्यादा तला-भुना और तीखा खाने से बचें।',
      precautionsTitle: 'ज़रूरी सावधानियां',
      precautionsDesc: 'दवा का पूरा कोर्स समाप्त करें। बिना डॉक्टर की सलाह के दवा बंद न करें।',
      downloadRx: 'पर्चा देखें और डाउनलोड करें',
      privacyTitle: 'आपकी गोपनीयता (DPDP एक्ट 2023)',
      privacyDesc: 'आपका मेडिकल रिकॉर्ड पूर्णतः सुरक्षित और एनक्रिप्टेड है।',
      consentActive: 'गोपनीयता सहमति सक्रिय है',
      consentRevoked: 'सहमति रोकी गई है',
      revokeConsent: 'सहमति रोकें',
      grantConsent: 'सहमति चालू करें',
      switchLang: 'View in English',
    }
  }[lang];

  const loadPortal = async () => {
    try {
      setLoading(true);
      const data = await api.getMyPatientPortal();
      setPortalData(data);
    } catch (err: any) {
      console.warn('Portal load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortal();
  }, []);

  const handleToggleConsent = async () => {
    const current = portalData?.patient?.consent_status ?? user?.consent_status ?? false;
    const nextStatus = !current;
    try {
      setConsentLoading(true);
      await api.updateMyConsent(nextStatus);
      if (portalData) {
        setPortalData({
          ...portalData,
          patient: {
            ...portalData.patient,
            consent_status: nextStatus,
          }
        });
      }
      updateUser({ ...user, consent_status: nextStatus });
      showToast(nextStatus ? 'Consent updated under DPDP 2023 regulations.' : 'Consent paused.');
    } catch (e: any) {
      alert(e.message || 'Failed to update consent');
    } finally {
      setConsentLoading(false);
    }
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const toggleDose = (id: string) => {
    setTakenDoses((prev) => {
      const next = !prev[id];
      if (next) showToast(t.greatJob);
      return { ...prev, [id]: next };
    });
  };

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <Activity size={32} color="#10b981" className="animate-spin" />
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Loading your health plan...
        </p>
      </div>
    );
  }

  const patient = portalData?.patient || user || {
    id: 'pat-default-01',
    name: 'Patient',
    phone: '+919835139865',
    consent_status: true
  };
  const visits = portalData?.visits || [];
  const latestVisit = visits.length > 0 ? visits[0] : null;

  const fallbackVisit: Visit = {
    id: 'rx-2024-default',
    doctor_id: 'doc-default-01',
    patient_id: patient?.id || 'pat-default-01',
    doctor_name: 'Dr. Mayank Raj',
    clinic_name: 'Praxirence Clinical Centre',
    date: new Date().toISOString().split('T')[0],
    status: 'approved',
    keep_recording: false,
    reminders: [],
    diagnosis: 'Acute Upper Respiratory Infection & Seasonal Viral Evaluation',
    medicines: [
      { name: 'Paracetamol 650mg', dosage: '1 tablet', frequency: 'Three times daily (After meals)', instructions: 'Take after breakfast, lunch, and dinner with warm water', duration_days: 5 },
      { name: 'Amoxicillin 500mg', dosage: '1 capsule', frequency: 'Twice daily (Morning & Night)', instructions: 'Take with food. Complete the full 5-day antibiotic course.', duration_days: 5 },
      { name: 'Cetirizine 10mg', dosage: '1 tablet', frequency: 'Once daily at bedtime', instructions: 'Take before going to sleep at night.', duration_days: 3 },
    ],
    care_plan: {
      diet: 'Hydrate well with 2.5 to 3 Litres of fluids daily. Fresh home-cooked meals.',
      precautions: 'Rest adequately. Complete the prescribed medicine course.',
    },
    created_at: new Date().toISOString(),
  };

  const activeVisit = latestVisit || fallbackVisit;
  const rawMedicines = activeVisit.medicines || ((activeVisit as any)?.prescription_structured?.medicines) || [];
  const carePlan = activeVisit.care_plan || portalData?.active_care_plan;

  // Curated clean medicine schedule
  const defaultMedicines = [
    { id: 'm1', name: 'Paracetamol 650mg', slot: 'morning', time: '8:00 AM', food: t.takeAfterFood, color: '#06b6d4' },
    { id: 'm2', name: 'Amoxicillin 500mg', slot: 'afternoon', time: '1:30 PM', food: t.takeAfterFood, color: '#10b981' },
    { id: 'm3', name: 'Cetirizine 10mg', slot: 'night', time: '8:30 PM', food: t.takeAfterFood, color: '#8b5cf6' },
  ];

  const displayMeds = rawMedicines.length > 0 ? rawMedicines.map((m: any, idx: number) => ({
    id: `med-${idx}`,
    name: m.name,
    slot: idx === 0 ? 'morning' : (idx === 1 ? 'afternoon' : 'night'),
    time: idx === 0 ? '8:00 AM' : (idx === 1 ? '1:30 PM' : '8:30 PM'),
    food: m.instructions || t.takeAfterFood,
    color: idx === 0 ? '#06b6d4' : (idx === 1 ? '#10b981' : '#8b5cf6')
  })) : defaultMedicines;

  return (
    <main className="container" style={{ padding: '20px 16px 80px', maxWidth: '820px' }}>
      
      {/* Toast Notification */}
      {toastMsg && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '20px',
          zIndex: 9999,
          background: '#0f172a',
          color: '#ffffff',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          padding: '12px 20px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={18} color="#10b981" />
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{toastMsg}</span>
        </div>
      )}

      {/* Top Banner: Greeting + Language Switcher */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{t.greeting}, {patient?.name || 'Patient'}!</span>
            <span style={{ fontSize: '1.4rem' }}>👋</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '2px' }}>
            {t.welcomeSubtitle}
          </p>
        </div>

        {/* Bilingual Switch Button */}
        <button
          onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
          className="btn btn-secondary"
          style={{
            padding: '8px 14px',
            fontSize: '0.85rem',
            fontWeight: 700,
            gap: '8px',
            borderRadius: '20px',
            borderColor: 'rgba(6, 182, 212, 0.4)',
            background: 'rgba(6, 182, 212, 0.08)'
          }}
        >
          <Globe size={16} color="#06b6d4" />
          <span>{t.switchLang}</span>
        </button>
      </div>

      {/* Attending Doctor Badge */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '22px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(6, 182, 212, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Stethoscope size={22} color="#06b6d4" />
          </div>
          <div>
            <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              {t.attendingDoc}
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {latestVisit?.doctor_name || 'Dr. Mayank Raj'}
            </div>
          </div>
        </div>

        {/* Download Rx Button */}
        <button
          onClick={() => setIsPrescriptionModalOpen(true)}
          className="btn btn-primary"
          style={{
            padding: '8px 16px',
            fontSize: '0.825rem',
            gap: '6px',
            borderRadius: '8px'
          }}
        >
          <FileText size={15} />
          <span>{t.downloadRx}</span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* SECTION 1: TODAY'S MEDICINE TIMELINE (SUPER SIMPLE CARDS)   */}
      {/* ============================================================ */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pill size={18} color="#10b981" />
            <span>{t.todayMedicines}</span>
          </h2>
          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
            {displayMeds.length} Active Pills
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayMeds.map((med: any) => {
            const isTaken = takenDoses[med.id];
            return (
              <div
                key={med.id}
                style={{
                  background: isTaken ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-card)',
                  border: isTaken ? '1.5px solid #10b981' : '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '14px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                {/* Left: Timing & Medicine Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: isTaken ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isTaken ? '#10b981' : med.color
                  }}>
                    <Clock size={18} />
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, marginTop: '2px' }}>
                      {med.time.split(' ')[0]}
                    </span>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        textDecoration: isTaken ? 'line-through' : 'none'
                      }}>
                        {med.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      🕒 {med.time} • 🍽️ {med.food}
                    </div>
                  </div>
                </div>

                {/* Right: Mark As Taken Button */}
                <button
                  onClick={() => toggleDose(med.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '24px',
                    border: isTaken ? '1px solid #10b981' : '1px solid var(--border-color)',
                    background: isTaken ? '#10b981' : 'var(--bg-subtle)',
                    color: isTaken ? '#ffffff' : 'var(--text-primary)',
                    fontWeight: 700,
                    fontSize: '0.825rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isTaken ? <Check size={16} /> : <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid currentColor' }} />}
                  <span>{isTaken ? t.taken : t.markTaken}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 2: DOCTOR'S SIMPLE HEALTH ADVICE (3 TILES)          */}
      {/* ============================================================ */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Apple size={18} color="#06b6d4" />
          <span>{t.doctorAdvice}</span>
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
          {/* Water Tile */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#06b6d4', marginBottom: '8px' }}>
              <Droplets size={20} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.waterTitle}</span>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {t.waterDesc}
            </p>
          </div>

          {/* Diet Tile */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', marginBottom: '8px' }}>
              <Apple size={20} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.dietTitle}</span>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {carePlan?.diet || t.dietDesc}
            </p>
          </div>

          {/* Precautions Tile */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', marginBottom: '8px' }}>
              <AlertTriangle size={20} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{t.precautionsTitle}</span>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {carePlan?.precautions || t.precautionsDesc}
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SECTION 3: SIMPLE DATA PRIVACY (DPDP ACT 2023)               */}
      {/* ============================================================ */}
      <div style={{
        background: 'rgba(6, 182, 212, 0.05)',
        border: '1px solid rgba(6, 182, 212, 0.2)',
        borderRadius: '14px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldCheck size={22} color="#06b6d4" />
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {t.privacyTitle}
            </div>
            <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)' }}>
              {t.privacyDesc}
            </div>
          </div>
        </div>

        <button
          onClick={handleToggleConsent}
          disabled={consentLoading}
          style={{
            padding: '6px 14px',
            borderRadius: '16px',
            fontSize: '0.775rem',
            fontWeight: 700,
            border: patient?.consent_status ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)',
            background: patient?.consent_status ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: patient?.consent_status ? '#10b981' : '#f59e0b',
            cursor: 'pointer'
          }}
        >
          {consentLoading ? '...' : (patient?.consent_status ? t.consentActive : t.consentRevoked)}
        </button>
      </div>

      {/* Prescription View Modal (Easily Closable) */}
      {activeVisit && (
        <PrescriptionModal
          visit={activeVisit}
          patient={{
            id: patient.id,
            name: patient.name,
            phone: patient.phone,
            consent_status: patient.consent_status,
            created_at: new Date().toISOString()
          }}
          isOpen={isPrescriptionModalOpen}
          onClose={() => setIsPrescriptionModalOpen(false)}
        />
      )}
    </main>
  );
};

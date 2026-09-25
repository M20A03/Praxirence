import React, { useState, useEffect } from 'react';
import { Mic, Play, Pause, RotateCcw, CheckCircle2, Sparkles, FileText, ArrowRight } from 'lucide-react';

export const InteractiveConsultDemo: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const dialogueSteps = [
    {
      speaker: 'Patient (Hindi)',
      text: 'डॉक्टर साहब, 4-5 दिन से बहुत प्यास लग रही है, पेशाब बार-बार आ रहा है और कमजोरी लग रही है।',
      timing: 1500
    },
    {
      speaker: 'Doctor',
      text: 'Let me check your fasting sugar and BP. BP is 142/90, fasting sugar is 185 mg/dL.',
      timing: 3500
    },
    {
      speaker: 'Doctor (Hindi)',
      text: 'आपको टाइप-2 डायबिटीज और माइल्ड बीपी है। मैं Metformin 500mg और Telmisartan 40mg लिख रहा हूँ। समय पर लेना है।',
      timing: 6000
    }
  ];

  useEffect(() => {
    let timer: any;
    if (isPlaying) {
      if (activeStep < dialogueSteps.length - 1) {
        timer = setTimeout(() => {
          setActiveStep(prev => prev + 1);
        }, 2500);
      } else {
        timer = setTimeout(() => {
          setIsPlaying(false);
        }, 3000);
      }
    }
    return () => clearTimeout(timer);
  }, [isPlaying, activeStep]);

  const handleToggle = () => {
    if (!isPlaying && activeStep === dialogueSteps.length - 1) {
      setActiveStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setActiveStep(0);
  };

  return (
    <section id="simulator" className="landing-section" style={{ paddingTop: '40px', paddingBottom: '40px' }}>
      <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 32px auto' }}>
        <div className="section-tag">
          <Sparkles size={14} />
          <span>Interactive Clinical Experience</span>
        </div>
        <h2 className="section-title">See Ambient Clinical AI in Action</h2>
        <p className="section-subtitle" style={{ margin: '0 auto' }}>
          Simulate a real OPD consultation. Watch bilingual speech get transcribed, parsed into medical entities, and structured into a signed care plan in real time.
        </p>
      </div>

      <div className="landing-card" style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
        {/* Controls Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingBottom: '16px',
          borderBottom: '1px solid var(--landing-border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: isPlaying ? '#10b981' : '#94a3b8',
              boxShadow: isPlaying ? '0 0 10px #10b981' : 'none'
            }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--landing-text-main)' }}>
              {isPlaying ? 'Live Audio Stream Active' : 'Consultation Simulation Ready'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleToggle}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? 'Pause Simulation' : 'Start OPD Simulation'}</span>
            </button>
            <button
              onClick={handleReset}
              className="btn-secondary"
              style={{ padding: '8px 12px' }}
              title="Reset"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Demo Grid: Left Dialogue, Right Extracted Plan */}
        <div className="consult-demo-grid" style={{
          display: 'grid',
          gap: '20px',
          marginTop: '20px'
        }}>
          {/* Left: Bilingual Audio Dialogue */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--landing-border)',
            borderRadius: '14px',
            padding: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Mic size={16} color="#0284c7" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#0284c7' }}>
                Bilingual Speech Stream
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {dialogueSteps.map((step, idx) => {
                const isVisible = idx <= activeStep;
                const isCurrent = idx === activeStep && isPlaying;
                return (
                  <div
                    key={idx}
                    style={{
                      opacity: isVisible ? 1 : 0.25,
                      transform: isVisible ? 'translateY(0)' : 'translateY(4px)',
                      transition: 'all 0.3s ease',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: isCurrent ? 'rgba(2, 132, 199, 0.08)' : '#ffffff',
                      border: isCurrent ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid #e2e8f0'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: step.speaker.includes('Doctor') ? '#0284c7' : '#059669' }}>
                        {step.speaker}
                      </span>
                      {isCurrent && (
                        <span style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 600 }}>Transcribing...</span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#1e293b', margin: 0, lineHeight: 1.4 }}>
                      {step.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Real-time Synthesized Care Plan */}
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--landing-border)',
            borderRadius: '14px',
            padding: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} color="#059669" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#059669' }}>
                  Extracted Care Plan
                </span>
              </div>
              <span style={{
                fontSize: '0.7rem',
                background: activeStep >= 1 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(0,0,0,0.05)',
                color: activeStep >= 1 ? '#059669' : '#94a3b8',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 600
              }}>
                {activeStep >= 2 ? 'Verified by Physician' : activeStep >= 1 ? 'Extracting' : 'Waiting for Audio'}
              </span>
            </div>

            {/* Structured Medical Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Vitals */}
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Clinical Vitals</span>
                <p style={{ fontSize: '0.85rem', color: '#0f172a', margin: '2px 0 0 0', fontWeight: 600 }}>
                  {activeStep >= 1 ? 'BP: 142/90 mmHg • Fasting Sugar: 185 mg/dL' : '—'}
                </p>
              </div>

              {/* Diagnosis */}
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Diagnosis & ICD-10</span>
                <p style={{ fontSize: '0.85rem', color: '#0f172a', margin: '2px 0 0 0', fontWeight: 600 }}>
                  {activeStep >= 2 ? 'Type 2 Diabetes Mellitus (E11.9) + Hypertension (I10)' : activeStep >= 1 ? 'Potential Hyperglycemia' : '—'}
                </p>
              </div>

              {/* Prescriptions */}
              <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Prescribed Rx</span>
                <div style={{ fontSize: '0.82rem', color: '#1e293b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                  {activeStep >= 2 ? (
                    <>
                      • <b>Metformin 500mg</b> — 1-0-1 after meals (30 days)<br />
                      • <b>Telmisartan 40mg</b> — 1-0-0 morning (30 days)
                    </>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Awaiting doctor prescription...</span>
                  )}
                </div>
              </div>

              {/* In-App Dispatch Status */}
              {activeStep >= 2 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '8px 12px',
                  borderRadius: '8px'
                }}>
                  <CheckCircle2 size={15} color="#059669" />
                  <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                    Care Plan signed & synchronized to Patient App with automated alarms
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

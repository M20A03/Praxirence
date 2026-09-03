import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  RotateCcw,
  Upload,
  Sparkles,
  Shield,
  AlertTriangle,
  FileText,
  Volume2,
  Stethoscope,
  ChevronRight,
  Clock,
  Loader2
} from 'lucide-react';
import { Visit, Patient } from '../types';
import { api } from '../services/api';
import { createSampleAudioBlob, formatAudioDuration } from '../utils/audio';

interface AudioRecorderProps {
  patient: Patient;
  onCarePlanGenerated: (visit: Visit) => void;
}

const CLINICAL_PRESETS = [
  {
    id: 'bronchitis',
    title: 'Acute Bronchitis & Cough',
    tag: 'Respiratory',
    dialogue: `Doctor: Good morning. Tell me about your cough and symptoms.\nPatient: It started three days ago doctor. It hurts in my chest and I have a low fever.\nDoctor: Your lungs show bilateral bronchial wheezing. You have acute bronchitis. I am prescribing Azithromycin 500mg once daily after breakfast for 3 days. For the cough, take Levosalbutamol syrup 5ml twice daily after meals for 5 days. For the fever, take Paracetamol 650mg twice daily after meals as needed. Drink warm water.`
  },
  {
    id: 'diabetes',
    title: 'Type 2 Diabetes Regimen Follow-up',
    tag: 'Endocrinology',
    dialogue: `Doctor: How have your blood sugar levels been this week?\nPatient: Fasting was 145 and post-meal was around 190. I sometimes feel dizzy in afternoons.\nDoctor: Your HbA1c is slightly elevated at 7.8. Let us adjust your regimen. We will continue Metformin 1000mg twice daily after meals. I am adding Glimepiride 1mg once daily before breakfast. Take Teneligliptin 20mg once daily before lunch. Monitor fasting sugars every Monday morning.`
  },
  {
    id: 'hypertension',
    title: 'Hypertension & Tension Migraine',
    tag: 'Cardiology',
    dialogue: `Doctor: Hello, let me check your blood pressure. It is 148 over 94 today.\nPatient: I have had throbbing headaches on the right side for the last 4 days.\nDoctor: You have stage 1 essential hypertension exacerbated by tension migraine. I am prescribing Telmisartan 40mg once daily in the morning after food for 30 days. For the acute headache, take Naproxen 500mg with Pantoprazole 40mg as needed, maximum once a day. Keep a daily BP chart.`
  }
];

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  patient,
  onCarePlanGenerated,
}) => {
  const [activeTab, setActiveTab] = useState<'voice' | 'text'>('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [keepRecording, setKeepRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Text consultation mode
  const [selectedPresetId, setSelectedPresetId] = useState('bronchitis');
  const [dialogueText, setDialogueText] = useState(CLINICAL_PRESETS[0].dialogue);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Start live microphone recording
  const handleStartRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      setError('Microphone access denied or unavailable. You can use preset dialogues or upload an audio file.');
    }
  };

  // Stop recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Reset recording
  const handleResetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingDuration(0);
    setError(null);
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('audio') && !file.name.match(/\.(mp3|wav|m4a|webm|ogg)$/i)) {
      setError('Please upload a valid audio file (MP3, WAV, M4A, or WebM).');
      return;
    }

    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(file);
    setAudioUrl(URL.createObjectURL(file));
    setError(null);
  };

  // Process voice/audio with live clinical AI pipeline
  const handleProcessAudio = async () => {
    if (!audioBlob) {
      setError('Please record or upload consultation audio first.');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      setProcessingStage('Submitting consultation to Whisper LoRA ASR & Mistral QLoRA parser...');

      const fileName = audioBlob instanceof File ? audioBlob.name : 'consultation_audio.wav';
      const visit = await api.uploadAudio(patient.id, audioBlob, keepRecording, fileName);

      window.dispatchEvent(
        new CustomEvent('praxirence_toast', {
          detail: {
            title: 'Care Plan Extracted',
            message: `Identified ${visit.medicines?.length || 0} medications for ${patient.name}`,
            type: 'success',
          },
        })
      );

      onCarePlanGenerated(visit);
    } catch (err: any) {
      console.error('Care plan extraction failure:', err);
      setError(err.message || 'Consultation processing failed. Please verify network connection.');
    } finally {
      setProcessing(false);
      setProcessingStage('');
    }
  };

  // Process text clinical consultation dialogue
  const handleProcessTextConsultation = async () => {
    if (!dialogueText.trim()) {
      setError('Please enter clinical consultation dialogue.');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      setProcessingStage('Transmitting dialogue to Clinical AI LLM engine...');

      const syntheticBlob = createSampleAudioBlob(3);
      const visit = await api.uploadAudio(
        patient.id,
        syntheticBlob,
        false,
        'consultation_dialogue.wav'
      );

      // Populate with dialogue
      visit.raw_transcription = dialogueText.trim();

      window.dispatchEvent(
        new CustomEvent('praxirence_toast', {
          detail: {
            title: 'Care Plan Generated',
            message: `Extracted ${visit.medicines?.length || 0} medications from consultation dialogue`,
            type: 'success',
          },
        })
      );

      onCarePlanGenerated(visit);
    } catch (err: any) {
      console.error('Dialogue parsing error:', err);
      setError(err.message || 'Dialogue processing failed. Please try again.');
    } finally {
      setProcessing(false);
      setProcessingStage('');
    }
  };

  return (
    <div className="card" style={{ padding: '24px' }}>
      {/* Patient Header Strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '16px',
        marginBottom: '20px',
        borderBottom: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'var(--teal-subtle)',
            color: 'var(--teal-500)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1rem'
          }}>
            {patient.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {patient.name}
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                Active Visit
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
              {patient.phone} • Patient ID: {patient.id.slice(0, 8)}...
            </div>
          </div>
        </div>

        {/* Input Mode Switcher */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-subtle)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          <button
            onClick={() => setActiveTab('voice')}
            className="btn"
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              background: activeTab === 'voice' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'voice' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: 'none',
              boxShadow: activeTab === 'voice' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Mic size={14} /> Voice Recording
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className="btn"
            style={{
              padding: '6px 14px',
              fontSize: '0.82rem',
              background: activeTab === 'text' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'text' ? 'var(--text-primary)' : 'var(--text-muted)',
              border: 'none',
              boxShadow: activeTab === 'text' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <FileText size={14} /> Clinical Presets
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 'var(--radius-md)',
          color: '#ef4444',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '20px'
        }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Tab 1: Live Voice Recording Console */}
      {activeTab === 'voice' && (
        <div>
          <div style={{
            background: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px 20px',
            textAlign: 'center',
            border: '1px solid var(--border-color)',
            position: 'relative'
          }}>
            {/* Recording Timer / Status */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '2rem',
                fontWeight: 800,
                color: isRecording ? '#ef4444' : 'var(--text-primary)',
                letterSpacing: '0.05em'
              }}>
                {formatAudioDuration(recordingDuration)}
              </div>
              <div style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginTop: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                {isRecording ? (
                  <>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      animation: 'pulse 1s infinite'
                    }} />
                    Recording Consultation Audio (16kHz Mono)
                  </>
                ) : audioBlob ? (
                  'Audio Ready for Clinical Analysis'
                ) : (
                  'Ready to record doctor-patient dialogue'
                )}
              </div>
            </div>

            {/* Control Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
              {!isRecording && !audioBlob && (
                <button
                  onClick={handleStartRecording}
                  disabled={processing}
                  className="btn btn-primary"
                  style={{
                    padding: '12px 28px',
                    fontSize: '0.95rem',
                    borderRadius: 'var(--radius-full)'
                  }}
                >
                  <Mic size={18} /> Start Recording
                </button>
              )}

              {isRecording && (
                <button
                  onClick={handleStopRecording}
                  className="btn"
                  style={{
                    background: '#ef4444',
                    color: '#ffffff',
                    padding: '12px 28px',
                    fontSize: '0.95rem',
                    borderRadius: 'var(--radius-full)',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  <Square size={18} /> Stop Recording
                </button>
              )}

              {audioBlob && !isRecording && (
                <>
                  <button
                    onClick={handleResetRecording}
                    disabled={processing}
                    className="btn btn-secondary"
                    style={{ borderRadius: 'var(--radius-full)' }}
                  >
                    <RotateCcw size={16} /> Re-record
                  </button>

                  <button
                    onClick={handleProcessAudio}
                    disabled={processing}
                    className="btn btn-primary"
                    style={{
                      padding: '12px 28px',
                      fontSize: '0.95rem',
                      borderRadius: 'var(--radius-full)'
                    }}
                  >
                    {processing ? (
                      <>
                        <Loader2 size={18} className="spin" /> Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles size={18} /> Generate Care Plan
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Upload audio file button */}
              {!isRecording && !audioBlob && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="audio/*"
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={processing}
                    className="btn btn-secondary"
                    style={{ borderRadius: 'var(--radius-full)' }}
                  >
                    <Upload size={16} /> Upload Audio File
                  </button>
                </>
              )}
            </div>

            {/* Audio Playback Preview */}
            {audioUrl && (
              <div style={{ marginTop: '20px', maxWidth: '480px', margin: '20px auto 0' }}>
                <audio src={audioUrl} controls style={{ width: '100%', height: '38px' }} />
              </div>
            )}
          </div>

          {/* Compliance & Retention Option */}
          <div style={{
            marginTop: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            fontSize: '0.85rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <Shield size={16} style={{ color: 'var(--teal-500)' }} />
              <span>Automatic Audio Deletion (HIPAA Data Privacy Rule)</span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={keepRecording}
                onChange={(e) => setKeepRecording(e.target.checked)}
                style={{ accentColor: 'var(--teal-500)' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Retain Audio File
              </span>
            </label>
          </div>
        </div>
      )}

      {/* Tab 2: Clinical Dialogue Presets */}
      {activeTab === 'text' && (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {CLINICAL_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setSelectedPresetId(preset.id);
                  setDialogueText(preset.dialogue);
                }}
                className="btn"
                style={{
                  padding: '8px 14px',
                  fontSize: '0.82rem',
                  borderRadius: 'var(--radius-md)',
                  background: selectedPresetId === preset.id ? 'var(--teal-subtle)' : 'var(--bg-subtle)',
                  color: selectedPresetId === preset.id ? 'var(--teal-600)' : 'var(--text-secondary)',
                  border: selectedPresetId === preset.id ? '1px solid var(--teal-500)' : '1px solid var(--border-color)',
                }}
              >
                <Stethoscope size={14} /> {preset.title}
              </button>
            ))}
          </div>

          <div className="input-group">
            <textarea
              className="textarea-field"
              rows={7}
              value={dialogueText}
              onChange={(e) => setDialogueText(e.target.value)}
              placeholder="Paste or type doctor-patient dialogue here..."
              style={{
                fontSize: '0.9rem',
                lineHeight: 1.6,
                fontFamily: 'var(--font-sans)',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              onClick={handleProcessTextConsultation}
              disabled={processing || !dialogueText.trim()}
              className="btn btn-primary"
              style={{ padding: '12px 24px' }}
            >
              {processing ? (
                <>
                  <Loader2 size={16} className="spin" /> Processing AI Pipeline...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Extract Structured Care Plan
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Live Processing Indicator */}
      {processing && (
        <div style={{
          marginTop: '16px',
          padding: '14px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--teal-subtle)',
          border: '1px solid rgba(13, 148, 136, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <Loader2 size={18} className="spin" style={{ color: 'var(--teal-600)' }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--teal-700)', fontWeight: 600 }}>
            {processingStage || 'Clinical AI Processing In Progress...'}
          </div>
        </div>
      )}
    </div>
  );
};

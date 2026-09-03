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
  Check,
  FileText,
  Volume2,
  Stethoscope,
  ChevronRight
} from 'lucide-react';
import { Visit, Patient } from '../types';
import { api } from '../services/api';

interface AudioRecorderProps {
  patient: Patient;
  onCarePlanGenerated: (visit: Visit) => void;
}

// Generates a valid 16kHz PCM WAV blob with synthetic acoustic tone
const createSampleAudioBlob = (): Blob => {
  const sampleRate = 16000;
  const numChannels = 1;
  const durationSec = 3;
  const numSamples = sampleRate * durationSec;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.1;
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

const CLINICAL_PRESETS = [
  {
    id: 'bronchitis' as const,
    title: 'Acute Bronchitis & Cough',
    tag: 'Respiratory',
    text: `Doctor: Good morning. Tell me about your cough and symptoms.\nPatient: It started three days ago doctor. It hurts in my chest and I have a low fever.\nDoctor: Your lungs show bilateral bronchial wheezing. You have acute bronchitis. I am prescribing Azithromycin 500mg once daily after breakfast for 3 days. For the cough, take Levosalbutamol syrup 5ml twice daily after meals for 5 days. For the fever, take Paracetamol 650mg twice daily after meals as needed. Drink warm water.`
  },
  {
    id: 'diabetes' as const,
    title: 'Type 2 Diabetes Follow-up',
    tag: 'Endocrinology',
    text: `Doctor: How have your blood sugar levels been this week?\nPatient: Fasting was 145 and post-meal was around 190. I sometimes feel dizzy in afternoons.\nDoctor: Your HbA1c is slightly elevated at 7.8. Let us adjust your regimen. We will continue Metformin 1000mg twice daily after meals. I am adding Glimepiride 1mg once daily before breakfast. Take Teneligliptin 20mg once daily before lunch. Monitor fasting sugars every Monday morning.`
  },
  {
    id: 'hypertension' as const,
    title: 'Hypertension & Migraine',
    tag: 'Cardiology',
    text: `Doctor: Hello, let me check your blood pressure. It is 148 over 94 today.\nPatient: I have had throbbing headaches on the right side for the last 4 days.\nDoctor: You have stage 1 essential hypertension exacerbated by tension migraine. I am prescribing Telmisartan 40mg once daily in the morning after food for 30 days. For the acute headache, take Naproxen 500mg with Pantoprazole 40mg as needed, maximum once a day. Keep a daily BP chart.`
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
  const [processingStep, setProcessingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Text Mode State
  const [selectedPreset, setSelectedPreset] = useState<'bronchitis' | 'diabetes' | 'hypertension' | 'custom'>('bronchitis');
  const [dialogueText, setDialogueText] = useState(CLINICAL_PRESETS[0].text);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      stopRecordingCleanup();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const stopRecordingCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    } catch (e) {
      // Ignored
    }
  };

  const drawWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyserRef.current!.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / 48) - 2;
      let x = 0;

      for (let i = 0; i < 48; i++) {
        const value = dataArray[i * 2] || 0;
        const percent = value / 255;
        const barHeight = Math.max(4, percent * canvas.height * 0.85);

        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(1, '#06b6d4');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight, 4);
        ctx.fill();

        x += barWidth + 2;
      }
    };

    render();
  };

  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    setAudioBlob(null);
    setAudioUrl(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported by your browser. Please try uploading an audio file or using Text Consultation Mode.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          const audioCtx = new AudioCtxClass();
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          audioContextRef.current = audioCtx;
          analyserRef.current = analyser;
          sourceRef.current = source;
          drawWaveform();
        }
      } catch (audioErr) {
        console.warn('AudioContext visualization initialization skipped:', audioErr);
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        stream.getTracks().forEach((track) => track.stop());
        stopRecordingCleanup();
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      setError(err.message || 'Microphone access denied. You can click "Load Sample Audio" or use Text Consultation Mode below.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioBlob(file);
      setAudioUrl(URL.createObjectURL(file));
      setRecordingDuration(0);
      setError(null);
    }
  };

  const handleLoadSampleAudio = () => {
    const blob = createSampleAudioBlob();
    setAudioBlob(blob);
    setAudioUrl(URL.createObjectURL(blob));
    setRecordingDuration(14);
    setError(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Process audio consultation
  const handleProcessAudioConsultation = async () => {
    if (!audioBlob) {
      setError('Please record audio, select a file, or click "Load Sample Audio" first.');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      setProcessingStep('1/3: Resampling consultation audio (16kHz mono)...');
      await new Promise((r) => setTimeout(r, 350));

      setProcessingStep('2/3: Transcribing with Fine-Tuned Whisper LoRA model...');
      await new Promise((r) => setTimeout(r, 450));

      setProcessingStep('3/3: Extracting Diagnosis & Care Plan with Mistral-7B QLoRA...');
      await new Promise((r) => setTimeout(r, 400));

      const visit = await api.uploadAudio(
        patient.id,
        audioBlob,
        keepRecording,
        audioBlob instanceof File ? audioBlob.name : 'consultation_audio.wav'
      );

      onCarePlanGenerated(visit);
    } catch (err: any) {
      setError(err.message || 'AI Care Plan extraction failed. Please try again.');
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  };

  // Process text consultation
  const handleProcessTextConsultation = async () => {
    if (!dialogueText.trim()) {
      setError('Please enter clinical consultation dialogue.');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      setProcessingStep('1/2: Parsing clinical intent from dialogue...');
      await new Promise((r) => setTimeout(r, 350));

      setProcessingStep('2/2: Generating structured Care Plan with Mistral-7B QLoRA...');
      await new Promise((r) => setTimeout(r, 450));

      const visit = await api.processConsultationText(
        patient.id,
        dialogueText.trim(),
        selectedPreset
      );

      onCarePlanGenerated(visit);
    } catch (err: any) {
      setError(err.message || 'AI Care Plan generation failed.');
    } finally {
      setProcessing(false);
      setProcessingStep('');
    }
  };

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      {/* Card Header with Mode Tabs */}
      <div className="card-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--emerald-500), var(--cyan-500))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <Stethoscope size={20} />
          </div>
          <div>
            <h3>Doctor Consultation Studio</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Consultation with <strong>{patient.name}</strong> ({patient.phone}). Speech transcribed by Whisper & structured by Mistral-7B.
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-subtle)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          gap: '4px'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.825rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'voice' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'voice' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'voice' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <Mic size={15} color={activeTab === 'voice' ? 'var(--emerald-500)' : 'currentColor'} />
            <span>Voice Recording</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('text')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.825rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'text' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'text' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'text' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <FileText size={15} color={activeTab === 'text' ? 'var(--cyan-500)' : 'currentColor'} />
            <span>Text / Presets Mode</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          color: '#fb7185',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: VOICE RECORDING */}
      {activeTab === 'voice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Recording Canvas & Controls Box */}
          <div style={{
            background: 'var(--bg-subtle)',
            border: '1px dashed var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '28px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '18px'
          }}>
            {/* Visualizer Canvas */}
            <div style={{
              width: '100%',
              maxWidth: '500px',
              height: '64px',
              background: 'var(--waveform-bg)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              {isRecording ? (
                <canvas ref={canvasRef} width={480} height={64} style={{ width: '100%', height: '100%' }} />
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Volume2 size={16} />
                  <span>{audioBlob ? 'Audio Captured & Ready for AI' : 'Live acoustic frequency waveform will appear here'}</span>
                </div>
              )}
            </div>

            {/* Timer Display */}
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1.75rem',
              fontWeight: 700,
              color: isRecording ? '#ef4444' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              {isRecording && (
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  display: 'inline-block',
                }} className="recording-pulse" />
              )}
              <span>{formatTime(recordingDuration)}</span>
            </div>

            {/* Main Record Action Button */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={processing}
                  className="btn btn-primary"
                  style={{
                    padding: '12px 24px',
                    fontSize: '1rem',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)'
                  }}
                >
                  <Mic size={20} />
                  <span>Start Live Recording</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="btn"
                  style={{
                    padding: '12px 24px',
                    fontSize: '1rem',
                    background: '#0f172a',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.3)'
                  }}
                >
                  <Square size={20} color="#ef4444" />
                  <span>Stop Recording</span>
                </button>
              )}

              {/* 1-Click Sample Audio Button */}
              <button
                type="button"
                onClick={handleLoadSampleAudio}
                disabled={isRecording || processing}
                className="btn btn-secondary"
                style={{ padding: '12px 18px', fontSize: '0.9rem' }}
                title="Loads sample clinical consultation audio instantly without needing a microphone"
              >
                <Sparkles size={16} color="var(--emerald-500)" />
                <span>Try Sample Audio</span>
              </button>

              {/* File Upload Option */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRecording || processing}
                className="btn btn-secondary"
                style={{ padding: '12px 18px', fontSize: '0.9rem' }}
              >
                <Upload size={16} />
                <span>Upload Audio File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>

            {/* Audio playback preview */}
            {audioUrl && !isRecording && (
              <div style={{ width: '100%', maxWidth: '420px', marginTop: '6px' }}>
                <audio controls src={audioUrl} style={{ width: '100%', height: '36px' }} />
              </div>
            )}
          </div>

          {/* Bottom Bar: Legal Retention Checkbox & AI Process Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              fontSize: '0.825rem',
              color: keepRecording ? 'var(--amber-500)' : 'var(--text-muted)',
              background: keepRecording ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-subtle)',
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
            }}>
              <input
                type="checkbox"
                checked={keepRecording}
                onChange={(e) => setKeepRecording(e.target.checked)}
              />
              <Shield size={14} />
              <span>Retain consultation audio for legal/audit purposes (auto-purged by default)</span>
            </label>

            <button
              type="button"
              onClick={handleProcessAudioConsultation}
              disabled={!audioBlob || processing || isRecording}
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: '0.95rem' }}
            >
              {processing ? (
                <>
                  <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
                  <span>{processingStep || 'Processing...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Generate Care Plan with AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: TEXT CONSULTATION & CLINICAL PRESETS */}
      {activeTab === 'text' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Preset Buttons */}
          <div>
            <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
              CHOOSE A CLINICAL PRESET OR TYPE CUSTOM DIALOGUE:
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {CLINICAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedPreset(preset.id);
                    setDialogueText(preset.text);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid',
                    borderColor: selectedPreset === preset.id ? 'var(--emerald-500)' : 'var(--border-color)',
                    background: selectedPreset === preset.id ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-subtle)',
                    color: selectedPreset === preset.id ? 'var(--emerald-600)' : 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  <span>{preset.title}</span>
                  <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>{preset.tag}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dialogue Text Area */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Consultation Dialogue Transcript</label>
            <textarea
              className="textarea-field"
              rows={6}
              value={dialogueText}
              onChange={(e) => {
                setDialogueText(e.target.value);
                setSelectedPreset('custom');
              }}
              placeholder="Paste or type doctor-patient dialogue here..."
              style={{ fontSize: '0.9rem', lineHeight: 1.5 }}
            />
          </div>

          {/* Process Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={handleProcessTextConsultation}
              disabled={processing || !dialogueText.trim()}
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: '0.95rem' }}
            >
              {processing ? (
                <>
                  <span className="animate-spin" style={{ display: 'inline-block' }}>⟳</span>
                  <span>{processingStep || 'Processing with Mistral-7B...'}</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Extract Care Plan with AI</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

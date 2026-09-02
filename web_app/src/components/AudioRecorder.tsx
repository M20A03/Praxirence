import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, RotateCcw, Upload, Sparkles, Shield, AlertTriangle, Check } from 'lucide-react';
import { Visit, Patient } from '../types';
import { api } from '../services/api';

interface AudioRecorderProps {
  patient: Patient;
  onCarePlanGenerated: (visit: Visit) => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  patient,
  onCarePlanGenerated,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [keepRecording, setKeepRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopRecordingCleanup();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const stopRecordingCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
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

        // Dynamic emerald-cyan gradient
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Setup Web Audio Analyser for live visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      sourceRef.current = source;

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

        // Stop all tracks in stream
        stream.getTracks().forEach((track) => track.stop());
        stopRecordingCleanup();
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start visualizer and timer
      drawWaveform();
      timerRef.current = window.setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone access denied:', err);
      setError('Microphone access error. Please grant permission or upload an audio file below.');
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProcessConsultation = async () => {
    if (!audioBlob) {
      setError('Please record or select an audio file first.');
      return;
    }

    try {
      setProcessing(true);
      setError(null);

      setProcessingStep('1/3: Uploading consultation audio...');
      await new Promise((r) => setTimeout(r, 400));

      setProcessingStep('2/3: Transcribing audio with OpenAI Whisper...');
      await new Promise((r) => setTimeout(r, 600));

      setProcessingStep('3/3: Extracting Diagnosis, Medicines & Reminders with GPT-4...');
      
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

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Mic size={18} color="var(--emerald-400)" />
          </div>
          <div>
            <h3>Consultation Voice Recording</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Record dialogue with {patient.name}. Whisper transcribes & GPT-4 generates the structured Care Plan.
            </p>
          </div>
        </div>

        {/* Legal retention toggle */}
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
          transition: 'all 0.2s'
        }}>
          <input
            type="checkbox"
            checked={keepRecording}
            onChange={(e) => setKeepRecording(e.target.checked)}
            style={{ accentColor: 'var(--amber-500)' }}
          />
          <Shield size={14} />
          <span>Retain audio for legal/medical records</span>
        </label>
      </div>

      {error && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.15)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          color: '#fb7185',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Recording Studio View */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px dashed var(--border-color)',
        borderRadius: 'var(--radius-md)',
        padding: '30px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px'
      }}>
        {/* Visualizer Canvas */}
        <div style={{
          width: '100%',
          maxWidth: '500px',
          height: '64px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {isRecording ? (
            <canvas
              ref={canvasRef}
              width={480}
              height={64}
              style={{ width: '100%', height: '100%' }}
            />
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {audioBlob ? 'Audio captured and ready for analysis' : 'Microphone ready. Click Record to begin consultation.'}
            </div>
          )}
        </div>

        {/* Recording Timer & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {isRecording && (
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: '#ef4444',
            }} className="recording-pulse" />
          )}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.4rem',
            fontWeight: 700,
            color: isRecording ? '#f43f5e' : 'var(--text-primary)'
          }}>
            {formatTime(recordingDuration)}
          </span>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="btn btn-primary"
              style={{ padding: '12px 28px', fontSize: '1rem' }}
              disabled={processing}
            >
              <Mic size={20} />
              <span>{audioBlob ? 'Record Again' : 'Start Recording'}</span>
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="btn btn-danger"
              style={{ padding: '12px 28px', fontSize: '1rem' }}
            >
              <Square size={18} fill="currentColor" />
              <span>Stop Recording</span>
            </button>
          )}

          {/* Or upload file */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="audio/*"
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            disabled={isRecording || processing}
          >
            <Upload size={16} />
            <span>Upload Audio File (MP3/WAV)</span>
          </button>
        </div>

        {/* Audio Player Preview */}
        {audioUrl && !isRecording && (
          <div style={{ width: '100%', maxWidth: '480px', marginTop: '10px' }}>
            <audio controls src={audioUrl} style={{ width: '100%', height: '40px' }} />
            <div style={{
              fontSize: '0.75rem',
              color: keepRecording ? 'var(--amber-500)' : 'var(--emerald-400)',
              textAlign: 'center',
              marginTop: '6px'
            }}>
              {keepRecording
                ? '⚠️ Audio will be kept in records per your selection.'
                : '🛡️ Audio file will be automatically purged immediately after Whisper transcription.'}
            </div>
          </div>
        )}
      </div>

      {/* Process Consultation Button */}
      {audioBlob && !isRecording && (
        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleProcessConsultation}
            disabled={processing}
            className="btn"
            style={{
              background: 'linear-gradient(135deg, var(--purple-500), var(--cyan-500))',
              color: '#ffffff',
              padding: '14px 36px',
              fontSize: '1.05rem',
              fontWeight: 700,
              boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
              cursor: processing ? 'not-allowed' : 'pointer'
            }}
          >
            <Sparkles size={20} className={processing ? 'animate-spin' : ''} />
            <span>{processing ? 'Processing Consultation...' : 'Extract Care Plan with Whisper & GPT-4'}</span>
          </button>

          {processing && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.9rem',
              color: 'var(--cyan-500)',
              fontWeight: 600
            }}>
              <div className="animate-spin" style={{
                width: '16px',
                height: '16px',
                border: '2px solid var(--cyan-500)',
                borderTopColor: 'transparent',
                borderRadius: '50%'
              }} />
              <span>{processingStep}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

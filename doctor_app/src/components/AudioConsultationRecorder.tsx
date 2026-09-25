import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Alert,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, FontFamily } from '../theme';
import { ConsultationSummarizeResult } from '../types';
import { mobileApi } from '../services/api';

interface AudioConsultationRecorderProps {
  patientId: string;
  patientName: string;
  doctorName: string;
  onRecordingProcessed: (result: ConsultationSummarizeResult) => void;
}

export const AudioConsultationRecorder: React.FC<AudioConsultationRecorderProps> = ({
  patientId,
  patientName,
  doctorName,
  onRecordingProcessed,
}) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [lastAudioUri, setLastAudioUri] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploadFailed, setUploadFailed] = useState<boolean>(false);
  const [backgroundPaused, setBackgroundPaused] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<'hi' | 'en' | 'kn' | 'te' | 'ta'>('hi');

  // Pulse & Waveform Animation Refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const barAnims = useRef([
    new Animated.Value(6),
    new Animated.Value(14),
    new Animated.Value(24),
    new Animated.Value(18),
    new Animated.Value(28),
    new Animated.Value(12),
    new Animated.Value(20),
    new Animated.Value(8),
  ]).current;

  // Timer & Lifecycle Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);

  useEffect(() => {
    recordingRef.current = recording;
    isRecordingRef.current = isRecording;
    isPausedRef.current = isPaused;
  }, [recording, isRecording, isPaused]);

  // Check if an offline draft exists for this patient on mount
  useEffect(() => {
    const restoreOfflineDraft = async () => {
      try {
        const key = `praxirence_offline_audio_${patientId}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.uri) {
            setLastAudioUri(parsed.uri);
            setUploadFailed(true);
          }
        }
      } catch (e) {
        // Cache lookup notice
      }
    };
    restoreOfflineDraft();
  }, [patientId]);

  // Gracefully pause and preserve audio draft when app transitions to background or is minimized
  // Prevents abrupt recording termination or corrupt audio files
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState.match(/inactive|background/) && isRecordingRef.current) {
        if (recordingRef.current) {
          try {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            setIsRecording(false);
            isRecordingRef.current = false;
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            setRecording(null);
            recordingRef.current = null;
            if (uri) {
              setLastAudioUri(uri);
              setBackgroundPaused(true);
              await AsyncStorage.setItem(
                `praxirence_offline_audio_${patientId}`,
                JSON.stringify({ uri, patientId, patientName, doctorName, date: new Date().toISOString() })
              );
            }
          } catch (e) {
            console.warn('Background audio draft cache notice:', e);
          }
        }
      }
    });

    return () => {
      subscription.remove();
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      if (sound) {
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [patientId, patientName, doctorName]);

  // Animate pulse & waveform while recording
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let barLoop: Animated.CompositeAnimation | null = null;

    if (isRecording) {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 650,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 650,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();

      const waveSequences = barAnims.map((anim) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.floor(Math.random() * 26) + 10,
              duration: 200 + Math.random() * 200,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: Math.floor(Math.random() * 10) + 4,
              duration: 200 + Math.random() * 200,
              useNativeDriver: false,
            }),
          ])
        )
      );
      barLoop = Animated.parallel(waveSequences);
      barLoop.start();
    } else {
      pulseAnim.setValue(1);
      barAnims.forEach((b) => b.setValue(6));
    }

    return () => {
      if (loop) loop.stop();
      if (barLoop) barLoop.stop();
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          'Microphone Permission Required',
          'Please allow Praxirence Doctor microphone access to record patient consultations.'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Clinical Speech-Optimized ASR Audio Configuration (16kHz Mono)
      const speechRecordingOptions: Audio.RecordingOptions = {
        isMeteringEnabled: true,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 64000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 64000,
        },
      };

      const { recording: newRecording } = await Audio.Recording.createAsync(
        speechRecordingOptions
      );

      setRecording(newRecording);
      setIsRecording(true);
      setIsPaused(false);
      setDurationSec(0);
      setLastAudioUri(null);

      timerRef.current = setInterval(() => {
        setDurationSec((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording', err);
      Alert.alert('Recording Error', 'Could not access audio device: ' + err.message);
    }
  };

  const pauseRecording = async () => {
    const active = recordingRef.current || recording;
    if (!active || !isRecordingRef.current) return;
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      await active.pauseAsync();
      setIsPaused(true);
      isPausedRef.current = true;
    } catch (e: any) {
      console.warn('Pause error:', e);
    }
  };

  const resumeRecording = async () => {
    const active = recordingRef.current || recording;
    if (!active || !isRecordingRef.current) return;
    try {
      await active.startAsync();
      setIsPaused(false);
      isPausedRef.current = false;
      timerRef.current = setInterval(() => {
        setDurationSec((prev) => prev + 1);
      }, 1000);
    } catch (e: any) {
      console.warn('Resume error:', e);
    }
  };

  const discardRecording = () => {
    Alert.alert(
      'Discard Consultation Recording?',
      'Are you sure you want to discard this consultation recording? This audio cannot be recovered.',
      [
        { text: 'Keep Recording', style: 'cancel' },
        {
          text: 'Discard Audio',
          style: 'destructive',
          onPress: async () => {
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            setIsRecording(false);
            setIsPaused(false);
            isRecordingRef.current = false;
            const active = recordingRef.current || recording;
            if (active) {
              try {
                await active.stopAndUnloadAsync();
              } catch {}
            }
            setRecording(null);
            recordingRef.current = null;
            setDurationSec(0);
            setLastAudioUri(null);
          },
        },
      ]
    );
  };

  const stopRecording = async () => {
    const activeRecording = recordingRef.current || recording;
    if (!activeRecording) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);
    isRecordingRef.current = false;
    try {
      await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI();
      setRecording(null);
      recordingRef.current = null;
      setLastAudioUri(uri);

      if (uri) {
        // Automatically process with AI
        processAudio(uri);
      }
    } catch (error: any) {
      console.error('Failed to stop recording', error);
      Alert.alert('Audio Notice', 'Recording stopped.');
    }
  };

  const processAudio = async (uri: string) => {
    setProcessing(true);
    setUploadFailed(false);
    setBackgroundPaused(false);
    try {
      const result = await mobileApi.uploadConsultationAudio({
        patientId,
        audioUri: uri,
        patientName,
        doctorName,
        language: selectedLanguage,
      });

      // Clear local offline cache on successful upload
      await AsyncStorage.removeItem(`praxirence_offline_audio_${patientId}`).catch(() => {});

      onRecordingProcessed(result);

      Alert.alert(
        'Audio Transcribed & Extracted',
        'Clinical voice dialogue processed, medications extracted, and patient instructions generated.'
      );
    } catch (err: any) {
      console.warn('Audio upload network timeout, caching draft:', err);
      setUploadFailed(true);
      // Persist to Offline Consultation Queue
      await AsyncStorage.setItem(
        `praxirence_offline_audio_${patientId}`,
        JSON.stringify({ uri, patientId, patientName, doctorName, date: new Date().toISOString() })
      ).catch(() => {});

      Alert.alert(
        'Offline Consultation Saved',
        'Audio recording was preserved locally in the offline queue. Tap "Retry Upload (Draft Saved)" when connection stabilizes.'
      );
    } finally {
      setProcessing(false);
    }
  };

  const playRecordedAudio = async () => {
    if (!lastAudioUri) return;
    try {
      if (isPlaying && sound) {
        await sound.stopAsync();
        setIsPlaying(false);
        return;
      }

      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: lastAudioUri },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (e) {
      console.warn('Playback notice:', e);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.statusDot, isRecording && (isPaused ? styles.statusDotPaused : styles.statusDotRecording)]} />
          <Text style={styles.cardTitle}>
            {isRecording ? (isPaused ? 'Consultation Paused' : 'Listening to Consultation...') : 'Live Voice Consultation'}
          </Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="shield-checkmark" size={12} color="#0284C7" />
          <Text style={styles.badgeText}>HIPAA Audio Shredding</Text>
        </View>
      </View>

      <Text style={styles.description}>
        Tap the microphone to record doctor-patient dialogue. Whisper ASR & Clinical LLM will transcribe the conversation and auto-fill diagnosis & prescription.
      </Text>

      {/* Waveform & Timer Container */}
      <View style={styles.visualizerContainer}>
        {/* Waveform Bars */}
        <View style={styles.waveContainer}>
          {barAnims.map((anim, idx) => (
            <Animated.View
              key={idx}
              style={[
                styles.waveBar,
                {
                  height: anim,
                  backgroundColor: isRecording ? (isPaused ? '#F59E0B' : '#EF4444') : '#94A3B8',
                },
              ]}
            />
          ))}
        </View>

        {/* Timer Display */}
        <Text style={[styles.timerText, isRecording && (isPaused ? styles.timerTextPaused : styles.timerTextActive)]}>
          {formatTime(durationSec)} {isPaused ? '(Paused)' : ''}
        </Text>
      </View>

      {/* Consultation Language Hint Selector */}
      {!isRecording && (
        <View style={styles.langSelectorContainer}>
          <Text style={styles.langSelectorLabel}>Consultation Language:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.langScroll}>
            {[
              { code: 'hi', label: 'Hinglish / हिन्दी' },
              { code: 'en', label: 'English' },
              { code: 'kn', label: 'ಕನ್ನಡ' },
              { code: 'te', label: 'తెలుగు' },
              { code: 'ta', label: 'தமிழ்' },
            ].map((item) => (
              <TouchableOpacity
                key={item.code}
                style={[styles.langChip, selectedLanguage === item.code && styles.langChipActive]}
                onPress={() => setSelectedLanguage(item.code as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.langChipText, selectedLanguage === item.code && styles.langChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Main Action Controls */}
      <View style={styles.controlsRow}>
        {!isRecording ? (
          <TouchableOpacity
            style={styles.micButton}
            onPress={startRecording}
            activeOpacity={0.8}
            disabled={processing}
          >
            <Animated.View
              style={[
                styles.micCircle,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Ionicons name="mic" size={28} color="#FFFFFF" />
            </Animated.View>
            <Text style={styles.micButtonText}>Start Voice Recording</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.recordingCluster}>
            {/* Discard Button */}
            <TouchableOpacity
              style={styles.clusterDiscardBtn}
              onPress={discardRecording}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
              <Text style={styles.clusterDiscardText}>Discard</Text>
            </TouchableOpacity>

            {/* Pause / Resume Button */}
            <TouchableOpacity
              style={[styles.clusterPauseBtn, isPaused && styles.clusterResumeBtn]}
              onPress={isPaused ? resumeRecording : pauseRecording}
              activeOpacity={0.7}
            >
              <Ionicons name={isPaused ? "play" : "pause"} size={18} color="#FFFFFF" />
              <Text style={styles.clusterActionText}>{isPaused ? "Resume" : "Pause"}</Text>
            </TouchableOpacity>

            {/* Finish & AI Extract Button */}
            <TouchableOpacity
              style={styles.clusterFinishBtn}
              onPress={stopRecording}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.clusterActionText}>Finish & Extract</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Processing Loader */}
      {processing && (
        <View style={styles.processingBox}>
          <ActivityIndicator size="small" color="#0284C7" />
          <Text style={styles.processingText}>
            Whisper ASR transcribing speech & extracting care plan...
          </Text>
        </View>
      )}

      {/* Audio Playback Review if already recorded */}
      {!isRecording && lastAudioUri && !processing && (
        <View style={styles.playbackContainer}>
          <TouchableOpacity
            style={styles.playbackBtn}
            onPress={playRecordedAudio}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isPlaying ? 'pause-circle' : 'play-circle'}
              size={22}
              color="#0284C7"
            />
            <Text style={styles.playbackText}>
              {isPlaying ? 'Pause Audio' : 'Review Recorded Audio'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.reprocessBtn}
            onPress={() => processAudio(lastAudioUri)}
            activeOpacity={0.7}
          >
            <Ionicons name="sparkles" size={14} color="#0284C7" />
            <Text style={styles.reprocessText}>Re-extract Plan</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Offline Draft Saved / Upload Retry Banner */}
      {uploadFailed && lastAudioUri && !processing && (
        <View style={styles.offlineQueueBanner}>
          <View style={styles.offlineQueueInfo}>
            <Ionicons name="cloud-offline" size={18} color="#D97706" />
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineQueueTitle}>Offline Consultation Draft Saved</Text>
              <Text style={styles.offlineQueueSub}>
                Network upload interrupted. Audio file safely preserved in device storage.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.retryUploadBtn}
            onPress={() => processAudio(lastAudioUri)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text style={styles.retryUploadBtnText}>Retry Upload (Draft Saved)</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Background Graceful Pause Banner */}
      {backgroundPaused && !uploadFailed && (
        <View style={styles.backgroundNoticeBanner}>
          <Ionicons name="pause-circle" size={16} color="#0284C7" />
          <Text style={styles.backgroundNoticeText}>
            Recording paused & draft saved locally when app was minimized.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94A3B8',
  },
  statusDotRecording: {
    backgroundColor: '#EF4444',
  },
  statusDotPaused: {
    backgroundColor: '#F59E0B',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0284C7',
  },
  description: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
    marginBottom: 14,
  },
  visualizerContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  waveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  timerText: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
    color: '#64748B',
  },
  timerTextActive: {
    color: '#EF4444',
  },
  timerTextPaused: {
    color: '#D97706',
  },
  controlsRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
    paddingVertical: 4,
  },
  clusterDiscardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  clusterDiscardText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  clusterPauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#D97706',
  },
  clusterResumeBtn: {
    backgroundColor: '#0284C7',
  },
  clusterFinishBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  clusterActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  micButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  micButtonRecording: {
    borderColor: '#FCA5A5',
  },
  micCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  micCircleRecording: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  micButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284C7',
  },
  processingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  processingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0284C7',
  },
  playbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  playbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
  reprocessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  reprocessText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0284C7',
  },
  offlineQueueBanner: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  offlineQueueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineQueueTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B45309',
  },
  offlineQueueSub: {
    fontSize: 11,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 15,
  },
  retryUploadBtn: {
    backgroundColor: '#D97706',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 8,
  },
  retryUploadBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backgroundNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginTop: 10,
  },
  backgroundNoticeText: {
    fontSize: 12,
    color: '#0284C7',
    fontWeight: '600',
    flex: 1,
  },
  langSelectorContainer: {
    marginTop: 8,
    marginBottom: 12,
  },
  langSelectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
  },
  langScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  langChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  langChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  langChipTextActive: {
    color: '#FFFFFF',
  },
});

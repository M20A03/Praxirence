/**
 * Realtime WebSocket Client for Doctor App
 * Automatically reconnects with exponential backoff.
 * Listens for patient pill adherence, vital alerts, and consult confirmations.
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import { mobileApi } from './api';

export type RealtimeEventCallback = (payload: any) => void;

class DoctorRealtimeService {
  private ws: WebSocket | null = null;
  private doctorId: string | null = null;
  private listeners: Map<string, Set<RealtimeEventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 12;
  private isConnecting = false;
  private pingInterval: any = null;
  private processedMsgIds: Set<string> = new Set();
  private msgIdQueue: string[] = [];
  private appStateSubscription: any = null;

  constructor() {
    this.setupAppStateListener();
  }

  private setupAppStateListener() {
    this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        if (this.doctorId && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          this.reconnectAttempts = 0;
          this.connect(this.doctorId);
        }
      } else if (nextState === 'background') {
        this.stopHeartbeat();
      }
    });
  }

  private getWebSocketUrl(doctorId: string): string {
    if (process.env.EXPO_PUBLIC_WS_URL) {
      return `${process.env.EXPO_PUBLIC_WS_URL}/ws/doctor/${doctorId}`;
    }
    const apiBase = mobileApi.getApiUrl();
    const wsProto = apiBase.startsWith('https://') ? 'wss://' : 'ws://';
    const cleanHost = apiBase.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `${wsProto}${cleanHost}/ws/doctor/${doctorId}`;
  }

  public connect(doctorId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.isConnecting) return;
    this.doctorId = doctorId;
    this.isConnecting = true;

    try {
      const url = this.getWebSocketUrl(doctorId);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.notify('STATUS_CHANGE', { connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const eventType = data.event;
          const payload = data.payload;

          // Message deduplication
          const msgKey = data.msg_id || `${eventType}_${JSON.stringify(payload)}`;
          if (this.processedMsgIds.has(msgKey)) {
            return;
          }
          this.processedMsgIds.add(msgKey);
          this.msgIdQueue.push(msgKey);
          if (this.msgIdQueue.length > 200) {
            const oldest = this.msgIdQueue.shift();
            if (oldest) this.processedMsgIds.delete(oldest);
          }

          this.notify(eventType, payload);
        } catch (e) {
          // Non-JSON telemetry ping
        }
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.stopHeartbeat();
        this.ws = null;
        this.notify('STATUS_CHANGE', { connected: false });
        this.scheduleReconnect();
      };
    } catch (e) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.doctorId) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 25000);
    this.reconnectAttempts++;
    setTimeout(() => {
      if (this.doctorId && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
        this.connect(this.doctorId);
      }
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'PING', payload: Date.now() }));
      }
    }, 12000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public sendPrescriptionNotification(patientId: string, diagnosis: string, medicinesCount: number) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        event: 'PRESCRIPTION_SENT',
        payload: { patient_id: patientId, diagnosis, medicines_count: medicinesCount }
      }));
    }
  }

  public on(event: string, callback: RealtimeEventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off(event: string, callback: RealtimeEventCallback) {
    const subs = this.listeners.get(event);
    if (subs) subs.delete(callback);
  }

  private notify(event: string, payload: any) {
    const subs = this.listeners.get(event);
    if (subs) {
      subs.forEach(cb => {
        try { cb(payload); } catch (e) { }
      });
    }
  }

  public disconnect() {
    this.stopHeartbeat();
    if (this.appStateSubscription) {
      try { this.appStateSubscription.remove(); } catch (_) {}
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.doctorId = null;
  }
}

export const doctorRealtime = new DoctorRealtimeService();


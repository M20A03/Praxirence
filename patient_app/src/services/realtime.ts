/**
 * Realtime WebSocket Client for Patient App
 * Automatically reconnects with exponential backoff.
 * Listens for new prescriptions, doctor messages, and streams pill adherence confirmations.
 */

import { Platform, AppState, AppStateStatus } from 'react-native';
import { mobileApi } from './api';

export type RealtimeEventCallback = (payload: any) => void;

class PatientRealtimeService {
  private ws: WebSocket | null = null;
  private patientId: string | null = null;
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
        if (this.patientId && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
          this.reconnectAttempts = 0;
          this.connect(this.patientId);
        }
      } else if (nextState === 'background') {
        this.stopHeartbeat();
      }
    });
  }

  private getWebSocketUrl(patientId: string): string {
    if (process.env.EXPO_PUBLIC_WS_URL) {
      return `${process.env.EXPO_PUBLIC_WS_URL}/ws/patient/${patientId}`;
    }
    const apiBase = mobileApi.getApiUrl();
    const wsProto = apiBase.startsWith('https://') ? 'wss://' : 'ws://';
    const cleanHost = apiBase.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `${wsProto}${cleanHost}/ws/patient/${patientId}`;
  }

  public connect(patientId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    if (this.isConnecting) return;
    this.patientId = patientId;
    this.isConnecting = true;

    try {
      const url = this.getWebSocketUrl(patientId);
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
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this.patientId) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 25000);
    this.reconnectAttempts++;
    setTimeout(() => {
      if (this.patientId && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
        this.connect(this.patientId);
      }
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ event: 'PING', payload: Date.now() }));
        }
      } catch (e) {
        // Ignore socket heartbeat errors
      }
    }, 12000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public sendPillConfirmation(doctorId: string, medicineName: string, dosageWindow: string) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          event: 'PILL_TAKEN',
          payload: { doctor_id: doctorId, medicine_name: medicineName, dosage_window: dosageWindow }
        }));
      }
    } catch (e) {
      // Safe socket send catch
    }
  }

  public sendVitalUpdate(doctorId: string, vitals: any) {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          event: 'VITALS_LOGGED',
          payload: { doctor_id: doctorId, vitals }
        }));
      }
    } catch (e) {
      // Safe socket send catch
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
    this.patientId = null;
  }
}

export const patientRealtime = new PatientRealtimeService();

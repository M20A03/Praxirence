/**
 * Realtime WebSocket Client for Patient App
 * Automatically reconnects with exponential backoff.
 * Listens for new prescriptions, doctor messages, and streams pill adherence confirmations.
 */

import { Platform } from 'react-native';

export type RealtimeEventCallback = (payload: any) => void;

class PatientRealtimeService {
  private ws: WebSocket | null = null;
  private patientId: string | null = null;
  private listeners: Map<string, Set<RealtimeEventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private isConnecting = false;
  private pingInterval: any = null;

  private getWebSocketUrl(patientId: string): string {
    if (__DEV__) {
      return Platform.OS === 'android'
        ? `ws://10.0.2.2:8000/ws/patient/${patientId}`
        : `ws://localhost:8000/ws/patient/${patientId}`;
    }
    return `wss://praxirence-production.up.railway.app/ws/patient/${patientId}`;
  }

  public connect(patientId: string) {
    if (this.ws || this.isConnecting) return;
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
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    setTimeout(() => {
      if (this.patientId) this.connect(this.patientId);
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'PING', payload: Date.now() }));
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public sendPillConfirmation(doctorId: string, medicineName: string, dosageWindow: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        event: 'PILL_TAKEN',
        payload: { doctor_id: doctorId, medicine_name: medicineName, dosage_window: dosageWindow }
      }));
    }
  }

  public sendVitalUpdate(doctorId: string, vitals: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        event: 'VITAL_RECORDED',
        payload: { doctor_id: doctorId, vitals }
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.patientId = null;
  }
}

export const patientRealtime = new PatientRealtimeService();

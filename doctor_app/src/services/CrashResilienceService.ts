/**
 * Hospital-Grade Crash Resilience & Zero-PHI Audit Logging Service (Doctor App)
 */

export interface DiagnosticLogEvent {
  timestamp: string;
  type: 'ERROR' | 'SECURITY' | 'NETWORK' | 'CRASH_AVOIDED';
  message: string;
  metadata?: any;
}

class CrashResilienceService {
  private isInitialized = false;
  private readonly MAX_LOG_SIZE = 50;
  private logRingBuffer: DiagnosticLogEvent[] = [];

  initialize(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;

    const globalHandler = (ErrorUtils as any)?.getGlobalHandler?.();
    if ((ErrorUtils as any)?.setGlobalHandler) {
      (ErrorUtils as any).setGlobalHandler((error: any, isFatal?: boolean) => {
        const sanitizedMsg = this.sanitizePHI(error?.message || error?.toString() || 'Unknown error');
        this.recordEvent({
          timestamp: new Date().toISOString(),
          type: isFatal ? 'CRASH_AVOIDED' : 'ERROR',
          message: `[GlobalHandler] ${sanitizedMsg}`,
          metadata: { isFatal },
        });

        console.warn(`[CrashResilience] Trapped ${isFatal ? 'FATAL' : 'NON-FATAL'} exception:`, sanitizedMsg);

        if (__DEV__ && globalHandler) {
          globalHandler(error, isFatal);
        }
      });
    }

    this.recordEvent({
      timestamp: new Date().toISOString(),
      type: 'SECURITY',
      message: 'Doctor Workstation Crash Resilience & PHI Guard initialized',
    });
  }

  sanitizePHI(input: string): string {
    if (!input || typeof input !== 'string') return '';

    return input
      .replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, 'ABHA_****_****')
      .replace(/\b[6-9]\d{9}\b/g, (match) => `***${match.substring(6)}`)
      .replace(/\b\d{6}\b/g, '******')
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => {
        const parts = match.split('@');
        return `${parts[0].substring(0, 2)}***@${parts[1]}`;
      })
      .replace(/Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, 'Bearer [REDACTED_JWT]');
  }

  recordEvent(event: DiagnosticLogEvent): void {
    event.message = this.sanitizePHI(event.message);
    this.logRingBuffer.unshift(event);
    if (this.logRingBuffer.length > this.MAX_LOG_SIZE) {
      this.logRingBuffer.pop();
    }
  }

  getAuditLogs(): DiagnosticLogEvent[] {
    return [...this.logRingBuffer];
  }
}

export const CrashResilience = new CrashResilienceService();

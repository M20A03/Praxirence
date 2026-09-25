/**
 * Hospital-Grade Clipboard Sanitizer (Doctor App)
 */
class ClipboardSanitizerService {
  private purgeTimer: any = null;

  scheduleClipboardPurge(timeoutMs = 30_000, onPurge?: () => void): void {
    if (this.purgeTimer) {
      clearTimeout(this.purgeTimer);
    }

    this.purgeTimer = setTimeout(() => {
      try {
        if (onPurge) {
          onPurge();
        }
      } catch (err) {
        // Ignored
      }
      this.purgeTimer = null;
    }, timeoutMs);
  }

  cancelScheduledPurge(): void {
    if (this.purgeTimer) {
      clearTimeout(this.purgeTimer);
      this.purgeTimer = null;
    }
  }
}

export const ClipboardSanitizer = new ClipboardSanitizerService();

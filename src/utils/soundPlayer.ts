/**
 * Lightweight Web Audio API notification chime (zero external audio dependencies).
 * Safely no-ops in headless/non-browser environments or when AudioContext is blocked.
 */
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx) {
    sharedCtx = new Ctx();
  }
  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

export function playNotificationChime(kind: 'order' | 'payment' | 'status' = 'order'): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes =
      kind === 'payment'
        ? [587.33, 880] // D5 -> A5
        : kind === 'status'
          ? [523.25, 659.25] // C5 -> E5
          : [659.25, 783.99, 1046.5]; // E5 -> G5 -> C6

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.09 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.24);
    });
  } catch {
    // Audio playback is optional enhancement; never break UI flows
  }
}

export function showBrowserNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (window.Notification.permission !== 'granted') return;
  try {
    new window.Notification(title, {
      body,
      tag: title,
    });
  } catch {
    // Ignore restricted iframe notification context errors
  }
}

// Success "ding" + haptic tap for the order-confirmation screen, synthesized
// via Web Audio (no audio asset needed). Safari/iOS requires the
// AudioContext to be created/resumed synchronously inside a user gesture,
// so call unlockDing() at the very top of the click handler (before any
// `await`), and playDing() later once the order actually succeeds.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  const AudioContextClass = window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  ctx = new AudioContextClass();
  return ctx;
}

export function unlockDing() {
  const c = getCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function playDing() {
  const c = getCtx();
  if (!c) return;
  try {
    const now = c.currentTime;
    const tone = (freq: number, start: number, duration: number, peak: number) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.05);
    };
    tone(1318.5, 0, 0.35, 0.25); // E6
    tone(1760, 0.09, 0.4, 0.2);  // A6
  } catch {
    // sound is a nice-to-have, never let it break the success flow
  }
}

// iOS Safari has never implemented the Vibration API, so this is a no-op
// there - feature-detected, so it just silently does nothing.
export function vibrateSuccess() {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try { navigator.vibrate(15); } catch { /* ignore */ }
  }
}

let audioCtx: AudioContext | undefined;

function getAudioContext(): AudioContext | undefined {
  if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return undefined;
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

/**
 * Synthesizes a short, instantaneous "tactile" blip via the Web Audio API —
 * no audio asset to ship or load. Used for snappy UI confirmations like the
 * Studio theme swatches.
 */
export function playTactileClick(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(720, now);
  oscillator.frequency.exponentialRampToValueAtTime(280, now + 0.05);

  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.07);
}

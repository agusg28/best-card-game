// audio.js — synthesized WebAudio sounds. One job: every sound the game makes.
// Zero external assets: all tones are oscillators + noise, built at runtime.
let ctx = null;
let muted = false;

export function isMuted() { return muted; }
export function toggleMute() { muted = !muted; return muted; }

function audioCtx() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, dur, type, gain, when = 0, slideTo = null) {
  const ac = audioCtx();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch { /* sound is decoration; never break the game */ }
}

function noise(dur, gain, when = 0) {
  const ac = audioCtx();
  if (!ac) return;
  try {
    const t0 = ac.currentTime + when;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource(); src.buffer = buf;
    const g = ac.createGain(); g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 1200;
    src.connect(filt); filt.connect(g); g.connect(ac.destination);
    src.start(t0);
  } catch { /* ignore */ }
}

export const sfx = {
  click() { tone(660, 0.06, 'triangle', 0.08); },
  deal() { noise(0.12, 0.12); tone(440, 0.08, 'sine', 0.06, 0, 520); },
  play() { tone(392, 0.12, 'triangle', 0.12); tone(523, 0.14, 'triangle', 0.1, 0.07); },
  hit() { noise(0.18, 0.2); tone(180, 0.18, 'sawtooth', 0.12, 0, 70); },
  heal() { tone(523, 0.15, 'sine', 0.1); tone(784, 0.2, 'sine', 0.08, 0.1); },
  turn() { tone(330, 0.1, 'triangle', 0.1); tone(440, 0.12, 'triangle', 0.1, 0.08); },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.14, i * 0.12));
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sine', 0.12, i * 0.14));
  },
};

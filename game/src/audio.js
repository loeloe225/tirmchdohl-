// Tiny WebAudio synth: every sound is generated, no audio files are loaded.
// Created lazily on the first user gesture (browsers block audio before that).
let ctx = null;
let muted = false;
let alarmNodes = null;

export function setMuted(value) {
  muted = value;
  if (muted) stopAlarmLoop();
}
export function isMuted() {
  return muted;
}

function audio() {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, seconds, type = 'sine', gain = 0.12, when = 0, slideTo = null) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + seconds);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.05);
}

export function sfxPickup() {
  tone(880, 0.12, 'sine', 0.12);
  tone(1318, 0.18, 'sine', 0.1, 0.08);
}

export function sfxStar() {
  tone(523, 0.14, 'triangle', 0.14);
  tone(659, 0.14, 'triangle', 0.14, 0.1);
  tone(784, 0.2, 'triangle', 0.14, 0.2);
  tone(1046, 0.34, 'triangle', 0.14, 0.3);
}

export function sfxAlert() {
  tone(220, 0.22, 'sawtooth', 0.09, 0, 330);
  tone(330, 0.22, 'sawtooth', 0.07, 0.12, 220);
}

export function sfxSmoke() {
  tone(300, 0.4, 'sine', 0.08, 0, 90);
}

export function sfxDoor() {
  tone(392, 0.1, 'square', 0.06);
  tone(523, 0.16, 'square', 0.06, 0.09);
}

export function sfxWin() {
  [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, i * 0.12));
}

export function sfxLose() {
  tone(196, 0.5, 'sawtooth', 0.1, 0, 98);
  tone(147, 0.8, 'sawtooth', 0.1, 0.3, 73);
}

export function sfxClick() {
  tone(660, 0.05, 'square', 0.05);
}

export function startAlarmLoop() {
  const ac = audio();
  if (!ac || alarmNodes) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = 620;
  g.gain.value = 0.0;
  const lfo = ac.createOscillator();
  const lfoGain = ac.createGain();
  lfo.frequency.value = 2.2;
  lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain).connect(g.gain);
  osc.connect(g).connect(ac.destination);
  osc.start();
  lfo.start();
  alarmNodes = { osc, lfo, g };
}

export function stopAlarmLoop() {
  if (!alarmNodes) return;
  try {
    alarmNodes.osc.stop();
    alarmNodes.lfo.stop();
  } catch { /* already stopped */ }
  alarmNodes = null;
}

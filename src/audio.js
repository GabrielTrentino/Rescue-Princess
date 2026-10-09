// Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).
let ctx = null, master = null;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; }
}

function noiseBuffer(dur) {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function noise({ dur = 0.2, freq = 1000, q = 1, type = 'bandpass', vol = 0.5, sweep = 0 }, gainMul = 1) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), ctx.currentTime + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol * gainMul, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start();
}

function tone({ freq = 440, dur = 0.2, type = 'sine', vol = 0.3, to = 0, delay = 0 }, gainMul = 1) {
  const o = ctx.createOscillator();
  o.type = type;
  const t0 = ctx.currentTime + delay;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol * gainMul, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

const SFX = {
  swing: (m) => noise({ dur: 0.18, freq: 900, q: 0.8, vol: 0.35, sweep: 3 }, m),
  heavy: (m) => noise({ dur: 0.3, freq: 500, q: 0.7, vol: 0.45, sweep: 2.5 }, m),
  hit: (m) => { noise({ dur: 0.12, freq: 300, q: 1.2, vol: 0.6, type: 'lowpass' }, m); tone({ freq: 140, to: 60, dur: 0.12, type: 'triangle', vol: 0.4 }, m); },
  block: (m) => { tone({ freq: 900, to: 700, dur: 0.15, type: 'square', vol: 0.12 }, m); noise({ dur: 0.1, freq: 3000, q: 2, vol: 0.3 }, m); },
  bow: (m) => { tone({ freq: 220, to: 120, dur: 0.15, type: 'triangle', vol: 0.3 }, m); noise({ dur: 0.12, freq: 2500, q: 1, vol: 0.2, sweep: 0.5 }, m); },
  fire: (m) => noise({ dur: 0.35, freq: 600, q: 0.6, vol: 0.4, sweep: 0.4, type: 'lowpass' }, m),
  boom: (m) => { noise({ dur: 0.5, freq: 400, q: 0.5, vol: 0.7, sweep: 0.2, type: 'lowpass' }, m); tone({ freq: 90, to: 40, dur: 0.4, vol: 0.4 }, m); },
  heal: (m) => { tone({ freq: 523, dur: 0.18, vol: 0.18 }, m); tone({ freq: 659, dur: 0.18, vol: 0.18, delay: 0.08 }, m); tone({ freq: 784, dur: 0.3, vol: 0.18, delay: 0.16 }, m); },
  frost: (m) => { noise({ dur: 0.5, freq: 5000, q: 3, vol: 0.25, sweep: 0.3 }, m); tone({ freq: 1200, to: 400, dur: 0.4, type: 'sine', vol: 0.15 }, m); },
  smoke: (m) => noise({ dur: 0.6, freq: 800, q: 0.4, vol: 0.4, sweep: 0.3, type: 'lowpass' }, m),
  dash: (m) => noise({ dur: 0.25, freq: 1400, q: 0.6, vol: 0.3, sweep: 0.4 }, m),
  pickup: (m) => { tone({ freq: 660, dur: 0.12, vol: 0.2, type: 'triangle' }, m); tone({ freq: 990, dur: 0.2, vol: 0.2, type: 'triangle', delay: 0.08 }, m); },
  eat: (m) => { for (let i = 0; i < 3; i++) noise({ dur: 0.07, freq: 700 + i * 200, q: 2, vol: 0.4 }, m); tone({ freq: 330, to: 500, dur: 0.25, type: 'triangle', vol: 0.2, delay: 0.2 }, m); },
  death: (m) => { tone({ freq: 300, to: 80, dur: 0.6, type: 'sawtooth', vol: 0.15 }, m); noise({ dur: 0.3, freq: 300, vol: 0.4, type: 'lowpass' }, m); },
  bones: (m) => { for (let i = 0; i < 4; i++) tone({ freq: 800 + Math.random() * 600, dur: 0.06, type: 'square', vol: 0.06, delay: i * 0.05 }, m); },
  alarm: (m) => { tone({ freq: 440, dur: 0.18, type: 'square', vol: 0.12 }, m); tone({ freq: 330, dur: 0.25, type: 'square', vol: 0.12, delay: 0.2 }, m); },
  fanfare: (m) => { [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, dur: 0.35, type: 'triangle', vol: 0.22, delay: i * 0.13 }, m)); },
  sad: (m) => { [392, 330, 262].forEach((f, i) => tone({ freq: f, dur: 0.4, type: 'triangle', vol: 0.2, delay: i * 0.18 }, m)); },
  hurt: (m) => tone({ freq: 200, to: 110, dur: 0.18, type: 'sawtooth', vol: 0.12 }, m),
  step: (m) => noise({ dur: 0.05, freq: 250, q: 1, vol: 0.12, type: 'lowpass' }, m),
};

/** Toca um som. pos/listener opcionais para atenuar pela distância. */
export function sfx(name, dist = 0) {
  if (!ctx || !SFX[name]) return;
  const m = dist > 0 ? Math.max(0, 1 - dist / 60) : 1;
  if (m < 0.03) return;
  try { SFX[name](m); } catch (e) { /* ignora */ }
}

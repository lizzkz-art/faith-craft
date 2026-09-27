// Soft synthesized sound effects (no audio files needed, works offline)
let ctx = null, master = null;
export function audioCtx() { return ctx ? { ctx, master } : null; }
const unlockers = [];
export const Sound = {
  enabled: true, calm: false,
  onUnlock(f) { unlockers.push(f); if (ctx) f(ctx, master); },
  // iOS can suspend the context after the mic is used; bring music and effects back
  resume() { try { if (ctx && ctx.state !== 'running') ctx.resume(); } catch (e) { } },
  unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
        unlockers.forEach(f => f(ctx, master));
      }
      if (ctx.state === 'suspended' || ctx.state === 'interrupted') ctx.resume();
      const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(master); s.start(0);
    } catch (e) { }
  },
  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slide = 0, attack = 0.012) {
    if (!this.enabled || !ctx) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const v = vol * (this.calm ? 0.45 : 1);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.15, freq = 800, q = 0.7, when = 0) {
    if (!this.enabled || !ctx) return;
    const n = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = vol * (this.calm ? 0.45 : 1);
    s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start(ctx.currentTime + when);
  },
  // block sounds vary a little by material so building feels tactile
  place(kind = 'solid') { const r = 0.9 + Math.random() * 0.2; if (kind === 'wood') { this.tone(260 * r, 0.08, 'triangle', 0.12); this.noise(0.05, 0.08, 1400 * r, 1.2); } else if (kind === 'soft') { this.noise(0.09, 0.12, 700 * r, 0.8); } else { this.tone(320 * r, 0.06, 'triangle', 0.09); this.noise(0.05, 0.1, 2200 * r, 1.5); } this.tone(660 * r, 0.07, 'sine', 0.05, 0.02); },
  break(kind = 'solid') { const r = 0.9 + Math.random() * 0.2; if (kind === 'wood') { this.noise(0.16, 0.16, 900 * r, 1.1); this.tone(180 * r, 0.1, 'triangle', 0.07); } else if (kind === 'soft') { this.noise(0.16, 0.16, 500 * r, 0.7); } else { this.noise(0.14, 0.14, 1800 * r, 1.4); this.noise(0.1, 0.08, 3200 * r, 2, 0.03); } },
  click() { this.tone(700, 0.05, 'triangle', 0.06); },
  pop() { this.tone(520, 0.07, 'sine', 0.08, 0, 1.6); },
  step() { this.noise(0.05, 0.035, 450 + Math.random() * 250, 0.9); },
  pickup() { this.tone(880, 0.12, 'triangle', 0.13); this.tone(1320, 0.16, 'triangle', 0.11, 0.08); },
  star() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.12, i * 0.07)); },
  good() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.24, 'sine', 0.14, i * 0.09)); },
  gentle() { this.tone(440, 0.26, 'sine', 0.08); this.tone(494, 0.34, 'sine', 0.07, 0.14); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i === 5 ? 0.6 : 0.2, 'triangle', 0.13, i * 0.13)); [262, 330, 392].forEach(f => this.tone(f, 1.4, 'sine', 0.05, 0.6, 0, 0.3)); },
  moo() { this.tone(150, 0.55, 'sawtooth', 0.045, 0, 0.8, 0.08); },
  baa() { this.tone(430, 0.18, 'sawtooth', 0.035, 0, 0.95, 0.03); this.tone(410, 0.22, 'sawtooth', 0.035, 0.17, 0.9, 0.03); },
  chirp() { const f = 2400 + Math.random() * 900; this.tone(f, 0.07, 'sine', 0.025, 0, 1.3); this.tone(f * 1.1, 0.06, 'sine', 0.02, 0.1, 1.25); },
  whoosh() { this.noise(0.25, 0.04, 600, 0.5); },
};

// Gentle background music, generated live with Web Audio (no audio files, nothing loud or sudden).
// Soft pads + a slow, sparse melody. Pads only (and quieter) in Calm mode. Fades under the reading voice.
import { Sound } from './audio.js';
let ctx = null, out = null, duckG = null, timer = null, nextT = 0, bar = 0, on = false, vol = 0.4, calm = false, ducked = false;
const CHORDS = [[48, 55, 64, 67], [43, 50, 59, 62], [45, 52, 60, 64], [41, 48, 57, 60]]; // C G Am F
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76];
const BEAT = 60 / 64;
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function setup(c, master) {
  ctx = c; out = ctx.createGain(); duckG = ctx.createGain(); out.gain.value = 0; duckG.gain.value = 1;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
  const dl = ctx.createDelay(1); dl.delayTime.value = BEAT * 0.75; const fb = ctx.createGain(); fb.gain.value = 0.28; const wet = ctx.createGain(); wet.gain.value = 0.3;
  out.connect(lp); lp.connect(duckG); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(duckG); duckG.connect(master);
  apply();
}
function note(m, t, dur, type, v, atk) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = hz(m);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + atk); g.gain.setValueAtTime(v, t + Math.max(atk, dur - 1.2)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.1);
}
let lastM = 64;
function schedule() {
  if (!ctx || !on) return;
  while (nextT < ctx.currentTime + 2) {
    const ch = CHORDS[bar % 4], len = BEAT * 4;
    ch.forEach((m, i) => note(m, nextT, len + 1.2, i === 0 ? 'triangle' : 'sine', i === 0 ? 0.05 : 0.028, 1.4));
    if (!calm) for (let b = 0; b < 4; b++) {
      if (Math.random() < (b === 0 ? 0.75 : 0.35)) {
        const opts = SCALE.filter(m => Math.abs(m - lastM) <= 5 && (b !== 0 || ch.some(c => (c - m) % 12 === 0)));
        const m = (opts.length ? opts : SCALE)[Math.random() * (opts.length || SCALE.length) | 0]; lastM = m;
        note(m, nextT + b * BEAT, BEAT * 1.8, 'sine', 0.035, 0.03);
      }
    }
    nextT += len; bar++;
  }
}
function apply() {
  if (!ctx) return;
  const target = on ? vol * (calm ? 0.35 : 0.6) : 0;
  out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(target, ctx.currentTime, 1.2);
  if (on && !timer) { nextT = Math.max(nextT, ctx.currentTime + 0.2); schedule(); timer = setInterval(schedule, 500); }
  if (!on && timer) { clearInterval(timer); timer = null; }
}
export const Music = {
  set(enabled, volume, isCalm) { on = !!enabled && volume > 0; vol = volume == null ? 0.4 : volume; calm = !!isCalm; apply(); },
  duck(d) { if (!ctx || d === ducked) return; ducked = d; duckG.gain.setTargetAtTime(d ? 0.35 : 1, ctx.currentTime, d ? 0.15 : 0.8); },
};
Sound.onUnlock(setup);
document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) { if (timer) { clearInterval(timer); timer = null; } } else apply(); });

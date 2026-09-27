// "Read it aloud" bonus: optional speech recognition + in-memory "hear yourself" recording.
// Recognition never lowers scores; recordings are kept in memory only and discarded when the screen closes.
import { Speech } from './speech.js';
import { Sound, audioCtx } from './audio.js';

const MOCK = false;

class FakeRecognition {
  constructor() { this.lang = 'en-US'; this.maxAlternatives = 5; }
  start() {
    setTimeout(() => {
      const list = (window.__mockTranscripts || []).shift();
      if (list === 'error-network') { this.onerror && this.onerror({ error: 'network' }); this.onend && this.onend(); return; }
      if (!list) { this.onerror && this.onerror({ error: 'no-speech' }); this.onend && this.onend(); return; }
      const alts = list.map(t => ({ transcript: t, confidence: 0.5 }));
      const res = [alts]; res.isFinal = true;
      this.onresult && this.onresult({ results: [Object.assign(alts, { isFinal: true, length: alts.length })] });
      this.onend && this.onend();
    }, 400);
  }
  stop() { } abort() { }
}
const RecCtor = MOCK ? FakeRecognition : (window.SpeechRecognition || window.webkitSpeechRecognition || null);

export const Recognizer = {
  failed: false,
  get available() { return !!RecCtor && !this.failed; },
  listen(onDone) {
    // onDone({alts:[...]} | {error})
    let rec; try { rec = new RecCtor(); } catch (e) { this.failed = true; onDone({ error: 'unsupported' }); return null; }
    rec.lang = 'en-US'; rec.maxAlternatives = 5; rec.interimResults = false; rec.continuous = false;
    let done = false; const finish = r => { if (done) return; done = true; clearTimeout(to); onDone(r); };
    rec.onresult = e => { const alts = []; for (let i = 0; i < e.results.length; i++) for (let j = 0; j < e.results[i].length; j++) alts.push(e.results[i][j].transcript); finish({ alts }); };
    rec.onerror = e => { const err = e.error || 'error'; if (['network', 'service-not-allowed', 'not-allowed', 'audio-capture', 'language-not-supported'].includes(err)) this.failed = true; finish({ error: err }); };
    rec.onend = () => finish({ error: 'no-speech' });
    const to = setTimeout(() => { try { rec.stop(); } catch (e) { } finish({ error: 'no-speech' }); }, 9000);
    try { rec.start(); } catch (e) { this.failed = true; finish({ error: 'start-failed' }); }
    return rec;
  },
};

// ---------- Lenient matching tuned for his speech patterns ----------
export function normalize(s) { return (s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
// canonical "sound key": fold his common substitutions so they compare equal
function soundKey(w) {
  return w.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/wr/g, 'r')
    .replace(/r/g, 'w').replace(/l/g, 'y')          // w for r, y (j) for l
    .replace(/th/g, 's').replace(/z/g, 's')          // s/z distortions
    .replace(/([bcdfgkpt])[wy]/g, '$1')              // reduced clusters (br->b, tr->t, bl->b)
    .replace(/^s([ptkmnw])/, '$1')                   // s-cluster reduction (st->t)
    .replace(/(.)\1+/g, '$1')
    .replace(/e$/, '')                               // silent e
    .replace(/[bcdfgkpstvxnw]+$/, '');               // dropped final consonants
}
export function wordMatch(target, heard) {
  const t = normalize(target), h = normalize(heard); if (!t || !h) return false;
  if (t === h) return true;
  const tol = t.length <= 3 ? 1 : t.length <= 6 ? 1 : 2;
  if (lev(t, h) <= tol) return true;
  const kt = soundKey(t), kh = soundKey(h);
  if (kt && kt === kh) return true;
  if (kt.length >= 3 && lev(kt, kh) <= 1) return true;
  if (Math.min(kt.length, kh.length) >= 2 && Math.abs(kt.length - kh.length) <= 1 && (kt.startsWith(kh) || kh.startsWith(kt))) return true;
  return false;
}
export function isMatch(target, alts) {
  const tw = normalize(target).split(' ').filter(Boolean);
  for (const a of alts || []) {
    const hw = normalize(a).split(' ').filter(Boolean); if (!hw.length) continue;
    if (tw.length === 1) { if (hw.some(h => wordMatch(tw[0], h)) || wordMatch(tw[0], hw.join(''))) return { ok: true, heard: a }; continue; }
    let hit = 0; for (const w of tw) if (hw.some(h => wordMatch(w, h))) hit++;
    if (hit / tw.length >= 0.6) return { ok: true, heard: a };
  }
  return { ok: false, heard: (alts && alts[0]) || '' };
}

// ---------- Hear yourself (in-memory only) ----------
// Records a few seconds into memory (never saved or uploaded), then releases the microphone right away
// so the iPad's orange mic dot turns off. Playback goes through the same unlocked audio element as the
// voice clips (Speech.playUrl), so it works with the silent switch on and in Home Screen mode.
function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const types = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const t of types) { try { if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t; } catch (e) { } }
  return '';
}
function setSession(type) { try { if (navigator.audioSession) navigator.audioSession.type = type; } catch (e) { } }
export const Recorder = {
  get available() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && typeof window.MediaRecorder !== 'undefined'); },
  denied: false, url: null, mime: '', recording: false,
  _rec: null, _stream: null, _stopFn: null, _raf: 0, _src: null,
  // opts: { maxMs, silenceMs, onLevel(0..1), onStart }. Resolves { url, spoke, ms } or rejects { denied|error }
  async record(opts = {}) {
    this.discard();
    const maxMs = opts.maxMs || 6000, quietStart = opts.quietStartMs || 3000, afterSpeech = opts.silenceMs || 1000, minMs = opts.minMs || 3000;
    setSession('play-and-record');
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) {
      setSession('playback'); Sound.resume();
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'PermissionDeniedError');
      if (denied) this.denied = true;
      throw { denied, error: (e && e.name) || 'error' };
    }
    this.denied = false; this._stream = stream; this.recording = true;
    const mime = pickMime(); let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); } catch (e) { rec = new MediaRecorder(stream); }
    this._rec = rec; this.mime = rec.mimeType || mime || 'audio/mp4';
    // level meter + auto stop (analyser only; the mic is never sent to the speakers)
    const ac = audioCtx(); let an = null, buf = null;
    if (ac) { try { if (ac.ctx.state !== 'running') ac.ctx.resume(); this._src = ac.ctx.createMediaStreamSource(stream); an = ac.ctx.createAnalyser(); an.fftSize = 1024; buf = new Float32Array(an.fftSize); this._src.connect(an); } catch (e) { an = null; } }
    const chunks = []; const t0 = performance.now(); let spoke = false, lastLoud = 0, peak = 0;
    return new Promise((res, rej) => {
      const finish = () => {
        cancelAnimationFrame(this._raf); this._release();
        const ms = performance.now() - t0;
        if (!chunks.length) { rej({ error: 'empty' }); return; }
        const blob = new Blob(chunks, { type: this.mime.split(';')[0] || 'audio/mp4' }); this.url = URL.createObjectURL(blob);
        res({ url: this.url, spoke: spoke || !an, ms, size: blob.size });
      };
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = finish; rec.onerror = () => { try { rec.stop(); } catch (e) { finish(); } };
      this._stopFn = () => { if (rec.state !== 'inactive') { try { rec.requestData && rec.requestData(); } catch (e) { } rec.stop(); } };
      rec.start(250); opts.onStart && opts.onStart();
      const tick = () => {
        const now = performance.now() - t0;
        if (an) {
          an.getFloatTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length); peak = Math.max(peak * 0.9, rms); const lvl = Math.min(1, rms * 9);
          opts.onLevel && opts.onLevel(lvl);
          if (rms > 0.02) { if (!spoke && now > 120) spoke = true; lastLoud = now; }
          if (!spoke && now > quietStart) return this._stopFn();                       // nothing said: stop after ~3 s
          if (spoke && now > minMs && now - lastLoud > afterSpeech) return this._stopFn(); // finished talking
        } else if (now > minMs) return this._stopFn();
        if (now > maxMs) return this._stopFn();
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    });
  },
  stop() { if (this._stopFn) this._stopFn(); },
  // release the mic stream immediately (orange dot off) and give audio back to playback
  _release() {
    this.recording = false;
    try { this._src && this._src.disconnect(); } catch (e) { } this._src = null;
    if (this._stream) this._stream.getTracks().forEach(t => t.stop()); this._stream = null;
    setSession('playback'); Sound.resume();
  },
  play() { if (!this.url) return Promise.resolve(); return new Promise(r => Speech.playUrl(this.url, r)); },
  discard() {
    cancelAnimationFrame(this._raf);
    try { if (this._rec && this._rec.state !== 'inactive') { this._rec.ondataavailable = null; this._rec.onstop = null; this._rec.stop(); } } catch (e) { }
    this._rec = null; this._stopFn = null;
    if (this._stream || this.recording) this._release();
    if (this.url) URL.revokeObjectURL(this.url); this.url = null;
  },
};

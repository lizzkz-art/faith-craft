// "Read it aloud" bonus: optional speech recognition + in-memory "hear yourself" recording.
// Recognition never lowers scores; recordings are kept in memory only and discarded when the screen closes.

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
export const Recorder = {
  get available() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); },
  url: null, _rec: null, _stream: null,
  async record(ms = 4000) {
    this.discard();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this._stream = stream;
    const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', ''];
    const type = types.find(t => !t || (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)));
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); this._rec = rec;
    const chunks = [];
    return new Promise(res => {
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); this._stream = null; const blob = new Blob(chunks, { type: rec.mimeType || 'audio/mp4' }); this.url = URL.createObjectURL(blob); res(this.url); };
      rec.start(); setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, ms);
    });
  },
  stop() { if (this._rec && this._rec.state !== 'inactive') this._rec.stop(); },
  play() { if (!this.url) return Promise.resolve(); const a = new Audio(this.url); return new Promise(r => { a.onended = r; a.onerror = r; a.play().catch(r); }); },
  discard() { try { this.stop(); } catch (e) { } if (this._stream) this._stream.getTracks().forEach(t => t.stop()); this._stream = null; if (this.url) URL.revokeObjectURL(this.url); this.url = null; },
};

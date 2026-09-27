// Read-aloud. Main voice: natural neural-voice recordings bundled with the app (audio/),
// made ahead of time with Kokoro-82M (Apache 2.0). They work offline.
// Any text without a recording (for example a typed name) falls back to the device voice,
// choosing the best installed iPad voice (Premium / Enhanced / Siri / Samantha).
// Nothing is ever recorded here.
const synth = window.speechSynthesis;

const FAKE = false;
let voice = null, clips = null, clipsReady = null;
const A = typeof Audio !== 'undefined' ? new Audio() : null;
if (A) { A.preload = 'auto'; A.preservesPitch = true; A.mozPreservesPitch = true; A.webkitPreservesPitch = true; }
const SILENT = 'audio/silence.mp3';

// Same text normalisation + hash as tools/gen_audio.py (keep in sync)
export function normText(t) {
  return String(t).toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/(^|\s)'+|'+(?=\s|$)/g, '$1').replace(/\s+/g, ' ').trim();
}
export function clipId(key) { let h = 0x811c9dc5; for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
// Split into sentences, keeping character offsets
export function sentences(text) {
  const out = []; let cur = null;
  text.replace(/\S+/g, (w, i) => { if (!cur) cur = { off: i, end: i }; cur.end = i + w.length; if (/[.!?…][”"’')]*$/.test(w)) { out.push(cur); cur = null; } return w; });
  if (cur) out.push(cur);
  return out.map(c => ({ s: text.slice(c.off, c.end), off: c.off }));
}
function find(key) { if (!clips) return null; const id = clipId(key); const c = clips[id]; return c ? { id, d: c[0], w: c.slice(1) } : null; }

function pickVoice() {
  if (!synth) return null;
  const vs = (synth.getVoices() || []).filter(v => /^en/i.test(v.lang)); if (!vs.length) return null;
  const us = vs.filter(v => /en[-_]US/i.test(v.lang));
  const pref = [v => /premium/i.test(v.name), v => /enhanced|neural|natural/i.test(v.name), v => /siri/i.test(v.name), v => /samantha|ava|allison|zoe|nicky|susan/i.test(v.name), v => v.localService, () => true];
  for (const test of pref) { const v = us.find(test) || null; if (v) return v; }
  for (const test of pref) { const v = vs.find(test) || null; if (v) return v; }
  return vs[0];
}

let job = 0, raf = 0, fbTimer = 0;
const listeners = [], playListeners = [];
function setPlaying(on) { playListeners.forEach(f => { try { f(on); } catch (e) { } }); }

export const Speech = {
  available: false, rate: 0.9, unlocked: false,
  init() {
    clipsReady = fetch('audio/index.json').then(r => r.ok ? r.json() : null).then(j => { clips = j && j.clips || null; this._upd(); }).catch(() => { });
    if (FAKE) { this.available = true; return; }
    if (synth && typeof SpeechSynthesisUtterance !== 'undefined') {
      const upd = () => { voice = pickVoice(); this._upd(); };
      upd(); if (synth.addEventListener) synth.addEventListener('voiceschanged', upd); else synth.onvoiceschanged = upd;
      setTimeout(upd, 800); setTimeout(upd, 2500);
    }
    const unlock = () => this.unlock();
    ['touchend', 'pointerup', 'keydown', 'click'].forEach(ev => addEventListener(ev, unlock, { capture: true, passive: true }));
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
  },
  _upd() { const was = this.available; this.available = FAKE || !!clips || !!voice; if (was !== this.available) listeners.forEach(f => f(this.available)); },
  ready() { return clipsReady || Promise.resolve(); },
  hasClip(text, voiceKey = 'n') { return !!find(voiceKey + '|' + normText(text)); },
  voiceName() { return clips ? 'Natural voice (built in)' : voice ? voice.name : 'none'; },
  // iOS only lets audio start after a tap: play a silent clip on the first tap.
  unlock() {
    if (this.unlocked || !A) return; this.unlocked = true;
    try { if (!A.src || A.paused) { A.src = SILENT; const p = A.play(); if (p && p.catch) p.catch(() => { this.unlocked = false; }); } } catch (e) { this.unlocked = false; }
  },
  onChange(f) { listeners.push(f); },
  onPlaying(f) { playListeners.push(f); },
  cancel() {
    job++; cancelAnimationFrame(raf); clearTimeout(fbTimer);
    if (A) { try { A.pause(); } catch (e) { } A.onended = A.onerror = null; }
    try { synth && synth.speaking && synth.cancel(); } catch (e) { }
    setPlaying(false);
  },
  // speak(text, {onWord(charIndex), onEnd, voice: 'n'|'m', slow})
  speak(text, o = {}) {
    this.cancel(); const my = job; text = String(text || '');
    
    const single = !/\s/.test(text.trim());
    const segs = [];
    if (single) { const c = find('w|' + normText(text)) || find((o.voice || 'n') + '|' + normText(text)); segs.push({ s: text, off: text.indexOf(text.trim()), c }); }
    else for (const { s, off } of sentences(text)) segs.push({ s, off, c: find((o.voice || 'n') + '|' + normText(s)) || (o.voice === 'm' ? find('n|' + normText(s)) : null) });
    let i = 0;
    const next = () => {
      if (my !== job) return;
      if (i >= segs.length) { setPlaying(false); o.onEnd && o.onEnd(); return; }
      const seg = segs[i++];
      const after = () => { if (my !== job) return; fbTimer = setTimeout(next, i < segs.length ? 160 : 0); };
      if (seg.c) this._playClip(seg, o, my, after, () => this._tts(seg, o, my, after));
      else this._tts(seg, o, my, after);
    };
    setPlaying(true); next();
  },
  _rateFactor(o) { return Math.max(0.6, Math.min(1.35, (this.rate || 0.9) / 0.9)) * (o.slow ? 0.85 : 1); },
  _playClip(seg, o, my, done, fail) {
    if (!A) return fail();
    const words = []; seg.s.replace(/\S+/g, (m, k) => { words.push(seg.off + k); return m; });
    let lastW = -1;
    A.onended = () => { cancelAnimationFrame(raf); if (my === job) done(); };
    A.onerror = () => { cancelAnimationFrame(raf); if (my === job) fail(); };
    A.src = 'audio/c/' + seg.c.id + '.mp3';
    const rf = this._rateFactor(o); try { A.playbackRate = rf; A.defaultPlaybackRate = rf; } catch (e) { }
    const p = A.play();
    if (p && p.catch) p.catch(() => { if (my === job) { A.onended = A.onerror = null; fail(); } });
    const tick = () => {
      if (my !== job) return;
      const t = A.currentTime * 1000; let k = -1;
      for (let j = 0; j < seg.c.w.length; j++) if (seg.c.w[j] * 10 <= t + 40) k = j; else break;
      if (k !== lastW && k >= 0 && k < words.length) { lastW = k; o.onWord && o.onWord(words[k]); }
      raf = requestAnimationFrame(tick);
    };
    if (o.onWord) raf = requestAnimationFrame(tick);
  },
  _tts(seg, o, my, done) {
    const text = seg.s, rate = Math.max(0.4, Math.min(1.5, (o.slow ? 0.8 : 1) * (this.rate || 0.9)));
    const words = []; text.replace(/\S+/g, (m, k) => { words.push([k, m.length]); return m; });
    let got = false, ended = false;
    const finish = () => { if (ended) return; ended = true; clearTimeout(fbTimer); if (my === job) done(); };
    const fallback = () => { let k = 0; const step = () => { if (ended || got || my !== job) return; if (k >= words.length) { if (FAKE) finish(); return; } o.onWord && o.onWord(seg.off + words[k][0]); const len = words[k][1]; k++; fbTimer = setTimeout(step, (230 + len * 55) / rate); }; step(); };
    if (FAKE) { fallback(); return; }
    if (!synth || !voice) { done(); return; }
    const u = new SpeechSynthesisUtterance(text); u.voice = voice; u.lang = voice.lang; u.rate = rate; u.pitch = 1;
    u.onstart = () => { setTimeout(() => { if (!got && !ended) fallback(); }, 450); };
    u.onboundary = e => { if (e.name && e.name !== 'word') return; got = true; o.onWord && o.onWord(seg.off + e.charIndex); };
    u.onend = finish; u.onerror = finish;
    synth.speak(u);
  },
  // Play a recording (blob URL) through the same unlocked audio element as the voice clips
  playUrl(url, onEnd) {
    this.cancel(); const my = job; let done = false;
    const end = () => { if (done) return; done = true; if (A) { A.onended = A.onerror = null; } setPlaying(false); onEnd && onEnd(); };
    if (!A) return end();
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { }
    A.onended = () => { if (my === job) end(); }; A.onerror = () => { if (my === job) end(); };
    try { A.playbackRate = 1; A.defaultPlaybackRate = 1; } catch (e) { }
    A.src = url; setPlaying(true);
    const p = A.play(); if (p && p.catch) p.catch(() => { if (my === job) end(); });
    fbTimer = setTimeout(() => { if (my === job && A.paused && A.currentTime === 0) end(); }, 12000);
  },
  // Play several short parts in a row (syllables, verse chunks). onChunk(k) fires as each starts.
  speakChunks(chunks, o = {}) {
    this.cancel(); const my = job;
    
    let k = 0;
    const next = () => {
      if (my !== job) return;
      if (k >= chunks.length) { setPlaying(false); o.onEnd && o.onEnd(); return; }
      const idx = k++, text = chunks[idx], n = normText(text); o.onChunk && o.onChunk(idx);
      const c = find('p|' + n) || (idx < chunks.length - 1 || chunks.length === 1 ? find('s|' + n) : null) || find('w|' + n) || find('n|' + n);
      const after = () => { if (my !== job) return; fbTimer = setTimeout(next, k < chunks.length ? 380 : 0); };
      const seg = { s: text, off: 0, c };
      if (c) this._playClip(seg, {}, my, after, () => this._tts(seg, { slow: true }, my, after));
      else if (FAKE || !voice) { fbTimer = setTimeout(after, 600 + text.length * 70); }
      else this._tts(seg, { slow: true }, my, after);
    };
    setPlaying(true); next();
  },
};

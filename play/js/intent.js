// Voice talk: maps what the player said to one of the fixed Talk choices.
// Forgiving on purpose: folds w-for-r, y-for-l, dropped endings, and "shun" sounds. No AI, no network.
// Returns 'again' | 'next' | 'story' | 'verse' | 'bye' | null
const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
export function fold(w) {
  return w.replace(/ph/g, 'f').replace(/ck/g, 'k').replace(/x/g, 'ks').replace(/wr/g, 'r').replace(/qu/g, 'kw')
    .replace(/(ss|sh|s|t|ch)(io|u|o|i|a)n$/, 'shn')     // mission, mishun, mishon
    .replace(/r/g, 'w').replace(/l/g, 'y')                // w for r, y for l
    .replace(/th/g, 'd')                                  // "da" for "the"
    .replace(/^s([ptkmnw])/, '$1')                        // st -> t (story -> towy, stuck -> tuck)
    .replace(/(.)\1+/g, '$1');
}
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
// does heard word h (folded) match keyword k (folded)?
function wm(k, h) {
  if (k === h) return true;
  if (k.length >= 5 && lev(k, h) <= 1) return true;
  if (k.length >= 4 && h.length >= 3 && h.length >= k.length - 2 && k.startsWith(h)) return true; // dropped ending
  return false;
}
// keyword lists: [phrase, weight]. Topic words outweigh "again" so "tell me the story again" is a story.
const K = {
  again: [['repeat', 3], ['again', 2], ['mission', 4], ['mishn', 4], ['one more time', 4], ['say it again', 4], ['tell me again', 4], ['remind', 3], ['what did you say', 4], ['what was it', 3], ['hear it', 2], ['redo', 3], ['wepeat', 3], ['peat', 2], ['agen', 2], ['job', 2], ['quest', 3]],
  next: [['next', 3], ['help', 4], ['hewp', 4], ['hep', 3], ['hup', 3], ['halp', 4], ['stuck', 4], ['stuh', 3], ['hint', 4], ['what do i do', 5], ['what do i', 3], ['what now', 4], ['what should i', 4], ['where do i go', 5], ['where do i', 4], ['how do i', 4], ['dont know', 3], ['lost', 2], ['clue', 3], ['what next', 4]],
  story: [['story', 5], ['stories', 5], ['towy', 5], ['towee', 4], ['what happened', 4], ['tale', 3], ['tell me about', 2], ['bible story', 6]],
  verse: [['verse', 5], ['verses', 5], ['vewse', 5], ['vuss', 3], ['scripture', 5], ['bible verse', 6], ['memory verse', 6], ['say a verse', 6]],
  bye: [['bye', 5], ['goodbye', 5], ['good bye', 5], ['by', 3], ['buy', 3], ['bah', 1], ['see you', 5], ['see ya', 5], ['later', 3], ['gotta go', 5], ['got to go', 5], ['im done', 3], ['all done', 3], ['farewell', 5], ['see you later', 6]],
};
const ORDER = ['story', 'verse', 'next', 'again', 'bye'];
const FK = Object.fromEntries(Object.entries(K).map(([i, l]) => [i, l.map(([p, w]) => [norm(p).split(' ').map(fold), w])]));
function scoreAlt(alt) {
  const words = norm(alt).split(' ').filter(Boolean); if (!words.length) return null;
  const fw = words.map(fold);
  const joined = []; for (let i = 0; i + 1 < words.length; i++) joined.push(fold(words[i] + words[i + 1])); // "good bye", "a gain"
  const sc = {};
  for (const [intent, list] of Object.entries(FK)) {
    let s = 0;
    for (const [pw, w] of list) {
      let hit = false;
      if (pw.length === 1) hit = fw.some(h => wm(pw[0], h)) || joined.some(h => wm(pw[0], h));
      else for (let i = 0; i + pw.length <= fw.length && !hit; i++) hit = pw.every((k, j) => k === fw[i + j] || (k.length >= 4 && wm(k, fw[i + j])));
      if (hit) s = Math.max(s, w) + (s ? 1 : 0);   // best keyword, plus a little for each extra one
    }
    sc[intent] = s;
  }
  return sc;
}
export function matchIntent(alts) {
  const list = Array.isArray(alts) ? alts : [alts];
  const total = {};
  list.forEach((a, i) => { const sc = scoreAlt(a); if (!sc) return; const wt = i === 0 ? 1 : 0.8; for (const k in sc) total[k] = Math.max(total[k] || 0, sc[k] * wt); });
  let best = null, bs = 0;
  for (const k of ORDER) if ((total[k] || 0) > bs) { bs = total[k]; best = k; }
  return bs >= 2 ? best : null;
}

import { state, saveState, resetAll } from './save.js';
import { Speech } from './speech.js';
import { Sound } from './audio.js';
import { VERSES, VIRTUES, WORDS, GLOSSARY, QUESTS, QUEST_ORDER, PRACTICE, TRANSLATION, NPCS, LEVEL_NAMES, PHRASES, NPC_VOICE, TALK, HELPER_QUEST } from './data.js';
import { matchIntent } from './intent.js';
import { Music } from './music.js';
import { STORIES, SKILLS, SKILL_ORDER } from './stories.js';
import { GAMES, buildGame, shuffle, readAloudList, syllables, SAY_WORDS, SYLL } from './phonics.js';
import { iconURL, sceneEl } from './icons.js';
import { Recognizer, isMatch, Recorder } from './readaloud.js';

let G = null; // game API
const $ = s => document.querySelector(s);
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const SPK = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const MIC = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-3.1A7 7 0 0 0 19 11h-2z"/></svg>';
export const today = () => new Date().toLocaleDateString('en-US');
const tap = fn => e => { e.preventDefault && e.preventDefault(); Sound.unlock(); fn(e); };

const pick = a => Array.isArray(a) ? a[Math.random() * a.length | 0] : a;
export const playerName = () => (state.settings.name || '').trim() || 'Friend';
// Speak a few lines one after another (only if read-aloud is on, unless forced)
export function sayLines(list, force) {
  if ((!force && !state.settings.autoRead) || !Speech.available) return;
  const go = i => { if (i >= list.length) return; const [t, o] = Array.isArray(list[i]) ? list[i] : [list[i], {}]; Speech.speak(t, { ...o, onEnd: () => go(i + 1) }); };
  go(0);
}
// ---------------- Read-along text ----------------
function lookup(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  const tries = [w, w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ed$/, ''), w.replace(/ed$/, 'e'), w.replace(/ing$/, ''), w.replace(/ing$/, 'e'), w.replace(/ly$/, '')];
  for (const t of tries) { if (WORDS[t]) return { w: t, def: WORDS[t].def, ex: WORDS[t].ex }; if (GLOSSARY[t]) return { w: t, def: GLOSSARY[t] }; }
  return null;
}
export function wordPopup(word) {
  const clean = word.replace(/[^A-Za-z’'-]/g, '').replace(/[’']s$/, '');
  if (!clean) return;
  if (Speech.available) Speech.speak(clean, { slow: true });
  const info = lookup(clean);
  const pop = $('#wordpop'); pop.innerHTML = '';
  pop.append(h('div', { class: 'wp-word' }, clean, speakBtn(() => clean, { slow: true })),
    h('div', { class: 'wp-def' }, info ? info.def : 'Tap the speaker to hear this word.'),
    ...(info && info.ex ? [h('div', { class: 'wp-ex' }, 'Example: ' + info.ex)] : []),
    h('button', { class: 'btn small', onclick: tap(() => pop.classList.add('hidden')) }, 'Close'));
  pop.classList.remove('hidden');
}
export function speakBtn(getText, o = {}) {
  const b = h('button', { class: 'speak' + (o.cls ? ' ' + o.cls : ''), 'aria-label': 'Read aloud', html: SPK + (o.label ? `<span>${o.label}</span>` : '') });
  b.addEventListener('click', tap(() => { const t = typeof getText === 'function' ? getText() : getText; b.classList.add('pop'); setTimeout(() => b.classList.remove('pop'), 300); if (o.readable) o.readable.play(); else Speech.speak(t, { slow: o.slow, voice: o.voice }); }));
  return b;
}
// Text split into tappable words; play() reads aloud and highlights each word.
export function readable(text, o = {}) {
  const el = h('div', { class: 'readable' + (o.cls ? ' ' + o.cls : '') });
  const spans = []; const hl = new Set((o.highlight || []).map(x => x.toLowerCase()));
  text.replace(/\S+|\s+/g, (m, i) => {
    if (/^\s+$/.test(m)) { el.append(document.createTextNode(m)); return m; }
    const bare = m.toLowerCase().replace(/[^a-z]/g, '');
    const s = h('span', { class: 'w' + ([...hl].some(x => bare.startsWith(x)) ? ' vocab' : '') }, m); s.dataset.i = i;
    if (!o.noTap) s.addEventListener('click', tap(ev => { ev.stopPropagation(); wordPopup(m); }));
    spans.push([i, s]); el.append(s); return m;
  });
  const ctl = {
    el,
    play() {
      if (!Speech.available) return;
      Speech.speak(text, { voice: o.voice, slow: o.slow, onWord: ci => { let cur = null; for (const [i, s] of spans) { if (i <= ci) cur = s; s.classList.remove('on'); } if (cur) cur.classList.add('on'); }, onEnd: () => spans.forEach(([, s]) => s.classList.remove('on')) });
    },
  };
  if (o.speaker !== false) { const wrap = h('div', { class: 'readrow' }, speakBtn(null, { readable: ctl, cls: 'big' }), el); ctl.row = wrap; } else ctl.row = el;
  return ctl;
}
function autoRead(r) { if (state.settings.autoRead && Speech.available) r.play(); }

// ---------------- Overlay screens ----------------
function openScreen(title, opts = {}) {
  closeScreen(true);
  const back = h('button', { class: 'btn back', onclick: tap(() => { Speech.cancel(); (opts.onBack || closeScreen)(); }) }, opts.backLabel || '‹ Back');
  const body = h('div', { class: 'screen-body' });
  const scr = h('div', { class: 'screen' + (opts.cls ? ' ' + opts.cls : ''), id: 'screen' }, h('div', { class: 'screen-head' }, back, h('h2', {}, title), opts.right || h('span')), body);
  $('#overlay').append(scr); $('#overlay').classList.remove('hidden'); document.body.classList.add('screen-open');
  if (G) G.setUIOpen(true);
  return body;
}
export function closeScreen(silent) {
  Recorder.discard();
  $('#overlay').innerHTML = ''; $('#overlay').classList.add('hidden'); $('#wordpop').classList.add('hidden'); document.body.classList.remove('screen-open');
  if (!silent && G) G.afterScreenClose();
}

// ---------------- Scoring ----------------
export const grade = p => p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F';
export const starsFor = p => p >= 90 ? 3 : p >= 80 ? 2 : p >= 60 ? 1 : 0;
export function effLevel() { const s = state.settings; return Math.max(1, Math.min(3, s.difficulty + (s.autoLevel ? (state.levelBoost || 0) : 0))); }
function recordSkill(skill, ok, total, lv) {
  if (!total) return; const pct = Math.round(100 * ok / total);
  const r = (state.skills ||= {})[skill] ||= { best: 0, latest: 0, tries: 0, first: today(), last: today(), history: [] };
  r.best = Math.max(r.best, pct); r.latest = pct; r.tries++; r.last = today(); r.lv = lv;
  r.history.push({ pct, lv, d: today() }); if (r.history.length > 20) r.history.shift();
}
function afterActivity(pct, lv) {
  state.xp = (state.xp || 0) + Math.round(pct / 10) * lv;
  let msg = null;
  if (state.settings.autoLevel) {
    if (pct >= 80 && lv === effLevel()) { state.streak = (state.streak || 0) + 1; state.lowStreak = 0; }
    else if (pct < 60) { state.lowStreak = (state.lowStreak || 0) + 1; state.streak = 0; }
    else state.streak = 0;
    if (state.streak >= 3 && effLevel() < 3) { state.levelBoost = (state.levelBoost || 0) + 1; state.streak = 0; msg = PHRASES.levelUp[effLevel()]; }
    if (state.lowStreak >= 2 && (state.levelBoost || 0) > 0) { state.levelBoost--; state.lowStreak = 0; msg = PHRASES.levelDown[effLevel()]; }
  }
  saveState(); return msg;
}
export function readingLevel() { return 1 + Math.floor((state.xp || 0) / 100); }

// ---------------- Common activity pieces ----------------
function checklist(steps, cur) { return h('ol', { class: 'routine' }, steps.map((s, i) => h('li', { class: i < cur ? 'done' : i === cur ? 'cur' : '' }, h('span', { class: 'dot' }, i < cur ? '✓' : String(i + 1)), s))); }
function activityIntro(body, { title, dir, tip, pic }, onGo) {
  body.innerHTML = '';
  const r = readable(dir, { cls: 'dir' });
  const tipEl = tip ? h('div', { class: 'tip hidden' }, readable(tip, { cls: 'small' }).row) : null;
  body.append(h('div', { class: 'card intro' }, h('h3', {}, title), pic ? h('img', { class: 'intro-pic', src: iconURL(pic), alt: '' }) : null, r.row, tipEl,
    h('div', { class: 'ask' }, 'Do you understand what to do?'),
    h('div', { class: 'row' }, h('button', { class: 'btn primary big', onclick: tap(() => { Speech.cancel(); onGo(); }) }, 'Yes, I’m ready'),
      h('button', { class: 'btn big', onclick: tap(() => { r.play(); tipEl && tipEl.classList.remove('hidden'); }) }, 'Say it again'))));
  autoRead(r);
}
function results(body, { title, correct, total, skills, lv, best, onRetry, onDone, extra }) {
  const pct = Math.round(100 * correct / Math.max(1, total)); const gr = grade(pct), st = starsFor(pct);
  state.stars += st; const lvMsg = afterActivity(pct, lv);
  if (st) Sound.fanfare(); else Sound.good();
  body.innerHTML = '';
  const bar = h('div', { class: 'goalbar' }, h('div', { class: 'fill' + (pct >= 80 ? ' met' : ''), style: `width:${pct}%` }), h('div', { class: 'goal', style: 'left:80%' }, h('span', {}, 'Goal 80%')));
  const msg = pct >= 80 ? PHRASES.results[0] : pct >= 60 ? PHRASES.results[1] : PHRASES.results[2];
  const r = readable(`${msg} You got ${correct} out of ${total}.`);
  body.append(h('div', { class: 'card results' }, h('h3', {}, title),
    h('div', { class: 'scoreline' }, h('div', { class: 'pct' }, pct + '%'), h('div', { class: 'grade g' + gr }, gr), h('div', { class: 'stars' }, '★'.repeat(st) + '☆'.repeat(3 - st))),
    bar, r.row, best != null ? h('div', { class: 'muted' }, `Best score: ${best}% · Level: ${LEVEL_NAMES[lv]}`) : null,
    skills ? h('div', { class: 'skillmini' }, Object.entries(skills).map(([k, v]) => h('div', {}, `${SKILLS[k]}: ${v[0]}/${v[1]}`))) : null,
    lvMsg ? h('div', { class: 'levelup' }, lvMsg) : null, extra || null,
    h('div', { class: 'breaknote' }, 'This is a good place for a break.'),
    h('div', { class: 'row' }, h('button', { class: 'btn big', onclick: tap(onRetry) }, 'Try again'), h('button', { class: 'btn primary big', onclick: tap(onDone) }, 'Done'))));
  autoRead(r); saveState();
  return pct;
}
function choiceButtons(choices, pics, onPick, o = {}) {
  const wrap = h('div', { class: 'choices' + (pics ? ' pics' : '') });
  choices.forEach(c => {
    const b = h('button', { class: 'choice' + (o.bigText ? ' bigtext' : '') }, pics && pics[c] ? h('img', { src: iconURL(pics[c]), alt: '' }) : null, h('span', {}, c));
    b.addEventListener('click', tap(() => onPick(c, b, wrap)));
    const row = h('div', { class: 'choice-row' }, b, o.noSpeak ? null : speakBtn(() => c));
    wrap.append(row);
  });
  return wrap;
}
function markChoices(wrap, answer, picked) {
  wrap.querySelectorAll('.choice').forEach(b => { b.disabled = true; const t = b.querySelector('span').textContent; if (t === answer) b.classList.add('right'); else if (b === picked) b.classList.add('miss'); });
}
function feedback(ok, answer, spoken) {
  const say = spoken === undefined ? answer : spoken;
  if (ok) { Sound.good(); const ph = pick(PHRASES.right); sayLines([ph, ...(say ? [[say, { slow: true }]] : [])], true); return h('div', { class: 'fb good' }, '✓ ' + ph); }
  Sound.gentle(); const ph = pick(PHRASES.tryAgain); sayLines([ph, ...(say ? [[say, { slow: true }]] : [])], true);
  return h('div', { class: 'fb try' }, ph + ' ', h('b', {}, answer));
}

// ---------------- Story Check (comprehension + retell) ----------------
export function storyCheck(qid, onFinish) {
  const S = STORIES[qid], Qd = QUESTS[qid], lv = effLevel();
  const body = openScreen('Story Check: ' + Qd.title, { onBack: () => { closeScreen(); onFinish && onFinish(); } });
  const phases = ['Read the story', 'Answer questions', 'Put it in order', 'See your score'];
  const pages = S.pages[lv];
  let page = 0;
  const skillTally = {}; let correct = 0, total = 0;
  const tally = (s, ok) => { (skillTally[s] ||= [0, 0]); skillTally[s][1]++; total++; if (ok) { skillTally[s][0]++; correct++; } };
  function showPage() {
    body.innerHTML = '';
    const r = readable(pages[page], { cls: 'story', highlight: Qd.words });
    body.append(checklist(phases, 0), h('div', { class: 'card page' }, h('div', { class: 'muted' }, `Page ${page + 1} of ${pages.length} · ${LEVEL_NAMES[lv]}`), sceneEl(S.pics[page]), r.row,
      h('div', { class: 'row' }, page > 0 ? h('button', { class: 'btn', onclick: tap(() => { page--; showPage(); }) }, '‹ Back') : null,
        h('button', { class: 'btn big', onclick: tap(() => r.play()) }, 'Replay'),
        h('button', { class: 'btn primary big', onclick: tap(() => { Speech.cancel(); page++; if (page < pages.length) showPage(); else qIntro(); }) }, 'Next ›'))));
    autoRead(r);
  }
  const qs = S.qs.filter(q => q.lv <= lv); let qi = 0;
  function qIntro() { activityIntro(body, { title: 'Questions', dir: 'Read each question. Tap the best answer. Tap a speaker to hear any answer.', tip: 'Take your time. There is no timer.' }, () => { const d = h('div'); body.innerHTML = ''; showQ(); }); }
  function showQ() {
    const q = qs[qi]; body.innerHTML = ''; 
    const nWrong = lv === 3 ? 3 : 2; const choices = shuffle([q.a, ...q.w.slice(0, nWrong)]);
    const r = readable(q.q, { cls: 'question' });
    const fbBox = h('div', { class: 'fbbox' });
    const ch = choiceButtons(choices, Object.keys(q.p).length ? q.p : null, (c, b, wrap) => {
      const ok = c === q.a; tally(q.s, ok); markChoices(wrap, q.a, b); fbBox.append(feedback(ok, q.a),
        h('button', { class: 'btn primary big', onclick: tap(() => { qi++; if (qi < qs.length) showQ(); else retellIntro(); }) }, 'Next ›'));
    });
    body.append(checklist(phases, 1), h('div', { class: 'card' }, h('div', { class: 'muted' }, `Question ${qi + 1} of ${qs.length} · `, h('span', { class: 'chip' }, SKILLS[q.s])), r.row, ch, fbBox));
    autoRead(r);
  }
  function retellIntro() { activityIntro(body, { title: 'Retell the story', dir: 'Put the pictures in order. Tap the picture that happened first, then next, then last.', tip: 'First, Then, Last. Think about the story from beginning to end.' }, showRetell); }
  function showRetell() {
    const cards = S.retell.cards.map((c, i) => ({ ...c, i })); const order = shuffle(cards); const slots = [null, null, null];
    body.innerHTML = '';
    const slotEls = ['First', 'Then', 'Last'].map((lab, k) => h('div', { class: 'rslot', onclick: tap(() => { if (slots[k]) { slots[k] = null; render(); } }) }, h('div', { class: 'slot-lab' }, lab)));
    const pool = h('div', { class: 'cardpool' }); const done = h('div', { class: 'fbbox' });
    const check = h('button', { class: 'btn primary big', disabled: 'true', onclick: tap(() => {
      let ok = 0; slots.forEach((c, k) => { const good = c.i === k; if (good) ok++; tally('retell', good); slotEls[k].classList.add(good ? 'right' : 'miss'); });
      check.remove(); pool.innerHTML = '';
      sayLines([ok === 3 ? PHRASES.retellRight : PHRASES.retellTry], true);
      done.append(ok === 3 ? h('div', { class: 'fb good' }, '✓ ' + PHRASES.retellRight) : h('div', { class: 'fb try' }, PHRASES.retellTry), h('ol', { class: 'rightorder' }, S.retell.cards.map(c => h('li', {}, c.text))),
        h('button', { class: 'btn primary big', onclick: tap(showBecause) }, 'Next ›'));
      if (ok === 3) Sound.good(); else Sound.gentle();
    }) }, 'Check my order');
    function render() {
      slotEls.forEach((el, k) => { el.querySelectorAll('.rcard').forEach(n => n.remove()); if (slots[k]) el.append(rcard(slots[k], true)); });
      pool.innerHTML = ''; order.filter(c => !slots.includes(c)).forEach(c => { const e = rcard(c); e.addEventListener('click', tap(() => { const k = slots.indexOf(null); if (k >= 0) { slots[k] = c; Sound.click(); render(); } })); pool.append(e); });
      if (slots.every(Boolean)) check.removeAttribute('disabled'); else check.setAttribute('disabled', 'true');
    }
    function rcard(c, small) { return h('div', { class: 'rcard' + (small ? ' in' : '') }, h('img', { src: iconURL(c.pic), alt: '' }), h('div', { class: 'rtext' }, c.text), small ? null : speakBtn(() => c.text)); }
    body.append(checklist(phases, 2), h('div', { class: 'card' }, h('h3', {}, 'First, Then, Last'), h('div', { class: 'slots' }, slotEls), pool, h('div', { class: 'row' }, check), done));
    render();
  }
  function showBecause() {
    const b = S.retell.because; body.innerHTML = ''; const r = readable(b.q, { cls: 'question' }); const fbBox = h('div', { class: 'fbbox' });
    const ch = choiceButtons(shuffle([b.a, ...b.w]), null, (c, btn, wrap) => { const ok = c === b.a; tally('retell', ok); markChoices(wrap, b.a, btn); fbBox.append(feedback(ok, b.a), h('button', { class: 'btn primary big', onclick: tap(finish) }, 'See my score ›')); });
    body.append(checklist(phases, 2), h('div', { class: 'card' }, h('div', { class: 'muted' }, 'Finish the “because” sentence'), r.row, ch, fbBox)); autoRead(r);
  }
  function finish() {
    for (const [s, [ok, n]] of Object.entries(skillTally)) recordSkill(s, ok, n, lv);
    const pct = Math.round(100 * correct / total);
    const rec = (state.quiz ||= {})[qid] ||= { best: 0, tries: 0 };
    rec.tries++; rec.latest = pct; rec.date = today(); rec.lv = lv; if (pct >= rec.best) { rec.best = pct; rec.grade = grade(pct); rec.bestLv = lv; rec.bestDate = today(); }
    body.innerHTML = ''; body.append(checklist(phases, 3)); const inner = h('div'); body.append(inner);
    results(inner, { title: 'Story Check: ' + Qd.title, correct, total, skills: skillTally, lv, best: rec.best, onRetry: () => storyCheck(qid, onFinish), onDone: () => { closeScreen(); onFinish && onFinish(); } });
  }
  showPage();
}

// ---------------- Word games ----------------
export function gamesHub() {
  const body = openScreen('Word Games', { onBack: backToMenu });
  const lv = effLevel();
  body.append(h('div', { class: 'muted center' }, `Reading level: ${LEVEL_NAMES[lv]}. Each game takes about 2 to 4 minutes. Goal: 80%.`));
  const grid = h('div', { class: 'gamegrid' });
  for (const g of GAMES) {
    const rec = (state.games || {})[g.id];
    grid.append(h('button', { class: 'gamecard' + (g.extra ? ' extra' : ''), onclick: tap(() => runGame(g.id)) }, h('div', { class: 'gtitle' }, g.title),
      h('div', { class: 'gskill' }, g.skill === 'mixed' ? 'Mixed skills' : SKILLS[g.skill]),
      g.extra ? h('div', { class: 'gextra' }, 'Extra practice') : null,
      h('div', { class: 'gbest' + (rec && rec.best >= 80 ? ' met' : '') }, rec ? `Best ${rec.best}% (${grade(rec.best)})${rec.best >= 80 ? ' ✓' : ''}` : 'Not tried yet')));
  }
  body.append(grid);
}
export function runGame(id) {
  const g = GAMES.find(x => x.id === id), lv = effLevel();
  const body = openScreen(g.title, { onBack: gamesHub });
  const items = buildGame(id, lv); let k = 0, correct = 0; const skillT = {};
  const steps = ['Directions', 'Play', 'Score'];
  const wrapIntro = h('div'); body.append(checklist(steps, 0), wrapIntro);
  const pic = g.type === 'bd' ? 'bed' : null;
  activityIntro(wrapIntro, { title: g.title, dir: g.dir, tip: g.tip, pic }, next);
  function next() {
    if (k >= items.length) return end();
    const it = items[k]; body.innerHTML = ''; 
    const card = h('div', { class: 'card game' }); const fbBox = h('div', { class: 'fbbox' });
    const prog = h('div', { class: 'progress' }, h('div', { style: `width:${100 * k / items.length}%` }));
    body.append(checklist(steps, 1), prog, h('div', { class: 'muted' }, `${k + 1} of ${items.length}`), card);
    let answered = false;
    const answer = (val, el) => {
      if (answered) return; answered = true;
      const ok = val === it.answer; if (ok) correct++; (skillT[it.skill] ||= [0, 0]); skillT[it.skill][1]++; if (ok) skillT[it.skill][0]++;
      if (el) el.classList.add(ok ? 'right' : 'miss');
      card.querySelectorAll('.choice').forEach(b => { b.disabled = true; if ((b.dataset.v || b.textContent) === it.answer) b.classList.add('right'); });
      const shown = it.kind === 'fill' || it.kind === 'bd' ? it.say : it.answer;
      fbBox.append(feedback(ok, shown, it.say), h('div', { class: 'row' }, speakBtn(() => it.say, { label: 'Hear it', slow: true }), h('button', { class: 'btn primary big', onclick: tap(() => { k++; next(); }) }, 'Next ›')));
    };
    const big = (t) => h('div', { class: 'bigword' }, t);
    const btns = (choices, cls = '') => h('div', { class: 'choices letters ' + cls }, choices.map(c => { const b = h('button', { class: 'choice', 'data-v': c }, c); b.addEventListener('click', tap(() => answer(c, b))); return b; }));
    if (it.kind === 'sort') {
      const word = h('div', { class: 'dragword' }, it.word);
      const buckets = h('div', { class: 'buckets' }, it.choices.map(c => { const b = h('button', { class: 'bucket choice', 'data-v': c }, h('span', {}, c)); b.addEventListener('click', tap(() => answer(c, b))); return b; }));
      card.append(h('div', { class: 'row center' }, word, speakBtn(() => it.say, { slow: true })), buckets);
      makeDraggable(word, buckets, (c, el) => answer(c, el));
    } else if (it.kind === 'fill') {
      const r = readable('Clue: ' + it.clue, { cls: 'small' });
      card.append(big(it.word.replace('__', '＿＿')), r.row, btns(it.choices)); autoRead(r);
    } else if (it.kind === 'spell') {
      const r = readable('Clue: ' + it.clue, { cls: 'small' });
      card.append(r.row, h('div', { class: 'row center' }, speakBtn(() => it.say, { label: 'Hear the word', slow: true })), btns(it.choices, 'words')); autoRead(r);
    } else if (it.kind === 'sight') {
      const r = readable(it.sentence.replace('___', '_____'), { cls: 'question' });
      const ch = h('div', { class: 'choices' }); it.choices.forEach(c => { const b = h('button', { class: 'choice', 'data-v': c }, c); b.addEventListener('click', tap(() => answer(c, b))); ch.append(h('div', { class: 'choice-row' }, b, speakBtn(() => c))); });
      card.append(r.row, ch); autoRead(r);
    } else if (it.kind === 'bd') {
      card.append(h('img', { class: 'bigpic', src: iconURL(it.pic), alt: '' }), big(it.word.replace('_', '＿')), btns(it.choices, 'bd'), h('div', { class: 'tip' }, 'Tip: make a “bed” with your fists. b is on the left, d is on the right.'));
    } else if (it.kind === 'bdword') {
      card.append(h('img', { class: 'bigpic', src: iconURL(it.pic), alt: '' }), h('div', { class: 'muted center' }, 'Which word matches the picture?'), btns(it.choices, 'words'));
    } else if (it.kind === 'syll') {
      const r = readable('Clue: ' + it.clue, { cls: 'small' });
      const built = h('div', { class: 'built' }); const picked = [];
      const tiles = h('div', { class: 'tiles' });
      shuffle(it.parts.map((p, i) => ({ p, i }))).forEach(t => {
        const b = h('button', { class: 'tile' }, t.p);
        b.addEventListener('click', tap(() => { if (answered || b.disabled) return; b.disabled = true; picked.push(t.p); built.append(h('span', { class: 'bpart' }, t.p)); Sound.click();
          if (picked.length === it.parts.length) { const ok = picked.join('') === it.answer; answer(ok ? it.answer : picked.join(''), built); if (!ok) built.after(h('div', { class: 'bigword' }, it.parts.join(' - '))); } }));
        tiles.append(b);
      });
      card.append(r.row, h('div', { class: 'row center' }, speakBtn(() => it.say, { label: 'Hear the word', slow: true })), built, tiles,
        h('button', { class: 'btn small', onclick: tap(() => { if (answered) return; picked.length = 0; built.innerHTML = ''; tiles.querySelectorAll('button').forEach(b => b.disabled = false); }) }, 'Start over'));
      autoRead(r);
    }
    card.append(fbBox);
  }
  function end() {
    for (const [s, [ok, n]] of Object.entries(skillT)) recordSkill(s, ok, n, lv);
    const pct = Math.round(100 * correct / items.length);
    const rec = (state.games ||= {})[id] ||= { best: 0, tries: 0 }; rec.tries++; rec.latest = pct; rec.last = today(); rec.lv = lv; rec.best = Math.max(rec.best, pct);
    body.innerHTML = ''; body.append(checklist(steps, 2)); const inner = h('div'); body.append(inner);
    results(inner, { title: g.title, correct, total: items.length, skills: skillT, lv, best: rec.best, onRetry: () => runGame(id), onDone: gamesHub });
  }
}
function makeDraggable(el, bucketsWrap, onDrop) {
  let sx, sy, dragging = false;
  el.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; dragging = true; el.setPointerCapture(e.pointerId); el.classList.add('dragging'); });
  el.addEventListener('pointermove', e => { if (!dragging) return; el.style.transform = `translate(${e.clientX - sx}px, ${e.clientY - sy}px)`; });
  const up = e => {
    if (!dragging) return; dragging = false; el.classList.remove('dragging'); el.style.transform = '';
    for (const b of bucketsWrap.querySelectorAll('.bucket')) { const r = b.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { onDrop(b.dataset.v, b); return; } }
    if (Math.hypot(e.clientX - sx, e.clientY - sy) < 8 && Speech.available) Speech.speak(el.textContent, { slow: true });
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

// ---------------- Read It Aloud (bonus, never graded) ----------------
export function readAloud() {
  const body = openScreen('Read It Aloud ★ Bonus', { onBack: () => { Recorder.discard(); backToMenu(); } });
  const lv = effLevel(); const L = readAloudList(lv); const list = [...L.words.slice(0, 6), ...L.sentences.slice(0, 2)];
  let k = 0, tries = 0;
  const intro = h('div', { class: 'card intro' }, h('h3', {}, 'Read It Aloud'),
    readable('Read each word out loud. You earn bonus stars. This never changes your grades.').row,
    h('div', { class: 'row' }, h('button', { class: 'btn primary big', onclick: tap(show) }, 'Start')));
  body.append(intro);
  function show() {
    body.innerHTML = ''; tries = 0; const target = list[k]; const isWord = !/\s/.test(target);
    const parts = isWord ? syllables(target) : target.split(' ');
    const disp = h('div', { class: 'ra-target' + (isWord ? '' : ' sentence') }, parts.map((p, i) => h('span', { class: 'syl' }, p + (isWord ? '' : ' '))));
    const status = h('div', { class: 'ra-status' }, 'Tap the microphone and read it out loud.');
    const next = h('button', { class: 'btn primary big hidden', onclick: tap(() => { Recorder.discard(); k++; if (k < list.length) show(); else doneScreen(); }) }, k + 1 < list.length ? 'Next ›' : 'Finish');
    const model = () => {
      const spans = [...disp.querySelectorAll('.syl')];
      Speech.speakChunks(isWord && parts.length > 1 ? [...parts, target] : [target], { rate: 0.7, onChunk: c => spans.forEach((s, i) => s.classList.toggle('on', isWord && parts.length > 1 ? (c < parts.length ? i === c : true) : true)), onEnd: () => spans.forEach(s => s.classList.remove('on')) });
      if (!Speech.available) { spans.forEach((s, i) => setTimeout(() => { spans.forEach(x => x.classList.remove('on')); s.classList.add('on'); }, i * 700)); setTimeout(() => spans.forEach(x => x.classList.remove('on')), spans.length * 700 + 600); }
    };
    const award = (n, how) => {
      state.readStars = (state.readStars || 0) + n;
      if (how !== 'self') { (state.readWords ||= {})[target] = { d: today(), by: how }; }
      saveState(); next.classList.remove('hidden'); starBurst(body); if (typeof counter !== 'undefined') counter.textContent = `${k + 1} of ${list.length} · Read Aloud Stars: ${state.readStars || 0}`;
    };
    const success = (how) => { Sound.star(); const ph = pick(PHRASES.raYes); sayLines([ph], true); status.innerHTML = ''; status.append(h('b', {}, ph + ' '), how === 'helper' ? '(Helper check) ' : '', '+2 Read Aloud Stars'); award(2, how); lockMic(); };
    const participation = () => { Sound.good(); status.textContent = PHRASES.raEffort; sayLines([PHRASES.raEffort], true); award(1, 'self'); lockMic(); };
    const micBtn = h('button', { class: 'btn mic big', html: MIC + '<span>Read it</span>' });
    const lockMic = () => { micBtn.disabled = true; selfBtn.disabled = true; helperBtn && (helperBtn.disabled = true); };
    micBtn.addEventListener('click', tap(() => {
      if (!state.micIntroSeen) return micIntro(() => { state.micIntroSeen = true; saveState(); micBtn.click(); });
      micBtn.classList.add('listening'); status.textContent = 'Listening… read it now.';
      Recognizer.listen(res => {
        micBtn.classList.remove('listening');
        if (res.error) {
          if (!Recognizer.available) { micBtn.classList.add('hidden'); status.textContent = 'The microphone helper is not available right now. Tap “I read it!” instead.'; }
          else { status.textContent = PHRASES.raNoHear; sayLines([PHRASES.raNoHear], true); }
          return;
        }
        const m = isMatch(target, res.alts);
        if (m.ok) return success('mic');
        tries++;
        if (tries >= 2) { participation(); return; }
        status.textContent = PHRASES.raTry; Sound.gentle(); if (Speech.available) Speech.speak(PHRASES.raTry, { onEnd: () => setTimeout(model, 250) }); else setTimeout(model, 500);
      });
    }));
    if (!Recognizer.available) micBtn.classList.add('hidden');
    const selfBtn = h('button', { class: 'btn big', onclick: tap(participation) }, 'I read it!');
    const helperBtn = state.settings.helperCheck ? h('button', { class: 'btn helper', onclick: tap(() => success('helper')) }, 'Helper: He read it!') : null;
    const hearSelf = recordWidget({ recLabel: 'Record me', model: onEnd => Speech.speak(target, { slow: true, onEnd }) });
    const counter = h('div', { class: 'muted' }, `${k + 1} of ${list.length} · Read Aloud Stars: ${state.readStars || 0}`); body.append(counter, h('div', { class: 'card ra' }, disp,
      h('div', { class: 'row center' }, speakBtn(null, { label: 'Hear it slowly', cls: 'big' })), status,
      h('div', { class: 'row center' }, micBtn, selfBtn, helperBtn), h('div', { class: 'row center' }, hearSelf), h('div', { class: 'row center' }, next),
      h('div', { class: 'muted small' }, 'Bonus only. Recordings stay in memory and are deleted when you leave this screen.')));
    body.querySelector('.speak.big').replaceWith(h('button', { class: 'speak big', html: SPK + '<span>Hear it slowly</span>', onclick: tap(model) }));
  }
  function doneScreen() { body.innerHTML = ''; body.append(h('div', { class: 'card results' }, h('h3', {}, 'Great reading!'), h('div', { class: 'pct' }, '★ ' + (state.readStars || 0)), h('div', {}, 'Read Aloud Stars (bonus)'), h('div', { class: 'breaknote' }, 'This is a good place for a break.'), h('div', { class: 'row' }, h('button', { class: 'btn big', onclick: tap(readAloud) }, 'More words'), h('button', { class: 'btn primary big', onclick: tap(backToMenu) }, 'Done')))); }
}
function micIntro(onOk) {
  const pop = h('div', { class: 'modal', id: 'micintro' }, h('div', { class: 'card' }, h('h3', {}, 'Using the microphone'),
    readable('The game can listen while you read or talk, so it can cheer you on and you can hear yourself. Your iPad will ask to use the microphone. A grown-up can tap Allow. Recordings are never saved or shared.').row,
    h('div', { class: 'row' }, h('button', { class: 'btn primary big', onclick: tap(() => { pop.remove(); onOk(); }) }, 'OK, let’s try'), h('button', { class: 'btn big', onclick: tap(() => pop.remove()) }, 'Not now'))));
  document.body.append(pop);
}
function starBurst(parent) { if (state.settings.calm) return; const s = h('div', { class: 'burst' }, '★'); parent.append(s); setTimeout(() => s.remove(), 1200); }

// ---------------- Say it with me (never graded or recorded) ----------------
export function practice(startId) {
  const body = openScreen('Say It With Me', { onBack: backToMenu });
  const list = h('div', { class: 'practicelist' });
  body.append(h('div', { class: 'muted center' }, 'Practice out loud at your own speed. Nothing is graded. You can record yourself and listen back.'), h('h3', {}, 'Verses'), list);
  PRACTICE.forEach(p => list.append(h('button', { class: 'pbtn' + (state.practice[p.id] ? ' done' : ''), onclick: tap(() => sayIt(p.ref, p.chunks, p.id)) }, p.ref, state.practice[p.id] ? ' ✓' : '')));
  const wl = h('div', { class: 'practicelist' }); body.append(h('h3', {}, 'Words (r-blends and strong endings)'), wl);
  SAY_WORDS.forEach(w => wl.append(h('button', { class: 'pbtn', onclick: tap(() => sayIt(w.replace(/-/g, ''), w.split('-'), 'w:' + w, true)) }, w.replace(/-/g, ''))));
  if (startId) { const p = PRACTICE.find(x => x.id === startId); if (p) sayIt(p.ref, p.chunks, p.id); }
}
// ---------------- Record me / Hear myself (shared) ----------------
// model(onEnd) plays the correct Kokoro clip; the recording follows right after it. In memory only.
const MIC_OFF_MSG = 'The microphone is turned off for this game. A grown-up can turn it on: open Settings, then Safari (or the Faith Craft app), then Microphone, and choose Allow.';
function recordWidget({ model, onRecorded, onUnavailable, recLabel = 'Record me' }) {
  const wrap = h('div', { class: 'recw' });
  if (!Recorder.available) { onUnavailable && onUnavailable(); return wrap; }
  const meter = h('div', { class: 'recmeter', 'aria-hidden': 'true' }, h('div', { class: 'lvl' }));
  const status = h('div', { class: 'recstatus', 'aria-live': 'polite' });
  const recBtn = h('button', { class: 'btn big recbtn', html: '<span class="ico" aria-hidden="true">🎙️</span><span class="lbl">' + recLabel + '</span>' });
  const hearBtn = h('button', { class: 'btn primary big hearbtn hidden', html: '<span class="ico" aria-hidden="true">👂</span><span>Hear myself</span>' });
  const againBtn = h('button', { class: 'btn big againbtn hidden', html: '<span class="ico" aria-hidden="true">🔁</span><span>Try again</span>' });
  const liveRow = h('div', { class: 'reclive hidden' }, h('span', { class: 'recdot' }), h('b', {}, 'Listening…'), meter);
  const setIdle = () => { recBtn.classList.remove('listening', 'hidden'); recBtn.querySelector('.lbl').textContent = recLabel; recBtn.querySelector('.ico').textContent = '🎙️'; liveRow.classList.add('hidden'); };
  const start = async () => {
    if (Recorder.recording) { Recorder.stop(); return; }
    Speech.cancel(); status.textContent = ''; hearBtn.classList.add('hidden'); againBtn.classList.add('hidden');
    recBtn.classList.add('listening'); recBtn.querySelector('.lbl').textContent = 'Stop'; recBtn.querySelector('.ico').textContent = '⏹'; liveRow.classList.remove('hidden');
    const lvl = meter.firstChild;
    try {
      const r = await Recorder.record({ onLevel: v => { lvl.style.width = Math.round(v * 100) + '%'; } });
      recBtn.classList.add('hidden'); recBtn.classList.remove('listening'); liveRow.classList.add('hidden');
      hearBtn.classList.remove('hidden'); againBtn.classList.remove('hidden');
      onRecorded && onRecorded(r, status);
      if (!r.spoke) { status.textContent = 'I didn’t hear anything. Tap Try again, and say it out loud.'; sayLines(['I didn’t hear anything. Tap Try again, and say it out loud.'], true); }
    } catch (e) {
      setIdle();
      if (e && e.denied) { status.textContent = MIC_OFF_MSG; status.classList.add('warn'); recBtn.classList.add('hidden'); onUnavailable && onUnavailable(); }
      else { status.textContent = 'Recording did not work this time. You can try again.'; }
    }
  };
  recBtn.addEventListener('click', tap(() => { if (!state.micIntroSeen && !Recorder.recording) return micIntro(() => { state.micIntroSeen = true; saveState(); start(); }); start(); }));
  againBtn.addEventListener('click', tap(() => { Speech.cancel(); Recorder.discard(); start(); }));
  hearBtn.addEventListener('click', tap(() => {
    if (!Recorder.url) return; hearBtn.disabled = true; status.textContent = 'First the model, then you!';
    const after = () => Recorder.play().then(() => { hearBtn.disabled = false; status.textContent = 'That was you! Nice job practicing.'; });
    if (Speech.available) model(after); else after();
  }));
  wrap.append(h('div', { class: 'row center' }, recBtn, hearBtn, againBtn), liveRow, status);
  return wrap;
}
function sayIt(title, chunks, id, isWord) {
  const body = openScreen('Say It With Me', { onBack: () => practice() });
  const els = chunks.map(c => h('span', { class: 'chunk' + (isWord ? ' syl' : '') }, c));
  const hl = i => els.forEach((e, k) => e.classList.toggle('on', k === i));
  const play = () => {
    const seq = isWord && chunks.length > 1 ? [...chunks, chunks.join('')] : chunks;
    Speech.speakChunks(seq, { rate: 0.65, onChunk: i => i < chunks.length ? hl(i) : els.forEach(e => e.classList.add('on')), onEnd: () => setTimeout(() => hl(-1), 400) });
  };
  let idx = -1;
  const award = () => {
    const first = !state.practice[id]; state.practice[id] = true; if (first) state.stars++; saveState(); Sound.star(); starBurst(body);
    msg.textContent = (first ? PHRASES.saidIt[0] : PHRASES.saidIt[1]) + (first ? ' ★ +1' : ''); sayLines([first ? PHRASES.saidIt[0] : PHRASES.saidIt[1]], true);
  };
  const msg = h('div', { class: 'fb good' });
  const saidBtn = h('button', { class: 'btn big saidbtn hidden', onclick: tap(award) }, 'I said it!');
  // model for "Hear myself": the whole word (or the verse parts), highlighted, then the recording
  const model = onEnd => { if (isWord) { els.forEach(e => e.classList.add('on')); Speech.speak(chunks.join(''), { onEnd: () => { hl(-1); onEnd(); } }); } else Speech.speakChunks(chunks, { onChunk: i => hl(i), onEnd: () => { hl(-1); onEnd(); } }); };
  const rec = recordWidget({ model, onRecorded: r => { if (r.spoke) award(); }, onUnavailable: () => saidBtn.classList.remove('hidden') });
  body.append(h('div', { class: 'card say' }, h('h3', {}, title), h('div', { class: 'chunks' + (isWord ? ' word' : '') }, els),
    h('div', { class: 'muted center' }, 'Listen, then say it with me. Whispering counts too!'),
    h('div', { class: 'row center' }, h('button', { class: 'speak big', html: SPK + '<span>Hear it slowly</span>', onclick: tap(play) }),
      h('button', { class: 'btn big', onclick: tap(() => { idx = (idx + 1) % els.length; hl(idx); if (Speech.available) Speech.speakChunks([chunks[idx]], {}); }) }, 'One part at a time')),
    rec, h('div', { class: 'row center' }, saidBtn), msg,
    h('div', { class: 'muted small center' }, 'Recordings stay in memory only. They are never saved or sent anywhere.')));
}

// ---------------- Word Book / Virtues / Report ----------------
export function wordBook() {
  const body = openScreen('Word Book', { onBack: backToMenu });
  const ws = Object.keys(state.words || {});
  body.append(h('div', { class: 'muted center' }, ws.length ? `You have collected ${ws.length} words. Tap a speaker to hear a word.` : 'Start a mission to collect new words!'));
  const grid = h('div', { class: 'wordgrid' });
  for (const w of ws) { const d = WORDS[w]; if (!d) continue; grid.append(h('div', { class: 'wordcard' }, h('div', { class: 'wc-head' }, h('b', {}, w), speakBtn(() => `${w}. ${d.def} For example: ${d.ex}`)), readable(d.def, { speaker: false }).el, h('div', { class: 'wc-ex' }, readable(d.ex, { speaker: false }).el))); }
  body.append(grid);
}
export function journal() {
  const body = openScreen('Virtues Journal', { onBack: backToMenu });
  const grid = h('div', { class: 'virtues' });
  for (const v of VIRTUES) {
    const got = state.badges[v.id]; const vs = VERSES[v.verse];
    grid.append(h('div', { class: 'virtue' + (got ? ' got' : '') }, badgeSVG(v, !got), h('div', {}, h('h3', {}, v.name), got ? h('div', {}, readable(vs.text, { cls: 'small' }).row, h('div', { class: 'ref' }, vs.ref)) : h('div', { class: 'muted' }, 'Locked. ' + v.hint))));
  }
  body.append(grid, h('div', { class: 'muted small center' }, TRANSLATION));
}
export function badgeSVG(v, locked) { return h('div', { class: 'badge', html: `<svg viewBox="0 0 64 64" width="64" height="64"><path d="M32 3l24 9v18c0 15-10 26-24 31C18 56 8 45 8 30V12z" fill="${locked ? '#bbb' : v.color}" stroke="#fff" stroke-width="3"/><text x="32" y="41" text-anchor="middle" font-size="26" font-weight="bold" fill="#fff" font-family="sans-serif">${locked ? '?' : v.letter}</text></svg>` }); }

function reportData() {
  const name = playerName();
  const skills = SKILL_ORDER.map(k => ({ k, name: SKILLS[k], r: (state.skills || {})[k] }));
  const missions = QUEST_ORDER.map(id => { const q = QUESTS[id]; const qs = state.quests[id] || {}; const r = (state.quiz || {})[id]; const lvw = { 1: 3, 2: 4, 3: 5 }; return { id, title: q.title, done: !!qs.done, r, words: q.words.filter(w => state.words[w]).length }; });
  return { name, skills, missions };
}
export function reportCard() {
  const body = openScreen('Report Card', { onBack: backToMenu, right: h('button', { class: 'btn', onclick: tap(exportReport) }, 'Export report') });
  const { name, skills, missions } = reportData();
  const lvl = readingLevel(), xp = state.xp || 0;
  body.append(h('div', { class: 'card rc-top' }, h('h3', {}, `${name}’s Report Card`),
    h('div', { class: 'rc-stats' }, stat('Reading Level', lvl), stat('XP', xp), stat('Stars', state.stars), stat('Words learned', Object.keys(state.words).length), stat('Badges', Object.keys(state.badges).length), stat('Difficulty', LEVEL_NAMES[effLevel()])),
    h('div', { class: 'xpbar' }, h('div', { style: `width:${xp % 100}%` })), h('div', { class: 'muted small' }, `${100 - (xp % 100)} XP to Reading Level ${lvl + 1}`)));
  body.append(h('h3', {}, 'Skills (goal: 80% = mastered)'), h('div', { class: 'tablewrap' }, h('table', { class: 'rc' },
    h('tr', {}, ['Skill', 'Best', 'Latest', 'Tries', 'Goal', 'First tried', 'Last tried'].map(t => h('th', {}, t))),
    skills.map(({ name, r }) => h('tr', {}, h('td', {}, name), h('td', {}, r ? `${r.best}% (${grade(r.best)})` : '–'), h('td', {}, r ? `${r.latest}%` : '–'), h('td', {}, r ? r.tries : 0),
      h('td', { class: r && r.best >= 80 ? 'met' : '' }, r ? (r.best >= 80 ? '✓ Mastered' : 'Working on it') : '–'), h('td', {}, r ? r.first : '–'), h('td', {}, r ? r.last : '–'))))));
  body.append(h('h3', {}, 'Missions and Story Checks'), h('div', { class: 'tablewrap' }, h('table', { class: 'rc' },
    h('tr', {}, ['Mission', 'Status', 'Best score', 'Grade', 'Level', 'Date', 'Tries', 'Words', ''].map(t => h('th', {}, t))),
    missions.map(m => h('tr', {}, h('td', {}, m.title), h('td', {}, m.done ? '✓ Done' : (state.quests[m.id] ? 'In progress' : 'Not started')),
      h('td', {}, m.r ? m.r.best + '%' : '–'), h('td', {}, m.r ? m.r.grade : '–'), h('td', {}, m.r ? LEVEL_NAMES[m.r.bestLv] : '–'), h('td', {}, m.r ? m.r.bestDate : '–'), h('td', {}, m.r ? m.r.tries : 0), h('td', {}, m.words),
      h('td', {}, m.done ? h('button', { class: 'btn small', onclick: tap(() => storyCheck(m.id, reportCard)) }, 'Story Check') : ''))))));
  const rw = Object.entries(state.readWords || {});
  body.append(h('h3', {}, 'Read Aloud (bonus, not graded)'), h('div', { class: 'card' }, h('div', {}, `Read Aloud Stars: ★ ${state.readStars || 0}`),
    h('div', { class: 'muted' }, rw.length ? 'Words and sentences read aloud:' : 'No words read aloud yet.'), h('div', { class: 'wordchips' }, rw.map(([w, v]) => h('span', { class: 'chip' }, w + (v.by === 'helper' ? ' (helper)' : ''))))),
    h('div', { class: 'muted small' }, `Say It With Me practice: ${Object.keys(state.practice).length} items practiced (never graded or recorded).`));
}
function stat(l, v) { return h('div', { class: 'stat' }, h('div', { class: 'sv' }, String(v)), h('div', { class: 'sl' }, l)); }
function exportReport() {
  const { name, skills, missions } = reportData(); const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const rows = skills.map(({ name, r }) => `<tr><td>${esc(name)}</td><td>${r ? r.best + '% (' + grade(r.best) + ')' : '–'}</td><td>${r ? r.latest + '%' : '–'}</td><td>${r ? r.tries : 0}</td><td>${r ? (r.best >= 80 ? 'Mastered (80%+)' : 'Working toward 80%') : '–'}</td><td>${r ? esc(r.first) : '–'}</td><td>${r ? esc(r.last) : '–'}</td></tr>`).join('');
  const mrows = missions.map(m => `<tr><td>${esc(m.title)}</td><td>${m.done ? 'Done' : 'Not done'}</td><td>${m.r ? m.r.best + '%' : '–'}</td><td>${m.r ? m.r.grade : '–'}</td><td>${m.r ? LEVEL_NAMES[m.r.bestLv] : '–'}</td><td>${m.r ? esc(m.r.bestDate) : '–'}</td><td>${m.words}</td></tr>`).join('');
  const rw = Object.keys(state.readWords || {}).map(esc).join(', ') || 'None yet';
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Faith Craft Reading Report</title><style>body{font-family:Lexend,Arial,sans-serif;margin:24px;color:#222;line-height:1.5}table{border-collapse:collapse;width:100%;margin:8px 0 20px}td,th{border:1px solid #999;padding:6px 8px;text-align:left;font-size:14px}th{background:#eee}h1{font-size:22px}h2{font-size:18px;margin-top:20px}</style></head><body>
<h1>Faith Craft Reading Report: ${esc(name)}</h1><p>Report date: ${today()}<br>Current difficulty: ${LEVEL_NAMES[effLevel()]} (Easy = 1st grade, Medium = 2nd grade, Hard = 3rd grade reading)<br>Reading level: ${readingLevel()} · XP: ${state.xp || 0} · Words learned: ${Object.keys(state.words).length}</p>
<h2>Skills (mastery goal: 80%)</h2><table><tr><th>Skill</th><th>Best</th><th>Latest</th><th>Tries</th><th>Status</th><th>First tried</th><th>Last tried</th></tr>${rows}</table>
<h2>Story Checks (comprehension)</h2><table><tr><th>Mission</th><th>Status</th><th>Best</th><th>Grade</th><th>Level</th><th>Date</th><th>Words</th></tr>${mrows}</table>
<h2>Read Aloud bonus (not graded)</h2><p>Read Aloud Stars: ${state.readStars || 0}<br>Read aloud: ${rw}</p>
<p style="font-size:12px;color:#666">Scores come from in-game multiple-choice activities. Speech practice is never graded. Generated offline by Faith Craft.</p></body></html>`;
  const body = openScreen('Export Report', { onBack: reportCard });
  const frame = h('iframe', { class: 'printframe', title: 'Report preview' }); frame.srcdoc = html;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  body.append(h('div', { class: 'row' }, h('button', { class: 'btn primary big', onclick: tap(() => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { window.print(); } }) }, 'Print'),
    h('a', { class: 'btn big', href: url, download: `faith-craft-report-${new Date().toISOString().slice(0, 10)}.html` }, 'Save as file')), frame);
}

// ---------------- Settings (with optional parent PIN) ----------------
export function pinPad(title, onDone) {
  let v = ''; const disp = h('div', { class: 'pindisp' }, '○○○○');
  const pop = h('div', { class: 'modal' }, h('div', { class: 'card pin' }, h('h3', {}, title), disp,
    h('div', { class: 'pinpad' }, [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '✕'].map(n => h('button', { class: 'btn big', onclick: tap(() => {
      if (n === '✕') { pop.remove(); return; } if (n === 'C') v = ''; else if (v.length < 4) v += n;
      disp.textContent = '●'.repeat(v.length) + '○'.repeat(4 - v.length);
      if (v.length === 4) { setTimeout(() => { pop.remove(); onDone(v); }, 150); }
    }) }, String(n))))));
  document.body.append(pop);
}
export function settingsGate(then) {
  if (!state.settings.pin) return then();
  pinPad('Parent PIN', v => { if (v === state.settings.pin) then(); else toast('That PIN did not match.'); });
}
export function settings() {
  const s = state.settings; const body = openScreen('Settings', { onBack: backToMenu });
  const tog = (label, key, after) => h('label', { class: 'set' }, h('span', {}, label), (() => { const i = h('input', { type: 'checkbox' }); i.checked = !!s[key]; i.addEventListener('change', () => { s[key] = i.checked; saveState(); applySettings(); after && after(); }); return i; })());
  const sel = (label, key, opts, num) => h('label', { class: 'set' }, h('span', {}, label), (() => { const e = h('select', {}, opts.map(([v, t]) => { const o = h('option', { value: v }, t); if (String(s[key]) === String(v)) o.selected = true; return o; })); e.addEventListener('change', () => { s[key] = num ? Number(e.value) : e.value; if (key === 'difficulty') { state.levelBoost = 0; state.streak = 0; } saveState(); applySettings(); if ((key === 'view' || key === 'zoom') && G.viewChanged) G.viewChanged(); }); return e; })());
  const range = (label, key, min, max, step) => h('label', { class: 'set' }, h('span', {}, label), (() => { const e = h('input', { type: 'range', min, max, step }); e.value = s[key]; e.addEventListener('input', () => { s[key] = Number(e.value); saveState(); applySettings(); }); return e; })());
  const nameIn = h('input', { type: 'text', maxlength: '20', value: playerName(), class: 'nameinput' }); nameIn.addEventListener('change', () => { s.name = nameIn.value.trim().replace(/\s+.*/, '').slice(0, 20) || 'Friend'; nameIn.value = s.name; saveState(); });
  body.append(
    h('h3', {}, 'Reading'),
    sel('Difficulty', 'difficulty', [[1, 'Easy (1st grade reading)'], [2, 'Medium (2nd grade reading)'], [3, 'Hard (3rd grade + big words)']], true),
    tog('Raise difficulty automatically when he masters a level', 'autoLevel'),
    tog('Read text aloud automatically', 'autoRead'),
    range('Reading voice speed', 'rate', 0.7, 1.2, 0.05),
    h('div', { class: 'set' }, h('span', {}, Speech.available ? 'Voice: ' + Speech.voiceName() : 'No read-aloud voice found on this device.'), h('button', { class: 'btn', onclick: tap(() => Speech.speak('This is how fast I will read to you.', {})) }, 'Test voice')),
    sel('Font', 'font', [['lexend', 'Lexend (easy to read)'], ['dyslexic', 'OpenDyslexic'], ['system', 'System font']]),
    sel('Text size', 'textSize', [[0, 'Normal'], [1, 'Large'], [2, 'Extra large'], [3, 'Huge']], true),
    tog('Extra letter and line spacing', 'spacing'), tog('Cream background behind text', 'cream'),
    h('h3', {}, 'Play'),
    tog('Calm mode (less motion, softer sounds)', 'calm'), tog('Sound effects', 'sound'), tog('Background music', 'music'), range('Music volume', 'musicVol', 0, 1, 0.05),
    sel('Camera view', 'view', [['back', 'Behind me (see my character)'], ['front', 'Front view (camera looks at me)'], ['first', 'First person (through my eyes)']]),
    sel('Camera distance', 'zoom', [['close', 'Close'], ['normal', 'Normal'], ['far', 'Far']]),
    G.mode === 'play' ? h('div', { class: 'set' }, h('span', {}, 'Camera stuck or too close?'), h('button', { class: 'btn', onclick: tap(() => { closeScreen(true); G.setUIOpen(false); G.fixView(); }) }, '🎥 Fix my view')) : null,
    tog('Gentle head bob when walking', 'bob'), tog('Auto-jump up single blocks', 'autoJump'),
    range('Look sensitivity', 'sens', 0.4, 2, 0.1),
    h('h3', {}, 'Parent'),
    h('label', { class: 'set' }, h('span', {}, 'Player first name'), nameIn),
    tog('Helper check: show “He read it!” button in Read It Aloud', 'helperCheck'),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: tap(() => pinPad(s.pin ? 'New 4-digit PIN' : 'Choose a 4-digit PIN', v => pinPad('Type it again', v2 => { if (v === v2) { s.pin = v; saveState(); toast('Parent PIN saved.'); } else toast('The PINs did not match.'); }))) }, s.pin ? 'Change parent PIN' : 'Set parent PIN'),
      s.pin ? h('button', { class: 'btn', onclick: tap(() => { s.pin = null; saveState(); toast('Parent PIN removed.'); settings(); }) }, 'Remove PIN') : null),
    h('div', { class: 'row' }, h('button', { class: 'btn danger', onclick: tap(() => { if (confirm('Erase all progress, scores, and world changes? This cannot be undone.')) { resetAll(); location.reload(); } }) }, 'Reset all progress')),
    h('div', { class: 'muted small' }, TRANSLATION + ' Fonts: Lexend and OpenDyslexic (SIL Open Font License). 3D: three.js (MIT).'));
}
export function applySettings() {
  const s = state.settings, b = document.body;
  b.classList.remove('font-lexend', 'font-dyslexic', 'font-system', 'ts0', 'ts1', 'ts2', 'ts3');
  b.classList.add('font-' + s.font, 'ts' + s.textSize); b.classList.toggle('spacing', !!s.spacing); b.classList.toggle('cream', !!s.cream); b.classList.toggle('calm', !!s.calm);
  b.classList.toggle('no-voice', !Speech.available);
  Speech.rate = s.rate; Sound.enabled = s.sound; Sound.calm = s.calm; Music.set(s.music, s.musicVol, s.calm);
}

// ---------------- In-game dialog ----------------
export function faceEl(id) { return h('img', { class: 'face', src: iconURL('face:' + id), alt: '' }); }
export function dialog({ npc, name, lines, choice, onChoose, onDone, doneLabel, words, ref, force, noTalk }) {
  const box = $('#dialog'); let i = 0; G.setUIOpen(true);
  function render() {
    box.innerHTML = ''; box.classList.remove('hidden'); box.classList.remove('talkpanel');
    const line = lines[i]; const narr = /^\s*\(/.test(line); const r = readable(line, { highlight: words, voice: narr ? 'n' : (NPC_VOICE[npc] || 'n'), cls: narr ? 'narration' : '' });
    const actions = h('div', { class: 'dlg-actions' });
    const last = i === lines.length - 1;
    if (!last || !choice) actions.append(h('button', { class: 'btn primary big', onclick: tap(() => { Speech.cancel(); if (!last) { i++; render(); } else { close(); onDone && onDone(); } }) }, last ? (doneLabel || 'OK') : 'Next ›'));
    else {
      const pr = readable(choice.prompt, { cls: 'prompt' });
      actions.append(pr.row, h('div', { class: 'dlg-choices' }, choice.options.map((o, k) => h('div', { class: 'choice-row' }, h('button', { class: 'choice', onclick: tap(() => { Speech.cancel(); onChoose(k); }) }, o.text), speakBtn(() => o.text)))));
    }
    // big Talk button while a character is speaking, so the Talk menu is always easy to find
    const talkB = !noTalk && G.openTalk && NPCS.some(n => n.id === npc) ? h('button', { class: 'btn talkbtn dlg-talk', 'aria-label': 'Talk', html: '<span class="ico">💬</span><span>Talk</span>', onclick: tap(() => { Speech.cancel(); close(); G.openTalk(npc); }) }) : null;
    box.append(h('div', { class: 'dlg-face' }, faceEl(npc), talkB), h('div', { class: 'dlg-body' }, h('div', { class: 'dlg-name' }, name, h('span', { class: 'muted small' }, lines.length > 1 ? `  ${i + 1}/${lines.length}` : '')), r.row, ref && last ? h('div', { class: 'ref' }, ref) : null, actions));
    if (force) { if (Speech.available) r.play(); } else autoRead(r);
  }
  function close() { box.classList.add('hidden'); box.innerHTML = ''; G.setUIOpen(false); }
  render();
  return { close };
}
// ---------------- Talk menu ----------------
// Fixed, pre-recorded answers only. Works offline. The mic is optional and only maps speech to the same buttons.
const npcDef = id => NPCS.find(n => n.id === id);
export function talkContext(npcId) {
  const def = npcDef(npcId); let qid = def.quest || HELPER_QUEST[npcId] || null; const role = def.quest ? 'giver' : 'helper';
  if (def.role === 'guide') qid = state.active || QUEST_ORDER.find(q => !(state.quests[q] && state.quests[q].done)) || null;
  return { def, qid, role, voice: NPC_VOICE[npcId] || 'n' };
}
export function talkHint(ctx) {
  if (!ctx.qid) return TALK.allDone;
  const H = TALK.hints[ctx.qid][ctx.role], s = state.quests[ctx.qid];
  if (s && s.done) return H[H.length - 1];
  if (state.active === ctx.qid) return H[1 + Math.max(0, Math.min(s.step || 0, H.length - 3))];
  return H[0];
}
export function talkStory(ctx) { if (!ctx.qid) return TALK.allDoneStory; const S = TALK.stories[ctx.qid]; return (ctx.role === 'helper' && S.helper) || S.giver; }
export function talkVerse(ctx) { return VERSES[ctx.qid ? QUESTS[ctx.qid].reward : TALK.ruthVerse]; }
export function missionLines(qid) { const Q = QUESTS[qid]; const good = Q.choice ? Q.choice.options.find(o => o.good) : null; return [...Q.intro, ...(good ? good.reply : [])]; }
// Replay the mission-giver's intro, exactly as first given, in their voice
export function replayMission(qid, onDone) {
  const Q = QUESTS[qid]; if (!Q) return; const giver = npcDef(Q.npc);
  dialog({ npc: Q.npc, name: giver.name, lines: missionLines(qid), words: Q.words, doneLabel: 'Got it!', force: true, onDone });
}
function talkMainAction(ctx) {
  const id = ctx.def.id, act = state.active, Q = act ? QUESTS[act] : null, s = act ? state.quests[act] : null, st = Q && s ? Q.steps[s.step] : null;
  if (ctx.def.quest) {
    const qs = state.quests[ctx.def.quest];
    if (qs && qs.done) return 'hello';
    if (act === ctx.def.quest) return st && st.type === 'talk' && st.npc === id ? 'finish' : 'hello';
    return 'start';
  }
  if (st && st.type === 'share' && st.npcs.includes(id) && !(s.list || []).includes(id)) return act === 'joseph' ? 'grain' : 'bread';
  return 'hello';
}
const TALK_ICONS = { again: '🔁', next: '👣', story: '📖', verse: '📜', bye: '👋', start: '⭐', finish: '⭐', bread: '🍞', grain: '🌾', hello: '😊' };
const TALK_TEXT = { again: 'Tell me the mission again', next: 'What do I do next?', story: 'Tell me the story', verse: 'Say a Bible verse', bye: 'Goodbye', start: 'Start the mission', finish: 'Finish the mission', bread: 'Give bread', grain: 'Give grain', hello: 'Say hello' };
export function talkPanel(npcId, o = {}) {
  const ctx = talkContext(npcId), def = ctx.def, box = $('#dialog'); G.setUIOpen(true); Speech.cancel();
  box.innerHTML = ''; box.classList.remove('hidden'); box.classList.add('talkpanel');
  const back = () => talkPanel(npcId, { quiet: true });
  const answer = (lines, extra = {}) => dialog({ npc: npcId, name: def.name, lines, words: ctx.qid ? QUESTS[ctx.qid].words : [], doneLabel: 'OK', force: true, noTalk: true, onDone: back, ...extra });
  const close = () => { box.classList.add('hidden'); box.classList.remove('talkpanel'); box.innerHTML = ''; G.setUIOpen(false); };
  const run = k => {
    if (k === 'again') { if (ctx.qid) replayMission(ctx.qid, back); else answer([TALK.allDone]); }
    else if (k === 'next') answer([talkHint(ctx)]);
    else if (k === 'story') answer([talkStory(ctx)]);
    else if (k === 'verse') { const v = talkVerse(ctx); answer([TALK.verseLead, v.text], { ref: v.ref }); }
    else if (k === 'bye') answer([TALK.bye], { doneLabel: 'Bye!', onDone: () => G.setUIOpen(false) });
    else { close(); o.onMain ? o.onMain() : G.talkMain && G.talkMain(npcId); }
  };
  // read the button aloud first (so a new reader hears what he picked), then the character answers
  const choose = k => { Speech.cancel(); Sound.click(); if (Speech.available) Speech.speak(TALK.labels[k], { voice: 'n', onEnd: () => run(k) }); else run(k); };
  const say = h('div', { class: 'talk-say' }); let sayR = null;
  const sayLine = t => { say.innerHTML = ''; sayR = readable(t, { voice: ctx.voice, speaker: false, noTap: true }); say.append(sayR.el); if (Speech.available) sayR.play(); };
  const main = talkMainAction(ctx); const near = !G.isNear || G.isNear(npcId);
  const keys = [...(near ? [main] : []), 'again', 'next', 'story', 'verse', 'bye'];
  const btn = k => h('button', { class: 'talk-choice' + (k === main && k !== 'hello' ? ' main' : ''), 'data-k': k, onclick: tap(() => choose(k)) }, h('span', { class: 'ico', 'aria-hidden': 'true' }, TALK_ICONS[k]), h('span', { class: 'lbl' }, TALK_TEXT[k]));
  const grid = h('div', { class: 'talk-grid' }, keys.map(btn));
  let mic = null;
  const micOK = () => Recognizer.available && navigator.onLine !== false;
  if (micOK()) {
    mic = h('button', { class: 'btn mic big talk-mic', html: MIC + '<span>Tap and talk</span>' });
    const status = h('div', { class: 'muted small talk-status' });
    mic.addEventListener('click', tap(() => {
      if (!state.micIntroSeen) return micIntro(() => { state.micIntroSeen = true; saveState(); mic.click(); });
      Speech.cancel(); mic.classList.add('listening'); status.textContent = 'I’m listening…';
      Recognizer.listen(res => {
        mic.classList.remove('listening'); status.textContent = '';
        if (res.error && !Recognizer.available) { mic.remove(); status.remove(); sayLine(TALK.noCatch); return; }
        const k = res.error ? null : matchIntent(res.alts);
        if (k) choose(k); else sayLine(TALK.noCatch);   // kind, never "wrong", never counted
      });
    }));
    box.append(h('div', { class: 'dlg-face' }, faceEl(npcId)), h('div', { class: 'dlg-body' }, h('div', { class: 'dlg-name' }, 'Talk to ' + def.name), say, grid, h('div', { class: 'row center talk-microw' }, mic, status)));
  } else box.append(h('div', { class: 'dlg-face' }, faceEl(npcId)), h('div', { class: 'dlg-body' }, h('div', { class: 'dlg-name' }, 'Talk to ' + def.name), say, grid));
  if (!o.quiet) sayLine(TALK.open); else { say.append(readable(TALK.open, { voice: ctx.voice, speaker: false, noTap: true }).el); }
  return { close };
}
export function closeDialog() { const box = $('#dialog'); box.classList.add('hidden'); box.classList.remove('talkpanel'); box.innerHTML = ''; }

export function newWords(qid, onDone) {
  const lv = effLevel(); const n = lv === 1 ? 3 : lv === 2 ? 4 : 5; const ws = QUESTS[qid].words.slice(0, n);
  ws.forEach(w => { if (!state.words[w]) state.words[w] = today(); }); saveState();
  const pop = h('div', { class: 'modal' }, h('div', { class: 'card newwords' }, h('h3', {}, 'New words for this mission'),
    h('div', { class: 'muted' }, 'Tap a speaker to hear the word and what it means. They are saved in your Word Book.'),
    ws.map(w => h('div', { class: 'nw' }, speakBtn(() => `${w}. ${WORDS[w].def}`), h('div', {}, h('b', {}, w), h('div', { class: 'small' }, WORDS[w].def)))),
    h('button', { class: 'btn primary big', onclick: tap(() => { Speech.cancel(); pop.remove(); onDone && onDone(); }) }, 'Got it!')));
  document.body.append(pop); G.setUIOpen(true);
}
export function reward(qid, onClose) {
  const Q = QUESTS[qid], v = VIRTUES.find(x => x.id === Q.virtue), rv = VERSES[Q.reward], bv = VERSES[v.verse];
  const pop = h('div', { class: 'modal' }, h('div', { class: 'card reward' }, h('div', { class: 'bigstar' }, '★'), h('h3', {}, 'Mission complete!'),
    h('div', { class: 'row center' }, badgeSVG(v), h('div', {}, h('b', {}, v.name + ' badge'), h('div', { class: 'small muted' }, '+3 stars'))),
    h('div', { class: 'verse' }, readable(rv.text).row, h('div', { class: 'ref' }, rv.ref)),
    h('div', { class: 'verse small' }, readable(bv.text, { cls: 'small' }).row, h('div', { class: 'ref' }, bv.ref)),
    h('div', { class: 'row' }, h('button', { class: 'btn primary big', onclick: tap(() => { pop.remove(); storyCheck(qid, onClose); }) }, 'Story Check ›'),
      h('button', { class: 'btn big', onclick: tap(() => { pop.remove(); G.setUIOpen(false); onClose && onClose(); }) }, 'Later'))));
  document.body.append(pop); G.setUIOpen(true); Sound.fanfare(); confetti(); sayLines([PHRASES.missionDone]);
}
export function confetti() {
  if (state.settings.calm) return;
  const box = h('div', { class: 'confetti' }); const cols = ['#f5b700', '#e25a8a', '#4a90d9', '#3aa76d', '#8e5cc7', '#e0752d'];
  for (let i = 0; i < 60; i++) { const p = h('i'); p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${(Math.random() * .6).toFixed(2)}s;animation-duration:${(2.2 + Math.random() * 1.6).toFixed(2)}s;--dx:${Math.round((Math.random() - .5) * 160)}px;--r:${Math.round(Math.random() * 720)}deg`; box.append(p); }
  document.body.append(box); setTimeout(() => box.remove(), 4500);
}
export function toast(msg, cls) {
  const t = h('div', { class: 'toast' + (cls ? ' ' + cls : '') }, msg); $('#toasts').append(t);
  setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3200);
}

// ---------------- Menus ----------------
export function backToMenu() { if (G.mode === 'title') title(); else pauseMenu(); }
export function title() {
  closeScreen(true); G.setUIOpen(true); const name = playerName();
  const t = h('div', { class: 'screen title', id: 'screen' },
    h('div', { class: 'logo' }, h('div', { class: 'logo-main' }, 'Faith Craft'), h('div', { class: 'logo-sub' }, 'Build, read, and live out God’s Word')),
    h('div', { class: 'welcome' }, `Welcome, ${name}!`),
    h('div', { class: 'menu' },
      h('button', { class: 'btn primary huge', onclick: tap(() => { closeScreen(true); G.startPlay(); }) }, state.started ? 'Continue' : 'Play'),
      h('div', { class: 'menu-grid' },
        h('button', { class: 'btn big', onclick: tap(gamesHub) }, 'Word Games'), h('button', { class: 'btn big', onclick: tap(readAloud) }, 'Read It Aloud'),
        h('button', { class: 'btn big', onclick: tap(() => practice()) }, 'Say It With Me'), h('button', { class: 'btn big', onclick: tap(wordBook) }, 'Word Book'),
        h('button', { class: 'btn big', onclick: tap(journal) }, 'Virtues'), h('button', { class: 'btn big', onclick: tap(reportCard) }, 'Report Card'),
        h('button', { class: 'btn big', onclick: tap(howTo) }, 'How to Play'), h('button', { class: 'btn big', onclick: tap(() => settingsGate(settings)) }, 'Settings'))),
    h('div', { class: 'muted small foot' }, 'Works offline. ' + TRANSLATION));
  $('#overlay').append(t); $('#overlay').classList.remove('hidden');
}
export function pauseMenu() {
  const body = openScreen('Menu', { onBack: () => closeScreen(), backLabel: '‹ Back to game' });
  const b = (t, f, cls = 'big') => h('button', { class: 'btn ' + cls, onclick: tap(f) }, t);
  body.append(h('div', { class: 'menu-grid wide' }, b('Resume', () => closeScreen(), 'primary big'), b('🎥 Fix my view', () => { closeScreen(); G.fixView(); }, 'big fixview'), b('Word Games', gamesHub), b('Read It Aloud', readAloud), b('Say It With Me', () => practice()),
    b('Word Book', wordBook), b('Virtues', journal), b('Report Card', reportCard), b('How to Play', howTo), b('Settings', () => settingsGate(settings)), b('Title screen', () => { G.toTitle(); })));
}
export function howTo() {
  const body = openScreen('How to Play', { onBack: backToMenu });
  const touch = G.isTouch();
  const sec = (t, lines) => h('div', { class: 'card' }, h('h3', {}, t), lines.map(l => readable(l, { cls: 'small' }).row));
  body.append(
    sec('Your goal', ['Help people from Bible stories. Look for a gold ! above a person and talk to them.', 'The arrow at the top always points to your next step. The list shows every step.']),
    touch ? sec('iPad controls', ['Left thumb: drag to walk.', 'Right side: drag to look around. Pinch with two fingers to move the camera closer or farther.', 'Change view: see your character from behind, from the front, or look through your own eyes.', 'Fix my view: tap it any time the camera is stuck or too close.', 'Buttons: Jump, Break, and Place. Tap a block in the bar to choose it.', 'Tap a person, or tap the Talk button when you are close.'])
      : sec('Keyboard and mouse', ['W A S D or arrow keys: walk. Space: jump.', 'Click the game to look with the mouse. Left click: break. Right click: place.', 'Number keys: choose a block. E: talk. V: change view. Esc: menu.']),
    sec('Reading', ['Tap any word to hear it and see what it means.', 'Tap a speaker button to hear text read aloud.', 'After each mission there is a short Story Check. Word Games help with spelling and sounds.']));
}
export function initUI(api) { G = api; Speech.onChange(() => applySettings()); applySettings(); }

// Word games built around IEP targets: vowel teams, diphthongs, r-blends, syllables, sight words, b/d.
// w: [word, level, clue]
const L = (arr) => arr.map(([w, lv, clue]) => ({ w, lv, clue }));
export const WL = {
  ai: L([["rain", 1, "Water that falls from the clouds."], ["wait", 1, "To stay until something happens."], ["sail", 1, "A boat can do this on the water."], ["paint", 1, "You use it to add color."], ["grain", 2, "Joseph stored this in Egypt."], ["faith", 2, "Trusting God."], ["praise", 2, "Saying how great God is."], ["chain", 2, "Metal rings linked together."], ["afraid", 3, "Feeling scared."], ["remain", 3, "To stay in one place."], ["explain", 3, "To tell how something works."]]),
  ay: L([["day", 1, "The sun is up during the ___."], ["pray", 1, "To talk to God."], ["play", 1, "To have fun with a game."], ["stay", 1, "To not leave."], ["way", 1, "A path or road."], ["clay", 2, "Soft mud you can shape."], ["today", 2, "This day."], ["away", 2, "Not here; gone."], ["Sunday", 2, "A day of the week."], ["delay", 3, "To make something late."], ["display", 3, "To show something."]]),
  ee: L([["tree", 1, "It has a trunk and leaves."], ["sheep", 1, "David took care of these animals."], ["feet", 1, "You stand on them."], ["seed", 1, "A plant grows from it."], ["three", 1, "The number after two."], ["keep", 1, "To hold on to something."], ["green", 2, "The color of grass."], ["sweet", 2, "Honey tastes like this."], ["between", 3, "In the middle of two things."], ["agree", 3, "To think the same way."], ["asleep", 3, "Not awake."]]),
  ea: L([["sea", 1, "A big body of salty water."], ["eat", 1, "What you do with food."], ["leaf", 1, "A green part of a tree."], ["teach", 2, "To help someone learn."], ["peace", 2, "Calm; no fighting."], ["clean", 2, "Not dirty."], ["dream", 2, "Pictures in your mind while you sleep."], ["speak", 2, "To talk."], ["heal", 2, "To make well again."], ["feast", 3, "A big, special meal."], ["reason", 3, "Why something happens."], ["please", 3, "A polite word when you ask."]]),
  oi: L([["coin", 1, "Round money."], ["oil", 1, "The Samaritan put this on the man’s cuts."], ["join", 2, "To come together."], ["point", 2, "To show with your finger."], ["voice", 2, "The sound you make when you talk."], ["noise", 2, "A loud sound."], ["choice", 3, "Something you pick."], ["rejoice", 3, "To be full of joy."]]),
  oy: L([["boy", 1, "A young man. One had five loaves."], ["toy", 1, "Something to play with."], ["joy", 1, "Great happiness."], ["enjoy", 2, "To like doing something."], ["royal", 3, "Having to do with a king."], ["loyal", 3, "Always faithful to a friend."]]),
  ou: L([["out", 1, "Not in."], ["loud", 1, "Not quiet."], ["house", 1, "A home."], ["cloud", 2, "White and fluffy in the sky."], ["mouth", 2, "You talk with it."], ["found", 2, "Not lost anymore."], ["ground", 3, "The land under your feet."], ["mountain", 3, "Moses climbed one."]]),
  ow: L([["cow", 1, "A farm animal that says moo."], ["how", 1, "A question word."], ["now", 1, "Right at this time."], ["down", 1, "Not up."], ["town", 2, "A small city."], ["crown", 2, "A king wears it."], ["crowd", 2, "A large group of people."], ["flower", 3, "It grows and blooms."], ["tower", 3, "A tall building."], ["powerful", 3, "Very strong."]]),
};
export const RBLENDS = L([
  ["brave", 1, "Not afraid."], ["bread", 1, "A boy shared this."], ["bring", 2, "To carry something here."], ["brother", 2, "Joseph had eleven of them."], ["brook", 2, "A small stream."],
  ["cross", 1, "To go to the other side."], ["crowd", 2, "A big group of people."], ["crown", 1, "A king wears it."], ["cry", 1, "Tears fall when you do this."],
  ["drink", 1, "What you do with water."], ["drum", 1, "You beat it to make music."], ["dream", 2, "Pictures while you sleep."], ["dry", 2, "Not wet."],
  ["friend", 1, "Someone who cares about you."], ["free", 1, "Not stuck or trapped."], ["fruit", 2, "Apples and grapes."], ["frog", 1, "A green animal that hops."],
  ["grace", 2, "God’s kindness we do not earn."], ["grass", 1, "Green plants on the ground."], ["grain", 2, "Seeds used for bread."], ["green", 1, "The color of leaves."],
  ["pray", 1, "To talk to God."], ["praise", 2, "Saying how great God is."], ["promise", 3, "Saying you will surely do it."], ["prize", 2, "Something you win."],
  ["tree", 1, "It has a trunk and leaves."], ["trust", 2, "To believe someone will keep their word."], ["true", 1, "Not false."], ["travel", 3, "To go on a trip."],
]);
export const BLENDS = ['br', 'cr', 'dr', 'fr', 'gr', 'pr', 'tr'];
export const SYLL = L([
  ["rain-bow", 1, "Colors in the sky after rain."], ["broth-er", 1, "A boy in your family."], ["for-give", 1, "To let go of a wrong."], ["a-fraid", 1, "Feeling scared."], ["faith-ful", 1, "Loyal; keeps promises."], ["tab-let", 1, "A flat stone with words."],
  ["moun-tain", 2, "Moses climbed one."], ["shep-herd", 2, "Someone who keeps sheep."], ["prom-ise", 2, "Saying you will surely do it."], ["peace-ful", 2, "Calm and quiet."], ["re-joice", 2, "To be full of joy."], ["en-joy", 2, "To like doing something."],
  ["to-geth-er", 3, "With each other."], ["cov-e-nant", 3, "A serious promise."], ["com-mand-ment", 3, "A rule God gave."], ["gen-er-ous", 3, "Happy to share."], ["dis-ci-ple", 3, "A follower of Jesus."], ["trav-el-er", 3, "A person on a trip."], ["Sa-mar-i-tan", 3, "The helper in Jesus’ story."],
]);
// Dolch 3rd grade sight words, used in sentences. [sentence with ___, answer, distractors, level]
export const SIGHT = [
  ["Please ___ your Bible to church.", "bring", ["being", "brown"], 1], ["Can you ___ the water jar?", "carry", ["cry", "cart"], 1],
  ["We ___ up our room.", "clean", ["clear", "can"], 1], ["I ___ water when I am thirsty.", "drink", ["drank", "think"], 1],
  ["God is ___ to us.", "kind", ["find", "king"], 1], ["The lamp gives ___.", "light", ["like", "night"], 1],
  ["Noah worked a ___ time on the ark.", "long", ["lot", "lamb"], 1], ["I can do it ___.", "myself", ["maybe", "many"], 2],
  ["God will ___ leave you.", "never", ["even", "over"], 2], ["Joseph had ___ one little brother.", "only", ["on", "other"], 2],
  ["We work ___ as a team.", "together", ["tomorrow", "toward"], 2], ["Let’s ___ the race now.", "start", ["star", "stair"], 2],
  ["You can ___ again.", "try", ["tree", "toy"], 1], ["David had to ___ his sheep safe.", "keep", ["kept", "keen"], 2],
  ["Seeds ___ into plants.", "grow", ["grew", "glow"], 2], ["The happy children ___ and play.", "laugh", ["laud", "lunch"], 3],
  ["My basket is ___ of bread.", "full", ["fall", "fill"], 3], ["It is ___ better to give.", "much", ["must", "such"], 3],
  ["The sheep are not ___ away.", "far", ["for", "fur"], 3], ["I can ___ the ark in my picture.", "draw", ["drew", "door"], 3],
];
export const BD = [
  { w: "dog", pic: "dog" }, { w: "bed", pic: "bed" }, { w: "bug", pic: "bug" }, { w: "duck", pic: "duck" },
  { w: "book", pic: "book" }, { w: "drum", pic: "drum" }, { w: "door", pic: "door" }, { w: "bird", pic: "dove" },
  { w: "bread", pic: "bread" }, { w: "desert", pic: "desert" },
];

export const GAMES = [
  { id: "sort_ai", title: "Sort It: ai or ay", skill: "vowel", type: "sort", teams: ["ai", "ay"],
    dir: "Read the word. Drag it, or tap a box, to put it where it belongs.", tip: "Tip: ai is usually at the start or middle of a word. ay is usually at the end." },
  { id: "sort_ee", title: "Sort It: ee or ea", skill: "vowel", type: "sort", teams: ["ee", "ea"], extra: 2,
    dir: "Read the word. Drag it, or tap a box, to put it where it belongs.", tip: "Tip: ee and ea can make the same sound. Look closely at each word." },
  { id: "fill_vt", title: "Missing Vowel Team", skill: "vowel", type: "fill", fam: [["ai", "ay"], ["ee", "ea"], ["ee", "ea"]],
    dir: "A vowel team is missing. Pick the letters that finish the word.", tip: "Read the clue for help." },
  { id: "diph", title: "Diphthong Detective", skill: "diph", type: "fill", fam: [["oi", "oy"], ["ou", "ow"]],
    dir: "Pick the letters that finish the word: oi, oy, ou, or ow.", tip: "oi and ou are often in the middle. oy and ow are often at the end." },
  { id: "rblend", title: "R-Blend Builder", skill: "rblend", type: "blend",
    dir: "The start of the word is missing. Pick the r-blend that begins the word.", tip: "Say the blend slowly: b-r, br." },
  { id: "spell", title: "Pick the Right Spelling", skill: "mixed", type: "spell",
    dir: "Read the clue. Pick the word that is spelled correctly.", tip: "Look at every letter." },
  { id: "syll", title: "Syllable Builder", skill: "syll", type: "syll",
    dir: "Tap the word parts in order to build the word.", tip: "Clap the parts: rain - bow." },
  { id: "sight", title: "Sight Word Sentences", skill: "sight", type: "sight",
    dir: "Read the sentence. Pick the word that fits in the blank.", tip: "Read the whole sentence with your word in it." },
  { id: "bd", title: "b or d?", skill: "bd", type: "bd",
    dir: "Look at the picture. Pick the first letter: b or d.", tip: "Make a “bed” with your fists: b is on the left, d is on the right." },
];

export function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
const byLv = (list, lv) => { const ok = list.filter(x => x.lv <= lv); return lv === 3 ? shuffle(ok).sort((a, b) => b.lv - a.lv > 0 ? 1 : -1) : shuffle(ok); };
const nChoices = lv => lv === 1 ? 2 : lv === 2 ? 3 : 4;
const COUNT = { 1: 6, 2: 8, 3: 10 };

function teamOf(word, teams) { const lw = word.toLowerCase(); for (const t of teams) if (lw.includes(t)) return t; return null; }
function blankTeam(word, team) { const i = word.toLowerCase().indexOf(team); return word.slice(0, i) + '__' + word.slice(i + 2); }
function spellVariants(word, skill) {
  const v = new Set(); const lw = word;
  const swaps = [['ai', 'ay'], ['ay', 'ai'], ['ee', 'ea'], ['ea', 'ee'], ['oi', 'oy'], ['oy', 'oi'], ['ou', 'ow'], ['ow', 'ou']];
  for (const [a, b] of swaps) if (lw.includes(a)) v.add(lw.replace(a, b));
  if (skill === 'vowel') { const m = lw.match(/(ai|ay)/); if (m) v.add(lw.replace(m[0], 'a') + (lw.endsWith('e') ? '' : 'e')); const m2 = lw.match(/(ee|ea)/); if (m2) v.add(lw.replace(m2[0], 'e')); }
  if (skill === 'rblend') { v.add(lw.replace(/^([bcdfgpt])r/, '$1')); v.add(lw.replace(/^([bcdfgpt])r/, '$1w')); v.add(lw.replace(/^([bcdfgpt])r/, '$1l')); }
  if (skill === 'diph') { v.add(lw.replace(/(oi|oy)/, 'o')); v.add(lw.replace(/(ou|ow)/, 'o')); }
  v.delete(lw); return [...v].filter(x => x && x !== lw);
}

// Build a list of items for a game at level lv. Each item: {skill, kind, prompt, clue, say, answer, choices, ...}
export function buildGame(id, lv) {
  const g = GAMES.find(x => x.id === id); const n = COUNT[lv] + (g.extra || 0) * (lv === 1 ? 0 : 1);
  const items = [];
  if (g.type === 'sort') {
    const [a, b] = g.teams; const la = byLv(WL[a], lv), lb = byLv(WL[b], lv);
    for (let i = 0; items.length < n && i < 12; i++) { if (la[i]) items.push({ skill: 'vowel', kind: 'sort', word: la[i].w, answer: a, choices: g.teams, say: la[i].w }); if (lb[i] && items.length < n) items.push({ skill: 'vowel', kind: 'sort', word: lb[i].w, answer: b, choices: g.teams, say: lb[i].w }); }
    return shuffle(items);
  }
  if (g.type === 'fill') {
    const pool = [];
    for (const fam of g.fam) for (const t of fam) for (const x of WL[t].filter(x => x.lv <= lv)) pool.push({ x, t, fam });
    for (const { x, t, fam } of shuffle(pool)) {
      if (items.length >= n) break; if (items.some(i => i.say === x.w)) continue;
      let choices = lv === 3 ? (g.skill === 'vowel' ? ['ai', 'ay', 'ee', 'ea'] : ['oi', 'oy', 'ou', 'ow']) : fam.slice();
      items.push({ skill: g.skill, kind: 'fill', word: blankTeam(x.w, t), clue: x.clue, answer: t, choices: shuffle(choices), say: x.w });
    }
    return items;
  }
  if (g.type === 'blend') {
    for (const x of byLv(RBLENDS, lv).slice(0, n)) {
      const bl = x.w.slice(0, 2); const others = shuffle(BLENDS.filter(b => b !== bl)).slice(0, nChoices(lv) - 1);
      items.push({ skill: 'rblend', kind: 'fill', word: '__' + x.w.slice(2), clue: x.clue, answer: bl, choices: shuffle([bl, ...others]), say: x.w });
    }
    return items;
  }
  if (g.type === 'spell') {
    const pool = [];
    for (const t of ['ai', 'ay', 'ee', 'ea', 'ee', 'ea']) for (const x of WL[t]) if (x.lv <= lv) pool.push({ x, skill: 'vowel' });
    for (const t of ['oi', 'oy', 'ou', 'ow']) for (const x of WL[t]) if (x.lv <= lv) pool.push({ x, skill: 'diph' });
    for (const x of RBLENDS) if (x.lv <= lv) pool.push({ x, skill: 'rblend' });
    for (const { x, skill } of shuffle(pool)) {
      if (items.length >= n) break; if (items.some(i => i.say === x.w)) continue;
      const wrong = shuffle(spellVariants(x.w, skill)).slice(0, nChoices(lv) - 1); if (wrong.length < nChoices(lv) - 1) continue;
      items.push({ skill, kind: 'spell', clue: x.clue, answer: x.w, choices: shuffle([x.w, ...wrong]), say: x.w });
    }
    return items;
  }
  if (g.type === 'syll') {
    for (const x of byLv(SYLL, lv).slice(0, Math.min(n, lv === 1 ? 5 : lv === 2 ? 6 : 7))) { const parts = x.w.split('-'); items.push({ skill: 'syll', kind: 'syll', parts, clue: x.clue, answer: parts.join(''), say: parts.join('') }); }
    return items;
  }
  if (g.type === 'sight') {
    const pool = shuffle(SIGHT.filter(s => s[3] <= lv)); if (lv === 3) pool.sort((a, b) => b[3] - a[3]);
    for (const [s, a, w] of pool.slice(0, n)) items.push({ skill: 'sight', kind: 'sight', sentence: s, answer: a, choices: shuffle([a, ...w.slice(0, nChoices(lv) - 1)]), say: s.replace('___', a) });
    return items;
  }
  if (g.type === 'bd') {
    for (const x of shuffle(BD).slice(0, lv === 1 ? 6 : 8)) {
      if (lv === 3) { const flip = x.w.replace(/^b/, '#').replace(/^d/, 'b').replace('#', 'd'); items.push({ skill: 'bd', kind: 'bdword', pic: x.pic, answer: x.w, choices: shuffle([x.w, flip]), say: x.w }); }
      else items.push({ skill: 'bd', kind: 'bd', pic: x.pic, word: '_' + x.w.slice(1), answer: x.w[0], choices: ['b', 'd'], say: x.w });
    }
    return items;
  }
  return items;
}

// Words for "Read it aloud" practice, by level
export function readAloudList(lv) {
  const words = [...RBLENDS, ...WL.ai, ...WL.ay, ...WL.ee, ...WL.ea, ...WL.oi, ...WL.oy, ...WL.ou, ...WL.ow].filter(x => x.lv <= lv).map(x => x.w);
  const sentences = { 1: ["God is kind.", "I can pray.", "The tree is green.", "Be brave."], 2: ["God keeps His promise.", "Share your bread.", "Trust God every day.", "A true friend is kind."], 3: ["The Lord is my shepherd.", "Be strong and brave.", "Go and do likewise.", "God loves a cheerful giver."] }[lv];
  return { words: shuffle([...new Set(words)]).slice(0, 8), sentences: sentences };
}
// split word into syllable-ish parts for slow model
export function syllables(word) {
  const s = SYLL.find(x => x.w.replace(/-/g, '').toLowerCase() === word.toLowerCase()); if (s) return s.w.split('-');
  return [word];
}

// Say It With Me words (r-blends and strong final sounds), split into parts
export const SAY_WORDS = ['brave', 'cross', 'drink', 'friend', 'grace', 'pray', 'tree', 'bread', 'trust', 'crown', 'broth-er', 'prom-ise', 'for-give', 'thank-ful'];

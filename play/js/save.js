const KEY = 'faithcraft.state.v1', WKEY = 'faithcraft.world.v1';
export const DEFAULT_SETTINGS = { name: 'Friend', music: true, musicVol: 0.4, bob: true, helperCheck: false, calm: false, sound: true, rate: 0.9, autoRead: true, sens: 1, font: 'lexend', textSize: 1, spacing: true, cream: true, difficulty: 2, autoLevel: true, pin: null, autoJump: true };
function fresh() { return { v: 1, settings: { ...DEFAULT_SETTINGS }, stars: 0, xp: 0, quests: {}, active: null, badges: {}, words: {}, quiz: {}, practice: {}, player: null, hotbar: 0, started: false }; }
export let state = fresh();
export function loadState() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.v === 1) { state = Object.assign(fresh(), s); state.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) }; } } catch (e) { }
  return state;
}
let t = null;
export function saveState(now) { clearTimeout(t); const f = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { } }; if (now) f(); else t = setTimeout(f, 800); }
export function loadWorldEdits() { try { return JSON.parse(localStorage.getItem(WKEY) || '{}'); } catch (e) { return {}; } }
let wt = null;
export function saveWorld(edits, now) { clearTimeout(wt); const f = () => { try { localStorage.setItem(WKEY, JSON.stringify(edits)); } catch (e) { } }; if (now) f(); else wt = setTimeout(f, 1500); }
export function resetAll() { const pin = state.settings.pin; localStorage.removeItem(KEY); localStorage.removeItem(WKEY); state = fresh(); state.settings.pin = pin; saveState(true); }

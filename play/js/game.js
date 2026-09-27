import * as THREE from '../lib/three.module.js';
import { makeAtlas, blockIcon } from './textures.js';
import { World, W, D, H, CS, B, BLOCKS, PLACES, meshChunk, brookX } from './world.js';
import * as E from './entities.js';
import { NPCS, QUESTS, QUEST_ORDER, NPC_LINES, BLOCK_HOTBAR, HELLOS, PHRASES, TALK } from './data.js';
import { Music } from './music.js';
import { state, loadState, saveState, loadWorldEdits, saveWorld } from './save.js';
import * as UI from './ui.js';
import { Sound } from './audio.js';
import { Speech } from './speech.js';

const $ = s => document.querySelector(s);
loadState(); Speech.init(); Speech.onPlaying(on => Music.duck(on));
const pick = a => a[Math.random() * a.length | 0];

// ---------- Renderer ----------
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
const scene = new THREE.Scene();
const SKY = 0xa8d8ff; scene.background = new THREE.Color(SKY); scene.fog = new THREE.Fog(SKY, 32, 72);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 220); camera.rotation.order = 'YXZ';
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a70, 2.0));
const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(0.5, 1, 0.3); scene.add(sun);
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
  // landscape iPad: 72deg tall (about 95deg wide). Portrait: keep at least ~80deg across so it never feels 'up close'.
  camera.fov = camera.aspect >= 1 ? 72 : Math.min(100, 2 * Math.atan(Math.tan(40 * Math.PI / 180) / camera.aspect) * 180 / Math.PI); camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

// clouds
const clouds = new THREE.Group(); { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.88 }); const m2 = new THREE.MeshBasicMaterial({ color: 0xf2f6ff, fog: false, transparent: true, opacity: 0.88 });
  for (let i = 0; i < 16; i++) { const c = new THREE.Group(); const n = 2 + (Math.random() * 3 | 0); for (let k = 0; k < n; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(5 + Math.random() * 8, 1.2 + Math.random() * 1.2, 4 + Math.random() * 5), k ? m2 : m); b.position.set((Math.random() - 0.5) * 9, Math.random() * 0.8, (Math.random() - 0.5) * 5); c.add(b); }
    c.position.set(Math.random() * 180 - 40, 50 + Math.random() * 8, Math.random() * 160 - 30); c.userData.sp = 0.5 + Math.random() * 0.6; clouds.add(c); } scene.add(clouds); }

// ---------- World ----------
const atlas = makeAtlas();
const matO = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5 });
const matW = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, transparent: true, opacity: 0.72, depthWrite: false });
const waterU = { uTime: { value: 0 }, uAmp: { value: 1 } };
matW.onBeforeCompile = sh => { // gentle shimmer on water (cheap, in the shader)
  Object.assign(sh.uniforms, waterU);
  sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  sh.fragmentShader = 'uniform float uTime; uniform float uAmp; varying vec3 vWP;\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\nfloat sh1 = sin(vWP.x * 1.7 + uTime * 1.9) * sin(vWP.z * 1.3 - uTime * 1.4); float sh2 = sin((vWP.x + vWP.z) * 0.9 + uTime * 1.1);\ndiffuseColor.rgb *= 1.0 + uAmp * (0.07 * sh1 + 0.05 * sh2);\ndiffuseColor.rgb += uAmp * vec3(0.10, 0.12, 0.14) * pow(max(0.0, sh1 * sh2), 3.0);');
};
const world = new World(); world.generate();
const edits = loadWorldEdits(); for (const [i, b] of Object.entries(edits)) { world.data[+i] = b; world.edits[i] = b; }
const chunks = {}; const dirty = new Set();
function buildChunk(cx, cz) {
  const k = cx + ',' + cz; const old = chunks[k]; if (old) { for (const m of old) { scene.remove(m); m.geometry.dispose(); } }
  const out = meshChunk(world, cx, cz); const res = [];
  for (const [key, mat] of [['o', matO], ['w', matW]]) {
    const d = out[key]; if (!d.i.length) continue;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(d.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(d.u, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(d.c, 3)); g.setIndex(d.i); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); if (key === 'w') m.renderOrder = 2; scene.add(m); res.push(m);
  }
  chunks[k] = res;
}
for (let cz = 0; cz < D / CS; cz++) for (let cx = 0; cx < W / CS; cx++) buildChunk(cx, cz);
world.onChange = (x, y, z) => {
  const cx = Math.floor(x / CS), cz = Math.floor(z / CS); dirty.add(cx + ',' + cz);
  if (x % CS === 0 && cx > 0) dirty.add((cx - 1) + ',' + cz); if (x % CS === CS - 1 && cx < W / CS - 1) dirty.add((cx + 1) + ',' + cz);
  if (z % CS === 0 && cz > 0) dirty.add(cx + ',' + (cz - 1)); if (z % CS === CS - 1 && cz < D / CS - 1) dirty.add(cx + ',' + (cz + 1));
  saveWorld(world.edits); questWorldChanged();
};

// ---------- Camera views: first person, behind me (default), front view ----------
const VIEWS = ['back', 'front', 'first'];
const VIEW_NAMES = { first: 'First person', back: 'Behind me', front: 'Front view' };
const ZOOM = { close: 2.8, normal: 4.2, far: 6 };
const PITCH_DOWN = -1.05; // never more than about 60 degrees down (looking straight at the ground felt "so up close")
const viewMode = () => VIEWS.includes(state.settings.view) ? state.settings.view : 'back';
function clampPitch(p) { const up = viewMode() === 'first' ? 1.2 : 0.6; return Math.max(PITCH_DOWN, Math.min(up, Number.isFinite(p) ? p : -0.3)); }

// ---------- Player ----------
const P = { pos: new THREE.Vector3(PLACES.spawn.x, world.top(PLACES.spawn.x, PLACES.spawn.z) + 1, PLACES.spawn.z), vel: new THREE.Vector3(), yaw: 0, pitch: -0.1, onGround: false };
if (state.player && [state.player.x, state.player.y, state.player.z].every(Number.isFinite)) { P.pos.set(Math.max(0.5, Math.min(W - 0.5, state.player.x)), Math.max(1, state.player.y), Math.max(0.5, Math.min(D - 0.5, state.player.z))); P.yaw = Number.isFinite(state.player.yaw) ? state.player.yaw : 0; P.pitch = state.player.pitch; }
P.pitch = clampPitch(P.pitch);
const PW = 0.3, PH = 1.7, EYE = 1.55;
function collides(px, py, pz) {
  for (let x = Math.floor(px - PW); x <= Math.floor(px + PW); x++) for (let z = Math.floor(pz - PW); z <= Math.floor(pz + PW); z++) for (let y = Math.floor(py); y <= Math.floor(py + PH - 0.01); y++) if (world.solid(x, y, z)) return true;
  return false;
}
const input = { f: 0, s: 0, jump: false };
const keys = {};
function updatePlayer(dt) {
  pushOut(); // never stay inside a block (placed blocks, old saves, edits)
  const inWater = world.get(P.pos.x, P.pos.y + 0.4, P.pos.z) === B.WATER;
  let f = input.f, s = input.s;
  if (keys.KeyW || keys.ArrowUp) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1; if (keys.KeyA || keys.ArrowLeft) s -= 1; if (keys.KeyD || keys.ArrowRight) s += 1;
  const len = Math.hypot(f, s); if (len > 1) { f /= len; s /= len; }
  const speed = inWater ? 2.6 : 4.4;
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  // ease in and out of walking instead of starting/stopping instantly
  const tvx = (fx * f + rx * s) * speed, tvz = (fz * f + rz * s) * speed;
  const acc = (f || s) ? (P.onGround ? 11 : 5) : (P.onGround ? 14 : 3);
  const kk = 1 - Math.exp(-acc * dt); P.vel.x += (tvx - P.vel.x) * kk; P.vel.z += (tvz - P.vel.z) * kk;
  const jump = input.jump || keys.Space || input.jumpQ; input.jumpQ = false;
  if (inWater) { P.vel.y -= 9 * dt; if (P.vel.y < -2.5) P.vel.y = -2.5; if (jump) P.vel.y = 3.2; }
  else { P.vel.y -= 24 * dt; if (P.vel.y < -30) P.vel.y = -30; if (jump && P.onGround) { P.vel.y = 8.6; } }
  // horizontal
  let blocked = false;
  for (const ax of ['x', 'z']) {
    const d = P.vel[ax] * dt; if (!d) continue;
    P.pos[ax] += d;
    if (collides(P.pos.x, P.pos.y, P.pos.z)) {
      P.pos[ax] = d > 0 ? Math.floor(P.pos[ax] + PW) - PW - 0.001 : Math.floor(P.pos[ax] - PW) + 1 + PW + 0.001;
      if (collides(P.pos.x, P.pos.y, P.pos.z)) P.pos[ax] -= d;
      blocked = true;
    }
  }
  if (blocked && P.onGround && state.settings.autoJump && (Math.abs(f) + Math.abs(s)) > 0.3) {
    const ax = P.pos.x + (fx * f + rx * s) * 0.5, az = P.pos.z + (fz * f + rz * s) * 0.5;
    if (world.solid(ax, P.pos.y + 0.2, az) && !world.solid(ax, P.pos.y + 1.2, az) && !world.solid(ax, P.pos.y + 2.2, az)) P.vel.y = 8.6;
  }
  // vertical
  const wasGround = P.onGround, fallV = P.vel.y; P.onGround = false; const dy = P.vel.y * dt; P.pos.y += dy;
  if (collides(P.pos.x, P.pos.y, P.pos.z)) {
    if (dy < 0) { P.pos.y = Math.floor(P.pos.y) + 1; P.onGround = true; if (!wasGround && fallV < -6) { cam.land = Math.min(0.14, -fallV * 0.012); Sound.step(); } } else { P.pos.y = Math.floor(P.pos.y + PH) - PH - 0.001; }
    if (collides(P.pos.x, P.pos.y, P.pos.z)) P.pos.y -= dy;
    P.vel.y = 0;
  }
  P.pos.x = Math.max(0.4, Math.min(W - 0.4, P.pos.x)); P.pos.z = Math.max(0.4, Math.min(D - 0.4, P.pos.z));
  if (P.pos.y < -8) respawn();
  // camera: gentle head bob (off in Calm mode or in settings), soft landing dip, smooth step-ups
  const hs = Math.hypot(P.vel.x, P.vel.z), calm = state.settings.calm, bobOn = state.settings.bob && !calm;
  if (P.onGround && hs > 0.5) { const prev = cam.phase; cam.phase += hs * dt * 2.1; if (Math.floor(prev / Math.PI) !== Math.floor(cam.phase / Math.PI) && !calm) Sound.step(); }
  cam.amt += ((P.onGround && hs > 0.5 ? Math.min(1, hs / 4.4) : 0) - cam.amt) * Math.min(1, dt * 8);
  cam.land *= Math.exp(-dt * 9);
  cam.y = cam.y == null ? P.pos.y : (P.pos.y > cam.y ? cam.y + (P.pos.y - cam.y) * Math.min(1, dt * 14) : P.pos.y);
  cam.bobY = bobOn ? Math.abs(Math.sin(cam.phase)) * 0.055 * cam.amt : 0; cam.bobX = bobOn ? Math.sin(cam.phase) * 0.025 * cam.amt : 0;
  cam.roll = bobOn ? Math.sin(cam.phase) * 0.004 * cam.amt : 0;
}
const cam = { phase: 0, amt: 0, land: 0, y: null, bobX: 0, bobY: 0, roll: 0, dist: 0, pinch: 1, zoomKey: null, raise: 0 };

// The camera never goes inside a block: behind/front views pull in toward the player when terrain is in the way.
const playerModel = E.buildPlayer(); playerModel.visible = false; scene.add(playerModel);
const camTarget = new THREE.Vector3(), camDir = new THREE.Vector3();
function camFree(x, y, z) { const r = 0.24; for (const dx of [-r, r]) for (const dy of [-r, r]) for (const dz of [-r, r]) if (world.solid(x + dx, y + dy, z + dz)) return false; return true; }
function camFreeDist(pitch, mode, want) { // how far the camera can sit from his head at this angle without touching a block
  const cp = Math.cos(pitch), sp = Math.sin(pitch), fx = -Math.sin(P.yaw) * cp, fz = -Math.cos(P.yaw) * cp; // where he is looking
  if (mode === 'back') camDir.set(-fx, -sp, -fz); else camDir.set(fx, -sp, fz); // behind him / in front of him, raised when looking down
  let free = 0; if (!camFree(camTarget.x, camTarget.y, camTarget.z)) return 0;
  for (let d = 0.1; d <= want + 1e-6; d += 0.1) { if (!camFree(camTarget.x + camDir.x * d, camTarget.y + camDir.y * d, camTarget.z + camDir.z * d)) break; free = d; }
  return free;
}
function camZoom() { if (cam.zoomKey !== state.settings.zoom) { cam.zoomKey = state.settings.zoom; cam.pinch = 1; } return Math.max(2, Math.min(8, (ZOOM[state.settings.zoom] || ZOOM.normal) * cam.pinch)); }
function updateCamera(dt, playing) {
  const mode = viewMode(), footY = cam.y ?? P.pos.y;
  P.pitch = clampPitch(P.pitch);
  document.body.classList.toggle('tp', mode !== 'first'); updateViewBtn(); // the label always shows the real mode
  if (mode === 'first') {
    camera.position.set(P.pos.x + Math.cos(P.yaw) * cam.bobX, footY + EYE + cam.bobY - cam.land, P.pos.z - Math.sin(P.yaw) * cam.bobX);
    camera.rotation.set(P.pitch, P.yaw, cam.roll); cam.dist = 0; cam.raise = 0; playerModel.visible = false; return;
  }
  camTarget.set(P.pos.x, footY + 1.75, P.pos.z);
  const want = camZoom(), enough = Math.min(want, 2.4);
  // If terrain is in the way, first try raising the camera (looking down over the hill / out of a hole), then pull it in.
  let best = P.pitch, bestFree = camFreeDist(P.pitch, mode, want);
  if (bestFree < enough) for (let a = P.pitch - 0.15; a >= -1.35; a -= 0.15) { const f = camFreeDist(a, mode, want); if (f > bestFree + 0.3) { bestFree = f; best = a; if (f >= enough) break; } }
  if (bestFree < 1.5) best = P.pitch; // raising only helps if it really gets the camera clear; never a close, steep look at the ground
  cam.raise += ((best - P.pitch) - cam.raise) * Math.min(1, dt * (best - P.pitch < cam.raise ? 10 : 2.5));
  const camPitch = P.pitch + cam.raise, free = camFreeDist(camPitch, mode, want); // the distance is always checked for the exact angle used
  const goal = Math.max(0, free - 0.1);
  cam.dist = !(cam.dist >= 0) || goal < cam.dist ? goal : cam.dist + (goal - cam.dist) * Math.min(1, dt * 3); // snap in, ease back out
  camera.position.set(camTarget.x + camDir.x * cam.dist, camTarget.y + camDir.y * cam.dist, camTarget.z + camDir.z * cam.dist);
  camera.rotation.set(camPitch, mode === 'back' ? P.yaw : P.yaw + Math.PI, 0);
  // his character: faces where he walks, swings arms and legs, head tilts with the look
  playerModel.visible = playing && cam.dist > 0.9;
  playerModel.position.set(P.pos.x, footY, P.pos.z); playerModel.rotation.y = P.yaw + Math.PI;
  const U = playerModel.userData, sw = Math.sin(cam.phase) * 0.7 * cam.amt, calm = state.settings.calm;
  U.legL.rotation.x = sw; U.legR.rotation.x = -sw; U.armL.rotation.x = -sw * 0.8; U.armR.rotation.x = sw * 0.8 - (hand.swing > 0 ? Math.sin(hand.swing * Math.PI) * 1.2 : 0);
  U.armL.rotation.z = -0.04 - (calm ? 0 : Math.sin(performance.now() / 900) * 0.02); U.armR.rotation.z = 0.04;
  U.head.rotation.x = -P.pitch * 0.5; U.rig.position.y = Math.abs(Math.sin(cam.phase)) * 0.05 * cam.amt;
}

// ---------- Getting un-stuck ----------
function pushOut() {
  if (!collides(P.pos.x, P.pos.y, P.pos.z)) return false;
  for (let dy = 0; dy <= 3; dy++) { const y = Math.floor(P.pos.y) + dy; if (!collides(P.pos.x, y, P.pos.z)) { P.pos.y = y; P.vel.y = 0; cam.y = null; return true; } }
  moveToSafeSpot(); return true;
}
function inPit(x, y, z) { let walls = 0; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (world.solid(x + dx, y + 1.2, z + dz)) walls++; return walls >= 3; }
// Boxed in: walk outward (step up 1 like auto-jump, drop down up to 3, need 2 blocks of headroom). If he can't
// reach anywhere at least 4 blocks away, he is enclosed (e.g. walled himself in with blocks he placed).
function standY(x, z, yFrom) { for (let y = Math.floor(yFrom) + 1; y >= Math.floor(yFrom) - 3; y--) if (world.solid(x, y - 1, z) && !world.solid(x, y, z) && !world.solid(x, y + 1, z)) return y; return null; }
function enclosed(px, py, pz, reach = 4, limit = 8) {
  const sx = Math.floor(px), sz = Math.floor(pz), seen = new Set([sx + ',' + sz]), q = [[sx, sz, Math.floor(py + 0.01)]];
  while (q.length) {
    const [x, z, y] = q.shift();
    if (Math.max(Math.abs(x - sx), Math.abs(z - sz)) >= reach) return false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz, k = nx + ',' + nz; if (seen.has(k) || nx < 0 || nz < 0 || nx >= W || nz >= D) continue;
      if (Math.max(Math.abs(nx - sx), Math.abs(nz - sz)) > limit) continue;
      let ny = standY(nx, nz, y); if (ny === null) { const b = world.get(nx, y, nz); if (b === B.WATER && !world.solid(nx, y + 1, nz)) ny = y; }
      if (ny === null || (ny > y && world.solid(x, y + 2, z))) continue; // stepping up needs headroom to jump
      seen.add(k); q.push([nx, nz, ny]);
    }
  }
  return true;
}
function isStuck() { return collides(P.pos.x, P.pos.y, P.pos.z) || inPit(P.pos.x, P.pos.y, P.pos.z) || P.pos.y < 3 || enclosed(P.pos.x, P.pos.y, P.pos.z); }
function safeColumn(x, z) {
  if (x < 1 || z < 1 || x >= W - 1 || z >= D - 1) return null;
  const t = world.top(x, z); if (world.topAny(x, z) !== t) return null; // water on top
  if (world.solid(x, t + 1, z) || world.solid(x, t + 2, z) || world.solid(x, t + 3, z)) return null;
  const b = world.get(x, t, z); if (b === B.LEAVES || b === B.GLASS) return null;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (world.top(x + dx, z + dz) > t + 1) return null; // no walls to climb
  return t + 1;
}
function moveToSafeSpot() {
  const cx = Math.floor(P.pos.x), cz = Math.floor(P.pos.z);
  for (const grassOnly of [true, false]) for (let r = 0; r <= 16; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = cx + dx, z = cz + dz, y = safeColumn(x, z); if (y == null) continue;
    if (grassOnly && world.get(x, y - 1, z) !== B.GRASS) continue;
    if (enclosed(x + 0.5, y, z + 0.5)) continue; // must be really open ground, not another spot inside the box
    P.pos.set(x + 0.5, y, z + 0.5); P.vel.set(0, 0, 0); cam.y = null; return true;
  }
  respawn(); cam.y = null; return false;
}
function fixView() {
  const stuck = isStuck();
  if (stuck) { const ox = P.pos.x, oz = P.pos.z; moveToSafeSpot(); const dx = P.pos.x - ox, dz = P.pos.z - oz; if (Math.hypot(dx, dz) > 0.5) P.yaw = Math.atan2(-dx, -dz); } // face away from where he was stuck
  state.settings.view = 'back'; if (state.settings.zoom === 'close') state.settings.zoom = 'normal';
  cam.pinch = 1; cam.dist = -1; cam.raise = 0; cam.land = 0; P.pitch = -0.35; P.vel.set(0, 0, 0);
  saveState(); savePlayer(); updateViewBtn(); Sound.good && Sound.good();
  UI.toast(stuck ? '🎥 View fixed! You were stuck, so you are back on the grass.' : '🎥 View fixed!');
  return stuck;
}
function cycleView() {
  const i = VIEWS.indexOf(viewMode()); state.settings.view = VIEWS[(i + 1) % VIEWS.length];
  cam.dist = 0; P.pitch = clampPitch(state.settings.view === 'first' ? Math.max(P.pitch, -0.5) : P.pitch);
  saveState(); Sound.click(); UI.toast('👁️ ' + VIEW_NAMES[state.settings.view]); updateViewBtn();
}
function updateViewBtn() { const el = document.querySelector('#btn-view .lbl2'), t = VIEW_NAMES[viewMode()]; if (el && el.textContent !== t) el.textContent = t; }
function respawn() { P.pos.set(PLACES.spawn.x, world.top(PLACES.spawn.x, PLACES.spawn.z) + 1.01, PLACES.spawn.z); P.vel.set(0, 0, 0); }
pushOut(); // a save (or world edits) must never start him inside terrain

// ---------- Raycast ----------
function raycast(maxD = 6) {
  const o = new THREE.Vector3(P.pos.x, (cam.y ?? P.pos.y) + EYE, P.pos.z), dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(P.pitch, P.yaw, 0, 'YXZ'));
  let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
  const sx = Math.sign(dir.x), sy = Math.sign(dir.y), sz = Math.sign(dir.z);
  const tdx = Math.abs(1 / dir.x), tdy = Math.abs(1 / dir.y), tdz = Math.abs(1 / dir.z);
  let tmx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, tmy = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tmz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
  let n = [0, 0, 0], t = 0;
  while (t <= maxD) {
    const b = world.get(x, y, z);
    if (b !== B.AIR && b !== B.WATER) return { x, y, z, n, dist: t };
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; n = [-sx, 0, 0]; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; n = [0, -sy, 0]; }
    else { z += sz; t = tmz; tmz += tdz; n = [0, 0, -sz]; }
  }
  return null;
}
const sel = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.01, 1.01, 1.01)), new THREE.LineBasicMaterial({ color: 0x222222 })); scene.add(sel);

// particles
const parts = []; const pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1); const pMats = {};
const pMat = c => pMats[c] ||= new THREE.MeshLambertMaterial({ color: c });
function burst(x, y, z, color, n = 10, up = 3) {
  if (state.settings.calm) n = 4;
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(pGeo, pMat(i % 3 ? color : new THREE.Color(color).multiplyScalar(0.8).getHex())); m.position.set(x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.6, z + 0.2 + Math.random() * 0.6); m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3.2, Math.random() * up + 0.8, (Math.random() - 0.5) * 3.2); m.userData.t = 0.5 + Math.random() * 0.35; m.userData.s = 0.7 + Math.random() * 0.6; m.scale.setScalar(m.userData.s); scene.add(m); parts.push(m); }
  while (parts.length > 60) { const m = parts.shift(); scene.remove(m); }
}
// quick "pop" outline when a block is placed or broken
const popBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })); popBox.visible = false; scene.add(popBox); let popT = 0;
function popAt(x, y, z) { popBox.position.set(x + 0.5, y + 0.5, z + 0.5); popT = 0.28; popBox.visible = true; }
const KIND = b => (b === 4 || b === 8) ? 'wood' : (b === 1 || b === 2 || b === 5 || b === 6 || b === 12 || b === 13) ? 'soft' : 'solid';
const BCOL = { 1: 0x6aaa46, 2: 0x86603f, 3: 0x808080, 4: 0x70522f, 5: 0x3e8a30, 6: 0xded096, 8: 0xb8925c, 9: 0xf0c432, 10: 0xdff6ff, 11: 0xac4c3c, 12: 0xf0f0ec, 13: 0xfafaff, 14: 0x767676, 15: 0xe2ded4 };

function breakBlock() {
  const hit = raycast(); if (!hit || hit.y <= 0) return;
  const b = world.get(hit.x, hit.y, hit.z); world.set(hit.x, hit.y, hit.z, B.AIR); Sound.break(KIND(b)); burst(hit.x, hit.y, hit.z, BCOL[b] || 0x999999); popAt(hit.x, hit.y, hit.z); hand.swing = 1;
}
function placeBlock() {
  const hit = raycast(); if (!hit) return;
  const x = hit.x + hit.n[0], y = hit.y + hit.n[1], z = hit.z + hit.n[2];
  const cur = world.get(x, y, z); if (cur !== B.AIR && cur !== B.WATER) return;
  if (x < 0 || z < 0 || x >= W || z >= D || y >= H - 1) return;
  // don't place inside the player
  if (x + 1 > P.pos.x - PW && x < P.pos.x + PW && z + 1 > P.pos.z - PW && z < P.pos.z + PW && y + 1 > P.pos.y && y < P.pos.y + PH) return;
  const nb = BLOCK_HOTBAR[state.hotbar]; world.set(x, y, z, nb); Sound.place(KIND(nb)); popAt(x, y, z); burst(x, y, z, BCOL[nb] || 0xcccccc, 5, 1.5); hand.swing = 1;
  const st = curStep(); if (st && st.type === 'planks' && !WOOD.has(nb) && inArkArea(x, y, z) && performance.now() - (placeBlock.hintT || -1e9) > 8000) {
    placeBlock.hintT = performance.now(); UI.toast('🪵 Use wood blocks for the ark: Planks or Wood.'); UI.sayLines([PHRASES.woodHint]);
  }
}

// ---------- Held block (first-person hand) ----------
scene.add(camera);
const hand = { mesh: null, swing: 0, t: 0, id: -1 };
const handMat = new THREE.MeshLambertMaterial({ map: atlas });
function handGeo(bid) {
  const d = BLOCKS[bid], g = new THREE.BoxGeometry(1, 1, 1), uv = g.attributes.uv, N = 8;
  for (let f = 0; f < 6; f++) { const t = f === 2 ? d.top : f === 3 ? d.bottom : d.side, tu = t % N, tv = Math.floor(t / N); for (let k = 0; k < 4; k++) { const i = f * 4 + k, u = uv.getX(i), v = uv.getY(i); uv.setXY(i, (tu + u) / N, 1 - (tv + 1 - v) / N); } }
  return g;
}
function updateHand(dt) {
  const bid = BLOCK_HOTBAR[state.hotbar];
  if (hand.id !== bid) { if (hand.mesh) { camera.remove(hand.mesh); hand.mesh.geometry.dispose(); } hand.mesh = new THREE.Mesh(handGeo(bid), handMat); hand.mesh.scale.setScalar(touchMode ? 0.1 : 0.12); camera.add(hand.mesh); hand.id = bid; hand.swing = Math.max(hand.swing, 0.5); }
  hand.mesh.visible = G.mode === 'play' && !uiOpen && viewMode() === 'first';
  hand.swing = Math.max(0, hand.swing - dt * 4.5); const sw = Math.sin(hand.swing * Math.PI);
  const bx = Math.sin(cam.phase) * 0.018 * cam.amt, by = -Math.abs(Math.cos(cam.phase)) * 0.014 * cam.amt;
  const baseX = touchMode ? 0.26 : 0.38, baseY = touchMode ? -0.26 : -0.3;
  hand.mesh.position.set(baseX + bx - sw * 0.08, baseY + by - sw * 0.06 + (state.settings.calm ? 0 : Math.sin(performance.now() / 900) * 0.004), -0.62 - sw * 0.1);
  hand.mesh.rotation.set(0.25 - sw * 0.9, -0.7, 0.05);
}

// ---------- Entities ----------
const npcs = {}; const entityList = [];
for (const def of NPCS) {
  const grp = E.buildNPC(def); const label = E.makeLabel(def.name); label.position.y = def.lying ? 1.3 : 2.35; grp.add(label);
  const n = { def, grp, label, marker: null, markerKind: null, yaw: Math.random() * 6, kind: 'npc', t: Math.random() * 6, x: def.x, z: def.z, tx: null, tz: null, wait: 2 + Math.random() * 5, ph: 0, sw: 0, hy: 0, wave: 0, greeted: -1e9, bubble: null, bubbleT: 0 };
  grp.position.set(def.x, world.top(def.x, def.z) + 1, def.z); scene.add(grp); npcs[def.id] = n; entityList.push(n);
}
function setLying(n, lying) {
  const U = n.grp.userData; U.lying = lying;
  U.rig.rotation.x = lying ? -Math.PI / 2 : 0; U.rig.position.set(0, lying ? 0.25 : 0, lying ? 0.9 : 0);
  n.label.position.y = lying ? 1.3 : 2.35;
}
setLying(npcs.samaritan, !(state.quests.samaritan && state.quests.samaritan.done));

const ANIMALS = [
  ['sheep', 60, 48, 'w1'], ['sheep', 64, 50, 'w2'], ['sheep', 46, 40, 'w3'], ['sheep', 7, 90, 'pen1', 'pen'], ['sheep', 11, 91, 'pen2', 'pen'], ['sheep', 25, 92, 'lostsheep'],
  ['cow', 66, 52, 'c1'], ['cow', 44, 33, 'c2'], ['cow', 58, 57, 'c3'], ['cow', 70, 47, 'c4'],
  ['lion', 86, 42, 'l1'], ['lion', 89, 46, 'l2'], ['camel', 78, 26, 'm1'], ['camel', 88, 30, 'm2'], ['donkey', 46, 79, 'd1'],
  ['dove', 54, 40, 'v1'], ['dove', 48, 52, 'v2'], ['dove', 22, 72, 'v3'],
];
const animals = [];
const inZone = (x, z, zn) => { const r = zn === 'ark' ? PLACES.ark : { x0: PLACES.pen.x0 + 1, x1: PLACES.pen.x1, z0: PLACES.pen.z0 + 1, z1: PLACES.pen.z1 }; return x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1; };
const zoneRect = zn => zn === 'ark' ? PLACES.ark : { x0: PLACES.pen.x0 + 1, x1: PLACES.pen.x1, z0: PLACES.pen.z0 + 1, z1: PLACES.pen.z1 };
for (const [sp, x, z, id, zone] of ANIMALS) {
  const grp = E.buildAnimal(sp); scene.add(grp);
  const a = { sp, id, grp, x: x + 0.5, z: z + 0.5, y: 0, yaw: Math.random() * 6, home: { x: x + 0.5, z: z + 0.5 }, tx: null, tz: null, wait: Math.random() * 3, follow: false, zone: zone || null, kind: 'animal', t: Math.random() * 10 };
  const boardedIn = Object.values(state.quests).find(q => q.boarded && q.boarded[id]); if (boardedIn) a.zone = boardedIn.boarded[id];
  if (a.zone && !inZone(a.x, a.z, a.zone)) { const r = zoneRect(a.zone); a.x = r.x0 + 1 + Math.random() * (r.x1 - r.x0 - 2); a.z = r.z0 + 1 + Math.random() * (r.z1 - r.z0 - 2); }
  a.y = world.top(a.x, a.z) + 1; animals.push(a); entityList.push(a);
}
// Songbirds and butterflies (just for life; they never get in the way)
const birds = []; for (let i = 0; i < 7; i++) { const b = E.buildBird(['#5b6b8a', '#8a5b4a', '#4a7a8a'][i % 3]); const fl = i < 4 ? 0 : 1; b.userData.c = fl ? { x: 30, z: 70 } : { x: 62, z: 44 }; b.userData.r = 14 + (i % 4) * 2.5; b.userData.a = i * 0.7; b.userData.h = 30 + (i % 3) * 1.5; b.userData.sp = 0.16 + (i % 3) * 0.02; scene.add(b); birds.push(b); }
const flies = []; { const spots = [[50, 52], [47, 46], [22, 74], [30, 84], [58, 50], [38, 42], [14, 88], [64, 46], [26, 70], [44, 54]]; spots.forEach(([x, z], i) => { const f = E.buildButterfly(['#ffd84a', '#ff9ec7', '#9fd4ff', '#ffffff', '#ffb050'][i % 5]); f.userData = { ...f.userData, ax: x + 0.5, az: z + 0.5, t: Math.random() * 10, s: 0.6 + Math.random() * 0.5 }; scene.add(f); flies.push(f); }); }
let chirpT = 8;
function updateLife(dt, now) {
  const calm = state.settings.calm, sp = calm ? 0.5 : 1;
  for (const b of birds) { const u = b.userData; u.a += dt * u.sp * sp; const x = u.c.x + Math.cos(u.a) * u.r, z = u.c.z + Math.sin(u.a) * u.r; b.position.set(x, u.h + Math.sin(u.a * 3) * 0.8, z); b.rotation.y = -u.a; const fl = Math.sin(now / 1000 * (calm ? 8 : 14) + u.r) * 0.6; u.wingL.rotation.z = fl; u.wingR.rotation.z = -fl; }
  for (const f of flies) { const u = f.userData; u.t += dt * u.s * sp; const x = u.ax + Math.sin(u.t * 0.7) * 2.2 + Math.sin(u.t * 1.9) * 0.4, z = u.az + Math.cos(u.t * 0.5) * 2.2; const gy = world.top(x, z) + 1.1 + Math.sin(u.t * 2.3) * 0.35; f.position.set(x, gy, z); f.rotation.y = Math.atan2(Math.cos(u.t * 0.7), -Math.sin(u.t * 0.5)); const fl = Math.sin(now / 1000 * 22 + u.ax) * 1.0; u.wingL.rotation.z = fl; u.wingR.rotation.z = -fl; }
  if (!calm && G.mode === 'play') { chirpT -= dt; if (chirpT <= 0) { chirpT = 12 + Math.random() * 14; Sound.chirp(); } }
}
function updateAnimals(dt) {
  const calm = state.settings.calm;
  for (const a of animals) {
    a.t += dt; const S = E.SPECIES[a.sp];
    if (S.fly) { const r = 4, sp = calm ? 0.25 : 0.45; const ang = a.t * sp + a.home.x; a.x = a.home.x + Math.cos(ang) * r; a.z = a.home.z + Math.sin(ang) * r; const gy = world.top(a.x, a.z) + 5 + Math.sin(a.t) * 0.5; a.y += (gy - a.y) * Math.min(1, dt * 2); a.yaw = -ang; a.grp.position.set(a.x, a.y, a.z); a.grp.rotation.y = a.yaw; const U = a.grp.userData, fl = Math.sin(a.t * (calm ? 6 : 11)) * 0.55; U.wingL.rotation.z = fl; U.wingR.rotation.z = -fl; continue; }
    let tx = null, tz = null, speed = S.speed * (calm ? 0.8 : 1);
    if (a.follow) {
      const dx = P.pos.x - a.x, dz = P.pos.z - a.z, d = Math.hypot(dx, dz);
      if (d > 2.0) { tx = P.pos.x; tz = P.pos.z; speed = Math.min(4.2, 1.5 + d * 0.6); }
      if (d > 24) { a.follow = false; UI.toast(`The ${S.name.toLowerCase()} stopped following. Go back and walk close to it.`); }
    } else {
      if (a.tx == null) { a.wait -= dt; if (a.wait <= 0) { const r = a.zone ? zoneRect(a.zone) : null; if (r) { a.tx = r.x0 + 0.8 + Math.random() * (r.x1 - r.x0 - 1.6); a.tz = r.z0 + 0.8 + Math.random() * (r.z1 - r.z0 - 1.6); } else { a.tx = a.home.x + (Math.random() - 0.5) * 12; a.tz = a.home.z + (Math.random() - 0.5) * 12; } } }
      if (a.tx != null) { tx = a.tx; tz = a.tz; if (Math.hypot(tx - a.x, tz - a.z) < 0.3) { a.tx = null; a.wait = 2 + Math.random() * 4; tx = null; } }
    }
    let moving = false;
    if (tx != null) {
      const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz) || 1; const nx = a.x + dx / d * speed * dt, nz = a.z + dz / d * speed * dt;
      const cy = Math.floor(a.y) - 1, ny = world.top(nx, nz), wat = world.topAny(nx, nz) !== ny && world.get(nx, world.topAny(nx, nz), nz) === B.WATER;
      const maxUp = a.follow ? 2 : 1;
      if (nx < 1 || nz < 1 || nx > W - 1 || nz > D - 1 || ny - cy > maxUp || (wat && !a.follow) || (a.zone && !a.follow && !inZone(nx, nz, a.zone))) { a.tx = null; a.wait = 1; }
      else { a.x = nx; a.z = nz; moving = true; const ty = Math.atan2(dx, dz); let dy = ty - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2; a.yaw += dy * Math.min(1, dt * 6); }
    }
    const gy = world.top(a.x, a.z) + 1; a.y += (gy - a.y) * Math.min(1, dt * 10);
    // walking legs (diagonal pairs), little body bob, and grazing when standing still
    const U = a.grp.userData; a.sw = (a.sw || 0) + ((moving ? 1 : 0) - (a.sw || 0)) * Math.min(1, dt * 8); a.ph = (a.ph || 0) + dt * speed * 5.5 * (moving ? 1 : 0);
    const sw = Math.sin(a.ph) * 0.55 * a.sw; U.legs.forEach((l, i) => l.rotation.x = (i === 0 || i === 3 ? sw : -sw));
    if (!moving && !a.follow && a.wait > 1.5 && (a.sp === 'sheep' || a.sp === 'cow' || a.sp === 'donkey')) a.graze = Math.min(1, (a.graze || 0) + dt * 1.5); else a.graze = Math.max(0, (a.graze || 0) - dt * 3);
    U.rig.rotation.x = a.graze * 0.16; U.rig.position.y = Math.abs(Math.sin(a.ph)) * 0.04 * a.sw;
    a.grp.position.set(a.x, a.y, a.z); a.grp.rotation.y = a.yaw;
  }
}

// Items
const ITEM_DEFS = [];
{ [22, 30, 38, 46, 56, 64, 84].forEach((z, i) => { const x = Math.round(brookX(z) + 2.8); ITEM_DEFS.push({ id: 'pebble' + i, type: 'pebble', q: 'david', x: x + 0.5, z: z + 0.5 }); });
  ITEM_DEFS.push({ id: 'tablets', type: 'tablets', q: 'moses', x: PLACES.sinai.x + 0.5, z: PLACES.sinai.z + 0.5 });
  ITEM_DEFS.push({ id: 'water', type: 'water', q: 'samaritan', x: PLACES.well.x + 2.5, z: PLACES.well.z + 0.5 });
  ITEM_DEFS.push({ id: 'bandage', type: 'bandage', q: 'samaritan', x: PLACES.inn.x0 + 2.5, z: PLACES.inn.z0 + 2.5 });
  const g = PLACES.granary; [[1, 1], [3, 1], [1, 3]].forEach(([dx, dz], i) => ITEM_DEFS.push({ id: 'grain' + i, type: 'grain', q: 'joseph', x: g.x0 + dx + 0.5, z: g.z0 + dz + 0.5 })); }
const items = ITEM_DEFS.map(d => { const grp = E.buildItem(d.type); grp.visible = false; scene.add(grp); const it = { ...d, grp, kind: 'item', y: world.top(d.x, d.z) + 1 }; entityList.push(it); return it; });

// Beacon, zones, rainbow
const beacon = E.buildBeacon(); beacon.visible = false; scene.add(beacon);
const A = PLACES.ark; const arkZone = E.buildZone(A.x0, 13.02, A.z0, A.x1, 16, A.z1); arkZone.visible = false; scene.add(arkZone);
const gapZone = E.buildZone(14, 14, 90, 15, 16, 93, 0x7fd0ff); gapZone.visible = false; scene.add(gapZone);
// Each glowing cell shows its own state: gold = still empty, green = filled (sits on top of what he built there)
const cellMatEmpty = new THREE.MeshBasicMaterial({ color: 0xffd84a, transparent: true, opacity: 0.55, depthWrite: false });
const cellMatFull = new THREE.MeshBasicMaterial({ color: 0x3ddc5a, transparent: true, opacity: 0.8, depthWrite: false });
const tileGeo = new THREE.BoxGeometry(0.86, 0.05, 0.86), cubeGeo = new THREE.BoxGeometry(1.04, 1.04, 1.04);
const arkCells = []; for (let z = A.z0; z < A.z1; z++) for (let x = A.x0; x < A.x1; x++) { const m = new THREE.Mesh(tileGeo, cellMatEmpty); m.renderOrder = 3; m.visible = false; scene.add(m); arkCells.push({ x, z, m }); }
const gapCells = []; for (const [x, z] of PLACES.gap) for (let y = 14; y <= 15; y++) { const m = new THREE.Mesh(cubeGeo, cellMatEmpty); m.position.set(x + 0.5, y + 0.5, z + 0.5); m.renderOrder = 3; m.visible = false; scene.add(m); gapCells.push({ x, y, z, m }); }
function refreshCells(ark, gap) {
  for (const c of arkCells) {
    c.m.visible = ark; if (!ark) continue;
    let top = 13, wood = false; for (let y = ARK_Y0; y <= ARK_Y1; y++) { const b = world.get(c.x, y, c.z); if (b !== B.AIR && b !== B.WATER) { top = y; if (WOOD.has(b) && world.edits[c.x + c.z * W + y * W * D] != null) wood = true; } }
    c.m.material = wood ? cellMatFull : cellMatEmpty; c.m.position.set(c.x + 0.5, top + 1.03, c.z + 0.5);
  }
  for (const c of gapCells) { c.m.visible = gap; if (gap) { const full = world.solid(c.x, c.y, c.z); c.m.material = full ? cellMatFull : cellMatEmpty; c.m.scale.setScalar(full ? 1.0 : 0.9); } }
}
const rainbow = E.buildRainbow(); rainbow.position.set(60, 0, -10); rainbow.visible = !!(state.quests.noah && state.quests.noah.done); scene.add(rainbow);

// ---------- Quests ----------
const qs = id => (state.quests[id] ||= { step: 0, prog: 0, list: [], boarded: {}, done: false });
const curQ = () => state.active ? QUESTS[state.active] : null;
const curStep = () => { const q = curQ(); return q ? q.steps[qs(state.active).step] : null; };
// Ark building is forgiving: ANY wood block (Planks or the log-textured "Wood" block) counts, in a glowing cell,
// stacked on top of one, or up to 2 cells outside the glow. It is recounted from the world itself (placed blocks
// are saved with the world), so blocks placed before an update count as soon as the game opens.
const WOOD = new Set([B.PLANKS, B.LOG]);
const ARK_M = 2, ARK_Y0 = 13, ARK_Y1 = 30;
const inArkArea = (x, y, z) => x >= A.x0 - ARK_M && x < A.x1 + ARK_M && z >= A.z0 - ARK_M && z < A.z1 + ARK_M && y >= ARK_Y0 && y <= ARK_Y1;
function countPlanks() { // only blocks he placed (world edits) count, so nearby trees or lumber never do
  let n = 0; const WD = W * D;
  for (const [k, b] of Object.entries(world.edits)) { if (!WOOD.has(b)) continue; const i = +k, y = Math.floor(i / WD), r = i - y * WD, z = Math.floor(r / W), x = r - z * W; if (world.get(x, y, z) === b && inArkArea(x, y, z)) n++; }
  return n;
}
function countGap() { let n = 0; for (const [x, z] of PLACES.gap) for (let y = 14; y <= 15; y++) if (world.solid(x, y, z)) n++; return n; }
function stepCount(st) { if (!st) return [0, 0]; const s = qs(state.active);
  switch (st.type) { case 'planks': return [Math.min(st.count, countPlanks()), st.count]; case 'fill': return [countGap(), st.count]; case 'talk': case 'reach': return [0, 1]; case 'share': return [s.prog, st.npcs.length]; default: return [s.prog, st.count]; } }
function checkStep() {
  const st = curStep(); if (!st) return; const [n, c] = stepCount(st);
  if (st.type !== 'talk' && n >= c) advanceStep();
  updateHUD();
}
function advanceStep() {
  const id = state.active, s = qs(id), Q = QUESTS[id];
  s.step++; s.prog = 0; s.list = []; state.stars++; Sound.star(); UI.toast('★ Step done! +1 star', 'star'); bumpStars(); flashTracker();
  if (s.step < Q.steps.length) UI.sayLines([pick(PHRASES.stepDone)]);
  if (s.step >= Q.steps.length) return completeQuest(id);
  const st = curStep(); if (st.type === 'planks' || st.type === 'fill') checkStep();
  saveState(); refreshMarkers(); updateHUD();
}
function completeQuest(id) {
  const s = qs(id), Q = QUESTS[id]; s.done = true; s.doneAt = UI.today(); state.active = null; state.badges[Q.virtue] = UI.today(); state.stars += 3;
  if (id === 'noah') rainbow.visible = true;
  if (id === 'samaritan') setLying(npcs.samaritan, false);
  saveState(true); refreshMarkers(); updateHUD();
  UI.reward(id, () => { G.setUIOpen(false); });
}
function startQuest(id) {
  state.active = id; const s = qs(id); s.started = true; saveState(); refreshMarkers();
  UI.newWords(id, () => { G.setUIOpen(false); checkStep(); updateHUD(); UI.toast('Mission started: ' + QUESTS[id].title); });
}
function questWorldChanged() { const st = curStep(); if (st && (st.type === 'planks' || st.type === 'fill')) checkStep(); }

function talkTo(n) {
  const def = n.def, name = def.name; Sound.click();
  const words = state.active ? QUESTS[state.active].words : [];
  const st = curStep();
  const say = (lines, o = {}) => UI.dialog({ npc: def.id, name, lines, words, ...o });
  // step: talk
  if (st && st.type === 'talk' && st.npc === def.id) { const Q = QUESTS[state.active], id = state.active; say(Q.outro, { doneLabel: 'Finish mission', onDone: () => { qs(id).step = Q.steps.length - 1; advanceStepFinal(id); } }); return; }
  // step: share
  if (st && st.type === 'share' && st.npcs.includes(def.id)) {
    const s = qs(state.active);
    if (!s.list.includes(def.id)) { s.list.push(def.id); s.prog = s.list.length; Sound.pickup(); say(NPC_LINES.shareLines[def.id] || ['Thank you!'], { onDone: checkStep }); saveState(); refreshMarkers(); return; }
  }
  if (def.role === 'guide') return say(NPC_LINES.ruth);
  if (def.role === 'hungry') return say(state.quests.loaves && state.quests.loaves.done ? NPC_LINES.hungryFed : NPC_LINES.hungry);
  if (def.role === 'brother') return say(state.quests.joseph && state.quests.joseph.done ? NPC_LINES.brotherFed : NPC_LINES.brother);
  const qid = def.quest; if (!qid) return;
  const Q = QUESTS[qid], s = state.quests[qid];
  if (s && s.done) return say(Q.done);
  if (state.active === qid) return say([Q.remind, 'Next: ' + curStep().text + '.']);
  const begin = () => {
    if (Q.choice) {
      const ask = () => say(Q.intro, { words: Q.words, choice: Q.choice, onChoose: k => {
        const o = Q.choice.options[k];
        if (o.good) { state.stars++; Sound.good(); UI.toast('★ Kind and wise choice! +1 star', 'star'); say(o.reply, { words: Q.words, doneLabel: 'Start mission', onDone: () => startQuest(qid) }); }
        else { Sound.gentle(); say(o.reply, { doneLabel: 'Try again', onDone: () => askAgain() }); }
      } });
      const askAgain = () => say([Q.intro[Q.intro.length - 1]], { words: Q.words, choice: Q.choice, onChoose: k => { const o = Q.choice.options[k]; if (o.good) { state.stars++; Sound.good(); UI.toast('★ Kind and wise choice! +1 star', 'star'); say(o.reply, { doneLabel: 'Start mission', onDone: () => startQuest(qid) }); } else { Sound.gentle(); say(o.reply, { doneLabel: 'Try again', onDone: () => askAgain() }); } } });
      ask();
    } else say(Q.intro, { words: Q.words, doneLabel: Q.start, onDone: () => startQuest(qid) });
  };
  if (state.active && state.active !== qid) {
    say([NPC_LINES.busy], { choice: { prompt: NPC_LINES.busyPrompt, options: [{ text: 'Keep my mission' }, { text: 'Switch to this mission' }] }, onChoose: k => { if (k === 1) { state.active = null; begin(); } else { UI.closeDialog(); G.setUIOpen(false); } } });
    return;
  }
  begin();
}
function advanceStepFinal(id) { const s = qs(id); s.step = QUESTS[id].steps.length; state.stars++; Sound.star(); completeQuest(id); }

function pickupItem(it) { const s = qs(state.active); if (s.list.includes(it.id)) return; s.list.push(it.id); s.prog = s.list.length; it.grp.visible = false; Sound.pickup(); burst(it.x - 0.5, it.y - 0.3, it.z - 0.5, 0xffe27a, 8, 2.5); UI.toast('Picked up!'); saveState(); checkStep(); }
function itemActive(it) { const st = curStep(); return st && state.active === it.q && st.type === 'collect' && st.item === it.type && !qs(state.active).list.includes(it.id); }

function questTick() {
  const st = curStep(); if (!st) return;
  if (st.type === 'reach' && st.where === 'summit') { if (Math.hypot(P.pos.x - PLACES.sinai.x - 0.5, P.pos.z - PLACES.sinai.z - 0.5) < 3.5 && P.pos.y > world.top(PLACES.sinai.x, PLACES.sinai.z) - 1) advanceStep(); }
  if (st.type === 'collect') for (const it of items) if (itemActive(it) && Math.hypot(P.pos.x - it.x, P.pos.z - it.z) < 1.6 && Math.abs(P.pos.y - it.y) < 2.5) pickupItem(it);
  if (st.type === 'lead') {
    const s = qs(state.active); const need = st.count - s.prog;
    const followers = animals.filter(a => a.follow);
    for (const a of animals) {
      if (a.sp !== st.species || a.zone) continue;
      const eligible = st.lost ? a.id === 'lostsheep' : a.id !== 'lostsheep';
      if (!eligible) continue;
      if (!a.follow && followers.length < need && Math.hypot(P.pos.x - a.x, P.pos.z - a.z) < 2.6) { a.follow = true; followers.push(a); Sound.baa && (a.sp === 'cow' ? Sound.moo() : Sound.baa()); UI.toast(`The ${E.SPECIES[a.sp].name.toLowerCase()} is following you!`); }
      if (a.follow && (inZone(a.x, a.z, st.zone) || (st.zone === 'ark' && a.x >= A.x0 - 1.5 && a.x < A.x1 + 1.5 && a.z >= A.z0 - 1.5 && a.z < A.z1 + 1.5))) { a.follow = false; a.zone = st.zone; s.boarded[a.id] = st.zone; s.prog++; Sound.pickup(); saveState(); checkStep(); if (curStep() !== st) break; }
    }
  }
}
function targetPos() {
  const st = curStep();
  if (!st) { let best = null, bd = 1e9; for (const n of Object.values(npcs)) if (n.markerKind === '!') { const d = Math.hypot(n.grp.position.x - P.pos.x, n.grp.position.z - P.pos.z); if (d < bd) { bd = d; best = n; } } return best ? { x: best.grp.position.x, z: best.grp.position.z, y: best.grp.position.y, name: best.def.name } : null; }
  const npcPos = id => ({ x: npcs[id].grp.position.x, z: npcs[id].grp.position.z, y: npcs[id].grp.position.y, name: npcs[id].def.name });
  switch (st.type) {
    case 'planks': return { x: (A.x0 + A.x1) / 2, z: (A.z0 + A.z1) / 2, y: 14, name: 'Ark area' };
    case 'fill': return { x: 14.5, z: 91.5, y: 14, name: 'Fence gap' };
    case 'talk': return npcPos(st.npc);
    case 'reach': return { x: PLACES.sinai.x + 0.5, z: PLACES.sinai.z + 0.5, y: world.top(PLACES.sinai.x, PLACES.sinai.z) + 1, name: 'Mountain top' };
    case 'share': { const s = qs(state.active); let best = null, bd = 1e9; for (const id of st.npcs) if (!s.list.includes(id)) { const p = npcPos(id); const d = Math.hypot(p.x - P.pos.x, p.z - P.pos.z); if (d < bd) { bd = d; best = p; } } return best; }
    case 'collect': { let best = null, bd = 1e9; for (const it of items) if (itemActive(it)) { const d = Math.hypot(it.x - P.pos.x, it.z - P.pos.z); if (d < bd) { bd = d; best = { x: it.x, z: it.z, y: it.y, name: it.type === 'pebble' ? 'Smooth stone' : it.type }; } } return best; }
    case 'lead': {
      if (animals.some(a => a.follow)) { const r = zoneRect(st.zone); return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, y: 14, name: st.zone === 'ark' ? 'Ark' : 'Sheep pen' }; }
      let best = null, bd = 1e9; for (const a of animals) { if (a.sp !== st.species || a.zone) continue; if (st.lost ? a.id !== 'lostsheep' : a.id === 'lostsheep') continue; const d = Math.hypot(a.x - P.pos.x, a.z - P.pos.z); if (d < bd) { bd = d; best = { x: a.x, z: a.z, y: a.y, name: E.SPECIES[a.sp].name }; } } return best;
    }
  }
  return null;
}
function refreshMarkers() {
  const st = curStep();
  for (const n of Object.values(npcs)) {
    let kind = null; const qid = n.def.quest;
    if (qid) { const s = state.quests[qid]; if (!(s && s.done) && state.active !== qid) kind = '!'; }
    if (st && st.type === 'talk' && st.npc === n.def.id) kind = '?';
    if (st && st.type === 'share' && st.npcs.includes(n.def.id) && !qs(state.active).list.includes(n.def.id)) kind = state.active === 'joseph' ? 'grain' : 'bread';
    if (kind !== n.markerKind) { if (n.marker) { n.grp.remove(n.marker); n.marker = null; } if (kind) { n.marker = E.makeMarker(kind); n.marker.position.y = n.grp.userData.lying ? 1.9 : 2.95; n.grp.add(n.marker); } n.markerKind = kind; }
  }
}

// ---------- HUD ----------
const hud = $('#hud');
function updateHUD() {
  const Q = curQ(); const tr = $('#tracker');
  $('#starcount').textContent = state.stars;
  const key = Q ? state.active + ':' + qs(state.active).step : 'explore';
  if (!Q) { if (tr.dataset.k !== key) { tr.dataset.k = key; tr.innerHTML = `<button class="tr-say" aria-label="Hear it"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg></button><div class="tq">Explore!</div><div class="tstep">Find a person with a gold <b>!</b> and talk to them.</div>`; } return; }
  const s = qs(state.active); const st = curStep(); const [n, c] = stepCount(st);
  const frac = (s.step + (st && st.type !== 'talk' ? n / Math.max(1, c) : 0)) / Q.steps.length;
  if (tr.dataset.k === key && tr.querySelector('.tlist')) { const b = tr.querySelector('li.cur b'); if (b && st && st.label) b.textContent = `${st.label}: ${n}/${c}`; tr.querySelector('.tbar div').style.width = Math.round(frac * 100) + '%'; return; }
  tr.dataset.k = key;
  tr.innerHTML = `<button class="tr-say" aria-label="Hear it"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg></button><div class="tq">${Q.title}</div><ol class="tlist">${Q.steps.map((x, i) => `<li class="${i < s.step ? 'done' : i === s.step ? 'cur' : ''}"><span class="dot">${i < s.step ? '✓' : i + 1}</span><span>${x.text}${/[.!?]$/.test(x.text) ? '' : '.'}${i === s.step && x.label ? `<b class="tcount">${x.label}: ${n}/${c}</b>` : ''}</span></li>`).join('')}</ol><div class="tbar"><div style="width:${Math.round(frac * 100)}%"></div></div><button class="tr-replay" aria-label="Hear the mission again"><span aria-hidden="true">🔁</span> Hear the mission again</button>`;
}
function trackerSay() { const st = curStep(); Speech.speak(st ? st.text + '.' : 'Find a person with a gold mark, and talk to them.', {}); }
function bumpStars() { const el = $('#stars'); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function flashTracker() { const el = $('#tracker'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
function updateWaypoint() {
  const t = targetPos(); const wp = $('#waypoint');
  if (!t || G.mode !== 'play') { wp.classList.add('hidden'); beacon.visible = false; return; }
  wp.classList.remove('hidden');
  const dx = t.x - P.pos.x, dz = t.z - P.pos.z, dist = Math.hypot(dx, dz);
  const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
  $('#wp-arrow').style.transform = `rotate(${ang}rad)`;
  $('#wp-label').textContent = dist < 3 ? `${t.name}: here!` : `${t.name}: ${Math.round(dist)} steps`;
  beacon.visible = dist > 8 && !uiOpen; beacon.position.set(t.x, (t.y || 13), t.z);
  beacon.material.opacity = state.settings.calm ? 0.3 : 0.25 + 0.1 * Math.sin(performance.now() / 700);
}
function buildHotbar() {
  const hb = $('#hotbar'); hb.innerHTML = '';
  BLOCK_HOTBAR.forEach((b, i) => { const d = BLOCKS[b]; const el = document.createElement('button'); el.className = 'slot' + (i === state.hotbar ? ' on' : ''); el.innerHTML = `<img src="${blockIcon(d.top, d.side)}" alt=""><span>${i < 9 ? i + 1 : ''}</span>`; el.title = d.name; el.setAttribute('aria-label', d.name);
    el.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); selectSlot(i); }); hb.appendChild(el); });
}
function selectSlot(i) { state.hotbar = (i + BLOCK_HOTBAR.length) % BLOCK_HOTBAR.length; [...$('#hotbar').children].forEach((c, k) => c.classList.toggle('on', k === state.hotbar)); $('#blockname').textContent = BLOCKS[BLOCK_HOTBAR[state.hotbar]].name; $('#blockname').classList.add('show'); clearTimeout(selectSlot.t); selectSlot.t = setTimeout(() => $('#blockname').classList.remove('show'), 1200); saveState(); }

// ---------- Input ----------
let touchMode = (navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches) || /iPad|iPhone|Android/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function setTouch(on) { touchMode = on; document.body.classList.toggle('touch', on); }
setTouch(touchMode);
let uiOpen = true;
const G = {
  mode: 'title', isTouch: () => touchMode,
  setUIOpen(v) { uiOpen = v || !$('#overlay').classList.contains('hidden') || !$('#dialog').classList.contains('hidden') || !!document.querySelector('.modal'); if (uiOpen && document.pointerLockElement) document.exitPointerLock(); hud.classList.toggle('uiopen', uiOpen); input.f = input.s = 0; input.jump = false; },
  afterScreenClose() { if (G.mode === 'title') UI.title(); else { G.setUIOpen(false); updateHUD(); } },
  startPlay() { G.mode = 'play'; state.started = true; saveState(); hud.classList.remove('hidden'); document.body.classList.add('playing'); G.setUIOpen(false); updateHUD(); refreshMarkers(); questWorldChanged(); if (!touchMode) $('#clickhint').classList.remove('hidden'); },
  openTalk: id => openTalk(id), talkMain: id => talkTo(npcs[id]),
  fixView: () => fixView(), cycleView: () => cycleView(), viewChanged: () => { cam.dist = 0; P.pitch = clampPitch(P.pitch); updateViewBtn(); },
  isNear: id => { const n = npcs[id]; return !!n && Math.hypot(n.grp.position.x - P.pos.x, n.grp.position.z - P.pos.z) < 7; },
  toTitle() { G.mode = 'title'; hud.classList.add('hidden'); document.body.classList.remove('playing'); savePlayer(); UI.title(); },
};

window.FC = G;
UI.initUI(G);

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (G.mode !== 'play') return;
  if (uiOpen) { if (e.code === 'Escape' && !$('#overlay').classList.contains('hidden')) UI.closeScreen(); return; }
  keys[e.code] = true;
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); selectSlot(n === 0 ? 9 : n - 1); }
  if (e.code === 'KeyE') { const n = nearestNPC(); if (n) talkTo(n); }
  if (e.code === 'KeyT') { const n = nearestNPC(); if (n) openTalk(n.def.id); }
  if (e.code === 'Escape' || e.code === 'KeyM') UI.pauseMenu();
  if (e.code === 'KeyV' || e.code === 'F5') { e.preventDefault(); cycleView(); }
  if (e.code === 'Space') { e.preventDefault(); input.jumpQ = true; }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('mousedown', e => {
  if (touchMode || G.mode !== 'play' || uiOpen) return; Sound.unlock();
  if (!document.pointerLockElement) { canvas.requestPointerLock && canvas.requestPointerLock(); $('#clickhint').classList.add('hidden'); return; }
  const ent = pickEntityCenter(); const hit = raycast();
  if (ent && (!hit || ent.d < hit.dist)) { interactEntity(ent.e); return; }
  if (e.button === 0) breakBlock(); else if (e.button === 2) placeBlock();
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (document.pointerLockElement !== canvas || uiOpen) return; const s = 0.0025 * state.settings.sens; P.yaw -= e.movementX * s; P.pitch = clampPitch(P.pitch - e.movementY * s); });
addEventListener('wheel', e => { if (G.mode === 'play' && !uiOpen) selectSlot(state.hotbar + (e.deltaY > 0 ? 1 : -1)); }, { passive: true });
document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && G.mode === 'play' && !uiOpen && !touchMode) { $('#clickhint').classList.remove('hidden'); UI.pauseMenu(); } });

// Touch: joystick (left), look (right), tap to interact
const joy = $('#joy'), knob = $('#joy-knob'); let joyId = null, joyC = null, lookId = null, lookLast = null, lookStart = null; const pinch = { a: null, b: null, d0: 1, z0: 1 };
const layer = $('#touchlayer');
layer.addEventListener('touchstart', e => {
  e.preventDefault(); Sound.unlock(); if (!touchMode) setTouch(true);
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.4 && joyId === null) { joyId = t.identifier; joyC = { x: t.clientX, y: t.clientY }; joy.style.left = (t.clientX - 70) + 'px'; joy.style.top = (t.clientY - 70) + 'px'; joy.classList.add('active'); knob.style.transform = 'translate(0,0)'; }
    else if (lookId === null && pinch.a === null) { lookId = t.identifier; lookLast = { x: t.clientX, y: t.clientY }; lookStart = { x: t.clientX, y: t.clientY, t: performance.now() }; }
    else if (lookId !== null && pinch.a === null && t.clientX >= innerWidth * 0.4) { // second finger on the look side: pinch to zoom
      const o = [...e.touches].find(q => q.identifier === lookId); if (o) { pinch.a = lookId; pinch.b = t.identifier; pinch.d0 = Math.max(20, Math.hypot(o.clientX - t.clientX, o.clientY - t.clientY)); pinch.z0 = cam.pinch; lookId = null; lookStart = null; }
    }
  }
}, { passive: false });
layer.addEventListener('touchmove', e => {
  e.preventDefault();
  if (pinch.a !== null) { const a = [...e.touches].find(q => q.identifier === pinch.a), b = [...e.touches].find(q => q.identifier === pinch.b);
    if (a && b) { const d = Math.max(20, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)); const base = ZOOM[state.settings.zoom] || ZOOM.normal; cam.pinch = Math.max(2 / base, Math.min(8 / base, pinch.z0 * pinch.d0 / d)); } }
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) { let dx = t.clientX - joyC.x, dy = t.clientY - joyC.y; const d = Math.hypot(dx, dy), m = 60; if (d > m) { dx *= m / d; dy *= m / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; input.s = dx / m; input.f = -dy / m; }
    if (t.identifier === lookId) { const s = 0.006 * state.settings.sens; P.yaw -= (t.clientX - lookLast.x) * s; P.pitch = clampPitch(P.pitch - (t.clientY - lookLast.y) * s); lookLast = { x: t.clientX, y: t.clientY }; }
  }
}, { passive: false });
const tend = e => {
  for (const t of e.changedTouches) {
    if (t.identifier === joyId) { joyId = null; input.f = input.s = 0; joy.classList.remove('active'); knob.style.transform = 'translate(0,0)'; }
    if (t.identifier === pinch.a || t.identifier === pinch.b) { pinch.a = pinch.b = null; }
    if (t.identifier === lookId) { lookId = null; if (lookStart && performance.now() - lookStart.t < 300 && Math.hypot(t.clientX - lookStart.x, t.clientY - lookStart.y) < 12) tapAt(t.clientX, t.clientY); }
  }
};
layer.addEventListener('touchend', tend); layer.addEventListener('touchcancel', tend);
const holdBtn = (sel, down, up) => { const b = $(sel); b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); Sound.unlock(); b.classList.add('pressed'); down(); }, { passive: false }); b.addEventListener('touchend', e => { e.preventDefault(); b.classList.remove('pressed'); up && up(); }); b.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); down(); }); b.addEventListener('mouseup', () => up && up()); };
holdBtn('#btn-jump', () => input.jump = true, () => input.jump = false);
holdBtn('#btn-break', () => { if (!uiOpen) breakBlock(); });
holdBtn('#btn-place', () => { if (!uiOpen) placeBlock(); });
holdBtn('#btn-talk', () => { const n = nearestNPC(); if (n && !uiOpen) openTalk(n.def.id); });
function openTalk(id) { Sound.click(); UI.talkPanel(id, { onMain: () => talkTo(npcs[id]) }); }
const hudTap = (sel, fn) => { const b = $(sel); b.addEventListener('touchstart', e => { e.stopPropagation(); }, { passive: true }); b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); Sound.unlock(); if (G.mode === 'play' && !uiOpen) fn(); }); };
hudTap('#btn-view', cycleView); hudTap('#btn-fixview', fixView); updateViewBtn();
$('#btn-menu').addEventListener('click', e => { e.preventDefault(); Sound.unlock(); Sound.click(); UI.pauseMenu(); });
$('#tracker').addEventListener('click', e => { if (e.target.closest('.tr-say')) { e.preventDefault(); trackerSay(); } else if (e.target.closest('.tr-replay') && state.active && !uiOpen) { e.preventDefault(); Sound.unlock(); Sound.click(); Speech.speak(TALK.labels.replay, { voice: 'n', onEnd: () => UI.replayMission(state.active) }); } });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// Entity picking
const ray = new THREE.Raycaster(); const tmpBox = new THREE.Box3(); const tmpV = new THREE.Vector3();
function entBox(e) {
  if (e.kind === 'npc') { const p = e.grp.position; return e.grp.userData.lying ? tmpBox.set(tmpV.set(p.x - 0.5, p.y, p.z - 1.2), new THREE.Vector3(p.x + 0.5, p.y + 0.7, p.z + 1.2)) : tmpBox.set(tmpV.set(p.x - 0.45, p.y, p.z - 0.45), new THREE.Vector3(p.x + 0.45, p.y + 2.1, p.z + 0.45)); }
  if (e.kind === 'animal') { const p = e.grp.position, hh = E.SPECIES[e.sp].h; return tmpBox.set(tmpV.set(p.x - 0.7, p.y, p.z - 0.7), new THREE.Vector3(p.x + 0.7, p.y + hh, p.z + 0.7)); }
  if (e.kind === 'item') { if (!e.grp.visible) return null; return tmpBox.set(tmpV.set(e.x - 0.5, e.y, e.z - 0.5), new THREE.Vector3(e.x + 0.5, e.y + 0.9, e.z + 0.5)); }
}
function pickWithRay() { let best = null; for (const e of entityList) { const b = entBox(e); if (!b) continue; const hit = ray.ray.intersectBox(b, new THREE.Vector3()); if (hit) { const d = hit.distanceTo(ray.ray.origin); if (d < 8 + cam.dist && (!best || d < best.d)) best = { e, d }; } } return best; }
function pickEntityCenter() { ray.ray.origin.set(P.pos.x, (cam.y ?? P.pos.y) + EYE, P.pos.z); ray.ray.direction.set(0, 0, -1).applyEuler(new THREE.Euler(P.pitch, P.yaw, 0, 'YXZ')); return pickWithRay(); }
function tapAt(x, y) {
  if (uiOpen || G.mode !== 'play') return;
  ray.setFromCamera({ x: (x / innerWidth) * 2 - 1, y: -(y / innerHeight) * 2 + 1 }, camera);
  const p = pickWithRay(); if (p) interactEntity(p.e);
}
function interactEntity(e) {
  if (e.kind === 'npc') { if (Math.hypot(e.grp.position.x - P.pos.x, e.grp.position.z - P.pos.z) < 7) talkTo(e); else UI.toast('Walk closer to talk.'); }
  else if (e.kind === 'animal') { if (e.sp === 'cow') Sound.moo(); else if (e.sp === 'sheep') Sound.baa(); else Sound.click(); UI.toast({ sheep: 'Baa! A friendly sheep.', cow: 'Moo! A gentle cow.', lion: 'A calm, friendly lion. Purr!', camel: 'A tall desert camel.', donkey: 'Hee-haw! A helpful donkey.', dove: 'Coo! A gentle dove.' }[e.sp]); }
  else if (e.kind === 'item' && itemActive(e)) pickupItem(e);
}
function nearestNPC() { let best = null, bd = 3.2; for (const n of Object.values(npcs)) { const d = Math.hypot(n.grp.position.x - P.pos.x, n.grp.position.z - P.pos.z); if (d < bd && Math.abs(n.grp.position.y - P.pos.y) < 3) { bd = d; best = n; } } return best; }

// ---------- NPC life: wander a little, walk, look at you, wave hello ----------
function updateNPCs(dt, now) {
  const calm = state.settings.calm;
  for (const n of Object.values(npcs)) {
    n.t += dt; const g = n.grp, U = g.userData;
    const dxp = P.pos.x - n.x, dzp = P.pos.z - n.z, dp = Math.hypot(dxp, dzp), playing = G.mode === 'play';
    const near = playing && dp < 6.5;
    let moving = false;
    if (!U.lying) {
      if (!near && !uiOpen) {
        if (n.tx == null) { n.wait -= dt; if (n.wait <= 0) { const ang = Math.random() * 6.283, r = 0.5 + Math.random() * 1.8, tx = n.def.x + Math.cos(ang) * r, tz = n.def.z + Math.sin(ang) * r, y0 = world.top(n.x, n.z), y1 = world.top(tx, tz); if (Math.abs(y1 - y0) <= 1 && world.get(tx, y1, tz) !== B.WATER && !world.solid(tx, y0 + 1, tz) && !world.solid(tx, y0 + 2, tz)) { n.tx = tx; n.tz = tz; } else n.wait = 1.5; } }
        if (n.tx != null) { const dx = n.tx - n.x, dz = n.tz - n.z, dd = Math.hypot(dx, dz); if (dd < 0.06) { n.tx = null; n.wait = 3 + Math.random() * 6; } else { const st = Math.min(dd, dt * 0.85); n.x += dx / dd * st; n.z += dz / dd * st; moving = true; turnTo(n, Math.atan2(dx, dz), dt * 5); } }
      } else if (near) { n.tx = null; turnTo(n, Math.atan2(dxp, dzp), dt * 2.5); }
      n.sw += ((moving ? 1 : 0) - n.sw) * Math.min(1, dt * 7); if (moving) n.ph += dt * 6.5;
      const sw = Math.sin(n.ph) * 0.5 * n.sw;
      U.legL.rotation.x = sw; U.legR.rotation.x = -sw;
      const idle = calm ? 0 : Math.sin(n.t * 1.5) * 0.06 * (1 - n.sw);
      U.armL.rotation.x = -sw * 0.8 + idle;
      // wave hello when you walk up
      if (near && dp < 5 && now - n.greeted > 25000 && !uiOpen) { n.greeted = now; n.wave = calm ? 1.2 : 1.8; if (HELLOS[n.def.id]) showBubble(n, HELLOS[n.def.id]); }
      if (n.wave > 0) { n.wave -= dt; U.armR.rotation.x = -2.7 + Math.sin(n.t * (calm ? 6 : 11)) * 0.25; U.armR.rotation.z = -0.25; }
      else { U.armR.rotation.x += ((sw * 0.8 - idle) - U.armR.rotation.x) * Math.min(1, dt * 10); U.armR.rotation.z *= 0.8; }
      // head looks at you when near, otherwise glances around
      let hy = 0; if (near) { let rel = Math.atan2(dxp, dzp) - n.yaw; while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI; hy = Math.max(-1, Math.min(1, rel)); } else if (!calm) hy = Math.sin(n.t * 0.35 + n.def.x) * 0.45 * (1 - n.sw);
      n.hy += (hy - n.hy) * Math.min(1, dt * 6); U.head.rotation.y = n.hy;
      U.head.rotation.x = near ? Math.max(-0.3, Math.min(0.3, -(P.pos.y + 1.4 - (g.position.y + 1.6)) / Math.max(1, dp))) : 0;
      U.rig.position.y = Math.abs(Math.sin(n.ph)) * 0.045 * n.sw; U.rig.scale.y = 1 + (calm ? 0 : Math.sin(n.t * 1.8) * 0.008);
      g.rotation.y = n.yaw;
    } else { g.rotation.y = Math.PI / 2; U.head.rotation.y = near ? 0.5 * Math.sin(n.t * 0.8) : 0; }
    const gy = world.top(n.x, n.z) + 1; g.position.x = n.x; g.position.z = n.z; g.position.y += (gy - g.position.y) * Math.min(1, dt * 8);
    if (n.marker) n.marker.position.y = (U.lying ? 1.9 : 2.95) + (calm ? 0 : Math.sin(n.t * 2) * 0.08);
    if (n.bubble) { n.bubbleT -= dt; const a = Math.min(1, n.bubbleT * 2, (2.6 - n.bubbleT) * 5); n.bubble.material.opacity = Math.max(0, a); n.label.material.opacity = 1 - Math.max(0, a); n.bubble.position.y = n.label.position.y + 0.08 * Math.min(1, (2.6 - n.bubbleT) * 4); if (n.bubbleT <= 0) { n.label.material.opacity = 1; g.remove(n.bubble); n.bubble.material.map.dispose(); n.bubble.material.dispose(); n.bubble = null; } }
  }
}
function turnTo(n, target, k) { let d = target - n.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; n.yaw += d * Math.min(1, k); }
function showBubble(n, text) { if (n.bubble) { n.grp.remove(n.bubble); } n.bubble = E.makeBubble(text); n.bubble.material.opacity = 0; n.bubbleT = 2.6; n.grp.add(n.bubble); Sound.pop(); }

// ---------- Loop ----------
function savePlayer() { state.player = { x: P.pos.x, y: P.pos.y, z: P.pos.z, yaw: P.yaw, pitch: P.pitch }; saveState(); }
setInterval(() => { if (G.mode === 'play') savePlayer(); }, 5000);
addEventListener('pagehide', () => { savePlayer(); saveState(true); saveWorld(world.edits, true); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { savePlayer(); saveState(true); saveWorld(world.edits, true); } });

let last = performance.now(), titleT = 0, hudT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const calm = state.settings.calm;
  let n = 0; for (const k of dirty) { const [cx, cz] = k.split(',').map(Number); buildChunk(cx, cz); dirty.delete(k); if (++n >= 3) break; }
  if (G.mode === 'title') {
    titleT += dt * (calm ? 0.03 : 0.06);
    camera.position.set(52 + Math.cos(titleT) * 34, 34, 56 + Math.sin(titleT) * 34); camera.lookAt(56, 16, 52);
    sel.visible = false; playerModel.visible = false;
  } else {
    if (!uiOpen) updatePlayer(dt); else pushOut();
    updateCamera(dt, true);
    const hit = !uiOpen ? raycast() : null; sel.visible = !!hit; if (hit) sel.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    questTick();
    const nn = nearestNPC(); const tb = $('#btn-talk'); if (nn && !uiOpen) { if (tb.dataset.n !== nn.def.id) { tb.dataset.n = nn.def.id; tb.querySelector('.who').textContent = nn.def.name; $('#interact-hint').textContent = 'Press E to talk to ' + nn.def.name + '. Press T for the Talk menu.'; } tb.classList.remove('hidden'); $('#interact-hint').classList.remove('hidden'); } else { tb.classList.add('hidden'); tb.dataset.n = ''; $('#interact-hint').classList.add('hidden'); }
    hudT += dt; if (hudT > 0.25) { hudT = 0; updateWaypoint(); const st = curStep(); if (st && st.type !== 'talk') updateHUD(); if (st && (st.type === 'planks' || st.type === 'fill') && !uiOpen) { const [n, c] = stepCount(st); if (n >= c) checkStep(); } }
  }
  updateAnimals(dt); updateLife(dt, now); if (G.mode === 'play') updateHand(dt); else if (hand.mesh) hand.mesh.visible = false;
  waterU.uTime.value = now / 1000; waterU.uAmp.value = state.settings.calm ? 0.4 : 1;
  if (popT > 0) { popT -= dt; const k = Math.max(0, popT / 0.28); popBox.material.opacity = k * 0.9; popBox.scale.setScalar(1.0 + (1 - k) * 0.12); if (popT <= 0) popBox.visible = false; }
  updateNPCs(dt, now);
  for (const it of items) { const vis = itemActive(it); it.grp.visible = vis; if (vis) { it.y = world.top(it.x, it.z) + 1; it.grp.position.set(it.x, it.y + (calm ? 0.05 : 0.15 + Math.sin(now / 400) * 0.08), it.z); if (!calm) it.grp.rotation.y += dt; } }
  const st = curStep(); arkZone.visible = !!(st && st.type === 'planks') || !!(st && st.type === 'lead' && st.zone === 'ark'); gapZone.visible = !!(st && st.type === 'fill'); if (G.mode === 'play') refreshCells(!!(st && st.type === 'planks'), gapZone.visible); else refreshCells(false, false);
  for (const c of clouds.children) { c.position.x += dt * c.userData.sp * (calm ? 0.4 : 1); if (c.position.x > 150) c.position.x = -50; }
  for (let i = parts.length - 1; i >= 0; i--) { const m = parts[i], u = m.userData; u.t -= dt; u.v.y -= 11 * dt; m.position.addScaledVector(u.v, dt); m.rotation.x += dt * 6; m.rotation.z += dt * 4; if (world.solid(m.position.x, m.position.y - 0.05, m.position.z) && u.v.y < 0) { u.v.y *= -0.3; u.v.x *= 0.6; u.v.z *= 0.6; } if (u.t < 0.2) m.scale.setScalar(u.s * Math.max(0.01, u.t / 0.2)); if (u.t <= 0) { scene.remove(m); parts.splice(i, 1); } }
  renderer.render(scene, camera);
}
buildHotbar(); selectSlot(state.hotbar || 0); $('#blockname').classList.remove('show');
refreshMarkers(); updateHUD();
requestAnimationFrame(frame);
UI.title();
document.getElementById('loading')?.remove();

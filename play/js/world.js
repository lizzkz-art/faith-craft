import { T } from './textures.js';
import { NPCS } from './data.js';
export const W = 96, D = 96, H = 48, CS = 16;
export const B = { AIR:0, GRASS:1, DIRT:2, STONE:3, LOG:4, LEAVES:5, SAND:6, WATER:7, PLANKS:8, GOLD:9, GLASS:10, BRICK:11, WOOL:12, SNOW:13, COBBLE:14, MARBLE:15 };
export const BLOCKS = [
  null,
  { name: 'Grass', top: T.GRASS_TOP, bottom: T.DIRT, side: T.GRASS_SIDE },
  { name: 'Dirt', top: T.DIRT, bottom: T.DIRT, side: T.DIRT },
  { name: 'Stone', top: T.STONE, bottom: T.STONE, side: T.STONE },
  { name: 'Wood', top: T.LOG_TOP, bottom: T.LOG_TOP, side: T.LOG_SIDE },
  { name: 'Leaves', top: T.LEAVES, bottom: T.LEAVES, side: T.LEAVES },
  { name: 'Sand', top: T.SAND, bottom: T.SAND, side: T.SAND },
  { name: 'Water', top: T.WATER, bottom: T.WATER, side: T.WATER, liquid: true },
  { name: 'Planks', top: T.PLANKS, bottom: T.PLANKS, side: T.PLANKS },
  { name: 'Gold', top: T.GOLD, bottom: T.GOLD, side: T.GOLD },
  { name: 'Glass', top: T.GLASS, bottom: T.GLASS, side: T.GLASS, see: true },
  { name: 'Brick', top: T.BRICK, bottom: T.BRICK, side: T.BRICK },
  { name: 'Wool', top: T.WOOL, bottom: T.WOOL, side: T.WOOL },
  { name: 'Snow', top: T.SNOW, bottom: T.SNOW, side: T.SNOW },
  { name: 'Cobblestone', top: T.COBBLE, bottom: T.COBBLE, side: T.COBBLE },
  { name: 'Marble', top: T.MARBLE, bottom: T.MARBLE, side: T.MARBLE },
];

function hash2(x, z, s) { let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 1440662683); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, z, s) { const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf); const a = hash2(xi, zi, s), b = hash2(xi + 1, zi, s), c = hash2(xi, zi + 1, s), d = hash2(xi + 1, zi + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function brookX(z) { return 36 + 3 * Math.sin(z * 0.12); }

// Key places
export const PLACES = {
  spawn: { x: 48.5, z: 53.5 },
  ark: { x0: 56, x1: 66, z0: 34, z1: 40 },          // [x0,x1) x [z0,z1)
  pen: { x0: 4, x1: 14, z0: 88, z1: 94 },            // fence ring on the border cells
  gap: [[14, 90], [14, 91], [14, 92]],                // fence gap cells (2 high)
  sinai: { x: 78, z: 78, r: 21 },
  well: { x: 22, z: 70 },
  inn: { x0: 6, z0: 63, w: 7, d: 6 },
  granary: { x0: 63, z0: 7, w: 5, d: 5 },
};
const FLATS = [
  { x0: 42, x1: 56, z0: 46, z1: 58, h: 13, b: 6 },
  { x0: 50, x1: 70, z0: 30, z1: 44, h: 13, b: 5 },
  { x0: 4, x1: 30, z0: 62, z1: 95, h: 13, b: 5 },
  { x0: 58, x1: 95, z0: 0, z1: 30, h: 13, b: 5 },
];
const inRect = (x, z, r, m = 0) => x >= r.x0 - m && x < r.x1 + m && z >= r.z0 - m && z < r.z1 + m;

export class World {
  constructor() { this.data = new Uint8Array(W * H * D); this.edits = {}; this.heights = new Int16Array(W * D); this.onChange = null; }
  get(x, y, z) { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (y < 0) return B.STONE; if (x < 0 || z < 0 || x >= W || z >= D || y >= H) return B.AIR; return this.data[x + z * W + y * W * D]; }
  raw(x, y, z, b) { if (x < 0 || z < 0 || x >= W || z >= D || y < 0 || y >= H) return; this.data[x + z * W + y * W * D] = b; }
  set(x, y, z, b) {
    if (x < 0 || z < 0 || x >= W || z >= D || y < 1 || y >= H) return false;
    const i = x + z * W + y * W * D; this.data[i] = b; this.edits[i] = b;
    if (this.onChange) this.onChange(x, y, z, b);
    return true;
  }
  solid(x, y, z) { const b = this.get(x, y, z); return b !== B.AIR && b !== B.WATER; }
  top(x, z) { x = Math.floor(x); z = Math.floor(z); for (let y = H - 1; y >= 0; y--) { const b = this.get(x, y, z); if (b !== B.AIR && b !== B.WATER) return y; } return 0; }
  topAny(x, z) { x = Math.floor(x); z = Math.floor(z); for (let y = H - 1; y >= 0; y--) { if (this.get(x, y, z) !== B.AIR) return y; } return 0; }

  heightAt(x, z) {
    let h = 13 + (vnoise(x / 16, z / 16, 1) - 0.5) * 7 + (vnoise(x / 6, z / 6, 2) - 0.5) * 2;
    for (const f of FLATS) { const dx = Math.max(f.x0 - x, 0, x - f.x1), dz = Math.max(f.z0 - z, 0, z - f.z1); const d = Math.hypot(dx, dz); if (d < f.b) { const t = d / f.b; h = f.h + (h - f.h) * t * t; } }
    const dxb = Math.abs(x - brookX(z));
    if (dxb < 5.5) { const t = Math.max(0, (dxb - 2.2) / 3.3); h = Math.min(h, 12 + (Math.max(h, 12) - 12) * t); }
    const r = Math.hypot(x - PLACES.sinai.x, z - PLACES.sinai.z);
    if (r < PLACES.sinai.r) h = Math.max(h, 13 + (PLACES.sinai.r - r) * 1.0);
    return Math.max(4, Math.round(h));
  }

  generate() {
    const R = (() => { let s = 12345; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; })();
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      let h = this.heightAt(x, z);
      const dxb = Math.abs(x + 0.5 - brookX(z + 0.5));
      const r = Math.hypot(x - PLACES.sinai.x, z - PLACES.sinai.z);
      const desert = x >= 58 && z < 30 && r > PLACES.sinai.r;
      const isWater = dxb <= 1.7;
      if (isWater) h = 9;
      let surf = B.GRASS, sub = B.DIRT;
      if (isWater || (dxb < 3.4 && h <= 13) || desert) { surf = B.SAND; sub = B.SAND; }
      if (r < PLACES.sinai.r && h >= 19) { surf = h >= 29 ? B.SNOW : B.STONE; sub = B.STONE; }
      for (let y = 0; y <= h; y++) this.raw(x, y, z, y === h ? surf : (y >= h - 3 ? sub : B.STONE));
      if (isWater) for (let y = h + 1; y <= 11; y++) this.raw(x, y, z, B.WATER);
    }
    this.buildStructures(R);
    this.computeHeights();
  }
  computeHeights() { for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) this.heights[x + z * W] = this.top(x, z); }

  fillBox(x0, y0, z0, x1, y1, z1, b) { for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.raw(x, y, z, b); }

  house(x0, z0, w, d, door) {
    const g = 13, x1 = x0 + w - 1, z1 = z0 + d - 1;
    this.fillBox(x0, g, z0, x1, g, z1, B.PLANKS);
    this.fillBox(x0, g + 1, z0, x1, g + 3, z1, B.PLANKS);
    this.fillBox(x0 + 1, g + 1, z0 + 1, x1 - 1, g + 3, z1 - 1, B.AIR);
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) this.fillBox(cx, g + 1, cz, cx, g + 3, cz, B.LOG);
    this.fillBox(x0 - 1, g + 4, z0 - 1, x1 + 1, g + 4, z1 + 1, B.BRICK);
    this.fillBox(x0 + 1, g + 5, z0 + 1, x1 - 1, g + 5, z1 - 1, B.BRICK);
    const mx = Math.floor((x0 + x1) / 2), mz = Math.floor((z0 + z1) / 2);
    if (door === 'e') this.fillBox(x1, g + 1, mz, x1, g + 2, mz, B.AIR);
    if (door === 's') this.fillBox(mx, g + 1, z1, mx, g + 2, z1, B.AIR);
    if (door === 'n') this.fillBox(mx, g + 1, z0, mx, g + 2, z0, B.AIR);
    if (door !== 'n') this.raw(mx, g + 2, z0, B.GLASS);
    this.raw(x0, g + 2, mz, B.GLASS);
  }

  tree(x, z, R) {
    const g = this.top(x, z); if (this.get(x, g, z) !== B.GRASS) return;
    const th = 4 + (R() * 2 | 0);
    for (let y = 1; y <= th; y++) this.raw(x, g + y, z, B.LOG);
    for (let dy = th - 2; dy <= th + 1; dy++) {
      const rad = dy > th ? 1 : 2;
      for (let dz = -rad; dz <= rad; dz++) for (let dx = -rad; dx <= rad; dx++) {
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && (rad === 2 || dy > th)) continue;
        if (this.get(x + dx, g + dy, z + dz) === B.AIR) this.raw(x + dx, g + dy, z + dz, B.LEAVES);
      }
    }
  }
  palm(x, z) {
    const g = this.top(x, z);
    for (let y = 1; y <= 5; y++) this.raw(x, g + y, z, B.LOG);
    const t = g + 6; this.raw(x, t, z, B.LEAVES);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) this.raw(x + dx, t - (Math.abs(dx) + Math.abs(dz) > 1 ? 1 : 0), z + dz, B.LEAVES);
  }

  buildStructures(R) {
    const g = 13;
    // Road (cobble) from village to spawn, with a bridge over the brook
    for (let x = 24; x <= 49; x++) for (let z = 75; z <= 76; z++) {
      const t = this.top(x, z);
      if (this.get(x, t, z) === B.SAND && Math.abs(x + 0.5 - brookX(z + 0.5)) <= 1.7) { this.raw(x, 12, z, B.PLANKS); }
      else if (Math.abs(x + 0.5 - brookX(z + 0.5)) <= 3.4) { this.fillBox(x, 10, z, x, 12, z, B.PLANKS); this.fillBox(x, 13, z, x, 20, z, B.AIR); }
      else { this.raw(x, t, z, B.COBBLE); }
    }
    for (let z = 57; z <= 76; z++) for (let x = 48; x <= 49; x++) this.raw(x, this.top(x, z), z, B.COBBLE);
    // Village houses
    const inn = PLACES.inn; this.house(inn.x0, inn.z0, inn.w, inn.d, 'e');
    this.house(6, 77, 6, 5, 'e');
    this.house(21, 80, 6, 5, 'n');
    // Well
    const wl = PLACES.well; this.fillBox(wl.x - 1, g + 1, wl.z - 1, wl.x + 1, g + 1, wl.z + 1, B.COBBLE); this.fillBox(wl.x, g - 1, wl.z, wl.x, g + 1, wl.z, B.WATER);
    // Micah's sheep pen: 2-high wooden fence with a gap
    const p = PLACES.pen;
    for (let x = p.x0; x <= p.x1; x++) for (let z = p.z0; z <= p.z1; z++) {
      if (x === p.x0 || x === p.x1 || z === p.z0 || z === p.z1) this.fillBox(x, g + 1, z, x, g + 2, z, B.LOG);
    }
    for (const [x, z] of PLACES.gap) this.fillBox(x, g + 1, z, x, g + 2, z, B.AIR);
    // Noah's lumber pile
    this.fillBox(50, g + 1, 33, 52, g + 1, 34, B.LOG); this.fillBox(50, g + 2, 33, 51, g + 2, 34, B.LOG);
    // Desert: pyramid and brick storehouse
    for (let l = 0; l <= 6; l++) this.fillBox(84 - 6 + l, g + 1 + l, 12 - 6 + l, 84 + 6 - l, g + 1 + l, 12 + 6 - l, l === 6 ? B.GOLD : B.SAND);
    const gr = PLACES.granary; this.fillBox(gr.x0, g, gr.z0, gr.x0 + gr.w - 1, g + 3, gr.z0 + gr.d - 1, B.BRICK);
    this.fillBox(gr.x0 + 1, g + 1, gr.z0 + 1, gr.x0 + gr.w - 2, g + 3, gr.z0 + gr.d - 2, B.AIR);
    this.fillBox(gr.x0 + 2, g + 1, gr.z0 + gr.d - 1, gr.x0 + 2, g + 2, gr.z0 + gr.d - 1, B.AIR);
    this.fillBox(gr.x0 - 1, g + 4, gr.z0 - 1, gr.x0 + gr.w, g + 4, gr.z0 + gr.d, B.SAND);
    for (const [x, z] of [[62, 20], [88, 26], [78, 4], [92, 20]]) this.palm(x, z);
    // Summit platform
    const s = PLACES.sinai, st = this.top(s.x, s.z);
    this.fillBox(s.x - 1, st, s.z - 1, s.x + 1, st, s.z + 1, B.MARBLE);
    // Trees
    const reserved = [...FLATS.slice(0, 3).map(f => ({ ...f })), { x0: 58, x1: 96, z0: 0, z1: 32 }];
    let placed = [];
    for (let i = 0; i < 400 && placed.length < 70; i++) {
      const x = 3 + (R() * (W - 6) | 0), z = 3 + (R() * (D - 6) | 0);
      if (reserved.some(r => inRect(x, z, r, 1))) continue;
      if (Math.abs(x - brookX(z)) < 5) continue;
      if (Math.hypot(x - s.x, z - s.z) < s.r + 1) continue;
      if (z >= 72 && z <= 79) continue;
      if (NPCS.some(n => Math.abs(n.x - x) < 4 && Math.abs(n.z - z) < 4)) continue;
      if (placed.some(([px, pz]) => Math.abs(px - x) < 4 && Math.abs(pz - z) < 4)) continue;
      this.tree(x, z, R); placed.push([x, z]);
    }
  }
}

// ---- Meshing ----
const FACES = [
  { dir: [-1, 0, 0], s: 0.78, c: [[0, 1, 0, 0, 1], [0, 0, 0, 0, 0], [0, 1, 1, 1, 1], [0, 0, 1, 1, 0]] },
  { dir: [1, 0, 0], s: 0.78, c: [[1, 1, 1, 0, 1], [1, 0, 1, 0, 0], [1, 1, 0, 1, 1], [1, 0, 0, 1, 0]] },
  { dir: [0, -1, 0], s: 0.55, c: [[1, 0, 1, 1, 0], [0, 0, 1, 0, 0], [1, 0, 0, 1, 1], [0, 0, 0, 0, 1]] },
  { dir: [0, 1, 0], s: 1.0, c: [[0, 1, 1, 1, 1], [1, 1, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 0, 0, 0]] },
  { dir: [0, 0, -1], s: 0.68, c: [[1, 0, 0, 0, 0], [0, 0, 0, 1, 0], [1, 1, 0, 0, 1], [0, 1, 0, 1, 1]] },
  { dir: [0, 0, 1], s: 0.88, c: [[0, 0, 1, 0, 0], [1, 0, 1, 1, 0], [0, 1, 1, 0, 1], [1, 1, 1, 1, 1]] },
];
const EPS = 0.0015, N = 8;
export function meshChunk(world, cx, cz) {
  const out = { o: { p: [], u: [], c: [], i: [] }, w: { p: [], u: [], c: [], i: [] } };
  const x0 = cx * CS, z0 = cz * CS;
  for (let y = 0; y < H; y++) for (let z = z0; z < z0 + CS; z++) for (let x = x0; x < x0 + CS; x++) {
    const b = world.data[x + z * W + y * W * D]; if (!b) continue;
    const def = BLOCKS[b]; const liquid = !!def.liquid;
    for (let f = 0; f < 6; f++) {
      const F = FACES[f]; const nb = world.get(x + F.dir[0], y + F.dir[1], z + F.dir[2]);
      if (liquid) { if (nb !== B.AIR) continue; }
      else if (nb !== B.AIR && nb !== B.WATER && !(BLOCKS[nb].see && nb !== b)) continue;
      if (y === 0 && f === 2) continue;
      const tile = f === 3 ? def.top : f === 2 ? def.bottom : def.side;
      const tu = tile % N, tv = Math.floor(tile / N);
      const tgt = liquid ? out.w : out.o; const base = tgt.p.length / 3;
      for (const c of F.c) {
        let py = y + c[1]; if (liquid && c[1] === 1 && world.get(x, y + 1, z) === B.AIR) py -= 0.12;
        tgt.p.push(x + c[0], py, z + c[2]);
        const uu = c[3] ? 1 - EPS : EPS, vv = c[4] ? 1 - EPS : EPS;
        tgt.u.push((tu + uu) / N, 1 - (tv + 1 - vv) / N);
        tgt.c.push(F.s, F.s, F.s);
      }
      tgt.i.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    }
  }
  return out;
}

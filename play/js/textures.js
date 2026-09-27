import * as THREE from '../lib/three.module.js';
export const T = { GRASS_TOP:0, GRASS_SIDE:1, DIRT:2, STONE:3, LOG_SIDE:4, LOG_TOP:5, LEAVES:6, SAND:7, WATER:8, PLANKS:9, GOLD:10, GLASS:11, BRICK:12, WOOL:13, SNOW:14, COBBLE:15, MARBLE:16 };
export const ATLAS_N = 8, TILE = 16;

function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function paint(img, t, ox, oy) {
  const r = rng(1000 + t * 77);
  const set = (x, y, c, a = 255) => { const i = ((oy + y) * ATLAS_N * TILE + ox + x) * 4; img[i] = c[0]; img[i+1] = c[1]; img[i+2] = c[2]; img[i+3] = a; };
  const vary = (c, v) => { const k = (r() - 0.5) * v; return [c[0] + k, c[1] + k, c[2] + k].map(n => Math.max(0, Math.min(255, n | 0))); };
  const fill = (c, v) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, vary(c, v)); };
  switch (t) {
    case T.GRASS_TOP: fill([106, 170, 70], 30); break;
    case T.DIRT: fill([134, 96, 67], 28); break;
    case T.GRASS_SIDE: fill([134, 96, 67], 28); for (let x = 0; x < 16; x++) { const d = 3 + (r() * 3 | 0); for (let y = 0; y < d; y++) set(x, y, vary([106, 170, 70], 30)); } break;
    case T.STONE: fill([128, 128, 128], 26); for (let i = 0; i < 10; i++) set(r() * 16 | 0, r() * 16 | 0, [100, 100, 100]); break;
    case T.LOG_SIDE: for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, vary(x % 4 === 0 ? [88, 62, 36] : [112, 82, 50], 16)); break;
    case T.LOG_TOP: for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); set(x, y, vary(d > 6.5 ? [100, 72, 42] : (Math.floor(d) % 2 ? [176, 140, 90] : [160, 124, 76]), 12)); } break;
    case T.LEAVES: for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, vary(r() < 0.18 ? [40, 90, 30] : [62, 138, 48], 34)); break;
    case T.SAND: fill([222, 208, 150], 18); break;
    case T.WATER: for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) set(x, y, vary(((x + y * 2) % 8 < 2) ? [90, 160, 235] : [52, 118, 214], 12), 255); break;
    case T.PLANKS: for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const seam = y % 4 === 3 || (x === ((y >> 2) % 2 ? 4 : 12)); set(x, y, vary(seam ? [120, 88, 52] : [184, 146, 92], 14)); } break;
    case T.GOLD: fill([240, 196, 50], 24); for (let i = 0; i < 12; i++) set(r() * 16 | 0, r() * 16 | 0, [255, 245, 170]); break;
    case T.GLASS: for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15; const shine = (x - y === 3 || x - y === 4) && x > 4 && x < 12; set(x, y, edge ? [200, 230, 240] : [230, 250, 255], edge ? 255 : shine ? 200 : 0); } break;
    case T.BRICK: for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = y >> 2; const mortar = y % 4 === 3 || ((x + (row % 2) * 4) % 8 === 7); set(x, y, vary(mortar ? [200, 196, 186] : [172, 76, 60], 16)); } break;
    case T.WOOL: fill([240, 240, 236], 12); break;
    case T.SNOW: fill([248, 250, 255], 8); break;
    case T.COBBLE: fill([118, 118, 118], 20); for (let i = 0; i < 26; i++) { const x = r() * 16 | 0, y = r() * 16 | 0; set(x, y, [80, 80, 80]); } for (let i = 0; i < 14; i++) set(r() * 16 | 0, r() * 16 | 0, [160, 160, 160]); break;
    case T.MARBLE: fill([226, 222, 212], 10); break;
  }
}

let atlasCanvas = null;
export function makeAtlas() {
  const S = ATLAS_N * TILE;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const ctx = c.getContext('2d');
  const id = ctx.createImageData(S, S);
  for (let t = 0; t <= 16; t++) paint(id.data, t, (t % ATLAS_N) * TILE, Math.floor(t / ATLAS_N) * TILE);
  ctx.putImageData(id, 0, 0);
  atlasCanvas = c;
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Small isometric-ish icon for hotbar
export function blockIcon(top, side) {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const sx = t => (t % ATLAS_N) * TILE, sy = t => Math.floor(t / ATLAS_N) * TILE;
  g.save(); g.setTransform(1, 0.5, -1, 0.5, 24, 2); g.drawImage(atlasCanvas, sx(top), sy(top), 16, 16, 0, 0, 22, 22); g.restore();
  g.save(); g.setTransform(1, 0.5, 0, 1, 2, 13); g.drawImage(atlasCanvas, sx(side), sy(side), 16, 16, 0, 0, 22, 22); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 22, 22); g.restore();
  g.save(); g.setTransform(1, -0.5, 0, 1, 24, 24); g.drawImage(atlasCanvas, sx(side), sy(side), 16, 16, 0, 0, 22, 22); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, 0, 22, 22); g.restore();
  return c.toDataURL();
}

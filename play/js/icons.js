// Blocky picture icons drawn with canvas (no image files). 16x16 grid scaled up.
import { NPCS } from './data.js';
const cache = {};
const FACES = Object.fromEntries(NPCS.map(n => [n.id, n.look]));
FACES.traveler = FACES.samaritan; FACES.priest = { skin: '#dcaa80', robe: '#f2f2f2', sash: '#3b6fb5', wrap: '#f2f2f2', hair: '#333', beard: '#555' };

function draw(g, name) {
  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  if (name.startsWith('face:')) {
    const L = FACES[name.slice(5)] || FACES.ruth;
    R(3, 11, 10, 5, L.robe); R(3, 13, 10, 1, L.sash);
    R(4, 2, 8, 9, L.skin);
    if (L.hair) R(4, 2, 8, 2, L.hair);
    if (L.wrap) { R(3, 1, 10, 3, L.wrap); R(3, 4, 1, 5, L.wrap); R(12, 4, 1, 5, L.wrap); }
    R(5, 5, 2, 2, '#fff'); R(9, 5, 2, 2, '#fff'); R(6, 5, 1, 2, '#222'); R(10, 5, 1, 2, '#222');
    if (L.beard) { R(4, 8, 8, 3, L.beard); R(6, 8, 4, 1, '#9a4a3a'); } else R(6, 8, 4, 1, '#9a4a3a');
    if (L.collar) R(3, 11, 10, 1, L.collar);
    return;
  }
  switch (name) {
    case 'ark': R(0, 13, 16, 3, '#4aa3f0'); R(1, 9, 14, 4, '#8b5a2b'); R(2, 12, 12, 1, '#6b4220'); R(4, 5, 8, 4, '#b07a45'); R(3, 4, 10, 1, '#6b4220'); R(6, 6, 1, 1, '#333'); R(9, 6, 1, 1, '#333'); break;
    case 'sheep': R(2, 5, 10, 6, '#f4f4ee'); R(11, 4, 4, 4, '#3b3b3b'); R(12, 5, 1, 1, '#fff'); R(3, 11, 2, 3, '#3b3b3b'); R(9, 11, 2, 3, '#3b3b3b'); break;
    case 'cow': R(1, 5, 11, 6, '#6b4226'); R(4, 6, 3, 3, '#f2f2f2'); R(11, 3, 4, 5, '#6b4226'); R(12, 7, 3, 2, '#f0b8b0'); R(11, 2, 1, 1, '#eee'); R(14, 2, 1, 1, '#eee'); R(2, 11, 2, 4, '#4a2d1a'); R(9, 11, 2, 4, '#4a2d1a'); break;
    case 'rainbow': ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'].forEach((c, i) => { R(1 + i, 4 + i, 14 - 2 * i, 1, c); R(1 + i, 4 + i, 1, 11 - i, c); R(14 - i, 4 + i, 1, 11 - i, c); }); break;
    case 'dove': R(3, 7, 8, 4, '#fafafa'); R(10, 5, 3, 3, '#fafafa'); R(13, 6, 2, 1, '#f0a040'); R(5, 4, 4, 3, '#e8e8f0'); R(1, 8, 2, 2, '#e0e0e8'); R(11, 6, 1, 1, '#111'); break;
    case 'mountain': for (let i = 0; i < 8; i++) R(8 - i, 3 + i + 2, 2 + i * 2, 1, i < 3 ? '#fafafa' : '#8a8a8a'); R(0, 13, 16, 3, '#6aaa46'); break;
    case 'house': R(2, 7, 12, 8, '#c9955c'); R(1, 5, 14, 2, '#ac4c3c'); R(3, 3, 10, 2, '#ac4c3c'); R(7, 10, 3, 5, '#6b4220'); R(3, 9, 3, 3, '#bfe6f2'); break;
    case 'brook': R(0, 0, 16, 16, '#79c257'); for (let y = 0; y < 16; y++) R(5 + Math.round(2 * Math.sin(y / 3)), y, 6, 1, '#4aa3f0'); R(8, 4, 1, 1, '#bfe6ff'); R(7, 11, 2, 1, '#bfe6ff'); break;
    case 'stones': [[2, 9], [6, 10], [10, 9], [4, 12], [8, 12]].forEach(([x, y]) => { R(x, y, 4, 3, '#a8acb4'); R(x + 1, y, 2, 1, '#d0d4dc'); }); break;
    case 'heart': R(3, 4, 4, 2, '#e25a8a'); R(9, 4, 4, 2, '#e25a8a'); R(2, 5, 12, 4, '#e25a8a'); R(3, 9, 10, 2, '#e25a8a'); R(5, 11, 6, 2, '#e25a8a'); R(7, 13, 2, 1, '#e25a8a'); R(4, 5, 2, 1, '#f7a8c4'); break;
    case 'tablets': R(1, 3, 6, 11, '#dcd6c6'); R(9, 3, 6, 11, '#dcd6c6'); R(1, 2, 6, 2, '#cfc8b6'); R(9, 2, 6, 2, '#cfc8b6'); for (let y = 5; y < 13; y += 2) { R(2, y, 4, 1, '#8a8272'); R(10, y, 4, 1, '#8a8272'); } break;
    case 'road': R(0, 0, 16, 16, '#79c257'); R(0, 6, 16, 5, '#9a9a9a'); R(1, 8, 3, 1, '#ddd'); R(7, 8, 3, 1, '#ddd'); R(13, 8, 3, 1, '#ddd'); break;
    case 'jar': R(4, 5, 8, 9, '#b5653a'); R(5, 3, 6, 2, '#b5653a'); R(5, 2, 6, 1, '#4aa3f0'); R(5, 8, 6, 1, '#8a4a2a'); break;
    case 'bandage': R(2, 6, 12, 5, '#fbfbf6'); R(2, 6, 12, 1, '#ddd'); R(7, 5, 2, 7, '#e25a5a'); R(5, 8, 6, 1, '#e25a5a'); break;
    case 'bread': R(2, 7, 12, 6, '#d69a4a'); R(3, 6, 10, 1, '#d69a4a'); R(4, 7, 1, 3, '#a0612a'); R(7, 7, 1, 3, '#a0612a'); R(10, 7, 1, 3, '#a0612a'); break;
    case 'fish': R(3, 6, 8, 5, '#6aa8d8'); R(11, 5, 3, 7, '#4a88b8'); R(4, 7, 1, 1, '#111'); R(6, 8, 3, 1, '#4a88b8'); break;
    case 'basket': R(2, 8, 12, 6, '#b07a45'); R(2, 9, 12, 1, '#8b5a2b'); R(2, 12, 12, 1, '#8b5a2b'); R(3, 6, 10, 2, '#d69a4a'); R(3, 3, 1, 5, '#8b5a2b'); R(12, 3, 1, 5, '#8b5a2b'); R(3, 3, 10, 1, '#8b5a2b'); break;
    case 'crowd': [[1, '#c77d3a'], [6, '#5a7fa8'], [11, '#4f8f4f']].forEach(([x, c], i) => { R(x, 4 + (i % 2), 4, 4, '#d8a47a'); R(x, 8 + (i % 2), 4, 7, c); R(x + 1, 5 + (i % 2), 1, 1, '#222'); R(x + 3, 5 + (i % 2), 1, 1, '#222'); }); break;
    case 'desert': R(0, 0, 16, 16, '#bfe3ff'); R(0, 11, 16, 5, '#e3d08e'); for (let i = 0; i < 5; i++) R(4 + i, 5 + i, 8 - 2 * i > 0 ? 1 : 1, 1, '#d8c070'); for (let i = 0; i < 6; i++) R(7 - i, 5 + i, 2 + 2 * i, 1, '#d8c070'); R(13, 2, 2, 2, '#ffd84a'); break;
    case 'grain': R(4, 5, 8, 10, '#d8b86a'); R(5, 3, 6, 2, '#c2a255'); R(5, 5, 6, 1, '#8b5a2b'); R(6, 9, 4, 1, '#c2a255'); break;
    case 'hug': R(2, 3, 5, 5, '#c98f5e'); R(9, 3, 5, 5, '#d8a57a'); R(2, 3, 5, 1, '#2c1c10'); R(9, 3, 5, 1, '#4b3020'); R(1, 8, 7, 7, '#f4f1e6'); R(8, 8, 7, 7, '#8a5a6a'); R(5, 9, 6, 2, '#c98f5e'); break;
    case 'fence': R(0, 13, 16, 3, '#6aaa46'); for (const x of [1, 6, 11]) R(x, 4, 3, 10, '#8b5a2b'); R(0, 6, 16, 2, '#b07a45'); R(0, 10, 16, 2, '#b07a45'); R(12, 4, 4, 9, '#79c257'); break;
    case 'crown': R(2, 6, 12, 7, '#f0c030'); R(2, 3, 2, 3, '#f0c030'); R(7, 2, 2, 4, '#f0c030'); R(12, 3, 2, 3, '#f0c030'); R(4, 8, 2, 2, '#e53935'); R(10, 8, 2, 2, '#1e88e5'); break;
    case 'dog': R(2, 7, 10, 5, '#b07a45'); R(10, 4, 5, 5, '#b07a45'); R(10, 3, 2, 3, '#6b4220'); R(14, 6, 1, 1, '#111'); R(12, 5, 1, 1, '#111'); R(3, 12, 2, 3, '#8b5a2b'); R(9, 12, 2, 3, '#8b5a2b'); R(0, 6, 2, 2, '#b07a45'); break;
    case 'bed': R(1, 4, 2, 11, '#8b5a2b'); R(13, 8, 2, 7, '#8b5a2b'); R(3, 9, 10, 3, '#4a90d9'); R(3, 8, 3, 2, '#fff'); R(3, 12, 10, 1, '#6b4220'); break;
    case 'bug': R(4, 6, 8, 7, '#43a047'); R(7, 6, 1, 7, '#2e7d32'); R(6, 3, 4, 3, '#333'); R(5, 2, 1, 1, '#333'); R(10, 2, 1, 1, '#333'); R(2, 8, 2, 1, '#333'); R(12, 8, 2, 1, '#333'); R(2, 11, 2, 1, '#333'); R(12, 11, 2, 1, '#333'); break;
    case 'duck': R(3, 8, 9, 5, '#fdd835'); R(9, 4, 5, 5, '#fdd835'); R(14, 6, 2, 2, '#fb8c00'); R(11, 5, 1, 1, '#111'); R(4, 9, 4, 2, '#f0c030'); break;
    case 'book': R(2, 3, 12, 11, '#b33b3b'); R(3, 4, 10, 9, '#f4f1e6'); R(7, 4, 2, 9, '#b33b3b'); R(4, 6, 2, 1, '#999'); R(10, 6, 2, 1, '#999'); R(4, 8, 2, 1, '#999'); R(10, 8, 2, 1, '#999'); break;
    case 'drum': R(3, 5, 10, 8, '#e53935'); R(3, 4, 10, 2, '#f4f1e6'); R(3, 12, 10, 1, '#f4f1e6'); R(5, 6, 1, 6, '#fdd835'); R(10, 6, 1, 6, '#fdd835'); R(1, 1, 1, 5, '#8b5a2b'); R(14, 1, 1, 5, '#8b5a2b'); break;
    case 'door': R(4, 1, 8, 14, '#8b5a2b'); R(5, 2, 6, 5, '#b07a45'); R(5, 8, 6, 6, '#b07a45'); R(10, 8, 1, 1, '#f0c030'); break;
    case 'tree': R(7, 9, 2, 6, '#6b4220'); R(3, 2, 10, 8, '#43a047'); R(5, 1, 6, 1, '#43a047'); break;
    default: R(4, 4, 8, 8, '#ccc');
  }
}
export function iconURL(name) {
  if (cache[name]) return cache[name];
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
  g.scale(6, 6); draw(g, name); cache[name] = c.toDataURL(); return cache[name];
}
// A "scene" picture: a few icons on a sky/grass background
export function sceneEl(names) {
  const d = document.createElement('div'); d.className = 'scene';
  for (const n of names) { const i = document.createElement('img'); i.src = iconURL(n); i.alt = ''; d.appendChild(i); }
  return d;
}

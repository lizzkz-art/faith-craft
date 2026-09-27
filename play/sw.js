// Faith Craft service worker: caches every file (including the voice recordings) so the game works fully offline.
const VERSION = 'v3-pages-p1-db0b1405bd';
const CACHE = 'faithcraft-' + VERSION;
const AUDIO_CACHE = 'faithcraft-audio'; // voice clips are named by content, so they survive updates
const ASSETS = [
  './', './index.html', './manifest.json', './css/style.css',
  './js/game.js', './js/ui.js', './js/data.js', './js/stories.js', './js/phonics.js', './js/icons.js', './js/readaloud.js', './js/intent.js',
  './js/world.js', './js/textures.js', './js/entities.js', './js/audio.js', './js/music.js', './js/speech.js', './js/save.js',
  './lib/three.module.js', './audio/index.json', './audio/silence.mp3',
  './fonts/lexend-latin-400-normal.woff2', './fonts/lexend-latin-700-normal.woff2', './fonts/opendyslexic-latin-400-normal.woff2', './fonts/opendyslexic-latin-700-normal.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
];
async function cacheAudio() { await cacheAudioOnce(); await cacheAudioOnce(); }
async function cacheAudioOnce() {
  const idx = await (await fetch('./audio/index.json', { cache: 'no-cache' })).json();
  const ids = Object.keys(idx.clips || {}); const c = await caches.open(AUDIO_CACHE);
  const have = new Set((await c.keys()).map(r => new URL(r.url).pathname.split('/').pop().replace('.mp3', '')));
  const want = new Set(ids);
  for (const r of await c.keys()) { const id = new URL(r.url).pathname.split('/').pop().replace('.mp3', ''); if (!want.has(id)) c.delete(r); }
  const todo = ids.filter(id => !have.has(id));
  for (let i = 0; i < todo.length; i += 24) {
    await Promise.all(todo.slice(i, i + 24).map(id => fetch('./audio/c/' + id + '.mp3').then(r => r.ok ? c.put('./audio/c/' + id + '.mp3', r) : null).catch(() => null)));
  }
}
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => cacheAudio().catch(() => null)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('faithcraft-') && k !== CACHE && k !== AUDIO_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Safari asks for audio in byte ranges; answer from the cache with a 206 partial response
async function rangeResponse(req, res) {
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || ''); if (!m) return res;
  const buf = await res.arrayBuffer(); const size = buf.byteLength;
  let start = m[1] === '' ? size - Number(m[2]) : Number(m[1]); let end = m[1] !== '' && m[2] !== '' ? Number(m[2]) : size - 1;
  start = Math.max(0, start); end = Math.min(size - 1, end);
  return new Response(buf.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers: { 'Content-Type': res.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' } });
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const isAudio = url.pathname.includes('/audio/c/');
  e.respondWith((async () => {
    const hit = await caches.match(isAudio ? url.pathname.replace(/^.*\/audio\//, './audio/') : req, { ignoreSearch: true }) || await caches.match(req, { ignoreSearch: true });
    if (hit) return req.headers.get('range') ? rangeResponse(req, hit) : hit;
    try {
      const res = await fetch(isAudio ? new Request(req.url) : req);
      if (res.ok && res.status === 200) { const copy = res.clone(); caches.open(isAudio ? AUDIO_CACHE : CACHE).then(c => c.put(isAudio ? './audio/c/' + url.pathname.split('/').pop() : req, copy)); }
      return req.headers.get('range') && res.status === 200 ? rangeResponse(req, res.clone()) : res;
    } catch (err) {
      return req.mode === 'navigate' ? ((await caches.match('./index.html')) || (await caches.match('./')) || Response.error()) : Response.error();
    }
  })());
});

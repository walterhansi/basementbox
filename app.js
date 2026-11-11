/* Basement Box – App-Logik
   Am PC: Übungen aus Obsidian holen, Musik laden, Workouts zusammenstellen, Senden.
   Am Handy/Chromebook: Holen und Workout in Echtzeit abspielen (auch ohne Internet).
   Daten: IndexedDB „basementbox“ (eigene Ablage, fitlog wird nicht berührt).
   Aufbau: 1 Grundlagen · 2 Speicher · 3 Obsidian · 4 Musik · 5 Workouts · 6 Spieler
           7 Abgleich über GitHub · 8 Ansichten · 9 Aktionen · 10 Start */
'use strict';

/* ================= 1 Grundlagen ================= */
const APP_VERSION = '1.5.1';
const ICONS = {
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h4v16H7zM14 4h4v16h-4z',
  next: 'M5 5l10 7-10 7zM19 5v14',
  prev: 'M19 5L9 12l10 7zM5 5v14',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  sync: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  upload: 'M12 15V3M7 8l5-5 5 5M5 21h14',
  text: 'M4 6h16M4 12h10M4 18h13',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  image: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  full: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  note: 'M9 18V5l11-2v13',
  mute: 'M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6',
  speaker: 'M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13'
};
function ic(name, cls = '') { return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`; }
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function uid() { return (crypto.randomUUID && crypto.randomUUID()) || Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function num(v) { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; }
function pad(n) { return String(n).padStart(2, '0'); }
function mmss(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + pad(sec % 60); }
function durText(sec) { sec = Math.round(sec); const m = Math.floor(sec / 60), s = sec % 60; return m ? `${m} min${s ? ' ' + s + ' s' : ''}` : `${s} s`; }
function fmtDate(ts) { return new Date(ts).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'; }
function norm(s) { return String(s || '').normalize('NFC').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, ''); }
const nfc = (s) => String(s).normalize('NFC');
function isPC() { return !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent); }
// Übungs-ID aus Obsidian: „UE-0002“, „0002“, „2“ → „2“ (gleiche Regel wie in fitlog)
function obsNorm(v) {
  let s = String(v ?? '').trim().replace(/^UE[\s_-]*/i, '');
  if (/^\d+$/.test(s)) s = String(parseInt(s, 10));
  return s;
}
function idSort(a, b) {
  const x = /^\d+$/.test(a) ? +a : Infinity, y = /^\d+$/.test(b) ? +b : Infinity;
  return x !== y ? (x < y ? -1 : 1) : String(a).localeCompare(String(b), 'de');
}
async function sha256hex(blob) {
  const buf = await blob.arrayBuffer();
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ================= 2 Speicher (IndexedDB) ================= */
let idbConn = null;
function idbOpen() {
  if (idbConn) return Promise.resolve(idbConn);
  return new Promise((res, rej) => {
    const r = indexedDB.open('basementbox', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('media'); };
    r.onsuccess = () => { idbConn = r.result; res(idbConn); };
    r.onerror = () => rej(r.error);
  });
}
async function idbReq(store, mode, fn) {
  const d = await idbOpen();
  return new Promise((res, rej) => {
    const tx = d.transaction(store, mode);
    const rq = fn(tx.objectStore(store));
    tx.oncomplete = () => res(rq ? rq.result : undefined);
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error || new Error('Speichern abgebrochen'));
  });
}
const idbGet = (s, k) => idbReq(s, 'readonly', (o) => o.get(k));
const idbPut = (s, k, v) => idbReq(s, 'readwrite', (o) => o.put(v, k));
const idbDel = (s, k) => idbReq(s, 'readwrite', (o) => o.delete(k));
const idbKeys = (s) => idbReq(s, 'readonly', (o) => o.getAllKeys());

function freshData() { return { app: 'basementbox', schema: 1, exercises: {}, sounds: {}, workouts: [], deleted: {}, updatedAt: 0, dirty: false }; }
let S = freshData();
async function loadData() {
  try { const d = await idbGet('kv', 'data'); if (d && d.app === 'basementbox') S = Object.assign(freshData(), d); } catch (e) { toast('Gerätespeicher nicht lesbar: ' + e.message, { error: true, timeout: 10000 }); }
}
async function save(changed = true) {
  if (changed) { S.updatedAt = Date.now(); S.dirty = true; }
  try { await idbPut('kv', 'data', S); return true; } catch (e) { toast('Speichern fehlgeschlagen: ' + e.message, { error: true, timeout: 10000 }); return false; }
}
// Bilder und MP3s: Schlüssel „img_<ID>_<prüfsumme>.jpg“ bzw. „snd_<prüfsumme>.mp3“
const mediaUrls = new Map();
let mediaKeysHere = new Set(); // welche Dateien auf diesem Gerät liegen
async function mediaUrl(key) {
  if (!key) return null;
  if (mediaUrls.has(key)) return mediaUrls.get(key);
  const b = await idbGet('media', key);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  mediaUrls.set(key, u);
  return u;
}
// Welche Dateien dieses Gerät braucht. Am PC die ganze Musik-Sammlung, auf Handy/Chromebook nur Stücke aus Workouts.
function usedSoundIds(data = S) {
  const ids = new Set();
  for (const w of data.workouts || []) for (const b of w.blocks) for (const it of b.items) { if (it.sound) ids.add(it.sound); if (it.restSound) ids.add(it.restSound); }
  return ids;
}
function referencedMedia(data = S, all = isPC()) {
  const keys = new Set();
  for (const ex of Object.values(data.exercises || {})) if (ex.img) keys.add(ex.img);
  const used = usedSoundIds(data);
  for (const sd of Object.values(data.sounds || {})) if (sd.media && (all || used.has(sd.id))) keys.add(sd.media);
  return keys;
}
async function mediaCleanup() {
  const ref = referencedMedia();
  const keys = await idbKeys('media');
  mediaKeysHere = new Set(keys.filter((k) => ref.has(k)));
  for (const k of keys) if (!ref.has(k)) { await idbDel('media', k); if (mediaUrls.has(k)) { URL.revokeObjectURL(mediaUrls.get(k)); mediaUrls.delete(k); } }
}
// Nach dem Rendern: Bilder mit data-media nachladen
async function hydrate(root = document) {
  for (const el of $$('[data-media]', root)) {
    const u = await mediaUrl(el.dataset.media);
    if (u && el.getAttribute('src') !== u) el.src = u;
  }
}

/* ================= 3 Übungen aus Obsidian (am PC) ================= */
// Gelesen wird nur, in Obsidian wird nichts geändert. Häkchen „Übungsauswahl“ (wie fitlog), Erkennung über die ID.
const OBS_TICK_KEYS = ['uebungsauswahl', 'ubungsauswahl', 'fitlogauswahl'];
function obsTick(fm) { return Object.keys(fm).some((k) => OBS_TICK_KEYS.includes(norm(k)) && fm[k] === true); }
function obsScalar(v) {
  v = String(v).trim();
  if (v === '') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v.startsWith('"') && v.endsWith('"')) { try { return JSON.parse(v); } catch (e) { return v.slice(1, -1); } }
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  return v;
}
function obsParse(text) {
  text = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) return [{}, text];
  const end = text.indexOf('\n---', 3);
  if (end < 0) return [{}, text];
  const fm = {};
  let cur = null;
  for (const line of text.slice(4, end).split('\n')) {
    const m = line.match(/^([^\s:#][^:]*):\s*(.*)$/);
    if (m && !line.startsWith(' ')) {
      cur = m[1].trim();
      const v = m[2].trim();
      if (v === '[]') fm[cur] = [];
      else if (v.startsWith('[') && v.endsWith(']')) fm[cur] = v.slice(1, -1).split(',').map(obsScalar).filter((x) => x != null && x !== '');
      else fm[cur] = obsScalar(v);
      continue;
    }
    const li = line.match(/^\s+-\s+(.*)$/);
    if (li && cur) { if (!Array.isArray(fm[cur])) fm[cur] = []; const val = obsScalar(li[1]); if (val != null && val !== '') fm[cur].push(val); }
  }
  const after = text.indexOf('\n', end + 4);
  return [fm, after < 0 ? '' : text.slice(after + 1)];
}
function obsSections(body) {
  const out = {}; let name = '_', buf = [];
  for (const line of body.split('\n')) { const m = line.match(/^## +(.+)$/); if (m) { out[name] = buf.join('\n'); name = m[1].trim(); buf = []; } else buf.push(line); }
  out[name] = buf.join('\n');
  return out;
}
function obsSec(secs, re) { const k = Object.keys(secs).find((n) => re.test(n)); return k ? secs[k] : ''; }
function obsClean(s) {
  return String(s || '')
    .replace(/!\[[^\]]*\]\((?:[^()\s]|\([^()]*\))*\)/g, '').replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, '$1').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/^>\s?/gm, '').replace(/[ \t]+/g, ' ')
    .split('\n').map((l) => l.trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function obsText(sec) {
  sec = String(sec || '').split('\n').filter((l) => !/^\s*(\||###)/.test(l)).join('\n');
  if (!/^\s*(?:\d+[.)]|[-*+])\s+/m.test(sec)) return obsClean(sec);
  const parts = [];
  for (const line of sec.split('\n')) {
    const m = line.match(/^\s*(\d+[.)]|[-*+])\s+(.*)$/);
    const txt = obsClean(m ? m[2] : line);
    if (!txt) continue;
    parts.push(m ? (/\d/.test(m[1]) ? m[1].replace(')', '.') + ' ' : '• ') + txt : txt);
  }
  return parts.join('\n');
}
// Kurze Ausführungshinweise für den Spieler: Abschnitt „Ausführung“, sonst „Kurzbeschreibung“
function obsCue(secs) { return obsText(obsSec(secs, /^Ausführung/i)) || obsText(obsSec(secs, /^Kurzbeschreibung/i)); }
const OBS_IMG_RE = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;
function obsImgRef(secs, body) {
  const find = (text) => {
    text = String(text || ''); const found = [];
    for (const m of text.matchAll(/!\[[^\]]*\]\(((?:[^()\s]|\([^()]*\))+)\)/g)) {
      let p = m[1].split('|')[0];
      if (/^https?:/i.test(p)) continue;
      try { p = decodeURIComponent(p); } catch (e) { /* bleibt */ }
      found.push([m.index, p.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '')]);
    }
    for (const m of text.matchAll(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)) { const p = m[1].split('#')[0]; found.push([m.index, p.includes('/') ? p : 'Medien/' + p]); }
    found.sort((x, y) => x[0] - y[0]);
    const hit = found.find(([, p]) => OBS_IMG_RE.test(p));
    return hit ? hit[1] : null;
  };
  return find(obsSec(secs, /^Bilder/i)) || find(body);
}
async function obsChild(dir, name, kind) { for await (const [n, h] of dir.entries()) if (h.kind === kind && nfc(n) === nfc(name)) return h; return null; }
async function obsFile(root, path) {
  const parts = path.split('/').filter(Boolean); let dir = root;
  for (let i = 0; i < parts.length - 1; i++) { dir = await obsChild(dir, parts[i], 'directory'); if (!dir) return null; }
  const fh = await obsChild(dir, parts[parts.length - 1], 'file');
  return fh ? fh.getFile() : null;
}
function obsTreeFromFiles(files) {
  const mk = (name) => ({ kind: 'directory', name, kids: new Map(), async *entries() { yield* this.kids; } });
  const root = mk('');
  for (const f of files) {
    const parts = nfc(f.webkitRelativePath || f.name).split('/').slice(1);
    if (!parts.length || parts.some((p) => p.startsWith('.'))) continue;
    let d = root;
    for (let i = 0; i < parts.length - 1; i++) { if (!d.kids.has(parts[i])) d.kids.set(parts[i], mk(parts[i])); d = d.kids.get(parts[i]); }
    d.kids.set(parts[parts.length - 1], { kind: 'file', name: parts[parts.length - 1], getFile: async () => f });
  }
  return root;
}
// Bild verkleinern (längste Seite 1400 px), weißer Hintergrund wie im Buch
function downscale(blob, max = 1400) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob); const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => b ? resolve(b) : reject(new Error('Bild nicht lesbar')), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild nicht lesbar')); };
    img.src = url;
  });
}
async function obsStart() {
  if (typeof window.showDirectoryPicker !== 'function') {
    openModal(`${modalHead('Obsidian-Ordner wählen')}
      <p class="small">Im nächsten Fenster den Ordner <b>master exercise db obsidian</b> anklicken und <b>Hochladen</b> bzw. <b>Ordner auswählen</b> drücken.</p>
      <div class="callout">Der Browser spricht von „hochladen“. Die Dateien bleiben aber auf deinem PC, Basement Box liest sie nur.</div>
      <div class="modal-foot"><button class="btn ghost" data-a="modal-close">Abbrechen</button>
      <label class="btn">${ic('download')}Ordner wählen<input type="file" webkitdirectory multiple hidden data-c="obs-dir"></label></div>`);
    return;
  }
  let root;
  try { root = await window.showDirectoryPicker({ id: 'bbx-obsidian', mode: 'read' }); } catch (e) { if (e && e.name !== 'AbortError') toast('Ordner konnte nicht geöffnet werden.', { error: true }); return; }
  obsRun(root);
}
async function obsRun(root) {
  openModal(`${modalHead('Übungen aus Obsidian holen')}<p class="muted" id="obsBusy">Lese Übungen …</p>`);
  try {
    const dir = await obsChild(root, 'Übungen', 'directory');
    if (!dir) { closeModal(); toast('Im gewählten Ordner fehlt der Unterordner „Übungen“. Bitte den Ordner „master exercise db obsidian“ wählen.', { error: true, timeout: 9000 }); return; }
    ui.obs = await obsPlan(root, dir);
    openModal(obsPreviewHtml(), { wide: true });
  } catch (e) { closeModal(); toast('Lesen fehlgeschlagen: ' + (e && e.message ? e.message : e), { error: true, timeout: 9000 }); }
}
async function obsPlan(root, dir) {
  const P = { add: [], upd: [], warn: [], skip: [], read: 0, keepNoTick: 0 };
  const notes = [];
  for await (const [fname, h] of dir.entries()) if (h.kind === 'file' && /\.md$/i.test(fname)) notes.push([nfc(fname), h]);
  notes.sort((a, b) => a[0].localeCompare(b[0], 'de'));
  const seen = new Map();
  for (const [fname, h] of notes) {
    const [fm, body] = obsParse(await (await h.getFile()).text());
    P.read++;
    if (P.read % 50 === 0) { const b = $('#obsBusy'); if (b) b.textContent = `Lese Übungen … ${P.read}`; }
    const id = obsNorm(fm.id);
    const tick = obsTick(fm);
    const have = id && S.exercises[id];
    if (!have && !tick) continue;
    const name = String(fm.name || fname.replace(/\.md$/i, '')).trim();
    const label = `${name}${id ? ' (ID ' + id + ')' : ''}`;
    if (!id) { P.skip.push(`${label}: keine ID in Obsidian`); continue; }
    if (!have && S.deleted && S.deleted[id]) { P.skip.push(`${label}: in Basement Box gelöscht – kommt erst wieder, wenn du sie unter „Gelöschte Übungen“ zurückholst`); continue; }
    if (seen.has(id)) { P.warn.push(`ID ${id} kommt doppelt vor („${seen.get(id)}“ und „${name}“) – zweite Notiz übersprungen`); continue; }
    seen.set(id, name);
    if (have && !tick) P.keepNoTick++;
    const secs = obsSections(body);
    const cue = obsCue(secs);
    const ref = obsImgRef(secs, body);
    let file = null;
    if (ref) { try { file = await obsFile(root, ref); } catch (e) { file = null; } }
    if (ref && !file) P.warn.push(`${label}: Bild „${ref}“ nicht gefunden`);
    const sig = file ? `${ref}|${file.size}|${file.lastModified}` : '';
    const x = { id, name, cue, sig, file };
    if (!have) { P.add.push(x); continue; }
    const what = [];
    if (have.name !== name) what.push('Name');
    if ((have.cue || '') !== cue) what.push('Hinweise');
    if ((have.imgSig || '') !== sig) what.push(sig ? 'Bild' : 'Bild entfernt');
    if (what.length) { x.what = what; P.upd.push(x); }
  }
  return P;
}
function obsPreviewHtml() {
  const P = ui.obs;
  const list = (items) => `<ul class="list-plain">${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
  const nothing = !P.add.length && !P.upd.length;
  let h = modalHead('Übungen aus Obsidian – Vorschau');
  h += `<p class="small muted">${P.read} Notizen gelesen. In Obsidian wird nichts geändert.</p>`;
  if (P.add.length) h += `<div class="section-title">Neu (${P.add.length})</div>${list(P.add.map((a) => `<b>ID ${esc(a.id)}</b> ${esc(a.name)}${a.file ? '' : ' <span class="faint">(ohne Bild)</span>'}`))}`;
  if (P.upd.length) h += `<div class="section-title">Aktualisiert (${P.upd.length})</div>${list(P.upd.map((u) => `<b>ID ${esc(u.id)}</b> ${esc(u.name)}: <span class="faint">${u.what.join(', ')}</span>`))}`;
  if (P.warn.length) h += `<div class="section-title">Hinweise (${P.warn.length})</div>${list(P.warn.map(esc))}`;
  if (P.skip.length) h += `<div class="section-title">Nicht übernommen (${P.skip.length})</div>${list(P.skip.map(esc))}`;
  if (P.keepNoTick) h += `<p class="hint">${P.keepNoTick} Übung(en) haben in Obsidian kein Häkchen „Übungsauswahl“ mehr, sind aber schon in Basement Box. Sie bleiben und werden weiter aktualisiert.</p>`;
  if (nothing) h += '<div class="callout">Nichts Neues – Basement Box ist auf dem Stand von Obsidian.</div>';
  h += `<div class="progress" id="obsProg" hidden><div></div></div>
    <div class="modal-foot"><button class="btn ghost" data-a="modal-close">${nothing ? 'Schließen' : 'Abbrechen'}</button>${nothing ? '' : '<button class="btn" data-a="obs-apply" id="obsApply">Übernehmen</button>'}</div>`;
  return h;
}
async function obsApply() {
  const P = ui.obs; if (!P) return;
  const btn = $('#obsApply'); if (btn) btn.disabled = true;
  const prog = $('#obsProg'); if (prog) prog.hidden = false;
  const all = [...P.add, ...P.upd];
  let i = 0;
  const now = Date.now();
  for (const x of all) {
    i++;
    if (prog) prog.firstElementChild.style.width = Math.round(i / all.length * 100) + '%';
    const ex = S.exercises[x.id] || { id: x.id, createdAt: now };
    ex.name = x.name; ex.cue = x.cue; ex.updatedAt = now;
    if ((ex.imgSig || '') !== x.sig) {
      ex.img = null; ex.imgSig = '';
      if (x.file) {
        try {
          const b = await downscale(x.file);
          const key = `img_${x.id}_${(await sha256hex(b)).slice(0, 16)}.jpg`;
          await idbPut('media', key, b);
          ex.img = key; ex.imgSig = x.sig;
        } catch (e) { P.warn.push(`ID ${x.id}: Bild nicht lesbar`); }
      }
    }
    S.exercises[x.id] = ex;
  }
  await save();
  await mediaCleanup();
  closeModal(); render();
  toast(`Übernommen: ${P.add.length} neu, ${P.upd.length} aktualisiert. Danach unter „Daten“ senden.`, { timeout: 7000 });
}
function exUsedIn(id) { return S.workouts.filter((w) => w.blocks.some((b) => b.items.some((it) => it.t === 'ex' && it.exId === id))); }

/* ================= 4 Musik ================= */
// Musik sparsam speichern: Mono, Opus 48 kbit/s, höchstens 3 Minuten (ein Stück wiederholt sich ohnehin, wenn es zu kurz ist).
const SND_MAX_SEC = 180, SND_RATE = 48000, SND_BITRATE = 48000, OPUS_PRESKIP = 312;
function canShrink() { return typeof window.AudioEncoder === 'function' && typeof window.OfflineAudioContext === 'function'; }
async function decodeMono(blob) {
  const buf = await blob.arrayBuffer();
  const tmp = new OfflineAudioContext(1, SND_RATE, SND_RATE);
  const decoded = await tmp.decodeAudioData(buf);
  const len = Math.min(decoded.duration, SND_MAX_SEC);
  const n = Math.max(1, Math.round(len * SND_RATE));
  const ctx = new OfflineAudioContext(1, n, SND_RATE);
  const src = ctx.createBufferSource(); src.buffer = decoded;
  // Am Ende des Ausschnitts kurz ausblenden, damit die Schleife nicht knackt
  const g = ctx.createGain(); const fade = Math.min(1.5, len / 4);
  g.gain.setValueAtTime(1, Math.max(0, len - fade)); g.gain.linearRampToValueAtTime(0, len);
  src.connect(g).connect(ctx.destination); src.start(0);
  const out = await ctx.startRendering();
  return { pcm: out.getChannelData(0), dur: len };
}
async function encodeOpus(pcm) {
  const packets = [];
  let err = null;
  const enc = new AudioEncoder({ output: (chunk) => { const d = new Uint8Array(chunk.byteLength); chunk.copyTo(d); packets.push(d); }, error: (e) => { err = e; } });
  enc.configure({ codec: 'opus', sampleRate: SND_RATE, numberOfChannels: 1, bitrate: SND_BITRATE });
  const FR = 960; // 20 ms
  for (let i = 0; i < pcm.length; i += FR) {
    const frame = new Float32Array(FR); frame.set(pcm.subarray(i, i + FR));
    enc.encode(new AudioData({ format: 'f32-planar', sampleRate: SND_RATE, numberOfFrames: FR, numberOfChannels: 1, timestamp: Math.round(i / SND_RATE * 1e6), data: frame }));
  }
  await enc.flush(); enc.close();
  if (err) throw err;
  return oggOpus(packets, pcm.length);
}
// Ogg-Hülle für Opus (RFC 7845)
const OGG_CRC = (() => { const t = new Uint32Array(256); for (let i = 0; i < 256; i++) { let r = i << 24; for (let j = 0; j < 8; j++) r = r & 0x80000000 ? (r << 1) ^ 0x04c11db7 : r << 1; t[i] = r >>> 0; } return t; })();
function oggOpus(packets, samples) {
  const serial = (Math.random() * 0xffffffff) >>> 0;
  const pages = []; let seq = 0;
  const page = (segs, granule, flags) => {
    const lacing = [], body = [];
    for (const p of segs) { let n = p.length; while (n >= 255) { lacing.push(255); n -= 255; } lacing.push(n); body.push(p); }
    const blen = body.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(27 + lacing.length + blen); const dv = new DataView(out.buffer);
    out.set([0x4f, 0x67, 0x67, 0x53], 0); out[4] = 0; out[5] = flags;
    dv.setUint32(6, Number(BigInt.asUintN(64, BigInt(granule)) & 0xffffffffn), true); dv.setUint32(10, Number(BigInt.asUintN(64, BigInt(granule)) >> 32n), true);
    dv.setUint32(14, serial, true); dv.setUint32(18, seq++, true); out[26] = lacing.length; out.set(lacing, 27);
    let o = 27 + lacing.length; for (const b of body) { out.set(b, o); o += b.length; }
    let crc = 0; for (let i = 0; i < out.length; i++) crc = ((crc << 8) ^ OGG_CRC[((crc >>> 24) ^ out[i]) & 0xff]) >>> 0;
    dv.setUint32(22, crc, true); pages.push(out);
  };
  const head = new Uint8Array(19); const hv = new DataView(head.buffer);
  head.set([...'OpusHead'].map((c) => c.charCodeAt(0)), 0); head[8] = 1; head[9] = 1; hv.setUint16(10, OPUS_PRESKIP, true); hv.setUint32(12, SND_RATE, true);
  page([head], 0, 2);
  const vendor = new TextEncoder().encode('Basement Box'); const tags = new Uint8Array(8 + 4 + vendor.length + 4); const tv = new DataView(tags.buffer);
  tags.set([...'OpusTags'].map((c) => c.charCodeAt(0)), 0); tv.setUint32(8, vendor.length, true); tags.set(vendor, 12); tv.setUint32(12 + vendor.length, 0, true);
  page([tags], 0, 0);
  let cur = [], segs = 0, size = 0, gran = OPUS_PRESKIP;
  const total = OPUS_PRESKIP + samples;
  packets.forEach((p, i) => {
    const need = Math.floor(p.length / 255) + 1;
    if (cur.length && (segs + need > 255 || size + p.length > 4000)) { page(cur, Math.min(gran, total), 0); cur = []; segs = 0; size = 0; }
    cur.push(p); segs += need; size += p.length; gran += 960;
    if (i === packets.length - 1) page(cur, total, 4);
  });
  return new Blob(pages, { type: 'audio/ogg' });
}
async function shrinkSound(blob) {
  const { pcm, dur } = await decodeMono(blob);
  return { blob: await encodeOpus(pcm), dur: Math.round(dur) };
}
async function addSounds(files) {
  let n = 0, saved = 0, failed = [];
  const shrink = canShrink();
  openModal(`${modalHead('Musik laden')}<p class="muted" id="sndBusy">Lade …</p>`);
  for (const f of files) {
    if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|aac|ogg|opus|wav|flac)$/i.test(f.name)) continue;
    const b = $('#sndBusy'); if (b) b.textContent = `${shrink ? 'Verkleinere' : 'Lade'} ${f.name} …`;
    const hash = (await sha256hex(f)).slice(0, 20);
    // Gleiche Originaldatei nur einmal – egal ob verkleinert oder nicht
    if (Object.values(S.sounds).some((s) => s.src === hash || (s.media || '').startsWith(`snd_${hash}.`))) continue;
    let blob = f, dur = 0, key;
    if (shrink) {
      try { const r = await shrinkSound(f); blob = r.blob; dur = r.dur; key = `snd_${hash}.ogg`; } catch (e) { failed.push(f.name); blob = f; }
    }
    if (!key) { const ext = (f.name.match(/\.([a-z0-9]+)$/i) || [, 'mp3'])[1].toLowerCase(); key = `snd_${hash}.${ext}`; dur = await audioDuration(f); blob = new Blob([f], { type: f.type || 'audio/mpeg' }); }
    await idbPut('media', key, blob); mediaKeysHere.add(key);
    const id = uid();
    S.sounds[id] = { id, name: f.name.replace(/\.[a-z0-9]+$/i, ''), media: key, src: hash, size: blob.size, origSize: f.size, dur, type: blob.type || 'audio/mpeg' };
    saved += f.size - blob.size; n++;
  }
  await save();
  closeModal(); render();
  toast(n ? `${n} Stück(e) geladen${saved > 1048576 ? `, ${(saved / 1048576).toFixed(1)} MB gespart` : ''}.${failed.length ? ` Nicht verkleinert: ${failed.join(', ')}` : ''}` : 'Keine neuen Musikdateien.', { timeout: 6000 });
}
// Früher geladene, unverkleinerte Stücke nachträglich verkleinern
async function shrinkExisting() {
  const list = Object.values(S.sounds).filter((s) => !/\.ogg$/.test(s.media || ''));
  let saved = 0, i = 0;
  openModal(`${modalHead('Musik verkleinern')}<p class="muted" id="sndBusy">…</p>`);
  for (const s of list) {
    const b = $('#sndBusy'); if (b) b.textContent = `Verkleinere ${++i}/${list.length}: ${s.name} …`;
    const orig = await idbGet('media', s.media); if (!orig) continue;
    try {
      const r = await shrinkSound(orig);
      const hash = s.src || (s.media.match(/^snd_([0-9a-f]+)\./) || [])[1] || (await sha256hex(orig)).slice(0, 20);
      const key = `snd_${hash}.ogg`;
      await idbPut('media', key, r.blob);
      saved += orig.size - r.blob.size;
      Object.assign(s, { media: key, src: hash, size: r.blob.size, origSize: s.origSize || orig.size, dur: r.dur, type: 'audio/ogg' });
    } catch (e) { /* bleibt wie es ist */ }
  }
  await save(); await mediaCleanup();
  closeModal(); render();
  toast(`${i} Stück(e) verkleinert, ${(saved / 1048576).toFixed(1)} MB gespart. Danach unter „Daten“ senden.`, { timeout: 7000 });
}
function audioDuration(blob) {
  return new Promise((res) => {
    const a = new Audio(); const u = URL.createObjectURL(blob);
    const done = (v) => { URL.revokeObjectURL(u); res(v); };
    a.preload = 'metadata'; a.onloadedmetadata = () => done(isFinite(a.duration) ? Math.round(a.duration) : 0); a.onerror = () => done(0);
    setTimeout(() => done(0), 8000);
    a.src = u;
  });
}
function soundUsedIn(id) { return S.workouts.filter((w) => w.blocks.some((b) => b.items.some((it) => it.sound === id || it.restSound === id))); }
function soundOptions(sel, emptyLabel = '– keine Musik –') {
  const list = Object.values(S.sounds).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return `<option value="">${emptyLabel}</option>` + list.map((s) => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
}
let previewAudio = null;
async function previewSound(id) {
  if (previewAudio) { const same = previewAudio.dataset.id === id; previewAudio.pause(); previewAudio = null; render(); if (same) return; }
  const s = S.sounds[id]; if (!s) return;
  const u = await mediaUrl(s.media); if (!u) { toast('Datei fehlt auf diesem Gerät. Bitte „Holen“.', { error: true }); return; }
  previewAudio = new Audio(u); previewAudio.dataset.id = id; previewAudio.play();
  previewAudio.onended = () => { previewAudio = null; render(); };
  render();
}

/* ================= 5 Workouts ================= */
function newWorkout() {
  return { id: uid(), name: '', mode: 'time', work: 40, rest: 20, prep: 10, blocks: [newBlock()], createdAt: Date.now(), updatedAt: Date.now() };
}
function newBlock() { return { id: uid(), title: '', rounds: 1, items: [] }; }
// Ablauf eines Workouts als Folge von Schritten: Vorbereitung, Übung, Pause …
function buildSteps(w) {
  const steps = [];
  const timed = w.mode === 'time';
  w.blocks.forEach((b, bi) => {
    const R = Math.max(1, Math.round(b.rounds) || 1);
    for (let r = 1; r <= R; r++) {
      let note = '', fresh = false;
      for (const it of b.items) {
        if (it.t === 'text') { if (String(it.text || '').trim()) { note = it.text.trim(); fresh = true; } continue; }
        if (it.t !== 'ex') continue;
        const ex = S.exercises[it.exId] || { id: it.exId, name: `Übung ${it.exId} (fehlt)`, cue: '', img: null };
        const work = timed ? Math.max(1, it.work != null && it.work !== '' ? num(it.work) : w.work) : null;
        steps.push({ kind: 'work', ex, it, dur: work, sound: it.sound || '', target: String(it.reps || '').trim(), note, noteNew: fresh, block: b, bi, round: r, rounds: R });
        fresh = false;
        if (timed) {
          const rest = it.rest != null && it.rest !== '' ? num(it.rest) : w.rest;
          if (rest > 0) steps.push({ kind: 'rest', dur: rest, sound: it.restSound || '', block: b, bi, round: r, rounds: R });
        }
      }
    }
  });
  while (steps.length && steps[steps.length - 1].kind === 'rest') steps.pop();
  const works = steps.filter((s) => s.kind === 'work');
  works.forEach((s, i) => { s.no = i + 1; s.total = works.length; });
  for (let i = steps.length - 1, nxt = null; i >= 0; i--) { if (steps[i].kind === 'work') nxt = steps[i]; else steps[i].next = nxt; }
  if (works.length) steps.unshift({ kind: 'prep', dur: Math.max(3, num(w.prep) || 10), next: works[0], sound: '' });
  return steps;
}
function workoutDuration(w) {
  if (w.mode !== 'time') return null;
  return buildSteps(w).reduce((a, s) => a + (s.dur || 0), 0);
}
function exCount(w) { return buildSteps(w).filter((s) => s.kind === 'work').length; }

/* ================= 6 Spieler ================= */
const AE = { ctx: null, el: null, gain: null, cur: '', level: 0.9, music: true, duck: false, fadeTimer: null };
function aeInit() {
  if (AE.ctx) { if (AE.ctx.state === 'suspended') AE.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  AE.ctx = new C();
  AE.el = new Audio(); AE.el.loop = true;
  const src = AE.ctx.createMediaElementSource(AE.el);
  AE.gain = AE.ctx.createGain(); AE.gain.gain.value = 0;
  src.connect(AE.gain).connect(AE.ctx.destination);
}
function aeTarget() { return AE.music ? AE.level * (AE.duck ? 0.25 : 1) : 0; }
function aeRamp(to, sec) {
  if (!AE.gain) return;
  const t = AE.ctx.currentTime, g = AE.gain.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + Math.max(0.02, sec));
}
async function musicPlay(soundId) {
  if (!AE.ctx) return;
  clearTimeout(AE.fadeTimer);
  const s = soundId && S.sounds[soundId];
  if (!s) { musicStop(0.4); return; }
  if (AE.cur === soundId && AE.el.src) { if (AE.el.paused) AE.el.play().catch(() => {}); aeRamp(aeTarget(), 0.3); return; }
  AE.cur = soundId;
  const u = await mediaUrl(s.media);
  if (!u || AE.cur !== soundId) return;
  AE.gain.gain.value = 0;
  AE.el.src = u; AE.el.currentTime = 0;
  try { await AE.el.play(); } catch (e) { /* Wiedergabe blockiert */ }
  aeRamp(aeTarget(), 0.4);
}
function musicStop(fade = 1) {
  if (!AE.ctx) return;
  AE.cur = '';
  aeRamp(0, fade);
  clearTimeout(AE.fadeTimer);
  AE.fadeTimer = setTimeout(() => { if (!AE.cur) AE.el.pause(); }, fade * 1000 + 50);
}
function beep(freq = 880, len = 0.12, vol = 0.5) {
  if (!AE.ctx || !P.sig) return;
  const t = AE.ctx.currentTime, o = AE.ctx.createOscillator(), g = AE.ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.setValueAtTime(vol, t + len - 0.03); g.gain.linearRampToValueAtTime(0, t + len);
  o.connect(g).connect(AE.ctx.destination); o.start(t); o.stop(t + len + 0.02);
}
let voiceDe = null;
function pickVoice() {
  if (!window.speechSynthesis) return;
  const v = speechSynthesis.getVoices();
  voiceDe = v.find((x) => /^de(-|_|$)/i.test(x.lang) && /google/i.test(x.name)) || v.find((x) => /^de(-|_|$)/i.test(x.lang)) || null;
}
function say(text) {
  if (!P.voice || !window.speechSynthesis || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'de-DE'; if (voiceDe) u.voice = voiceDe; u.rate = 1.02;
  u.onstart = () => { AE.duck = true; aeRamp(aeTarget(), 0.25); };
  u.onend = u.onerror = () => { AE.duck = false; aeRamp(aeTarget(), 0.6); };
  speechSynthesis.speak(u);
}
let wakeLock = null;
async function wakeOn() { try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* egal */ } }
function wakeOff() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* egal */ } wakeLock = null; }

// P = laufendes Workout
let P = null;
const ANN_LABEL = { sig: 'Signaltöne', voice: 'Sprachansage', both: 'Töne + Sprache', none: 'Keine Ansagen' };
// trial = Probelauf am PC mit dem gerade bearbeiteten (auch ungespeicherten) Workout
let pendingPlay = null;
function startDialog(id, trial = false) {
  const w = trial ? ui.ed : S.workouts.find((x) => x.id === id); if (!w) return;
  if (!exCount(w)) { toast('Das Workout enthält noch keine Übungen.', { error: true }); return; }
  pendingPlay = { w, trial };
  const speed = +(localStorage.getItem('bb_trial_speed') || 1);
  const last = localStorage.getItem('bb_ann') || 'both';
  const missing = [];
  for (const b of w.blocks) for (const it of b.items) {
    if (it.t === 'ex' && !S.exercises[it.exId]) missing.push(`Übung ${it.exId} fehlt`);
    for (const k of ['sound', 'restSound']) if (it[k] && (!S.sounds[it[k]] || !mediaKeysHere.has(S.sounds[it[k]].media))) missing.push('Ein Musikstück fehlt auf diesem Gerät');
  }
  const dur = workoutDuration(w);
  openModal(`${modalHead((trial ? 'Probelauf: ' : '') + esc(w.name || 'Workout'))}
    ${trial ? '<p class="small muted" style="margin-bottom:6px">Spielt das Workout so ab wie später im Keller – mit dem Stand im Editor, auch wenn noch nicht gespeichert. Danach bist du wieder im Editor.</p>' : ''}
    <p class="muted">${exCount(w)} Übungen · ${w.mode === 'time' ? 'auf Zeit, ca. ' + durText(dur) : 'per Tippen'}</p>
    ${missing.length ? `<div class="callout warn">${[...new Set(missing)].map(esc).join('<br>')}. Bitte unter „Daten“ holen.</div>` : ''}
    <div class="label" style="margin-top:14px">Ansagen</div>
    <div class="seg" id="annSeg">${Object.entries(ANN_LABEL).map(([k, v]) => `<button data-a="ann" data-k="${k}" class="${k === last ? 'on' : ''}">${v}</button>`).join('')}</div>
    ${trial && w.mode === 'time' ? `<div class="label" style="margin-top:14px">Tempo</div>
    <div class="seg" id="spdSeg">${[[1, 'Echtzeit'], [5, '5× schneller'], [10, '10× schneller']].map(([k, v]) => `<button data-a="spd" data-k="${k}" class="${k === speed ? 'on' : ''}">${v}</button>`).join('')}</div>
    <p class="hint">Bei schnellerem Tempo gibt es keine Sprachansage, Töne und Musik laufen mit.</p>` : ''}
    <div class="modal-foot"><button class="btn ghost" data-a="modal-close">Abbrechen</button><button class="btn" data-a="play-go">${ic('play')}${trial ? 'Probelauf starten' : "Los geht's"}</button></div>`);
}
function playStart(w, trial = false) {
  const steps = buildSteps(w);
  const speed = trial && w.mode === 'time' ? +(localStorage.getItem('bb_trial_speed') || 1) : 1;
  if (!steps.length) { toast('Das Workout enthält noch keine Übungen.', { error: true }); return; }
  const ann = localStorage.getItem('bb_ann') || 'both';
  closeModal();
  aeInit(); pickVoice();
  P = { w, steps, i: 0, t0: performance.now(), acc: 0, paused: false, sig: ann === 'sig' || ann === 'both', voice: (ann === 'voice' || ann === 'both') && speed === 1, lastBeep: null, startedAt: Date.now(), timer: null, fading: false, trial, speed };
  wakeOn();
  enterStep(0);
  P.timer = setInterval(tick, 100);
}
function stepElapsed() { return P.paused ? P.acc : P.acc + (performance.now() - P.t0) / 1000 * (P.speed || 1); }
function enterStep(i) {
  P.i = i; P.acc = 0; P.t0 = performance.now(); P.lastBeep = null; P.fading = false;
  const s = P.steps[i];
  if (!s) { finish(); return; }
  if (!P.paused) musicPlay(s.sound);
  if (s.kind === 'prep') {
    beep(660, 0.15);
    say(`${s.next.noteNew && s.next.note ? s.next.note + '. ' : ''}Gleich geht's los. Erste Übung: ${s.next.ex.name}`);
  } else if (s.kind === 'rest') {
    beep(520, 0.35);
    say(s.next ? `Pause. ${s.next.noteNew && s.next.note ? s.next.note + '. ' : ''}Als Nächstes: ${s.next.ex.name}` : 'Pause');
  } else if (s.kind === 'work') {
    beep(1046, 0.4, 0.6);
    const prev = P.steps[i - 1];
    const announced = prev && (prev.kind === 'rest' || prev.kind === 'prep');
    let t = announced ? 'Los!' : `${s.noteNew && s.note ? s.note + '. ' : ''}${s.ex.name}${s.target ? ', ' + s.target : ''}`;
    if (s.round > 1 && s.block.items.find((x) => x.t === 'ex') === s.it) t = `Runde ${s.round}. ` + t;
    say(t);
  }
  renderPlayer();
}
function tick() {
  if (!P || P.paused) return;
  const s = P.steps[P.i];
  if (!s) return;
  const el = stepElapsed();
  if (s.dur) {
    const left = s.dur - el;
    const sec = Math.ceil(left);
    if (sec <= 3 && sec >= 1 && P.lastBeep !== sec) { P.lastBeep = sec; beep(880, 0.1); }
    // Musik am Ende ausblenden – nur wenn danach ein anderes Stück kommt
    const nx = P.steps[P.i + 1];
    if (!P.fading && left <= 1.2 && (!nx || (nx.sound || '') !== (s.sound || ''))) { P.fading = true; aeRamp(0, Math.max(0.1, left)); }
    if (left <= 0) { enterStep(P.i + 1); return; }
  }
  updatePlayerClock();
}
function playNext() { if (!P) return; if (P.i >= P.steps.length - 1) { finish(); return; } enterStep(P.i + 1); }
function playPrev() {
  if (!P) return;
  // Zurück zur vorigen Übung (Pausen überspringen); innerhalb der ersten Sekunden noch eins weiter zurück
  let j = P.i;
  if (stepElapsed() < 3 || P.steps[j].kind !== 'work') j--;
  while (j > 0 && P.steps[j].kind !== 'work') j--;
  enterStep(Math.max(0, j));
}
function playPause() {
  if (!P) return;
  if (P.paused) { P.paused = false; P.t0 = performance.now(); musicPlay(P.steps[P.i] && P.steps[P.i].sound); wakeOn(); }
  else { P.acc = stepElapsed(); P.paused = true; if (AE.el) { aeRamp(0, 0.2); setTimeout(() => { if (P && P.paused) AE.el.pause(); }, 250); } if (window.speechSynthesis) speechSynthesis.cancel(); }
  renderPlayer();
}
function finish() {
  if (!P) return;
  clearInterval(P.timer);
  musicStop(1.5);
  beep(784, 0.2); setTimeout(() => beep(1046, 0.5), 220);
  say('Geschafft. Starke Leistung!');
  P.done = true; P.endedAt = Date.now();
  renderPlayer();
}
function playClose() {
  if (P && !P.done && !P.trial && !confirm('Workout beenden?')) return;
  if (P) clearInterval(P.timer);
  musicStop(0.3);
  if (window.speechSynthesis) speechSynthesis.cancel();
  P = null; wakeOff();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  $('#player-root').innerHTML = '';
}
// upcoming = Pause/Vorbereitung: Bild der nächsten Übung gedämpft und deutlich als „noch nicht“ markiert
function imgBox(ex, upcoming = false) {
  const ov = upcoming ? '<div class="pl-ov"><span>GLEICH</span><small>noch nicht ausführen</small></div>' : '';
  return ex && ex.img ? `<div class="pl-img ${upcoming ? 'upcoming' : ''}"><img data-media="${esc(ex.img)}" alt="">${ov}</div>` : `<div class="pl-img none ${upcoming ? 'upcoming' : ''}">${upcoming ? ov : 'kein Bild'}</div>`;
}
function renderPlayer() {
  const root = $('#player-root');
  if (!P) { root.innerHTML = ''; return; }
  if (P.done) {
    root.innerHTML = `<div class="player ph-done"><div class="pl-done"><h2>Geschafft!</h2>
      <p class="muted" style="font-size:1.2rem">${esc(P.w.name || 'Workout')} · ${P.trial ? 'Probelauf' + (P.speed > 1 ? ' (' + P.speed + '× schneller)' : '') + ', geplante Dauer ' + durText(workoutDuration(P.w) || 0) : durText((P.endedAt - P.startedAt) / 1000)}</p>
      <button class="btn" data-a="play-close" style="min-height:60px;font-size:1.2rem;padding:0 30px">Schließen</button></div></div>`;
    return;
  }
  const s = P.steps[P.i];
  const phase = s.kind === 'work' ? 'ph-work' : s.kind === 'rest' ? 'ph-rest' : 'ph-prep';
  const label = s.kind === 'work' ? 'ÜBUNG' : s.kind === 'rest' ? 'PAUSE' : 'GLEICH GEHT’S LOS';
  const ref = s.kind === 'work' ? s : s.next;
  const info = (P.trial ? `PROBELAUF${P.speed > 1 ? ' ×' + P.speed : ''} · ` : '') + (ref ? `${ref.block.title ? esc(ref.block.title) + ' · ' : ''}${ref.rounds > 1 ? `Runde ${ref.round}/${ref.rounds} · ` : ''}Übung ${ref.no}/${ref.total}` : '');
  let main;
  if (s.kind === 'work') {
    const timed = !!s.dur;
    main = `${s.note ? `<div class="pl-note">${esc(s.note)}</div>` : ''}
      <div class="pl-main ${s.ex.img ? '' : 'no-img'}">${imgBox(s.ex)}
        <div class="pl-side"><div class="pl-name">${esc(s.ex.name)}<span class="pl-id">ID ${esc(s.ex.id)}</span></div>
          ${timed ? '<div class="pl-timer" id="plClock"></div>' : `${s.target ? `<div class="pl-target">${esc(s.target)}</div>` : ''}<div class="pl-elapsed" id="plClock"></div>`}
          ${s.ex.cue ? `<div class="pl-cue">${esc(s.ex.cue)}</div>` : ''}</div></div>`;
  } else {
    const n = s.next;
    const showNote = n && n.noteNew && n.note;
    main = `${showNote ? `<div class="pl-note big">${esc(n.note)}</div>` : ''}
      <div class="pl-main ${n && n.ex.img ? '' : 'no-img'}">${n ? imgBox(n.ex, true) : ''}
        <div class="pl-side"><div class="pl-bigword">${s.kind === 'rest' ? 'PAUSE' : 'GLEICH GEHT’S LOS'}</div><div class="pl-timer" id="plClock"></div>
          ${n ? `<div class="pl-next"><div><small>Als Nächstes</small>${esc(n.ex.name)} <span class="pl-id" style="font-size:.6em;color:var(--z1);margin-left:6px">ID ${esc(n.ex.id)}</span>${n.target ? `<div class="pl-target" style="font-size:.9em">${esc(n.target)}</div>` : ''}</div></div>` : ''}
          ${n && n.ex.cue ? `<div class="pl-cue">${esc(n.ex.cue)}</div>` : ''}</div></div>`;
  }
  const tap = s.kind === 'work' && !s.dur;
  root.innerHTML = `<div class="player ${phase}">
    <div class="pl-top"><span class="pl-phase">${label}</span><span class="grow">${info}</span>
      <button class="icon-btn" data-a="play-music" title="Musik an/aus" aria-label="Musik an/aus">${ic(AE.music ? 'speaker' : 'mute')}</button>
      <button class="icon-btn" data-a="play-full" title="Vollbild" aria-label="Vollbild">${ic('full')}</button>
      <button class="icon-btn" data-a="play-close" title="Beenden" aria-label="Beenden">${ic('x')}</button></div>
    <div class="pl-bar"><div id="plBar"></div></div>
    ${main}
    <div class="pl-ctrl">
      <button data-a="play-prev" aria-label="Zurück">${ic('prev', 'ic-lg')}</button>
      <button data-a="play-pause" class="${P.paused ? 'on' : ''}" aria-label="${P.paused ? 'Weiter' : 'Pause'}">${ic(P.paused ? 'play' : 'pause', 'ic-lg')}</button>
      ${tap ? `<button class="pl-go" data-a="play-next">Weiter ${ic('next', 'ic-lg')}</button>` : `<button class="pl-go ph-hide" tabindex="-1"></button><button data-a="play-next" aria-label="Überspringen">${ic('next', 'ic-lg')}</button>`}
    </div></div>`;
  hydrate(root);
  updatePlayerClock();
}
function updatePlayerClock() {
  if (!P || P.done) return;
  const s = P.steps[P.i], el = stepElapsed();
  const c = $('#plClock'), bar = $('#plBar');
  if (c) c.textContent = s.dur ? mmss(s.dur - el) : mmss(el);
  if (bar) bar.style.width = s.dur ? Math.min(100, el / s.dur * 100) + '%' : '100%';
}

/* ================= 7 Abgleich über GitHub ================= */
// Ablage im privaten Daten-Repository (z. B. fitlog-daten) im eigenen Ordner „basementbox/“.
// fitlog liest dort nur „geraete/“ und „bilder/“ – der Ordner „basementbox/“ ist davon getrennt.
const SYNC_KEY = 'bb_sync';
const DIR = 'basementbox/';
const DATA_PATH = DIR + 'daten.json';
const MEDIA_DIR = DIR + 'medien/';
let sync = null;
try { sync = JSON.parse(localStorage.getItem(SYNC_KEY) || 'null'); } catch (e) { sync = null; }
function saveSync() { try { if (sync) localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); else localStorage.removeItem(SYNC_KEY); } catch (e) { /* egal */ } }
function syncReady() { return !!(sync && sync.repo && sync.token); }
// Gerätename wie in fitlog; beim ersten Mal wird der Name aus fitlog übernommen (nur gelesen).
function deviceName() {
  let d = localStorage.getItem('bb_device');
  if (d == null) {
    try { d = (JSON.parse(localStorage.getItem('aofl_data') || 'null') || {}).device || ''; } catch (e) { d = ''; }
    if (d) localStorage.setItem('bb_device', d);
  }
  return d || '';
}
function tsText(ts) { return ts ? fmtDate(ts) : 'noch nie'; }
class SyncError extends Error {}
function syncErrText(e) { return e instanceof SyncError ? e.message : 'Fehler beim Abgleich: ' + ((e && e.message) || e); }
async function gh(path, o = {}) {
  let res;
  try {
    res = await fetch('https://api.github.com' + path, {
      method: o.method || 'GET', cache: 'no-store',
      headers: Object.assign({ Authorization: 'Bearer ' + (o.token || sync.token), Accept: 'application/vnd.github+json' }, o.body ? { 'Content-Type': 'application/json' } : {}),
      body: o.body ? JSON.stringify(o.body) : undefined
    });
  } catch (e) { throw new SyncError('Keine Verbindung zu GitHub. Bitte Internet prüfen.'); }
  if (o.allow && o.allow.includes(res.status)) return { missing: res.status };
  if (!res.ok) {
    let msg = ''; try { msg = (await res.json()).message || ''; } catch (e) { /* egal */ }
    if (res.status === 401) throw new SyncError('GitHub lehnt den Schlüssel (Token) ab. Unter Daten › Abgleich einen gültigen eintragen.');
    if (res.status === 403 && /rate limit/i.test(msg)) throw new SyncError('GitHub bremst gerade zu viele Anfragen. Bitte später erneut versuchen.');
    if (res.status === 403) throw new SyncError('Keine Schreibberechtigung. Beim Token muss „Contents: Read and write“ erlaubt sein.');
    if (res.status === 404) throw new SyncError('Repository nicht gefunden. Name prüfen und ob der Token Zugriff darauf hat.');
    if (res.status === 422 && o.conflict) throw Object.assign(new SyncError('conflict'), { conflict: true });
    throw new SyncError(`GitHub meldet Fehler ${res.status}${msg ? ': ' + msg : ''}.`);
  }
  return res.status === 204 ? null : res.json();
}
function parseRepo(s) { s = String(s || '').trim().replace(/\.git$/, '').replace(/\/+$/, ''); const m = s.match(/(?:github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/); return m ? `${m[1]}/${m[2]}` : ''; }
async function repoInfo(repo, token) {
  const r = await gh(`/repos/${repo}`, { token });
  if (!r.private) throw new SyncError('Das Repository ist öffentlich. Deine Übungen, Bilder und MP3s gehören in ein privates Repository.');
  if (r.permissions && !r.permissions.push) throw new SyncError('Der Token darf in dieses Repository nicht schreiben („Contents: Read and write“).');
  return r;
}
async function syncState() {
  const R = sync.repo;
  const info = await repoInfo(R);
  const br = info.default_branch || 'main';
  let ref = await gh(`/repos/${R}/git/ref/heads/${encodeURIComponent(br)}`, { allow: [404, 409] });
  if (ref.missing) {
    await gh(`/repos/${R}/contents/LIESMICH.md`, { method: 'PUT', body: { message: 'Ablage eingerichtet', content: btoa('# Datenablage\n') } });
    ref = await gh(`/repos/${R}/git/ref/heads/${encodeURIComponent(br)}`);
  }
  const head = ref.object.sha;
  const commit = await gh(`/repos/${R}/git/commits/${head}`);
  const tree = await gh(`/repos/${R}/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree.truncated) throw new SyncError('Die Dateiliste auf GitHub ist zu groß. Bitte melden.');
  const files = {};
  for (const t of tree.tree || []) if (t.type === 'blob') files[t.path] = t.sha;
  return { R, br, head, treeSha: commit.tree.sha, files };
}
function blobToB64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
function textToB64(s) { return blobToB64(new Blob([s], { type: 'text/plain' })); }
function b64ToBlob(b64, type) {
  const bin = atob(String(b64).replace(/\s/g, '')); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
async function ghBlob(R, blob) { return (await gh(`/repos/${R}/git/blobs`, { method: 'POST', body: { content: await blobToB64(blob), encoding: 'base64' } })).sha; }
function mediaType(key) { return /\.jpe?g$/i.test(key) ? 'image/jpeg' : /\.m4a$/i.test(key) ? 'audio/mp4' : /\.ogg$/i.test(key) ? 'audio/ogg' : /\.wav$/i.test(key) ? 'audio/wav' : 'audio/mpeg'; }
function setBusy(t) { ui.busy = t; if (ui.tab === 'data') render(); }

async function syncSend(force = false) {
  if (!syncReady() || ui.busy) return;
  if (!deviceName()) { toast('Bitte zuerst unter „Dieses Gerät“ einen Gerätenamen eintragen.', { error: true }); ui.tab = 'data'; render(); return; }
  closeModal();
  setBusy('Senden …');
  try {
    let st = await syncState();
    const remote = st.files[DATA_PATH];
    if (!force && remote && remote !== sync.dataSha) {
      setBusy(null);
      openModal(`${modalHead('Erst „Holen“?')}<div class="callout warn">Auf GitHub liegt ein Stand, den dieses Gerät noch nicht kennt (z. B. von einem anderen Gerät gesendet). Senden würde ihn ersetzen.</div>
        <div class="modal-foot"><button class="btn ghost" data-a="modal-close">Abbrechen</button><button class="btn danger" data-a="sync-send-force">Trotzdem senden</button><button class="btn" data-a="sync-fetch">${ic('download')}Erst holen</button></div>`);
      return;
    }
    // 1. Fehlende Medien hochladen (Bilder, MP3s)
    const ref = referencedMedia(S, true);
    const entries = [];
    const todo = [...ref].filter((k) => !st.files[MEDIA_DIR + k]);
    let i = 0;
    for (const k of todo) {
      setBusy(`Dateien senden ${++i}/${todo.length} …`);
      const b = await idbGet('media', k);
      if (!b) continue;
      entries.push({ path: MEDIA_DIR + k, mode: '100644', type: 'blob', sha: await ghBlob(st.R, b) });
    }
    // 2. Nicht mehr benötigte Medien entfernen – ausschließlich im eigenen Ordner
    for (const p of Object.keys(st.files)) if (p.startsWith(MEDIA_DIR) && !ref.has(p.slice(MEDIA_DIR.length))) entries.push({ path: p, mode: '100644', type: 'blob', sha: null });
    // 3. Daten
    setBusy('Daten senden …');
    const out = Object.assign({}, S, { dirty: undefined, sentAt: Date.now(), device: deviceName() });
    const dataSha = await ghBlob(st.R, new Blob([JSON.stringify(out)], { type: 'application/json' }));
    entries.push({ path: DATA_PATH, mode: '100644', type: 'blob', sha: dataSha });
    for (let attempt = 0; ; attempt++) {
      try {
        const tree = await gh(`/repos/${st.R}/git/trees`, { method: 'POST', body: { base_tree: st.treeSha, tree: entries.filter((e) => e.sha !== null || st.files[e.path]) } });
        const c = await gh(`/repos/${st.R}/git/commits`, { method: 'POST', body: { message: `Basement Box – ${deviceName()}: Daten gesendet (${fmtDate(Date.now())})`, tree: tree.sha, parents: [st.head] } });
        await gh(`/repos/${st.R}/git/refs/heads/${encodeURIComponent(st.br)}`, { method: 'PATCH', body: { sha: c.sha }, conflict: true });
        break;
      } catch (e) {
        // Gleichzeitig hat jemand anderes (z. B. fitlog) gesendet: neu aufsetzen.
        if (!e.conflict || attempt >= 3) throw e.conflict ? new SyncError('Gerade sendet ein anderes Gerät. Bitte gleich noch einmal versuchen.') : e;
        st = await syncState();
      }
    }
    sync.dataSha = dataSha; sync.lastSend = Date.now(); saveSync();
    S.dirty = false; await save(false);
    toast('Gesendet. Handy und Chromebook können jetzt „Holen“.');
  } catch (e) { toast(syncErrText(e), { error: true, timeout: 9000 }); }
  finally { setBusy(null); render(); }
}
async function syncFetch(force = false) {
  if (!syncReady() || ui.busy) return;
  closeModal();
  if (!force && S.dirty && Object.keys(S.exercises).length + S.workouts.length > 0) {
    openModal(`${modalHead('Änderungen auf diesem Gerät')}<div class="callout warn">Hier gibt es Änderungen, die noch nicht gesendet wurden. Holen ersetzt sie durch den Stand auf GitHub.</div>
      <div class="modal-foot"><button class="btn ghost" data-a="modal-close">Abbrechen</button><button class="btn danger" data-a="sync-fetch-force">Trotzdem holen</button>${isPC() ? `<button class="btn" data-a="sync-send">${ic('upload')}Erst senden</button>` : ''}</div>`);
    return;
  }
  setBusy('Holen …');
  try {
    const st = await syncState();
    const sha = st.files[DATA_PATH];
    if (!sha) { toast('Auf GitHub liegen noch keine Basement-Box-Daten. Am PC zuerst „Senden“.', { timeout: 7000 }); return; }
    const raw = await gh(`/repos/${st.R}/git/blobs/${sha}`);
    const d = JSON.parse(new TextDecoder().decode(await b64ToBlob(raw.content, 'application/json').arrayBuffer()));
    if (!d || d.app !== 'basementbox') throw new SyncError('Die Daten auf GitHub sind nicht lesbar.');
    const nd = Object.assign(freshData(), d);
    const need = referencedMedia(nd);
    const have = new Set(await idbKeys('media'));
    const todo = [...need].filter((k) => !have.has(k));
    let i = 0, missing = 0;
    for (const k of todo) {
      setBusy(`Dateien holen ${++i}/${todo.length} …`);
      const fsha = st.files[MEDIA_DIR + k];
      if (!fsha) { missing++; continue; }
      const b = await gh(`/repos/${st.R}/git/blobs/${fsha}`);
      await idbPut('media', k, b64ToBlob(b.content, mediaType(k)));
    }
    const from = d.device ? ` von ${d.device}` : '', when = d.sentAt ? ` (gesendet ${fmtDate(d.sentAt)})` : '';
    S = nd; S.dirty = false;
    await save(false);
    await mediaCleanup();
    mediaKeysHere = new Set(await idbKeys('media'));
    sync.dataSha = sha; sync.lastFetch = Date.now(); saveSync();
    ui.news = false;
    toast(`Geholt${from}${when}: ${S.workouts.length} Workouts, ${Object.keys(S.exercises).length} Übungen, ${Object.keys(S.sounds).length} MP3s.${missing ? ` ${missing} Datei(en) fehlten.` : ''}`, { timeout: 6000 });
  } catch (e) { toast(syncErrText(e), { error: true, timeout: 9000 }); }
  finally { setBusy(null); render(); }
}
async function syncCheck() {
  if (!syncReady() || ui.busy || !navigator.onLine) return;
  try {
    const st = await syncState();
    const sha = st.files[DATA_PATH];
    const news = !!(sha && sha !== sync.dataSha);
    if (news !== !!ui.news) { ui.news = news; if (!ui.modal && !P) render(); }
  } catch (e) { /* still */ }
}
function syncSetupHtml() {
  const s = sync || {};
  let fl = null;
  try { fl = JSON.parse(localStorage.getItem('aofl_sync') || 'null'); } catch (e) { fl = null; }
  const canTake = fl && fl.repo && fl.token && !(s.repo && s.token);
  return `${modalHead('Abgleich über GitHub')}
    <p class="small muted">Basement Box legt seine Daten in einem <b>privaten</b> Repository im eigenen Ordner <b>basementbox/</b> ab. Am einfachsten nimmst du dasselbe wie fitlog (fitlog-daten). fitlog liest diesen Ordner nicht, beide Apps stören sich nicht.</p>
    ${canTake ? `<div class="callout">Auf diesem Gerät ist fitlog schon verbunden (${esc(fl.repo)}). <button class="btn sm" data-a="sync-take">Zugang von fitlog übernehmen</button></div>` : ''}
    <div class="field" style="margin-top:12px"><label for="syRepo">Repository (Benutzername/Name)</label>
      <input type="text" id="syRepo" value="${esc(s.repo || '')}" placeholder="walterhansi/fitlog-daten" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
    <div class="field"><label for="syToken">Token</label>
      <input type="password" id="syToken" value="${esc(s.token || '')}" placeholder="github_pat_…" autocomplete="off" autocapitalize="off" spellcheck="false">
      <p class="hint">Der Token bleibt nur auf diesem Gerät.</p></div>
    <div class="modal-foot">${syncReady() ? `<button class="btn danger" data-a="sync-off">Trennen</button>` : ''}<button class="btn ghost" data-a="modal-close">Abbrechen</button><button class="btn" data-a="sync-save" id="sySave">Prüfen und speichern</button></div>`;
}
async function syncSaveSetup() {
  const repo = parseRepo($('#syRepo').value), token = $('#syToken').value.trim();
  if (!repo) { toast('Bitte das Repository als Benutzername/Name angeben.', { error: true }); return; }
  if (!token) { toast('Bitte den Token einfügen.', { error: true }); return; }
  const btn = $('#sySave'); btn.disabled = true; btn.textContent = 'Prüfe …';
  try {
    await repoInfo(repo, token);
    const changed = !sync || sync.repo !== repo;
    sync = Object.assign(sync || {}, { repo, token });
    if (changed) { sync.dataSha = null; sync.lastSend = null; sync.lastFetch = null; }
    saveSync(); closeModal(); render();
    toast(isPC() ? 'Verbindung steht.' : 'Verbindung steht. Jetzt „Holen“ tippen.', { timeout: 6000 });
    syncCheck();
  } catch (e) { btn.disabled = false; btn.textContent = 'Prüfen und speichern'; toast(syncErrText(e), { error: true, timeout: 9000 }); }
}

/* ================= 8 Ansichten ================= */
const ui = { tab: 'workouts', modal: null, obs: null, busy: null, news: false, ed: null, exQ: '' };
const TABS = [
  { id: 'workouts', label: 'Workouts', icon: 'list' },
  { id: 'exercises', label: 'Übungen', icon: 'dumbbell' },
  { id: 'music', label: 'Musik', icon: 'music' },
  { id: 'data', label: 'Daten', icon: 'sync' }
];
function renderNav() {
  $('#nav').innerHTML = TABS.map((t) => `<button class="${ui.tab === t.id ? 'on' : ''}" data-a="tab" data-tab="${t.id}">${ic(t.icon)}<span>${t.label}</span>${t.id === 'data' && ui.news ? '<span class="dot"></span>' : ''}</button>`).join('');
}
function render() {
  renderNav();
  const v = ui.ed ? viewEditor() : ({ workouts: viewWorkouts, exercises: viewExercises, music: viewMusic, data: viewData }[ui.tab] || viewWorkouts)();
  $('#view').innerHTML = v;
  hydrate($('#view'));
}
function thumb(ex, cls = '') { return ex && ex.img ? `<img class="thumb ${cls}" data-media="${esc(ex.img)}" alt="">` : `<div class="thumb ph ${cls}">${ic('image')}</div>`; }

function viewWorkouts() {
  const pc = isPC();
  const list = [...S.workouts].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'de'));
  let h = `<div class="view-inner"><div class="page-head"><h1>Workouts</h1>${pc ? `<button class="btn" data-a="wo-new">${ic('plus')}Neues Workout</button>` : ''}</div>`;
  if (!list.length) h += `<div class="empty">${pc ? 'Noch keine Workouts. Erst unter „Übungen“ aus Obsidian holen, dann ein Workout anlegen.' : 'Noch keine Workouts. Unter „Daten“ den Abgleich einrichten und „Holen“ tippen.'}</div>`;
  h += '<div class="grid cols">' + list.map((w) => {
    const d = workoutDuration(w);
    return `<div class="card"><div class="card-row"><div class="grow"><div class="card-title">${esc(w.name || 'Ohne Namen')}</div>
      <div class="badges"><span class="badge ${w.mode === 'time' ? 'time' : 'tap'}">${w.mode === 'time' ? 'Auf Zeit' : 'Per Tippen'}</span><span class="badge">${exCount(w)} Übungen</span>${d ? `<span class="badge">ca. ${durText(d)}</span>` : ''}</div></div></div>
      <div class="btn-row" style="margin-top:12px"><button class="btn" data-a="wo-start" data-id="${w.id}">${ic('play')}Start</button>
      ${pc ? `<button class="btn ghost" data-a="wo-edit" data-id="${w.id}">${ic('edit')}Bearbeiten</button><button class="icon-btn" data-a="wo-copy" data-id="${w.id}" title="Kopieren" aria-label="Kopieren">${ic('copy')}</button><button class="icon-btn" data-a="wo-del" data-id="${w.id}" title="Löschen" aria-label="Löschen">${ic('trash')}</button>` : ''}</div></div>`;
  }).join('') + '</div></div>';
  return h;
}
function viewExercises() {
  const q = ui.exQ.trim().toLowerCase(), qi = obsNorm(q);
  const list = Object.values(S.exercises).filter((e) => !q || e.name.toLowerCase().includes(q) || e.id === qi).sort((a, b) => idSort(a.id, b.id));
  let h = `<div class="view-inner"><div class="page-head"><h1>Übungen</h1>${isPC() ? `<button class="btn" data-a="obs-open">${ic('download')}Aus Obsidian holen</button>` : ''}</div>
    ${isPC() ? '<p class="hint" style="margin:-6px 0 12px">In Obsidian das Häkchen „Übungsauswahl“ setzen, dann hier „Aus Obsidian holen“. Danach unter „Daten“ senden.</p>' : ''}
    <div class="search">${ic('search')}<input type="search" placeholder="ID oder Name" value="${esc(ui.exQ)}" data-in="ex-q"></div><div id="exList">`;
  h += exListHtml(list) + '</div>';
  const del = Object.keys(S.deleted || {}).sort(idSort);
  if (isPC() && del.length) h += `<div class="section-title">Gelöschte Übungen (${del.length})</div>
    <p class="hint" style="margin:-4px 0 10px">Kommen beim „Aus Obsidian holen“ nicht wieder. In fitlog und Obsidian bleiben sie unverändert.</p>
    <div class="btn-row">${del.map((id) => `<button class="btn sm ghost" data-a="ex-undel" data-id="${esc(id)}" title="Zurückholen">${ic('plus')}ID ${esc(id)}</button>`).join('')}</div>`;
  return h + '</div>';
}
function exListHtml(list) {
  if (!Object.keys(S.exercises).length) return `<div class="empty">Noch keine Übungen.${isPC() ? ' „Aus Obsidian holen“ tippen.' : ''}</div>`;
  if (!list.length) return '<div class="empty">Keine Übung gefunden.</div>';
  return '<div class="grid cols cols3">' + list.map((e) => {
    const used = exUsedIn(e.id).length;
    return `<div class="card tight"><div class="card-row">${thumb(e)}<div class="grow"><div class="card-title">${esc(e.name)}</div>
      <div class="badges"><span class="badge id">ID ${esc(e.id)}</span>${used ? `<span class="badge">in ${used} Workout${used > 1 ? 's' : ''}</span>` : ''}</div></div>
      ${isPC() && !used ? `<button class="icon-btn" data-a="ex-del" data-id="${esc(e.id)}" title="Aus Basement Box entfernen" aria-label="Entfernen">${ic('trash')}</button>` : ''}</div></div>`;
  }).join('') + '</div>';
}
function viewMusic() {
  const pc = isPC();
  const used = usedSoundIds();
  const list = Object.values(S.sounds).filter((x) => pc || used.has(x.id)).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const big = Object.values(S.sounds).filter((x) => !/\.ogg$/.test(x.media || ''));
  const total = list.reduce((a, x) => a + (mediaKeysHere.has(x.media) ? x.size || 0 : 0), 0);
  let h = `<div class="view-inner"><div class="page-head"><h1>Musik</h1>${pc ? `<label class="btn">${ic('plus')}Musik hinzufügen<input type="file" accept="audio/*,.mp3,.m4a,.ogg,.wav,.flac" multiple hidden data-c="snd-files"></label>` : ''}</div>
    <p class="hint" style="margin:-6px 0 12px">${pc
      ? 'Deine eigenen Musikdateien. Beim Hinzufügen werden sie platzsparend gespeichert: Mono, höchstens 3 Minuten. Deine Originaldateien bleiben unverändert. Im Workout ordnest du jeder Übung und jeder Pause ein Stück zu; ist es kürzer als die Phase, wiederholt es sich.'
      : 'Auf diesem Gerät liegen nur die Stücke, die in deinen Workouts vorkommen.'} Belegt: ${(total / 1048576).toFixed(1)} MB.</p>`;
  if (pc && big.length && canShrink()) h += `<div class="callout warn">${big.length} Stück(e) sind noch in voller Größe gespeichert. <button class="btn sm" data-a="snd-shrink" style="margin-left:8px">Jetzt verkleinern</button></div>`;
  if (!list.length) h += `<div class="empty">Noch keine Musik.${pc ? ' „Musik hinzufügen“ tippen.' : ' Am PC hinzufügen und in einem Workout verwenden, dann hier „Holen“.'}</div>`;
  h += '<div class="grid cols">' + list.map((x) => {
    const n = soundUsedIn(x.id).length;
    const here = mediaKeysHere.has(x.media);
    const playing = previewAudio && previewAudio.dataset.id === x.id;
    const mb = (v) => v >= 1048576 ? (v / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(v / 1024)) + ' KB';
    const sz = `${mb(x.size || 0)}${x.origSize && x.origSize > x.size ? ` statt ${mb(x.origSize)}` : ''}`;
    return `<div class="card tight"><div class="card-row"><button class="icon-btn" data-a="snd-play" data-id="${x.id}" aria-label="Anhören" ${here ? '' : 'disabled'}>${ic(playing ? 'pause' : 'play')}</button>
      <div class="grow"><div class="card-title">${esc(x.name)}</div><div class="card-sub">${x.dur ? mmss(x.dur) + ' · ' : ''}${sz}${n ? ` · in ${n} Workout${n > 1 ? 's' : ''}` : ''}${here ? '' : ' · <span style="color:var(--z4)">fehlt – bitte „Holen“</span>'}</div></div>
      ${pc ? `<button class="icon-btn" data-a="snd-ren" data-id="${x.id}" title="Umbenennen" aria-label="Umbenennen">${ic('edit')}</button>${n ? '' : `<button class="icon-btn" data-a="snd-del" data-id="${x.id}" title="Löschen" aria-label="Löschen">${ic('trash')}</button>`}` : ''}</div></div>`;
  }).join('') + '</div></div>';
  return h;
}
function viewData() {
  const pc = isPC();
  const busy = ui.busy;
  let h = `<div class="view-inner narrow"><div class="page-head"><h1>Daten</h1></div>
    <div class="card"><h3>Dieses Gerät</h3><div class="field" style="margin-top:10px;margin-bottom:0"><label for="dev">Gerätename (erscheint beim Abgleich)</label>
      <input type="text" id="dev" value="${esc(deviceName())}" placeholder="z. B. Handy, Chromebook oder PC" data-c="device"></div></div>`;
  if (!syncReady()) {
    h += `<div class="card"><h3>Abgleich über GitHub <span class="badge std">Standardweg</span></h3>
      <p class="small muted" style="margin-top:6px">So kommen deine Workouts vom PC aufs Handy und aufs Chromebook: <b>Senden</b> am PC, <b>Holen</b> auf dem anderen Gerät – mit Übungsbildern und MP3s. Die Ablage ist dein privates Repository (wie bei fitlog) im eigenen Ordner <b>basementbox/</b>.</p>
      <div class="card-actions"><button class="btn" data-a="sync-setup">${ic('sync')}Einrichten</button></div></div>`;
  } else {
    h += `<div class="card"><h3>Abgleich über GitHub <span class="badge std">Standardweg</span></h3>
      <p class="small muted" style="margin-top:6px">Ablage: <b>${esc(sync.repo)}</b>, Ordner basementbox/<br>Zuletzt gesendet: <b>${tsText(sync.lastSend)}</b><br>Zuletzt geholt: <b>${tsText(sync.lastFetch)}</b></p>
      ${ui.news && !busy ? '<div class="callout">Auf GitHub liegt ein neuerer Stand. Bitte „Holen“.</div>' : ''}
      ${S.dirty && pc && !busy ? '<div class="callout warn">Hier gibt es Änderungen, die noch nicht gesendet wurden.</div>' : ''}
      <div class="btn-row eq" style="margin-top:12px">${pc ? `<button class="btn" data-a="sync-send" ${busy ? 'disabled' : ''}>${ic('upload')}${busy && busy !== 'Holen …' && !busy.startsWith('Dateien holen') ? esc(busy) : 'Senden'}</button>` : ''}
        <button class="btn ${pc ? 'ghost' : ''}" data-a="sync-fetch" ${busy ? 'disabled' : ''}>${ic('download')}${busy && (busy === 'Holen …' || busy.startsWith('Dateien holen')) ? esc(busy) : 'Holen'}</button></div>
      <p class="hint">${pc ? '<b>Senden</b> legt Workouts, Übungsbilder und MP3s dieses PCs auf GitHub ab – nach jeder Änderung. ' : ''}<b>Holen</b> übernimmt, was am PC gesendet wurde. Danach läuft alles auch ohne Internet.</p>
      <div class="card-actions"><button class="btn sm ghost" data-a="sync-setup" ${busy ? 'disabled' : ''}>Einstellungen</button></div></div>`;
  }
  h += `<div class="card"><h3>Speicher</h3><p class="small muted" style="margin-top:6px">${S.workouts.length} Workouts · ${Object.keys(S.exercises).length} Übungen · ${Object.keys(S.sounds).length} MP3s</p><p class="small muted" id="quota"></p></div>`;
  h += `<div class="card"><h3>Hilfe</h3><p class="small muted" style="margin-top:6px">Basement Box Version ${APP_VERSION}. Es wird nichts protokolliert – das Festhalten deiner Ergebnisse bleibt bei fitlog.</p></div></div>`;
  setTimeout(showQuota, 0);
  return h;
}
async function showQuota() {
  const el = $('#quota'); if (!el || !navigator.storage || !navigator.storage.estimate) return;
  try { const e = await navigator.storage.estimate(); el.textContent = `Belegt: ${(e.usage / 1048576).toFixed(0)} MB von ca. ${(e.quota / 1073741824).toFixed(1)} GB`; } catch (e) { /* egal */ }
}

// ---------- Workout-Editor (am PC) ----------
function viewEditor() {
  const w = ui.ed;
  const timed = w.mode === 'time';
  let h = `<div class="view-inner"><div class="page-head"><h1>${w._new ? 'Neues Workout' : 'Workout bearbeiten'}</h1></div>
    <div class="ed-head">
      <div class="field"><label for="edName">Name</label><input type="text" id="edName" value="${esc(w.name)}" data-in="ed-name" placeholder="z. B. Keller-Zirkel A"></div>
      <div class="field"><label>Ablauf</label><div class="seg"><button class="${timed ? 'on' : ''}" data-a="ed-mode" data-m="time">Auf Zeit</button><button class="${timed ? '' : 'on'}" data-a="ed-mode" data-m="tap">Per Tippen</button></div></div>
      ${timed ? `<div class="field"><label for="edWork">Übung (Sekunden)</label><input type="number" min="1" id="edWork" value="${w.work}" data-c="ed-num" data-f="work"></div>
      <div class="field"><label for="edRest">Pause (Sekunden)</label><input type="number" min="0" id="edRest" value="${w.rest}" data-c="ed-num" data-f="rest"></div>` : '<div></div><div></div>'}
    </div>
    <p class="hint">${timed ? 'Die Zeiten gelten für alle Übungen. Bei einzelnen Übungen kannst du sie unten abweichend eintragen. Vor dem Start läuft ein Countdown von ' + (w.prep || 10) + ' Sekunden.' : 'Nach jeder Übung tippst du auf „Weiter“. Unter „Vorgabe“ kannst du z. B. „12 Wdh“ eintragen – das steht dann groß auf dem Bildschirm.'}</p>`;
  w.blocks.forEach((b, bi) => {
    h += `<div class="block"><div class="block-head">
      <input type="text" class="bname" value="${esc(b.title)}" placeholder="Abschnitt ${bi + 1} (Titel optional)" data-in="bl-title" data-b="${bi}">
      <label class="small muted">Runden <input type="number" min="1" class="rounds" value="${b.rounds}" data-c="bl-rounds" data-b="${bi}"></label>
      <button class="icon-btn" data-a="bl-move" data-b="${bi}" data-d="-1" ${bi === 0 ? 'disabled' : ''} aria-label="Abschnitt nach oben">${ic('up')}</button>
      <button class="icon-btn" data-a="bl-move" data-b="${bi}" data-d="1" ${bi === w.blocks.length - 1 ? 'disabled' : ''} aria-label="Abschnitt nach unten">${ic('down')}</button>
      <button class="icon-btn" data-a="bl-del" data-b="${bi}" aria-label="Abschnitt löschen">${ic('trash')}</button></div>`;
    if (!b.items.length) h += '<p class="hint" style="margin:0 0 6px">Noch leer. Unten eine Übungs-ID eintippen und Enter drücken.</p>';
    b.items.forEach((it, ii) => {
      const tools = `<div class="it-tools"><button class="icon-btn" data-a="it-move" data-b="${bi}" data-i="${ii}" data-d="-1" aria-label="Nach oben">${ic('up')}</button><button class="icon-btn" data-a="it-move" data-b="${bi}" data-i="${ii}" data-d="1" aria-label="Nach unten">${ic('down')}</button><button class="icon-btn" data-a="it-del" data-b="${bi}" data-i="${ii}" aria-label="Entfernen">${ic('trash')}</button></div>`;
      if (it.t === 'text') {
        h += `<div class="item text"><div class="thumb ph sm">${ic('text')}</div><div class="it-main"><textarea rows="1" placeholder="Eigener Text, z. B. „Ab jetzt: Every Minute on the Minute“" data-in="it-text" data-b="${bi}" data-i="${ii}">${esc(it.text)}</textarea></div>${tools}</div>`;
        return;
      }
      const ex = S.exercises[it.exId];
      h += `<div class="item">${thumb(ex, 'sm')}<div class="it-main"><div class="it-name"><span class="badge id">ID ${esc(it.exId)}</span> ${ex ? esc(ex.name) : '<span style="color:var(--z5)">fehlt in Basement Box</span>'}</div>
        <div class="it-fields">
          ${timed ? `<label>Übung s<input type="number" min="1" value="${it.work ?? ''}" placeholder="${w.work}" data-c="it-num" data-f="work" data-b="${bi}" data-i="${ii}"></label>
          <label>Pause s<input type="number" min="0" value="${it.rest ?? ''}" placeholder="${w.rest}" data-c="it-num" data-f="rest" data-b="${bi}" data-i="${ii}"></label>`
          : `<label>Vorgabe<input type="text" class="reps" value="${esc(it.reps || '')}" placeholder="z. B. 12 Wdh" data-in="it-reps" data-b="${bi}" data-i="${ii}"></label>`}
          <label>Musik Übung<select data-c="it-snd" data-f="sound" data-b="${bi}" data-i="${ii}">${soundOptions(it.sound)}</select></label>
          ${timed ? `<label>Musik Pause danach<select data-c="it-snd" data-f="restSound" data-b="${bi}" data-i="${ii}">${soundOptions(it.restSound)}</select></label>` : ''}
        </div></div>${tools}</div>`;
    });
    h += `<div class="addrow"><input type="text" inputmode="numeric" placeholder="Übungs-ID" data-k="add-id" data-in="add-id-in" data-b="${bi}" id="addId${bi}" autocomplete="off">
      <button class="btn sm" data-a="it-add" data-b="${bi}">${ic('plus')}Übung</button>
      <button class="btn sm ghost" data-a="it-text" data-b="${bi}">${ic('text')}Text einfügen</button>
      <span class="addhint" id="addHint${bi}"></span></div>`;
    if (Object.keys(S.sounds).length && b.items.some((x) => x.t === 'ex')) {
      h += `<div class="block-tools"><span class="small muted">Für alle Übungen dieses Abschnitts:</span>
        <select data-c="bl-snd" data-f="sound" data-b="${bi}">${soundOptions('', 'Musik Übung setzen …')}</select>
        ${timed ? `<select data-c="bl-snd" data-f="restSound" data-b="${bi}">${soundOptions('', 'Musik Pause setzen …')}</select>` : ''}</div>`;
    }
    h += '</div>';
  });
  h += `<button class="btn ghost" data-a="bl-add">${ic('plus')}Abschnitt hinzufügen</button>`;
  const d = workoutDuration(w);
  h += `<div class="ed-foot"><span class="muted small" style="margin-right:auto;align-self:center">${exCount(w)} Übungen${d ? ' · ca. ' + durText(d) : ''}</span>
    <button class="btn blue" data-a="ed-trial">${ic('play')}Probelauf</button><button class="btn ghost" data-a="ed-cancel">Abbrechen</button><button class="btn" data-a="ed-save">${ic('check')}Speichern</button></div></div>`;
  return h;
}
function edRefresh(focusId) {
  const v = $('#view'), top = v.scrollTop;
  render();
  v.scrollTop = top;
  if (focusId) { const el = $('#' + focusId); if (el) el.focus(); }
}
function edAddId(bi) {
  const inp = $('#addId' + bi); if (!inp) return;
  const id = obsNorm(inp.value);
  if (!id) { inp.focus(); return; }
  if (!S.exercises[id]) { toast(`Keine Übung mit ID ${id} in Basement Box. Am PC „Aus Obsidian holen“.`, { error: true }); inp.select(); return; }
  const b = ui.ed.blocks[bi];
  const prev = [...b.items].reverse().find((x) => x.t === 'ex');
  b.items.push({ t: 'ex', exId: id, sound: prev ? prev.sound || '' : '', restSound: prev ? prev.restSound || '' : '' });
  edRefresh('addId' + bi);
}

// ---------- Modal, Toast ----------
function modalHead(title) { return `<div class="modal-head"><h2>${title}</h2><button class="icon-btn" data-a="modal-close" aria-label="Schließen">${ic('x')}</button></div>`; }
function openModal(html, o = {}) {
  ui.modal = o;
  $('#modal-root').innerHTML = `<div class="modal-back" data-a="${o.sticky ? '' : 'modal-back'}"><div class="modal ${o.wide ? 'wide' : ''}">${html}</div></div>`;
}
function closeModal() { $('#modal-root').innerHTML = ''; ui.modal = null; ui.obs = null; }
function toast(msg, o = {}) {
  const el = document.createElement('div');
  el.className = 'toast' + (o.error ? ' error' : '');
  el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.remove(), o.timeout || 3500);
}

/* ================= 9 Aktionen ================= */
function itAt(el) { return ui.ed.blocks[+el.dataset.b].items[+el.dataset.i]; }
function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
const ACTIONS = {
  tab: (el) => { if (ui.ed && !confirm('Workout-Bearbeitung verwerfen?')) return; ui.ed = null; ui.tab = el.dataset.tab; render(); $('#view').scrollTop = 0; },
  'modal-close': () => closeModal(),
  'modal-back': (el, ev) => { if (ev.target === el) closeModal(); },
  // Workouts
  'wo-new': () => { ui.ed = Object.assign(newWorkout(), { _new: true }); render(); $('#view').scrollTop = 0; },
  'wo-edit': (el) => { const w = S.workouts.find((x) => x.id === el.dataset.id); if (!w) return; ui.ed = JSON.parse(JSON.stringify(w)); render(); $('#view').scrollTop = 0; },
  'wo-copy': async (el) => {
    const w = S.workouts.find((x) => x.id === el.dataset.id); if (!w) return;
    const c = JSON.parse(JSON.stringify(w)); c.id = uid(); c.name = (w.name || 'Workout') + ' (Kopie)'; c.createdAt = c.updatedAt = Date.now();
    c.blocks.forEach((b) => { b.id = uid(); });
    S.workouts.push(c); await save(); render();
  },
  'wo-del': async (el) => {
    const w = S.workouts.find((x) => x.id === el.dataset.id); if (!w) return;
    if (!confirm(`Workout „${w.name || 'Ohne Namen'}“ löschen?`)) return;
    S.workouts = S.workouts.filter((x) => x !== w); await save(); render();
  },
  'wo-start': (el) => startDialog(el.dataset.id),
  ann: (el) => { localStorage.setItem('bb_ann', el.dataset.k); $$('#annSeg button').forEach((b) => b.classList.toggle('on', b === el)); },
  'play-go': () => { if (pendingPlay) playStart(pendingPlay.w, pendingPlay.trial); pendingPlay = null; },
  spd: (el) => { localStorage.setItem('bb_trial_speed', el.dataset.k); $$('#spdSeg button').forEach((b) => b.classList.toggle('on', b === el)); },
  'ed-trial': () => startDialog(null, true),
  'play-next': () => playNext(),
  'play-prev': () => playPrev(),
  'play-pause': () => playPause(),
  'play-close': () => playClose(),
  'play-music': () => { AE.music = !AE.music; aeRamp(aeTarget(), 0.3); renderPlayer(); },
  'play-full': () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => {}); },
  // Editor
  'ed-mode': (el) => { ui.ed.mode = el.dataset.m; edRefresh(); },
  'ed-cancel': () => { if (!confirm('Änderungen verwerfen?')) return; ui.ed = null; render(); },
  'ed-save': async () => {
    const w = ui.ed;
    if (!w.name.trim()) { toast('Bitte einen Namen eingeben.', { error: true }); $('#edName').focus(); return; }
    if (!exCount(w)) { toast('Bitte mindestens eine Übung hinzufügen.', { error: true }); return; }
    delete w._new; w.updatedAt = Date.now();
    const i = S.workouts.findIndex((x) => x.id === w.id);
    if (i < 0) S.workouts.push(w); else S.workouts[i] = w;
    ui.ed = null; await save(); render();
    toast('Gespeichert. Unter „Daten“ senden, damit Handy und Chromebook es holen können.', { timeout: 6000 });
  },
  'bl-add': () => { ui.ed.blocks.push(newBlock()); edRefresh('addId' + (ui.ed.blocks.length - 1)); },
  'bl-del': (el) => { const b = ui.ed.blocks[+el.dataset.b]; if (b.items.length && !confirm('Abschnitt mit allen Einträgen löschen?')) return; ui.ed.blocks.splice(+el.dataset.b, 1); if (!ui.ed.blocks.length) ui.ed.blocks.push(newBlock()); edRefresh(); },
  'bl-move': (el) => { move(ui.ed.blocks, +el.dataset.b, +el.dataset.d); edRefresh(); },
  'it-add': (el) => edAddId(+el.dataset.b),
  'it-text': (el) => { const b = ui.ed.blocks[+el.dataset.b]; b.items.push({ t: 'text', text: '' }); edRefresh(); const ta = $$(`textarea[data-b="${el.dataset.b}"]`).pop(); if (ta) ta.focus(); },
  'it-move': (el) => { move(ui.ed.blocks[+el.dataset.b].items, +el.dataset.i, +el.dataset.d); edRefresh(); },
  'it-del': (el) => { ui.ed.blocks[+el.dataset.b].items.splice(+el.dataset.i, 1); edRefresh(); },
  // Übungen
  'obs-open': () => obsStart(),
  'obs-apply': () => obsApply(),
  'ex-del': async (el) => {
    const id = el.dataset.id;
    if (exUsedIn(id).length) return;
    if (!confirm(`Übung ID ${id} aus Basement Box entfernen? In Obsidian bleibt sie, und beim Holen kommt sie nicht wieder (unten unter „Gelöschte Übungen“ kannst du sie zurückholen).`)) return;
    delete S.exercises[id]; S.deleted = S.deleted || {}; S.deleted[id] = Date.now();
    await save(); await mediaCleanup(); render();
  },
  'ex-undel': async (el) => { delete S.deleted[el.dataset.id]; await save(); render(); toast(`ID ${el.dataset.id} kommt beim nächsten „Aus Obsidian holen“ wieder.`); },
  // Musik
  'snd-play': (el) => previewSound(el.dataset.id),
  'snd-shrink': () => shrinkExisting(),
  'snd-del': async (el) => { const s = S.sounds[el.dataset.id]; if (!s || !confirm(`„${s.name}“ löschen?`)) return; delete S.sounds[s.id]; await save(); await mediaCleanup(); render(); },
  'snd-ren': async (el) => { const s = S.sounds[el.dataset.id]; if (!s) return; const n = prompt('Neuer Name', s.name); if (n == null || !n.trim()) return; s.name = n.trim(); await save(); render(); },
  // Abgleich
  'sync-setup': () => openModal(syncSetupHtml()),
  'sync-save': () => syncSaveSetup(),
  'sync-take': () => { try { const fl = JSON.parse(localStorage.getItem('aofl_sync')); $('#syRepo').value = fl.repo; $('#syToken').value = fl.token; } catch (e) { /* egal */ } },
  'sync-off': () => { if (!confirm('Abgleich auf diesem Gerät trennen? Die Daten hier bleiben.')) return; sync = null; saveSync(); closeModal(); render(); },
  'sync-send': () => syncSend(false),
  'sync-send-force': () => syncSend(true),
  'sync-fetch': () => syncFetch(false),
  'sync-fetch-force': () => syncFetch(true),
  'update-now': () => { if (swWaiting) swWaiting.postMessage('skipWaiting'); else location.reload(); }
};
const CHANGES = {
  'ed-num': (el) => { ui.ed[el.dataset.f] = Math.max(el.dataset.f === 'rest' ? 0 : 1, Math.round(num(el.value))); edRefresh(); },
  'bl-rounds': (el) => { ui.ed.blocks[+el.dataset.b].rounds = Math.max(1, Math.round(num(el.value)) || 1); edRefresh(); },
  'it-num': (el) => { const it = itAt(el); const v = el.value.trim(); if (v === '') delete it[el.dataset.f]; else it[el.dataset.f] = Math.max(el.dataset.f === 'rest' ? 0 : 1, Math.round(num(v))); edRefresh(); },
  'it-snd': (el) => { itAt(el)[el.dataset.f] = el.value; },
  'bl-snd': (el) => { if (!el.value) return; for (const it of ui.ed.blocks[+el.dataset.b].items) if (it.t === 'ex') it[el.dataset.f] = el.value; edRefresh(); },
  'obs-dir': (el) => { const files = [...(el.files || [])]; el.value = ''; if (files.length) obsRun(obsTreeFromFiles(files)); },
  device: (el) => { localStorage.setItem('bb_device', el.value.trim()); },
  'snd-files': (el) => { const files = [...(el.files || [])]; el.value = ''; if (files.length) addSounds(files); }
};
const INPUTS = {
  'ed-name': (el) => { ui.ed.name = el.value; },
  'bl-title': (el) => { ui.ed.blocks[+el.dataset.b].title = el.value; },
  'it-text': (el) => { itAt(el).text = el.value; },
  'it-reps': (el) => { itAt(el).reps = el.value; },
  'add-id-in': (el) => {
    const hint = $('#addHint' + el.dataset.b); if (!hint) return;
    const id = obsNorm(el.value), ex = id && S.exercises[id];
    hint.innerHTML = !id ? '' : ex ? `${ic('check')} <b>${esc(ex.name)}</b> – Enter fügt hinzu` : `ID ${esc(id)} nicht vorhanden`;
  },
  'ex-q': (el) => {
    ui.exQ = el.value;
    const q = el.value.trim().toLowerCase(), qi = obsNorm(q);
    $('#exList').innerHTML = exListHtml(Object.values(S.exercises).filter((e) => !q || e.name.toLowerCase().includes(q) || e.id === qi).sort((a, b) => idSort(a.id, b.id)));
    hydrate($('#exList'));
  }
};

/* ================= 10 Start ================= */
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el || el.disabled || !el.dataset.a) return;
  const fn = ACTIONS[el.dataset.a];
  if (fn) fn(el, ev);
});
document.addEventListener('change', (ev) => { const el = ev.target.closest('[data-c]'); if (el && CHANGES[el.dataset.c]) CHANGES[el.dataset.c](el, ev); });
document.addEventListener('input', (ev) => { const el = ev.target.closest('[data-in]'); if (el && INPUTS[el.dataset.in]) INPUTS[el.dataset.in](el, ev); });
document.addEventListener('keydown', (ev) => {
  const t = ev.target;
  if (ev.key === 'Enter' && t && t.dataset && t.dataset.k === 'add-id') { ev.preventDefault(); edAddId(+t.dataset.b); return; }
  if (P && !P.done) {
    // Chromebook-Tastatur: Leertaste/Enter = Weiter (bei „per Tippen“) bzw. Pause; Pfeile = vor/zurück
    const s = P.steps[P.i];
    if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); if (s.kind === 'work' && !s.dur) playNext(); else playPause(); return; }
    if (ev.key === 'ArrowRight') { playNext(); return; }
    if (ev.key === 'ArrowLeft') { playPrev(); return; }
  }
  if (ev.key === 'Escape' && ui.modal) closeModal();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { if (P && !P.paused && !P.done) wakeOn(); syncCheck(); }
});
if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

let swWaiting = null;
function showUpdate() {
  $('#banner-root').innerHTML = `<div class="banner"><span>Neue Version verfügbar</span><button class="btn sm" data-a="update-now">Neu laden</button></div>`;
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) { swWaiting = reg.waiting; showUpdate(); }
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw && nw.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) { swWaiting = nw; showUpdate(); } });
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60000);
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && !P) { reloaded = true; location.reload(); } });
}

(async function init() {
  $('#ver').textContent = 'v' + APP_VERSION;
  await loadData();
  try { mediaKeysHere = new Set(await idbKeys('media')); } catch (e) { /* egal */ }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if (!isPC()) ui.tab = 'workouts';
  render();
  syncCheck();
})();

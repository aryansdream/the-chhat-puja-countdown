import express from 'express';
import { createServer } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || 3001);
const maxFloatingDiyas = 40;
const root = path.dirname(fileURLToPath(import.meta.url));
const prayerStore = path.join(root, 'data', 'prayers.json');
const audioStore = path.join(root, 'data', 'audio');
const audioManifest = path.join(audioStore, 'library.json');
fs.mkdirSync(path.dirname(prayerStore), { recursive: true });
fs.mkdirSync(audioStore, { recursive: true });
let prayers = [];
let audioTracks = [];
try {
  const saved = JSON.parse(fs.readFileSync(prayerStore, 'utf8'));
  if (Array.isArray(saved)) prayers = saved;
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not read saved prayer history:', error.message);
}
try {
  const saved = JSON.parse(fs.readFileSync(audioManifest, 'utf8'));
  if (Array.isArray(saved)) audioTracks = saved.filter(track => track && typeof track.id === 'string' && typeof track.file === 'string');
} catch (error) {
  if (error.code !== 'ENOENT') console.error('Could not read shared audio library:', error.message);
}

const audioMimeExtensions = new Map([
  ['audio/mpeg', '.mp3'], ['audio/mp4', '.m4a'], ['audio/aac', '.aac'],
  ['audio/wav', '.wav'], ['audio/x-wav', '.wav'], ['audio/ogg', '.ogg'],
  ['audio/webm', '.webm'], ['audio/flac', '.flac'],
]);
const publicTracks = () => audioTracks.map(({ id, title, mimeType }) => ({ id, title, mimeType, url: `/audio/${id}` }));
function saveAudioManifest() { fs.writeFileSync(audioManifest, JSON.stringify(audioTracks, null, 2)); }
function adminAuthorized(req) {
  const expected = process.env.AUDIO_ADMIN_PASSWORD;
  const supplied = req.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected), right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}
function requireAudioAdmin(req, res, next) {
  if (!process.env.AUDIO_ADMIN_PASSWORD) return res.status(503).json({ error: 'Owner song uploads are not configured. Set AUDIO_ADMIN_PASSWORD on the server.' });
  if (!adminAuthorized(req)) return res.status(401).json({ error: 'Owner password is incorrect.' });
  next();
}

app.use(express.json({ limit: '4kb' }));
app.get('/api/audio', (_req, res) => res.json({ tracks: publicTracks() }));
app.get('/api/admin/audio/config', (_req, res) => res.json({ configured: Boolean(process.env.AUDIO_ADMIN_PASSWORD) }));
app.post('/api/admin/audio', requireAudioAdmin, express.raw({ type: () => true, limit: '50mb' }), (req, res) => {
  const mimeType = (req.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!audioMimeExtensions.has(mimeType)) return res.status(415).json({ error: 'Choose an MP3, M4A, AAC, WAV, OGG, WebM, or FLAC audio file.' });
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ error: 'The selected audio file is empty.' });
  const id = randomUUID();
  const titleHeader = req.get('x-audio-title') || '';
  let title = titleHeader;
  try { title = decodeURIComponent(titleHeader); } catch {}
  title = path.basename(title).replace(/\.[^.]+$/, '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 120) || 'Chhath song';
  const file = `${id}${audioMimeExtensions.get(mimeType)}`;
  try {
    fs.writeFileSync(path.join(audioStore, file), req.body, { flag: 'wx' });
    audioTracks = [...audioTracks, { id, title, file, mimeType, uploadedAt: new Date().toISOString() }];
    saveAudioManifest();
  } catch (error) {
    audioTracks = audioTracks.filter(track => track.id !== id);
    try { fs.rmSync(path.join(audioStore, file), { force: true }); } catch {}
    console.error('Could not save shared audio track:', error.message);
    return res.status(500).json({ error: 'Could not save this track to the shared library.' });
  }
  const tracks = publicTracks();
  res.status(201).json({ tracks });
});
app.delete('/api/admin/audio/:id', requireAudioAdmin, (req, res) => {
  const track = audioTracks.find(item => item.id === req.params.id);
  if (!track) return res.status(404).json({ error: 'Track not found.' });
  try {
    fs.rmSync(path.join(audioStore, track.file), { force: true });
    audioTracks = audioTracks.filter(item => item.id !== track.id);
    saveAudioManifest();
  } catch (error) {
    console.error('Could not remove shared audio track:', error.message);
    return res.status(500).json({ error: 'Could not remove this track.' });
  }
  const tracks = publicTracks();
  res.json({ tracks });
});
app.get('/audio/:id', (req, res) => {
  const track = audioTracks.find(item => item.id === req.params.id);
  if (!track) return res.sendStatus(404);
  res.type(track.mimeType);
  res.sendFile(path.join(audioStore, track.file));
});
app.get('/api/prayers', (_req, res) => res.json({ prayers, floatingLimit: maxFloatingDiyas }));
app.post('/api/prayers', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 50) : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 220) : '';
  const diya = ['Earthen diya', 'Lotus soop', 'Brass diya'].includes(req.body?.diya) ? req.body.diya : 'Earthen diya';
  if (!name || !message) return res.status(400).json({ error: 'Enter a name and prayer.' });
  const prayer = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, message, diya, createdAt: new Date().toISOString() };
  prayers = [...prayers, prayer];
  try {
    fs.writeFileSync(prayerStore, JSON.stringify(prayers, null, 2));
  } catch (error) {
    prayers.pop();
    return res.status(500).json({ error: 'Could not save this prayer.' });
  }
  res.status(201).json({ prayer, prayers, floatingLimit: maxFloatingDiyas });
});

app.use(express.static(path.join(root, 'dist')));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(root, 'dist', 'index.html'));
});

server.listen(port, '0.0.0.0', () => console.log(`Chhath live server listening on http://localhost:${port}`));

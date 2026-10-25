import { del } from '@vercel/blob';
import { database, ensureSchema } from '../lib/database.js';

function authorized(req) {
  const expected = process.env.AUDIO_ADMIN_PASSWORD || '';
  const supplied = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return expected.length > 0 && supplied.length === expected.length && Buffer.from(expected).equals(Buffer.from(supplied));
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'DELETE'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
  if (req.method === 'GET' && req.query?.config === '1') {
    return res.status(200).json({ configured: Boolean(process.env.AUDIO_ADMIN_PASSWORD), storageReady: Boolean(process.env.BLOB_READ_WRITE_TOKEN && (process.env.DATABASE_URL || process.env.POSTGRES_URL)) });
  }
  try {
    const sql = database();
    await ensureSchema(sql);
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, title, url, mime_type, uploaded_at FROM audio_tracks ORDER BY uploaded_at ASC`;
      return res.status(200).json({ tracks: rows.map(row => ({ id: row.id, title: row.title, url: row.url, mimeType: row.mime_type, uploadedAt: row.uploaded_at })) });
    }
    if (!process.env.AUDIO_ADMIN_PASSWORD) return res.status(503).json({ error: 'Set AUDIO_ADMIN_PASSWORD in Vercel project settings first.' });
    if (!authorized(req)) return res.status(401).json({ error: 'Owner password is incorrect.' });
    const id = typeof req.query?.id === 'string' ? req.query.id : '';
    const rows = await sql`SELECT id, url FROM audio_tracks WHERE id = ${id}`;
    if (!rows.length) return res.status(404).json({ error: 'Track not found.' });
    await del(rows[0].url);
    await sql`DELETE FROM audio_tracks WHERE id = ${id}`;
    const remaining = await sql`SELECT id, title, url, mime_type, uploaded_at FROM audio_tracks ORDER BY uploaded_at ASC`;
    return res.status(200).json({ tracks: remaining.map(row => ({ id: row.id, title: row.title, url: row.url, mimeType: row.mime_type, uploadedAt: row.uploaded_at })) });
  } catch (error) {
    console.error('Audio library unavailable:', error.message);
    return res.status(503).json({ error: 'Connect Vercel Blob and Postgres to use the shared audio library.' });
  }
}

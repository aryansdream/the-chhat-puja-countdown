import { randomUUID } from 'node:crypto';
import { database, ensureSchema, floatingDiyasLimit } from '../lib/database.js';

const asPrayer = row => ({ id: row.id, name: row.name, message: row.message, diya: row.diya, createdAt: row.created_at });

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed.' });
  try {
    const sql = database();
    await ensureSchema(sql);
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, name, message, diya, created_at FROM prayers ORDER BY created_at ASC`;
      return res.status(200).json({ prayers: rows.map(asPrayer), floatingLimit: floatingDiyasLimit });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 50) : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 220) : '';
    const diya = ['Earthen diya', 'Lotus soop', 'Brass diya'].includes(req.body?.diya) ? req.body.diya : 'Earthen diya';
    if (!name || !message) return res.status(400).json({ error: 'Enter a name and prayer.' });
    const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const inserted = await sql`INSERT INTO prayers (id, name, message, diya) VALUES (${id}, ${name}, ${message}, ${diya}) RETURNING id, name, message, diya, created_at`;
    const rows = await sql`SELECT id, name, message, diya, created_at FROM prayers ORDER BY created_at ASC`;
    return res.status(201).json({ prayer: asPrayer(inserted[0]), prayers: rows.map(asPrayer), floatingLimit: floatingDiyasLimit });
  } catch (error) {
    console.error('Prayer service unavailable:', error.message);
    return res.status(503).json({ error: 'Prayer storage is not configured or temporarily unavailable.' });
  }
}

import { handleUpload } from '@vercel/blob/client';
import { database, ensureSchema } from '../lib/database.js';

const mimeTypes = ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/flac'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.AUDIO_ADMIN_PASSWORD) return res.status(503).json({ error: 'Set AUDIO_ADMIN_PASSWORD in Vercel project settings first.' });
  try {
    const result = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        let payload;
        try { payload = JSON.parse(clientPayload || '{}'); } catch { throw new Error('Invalid upload details.'); }
        if (!payload.password || payload.password !== process.env.AUDIO_ADMIN_PASSWORD) throw new Error('Owner password is incorrect.');
        const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 120) : '';
        if (!title || !mimeTypes.includes(payload.mimeType)) throw new Error('Choose a supported audio file.');
        return {
          allowedContentTypes: mimeTypes,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ title, mimeType: payload.mimeType }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const metadata = JSON.parse(tokenPayload || '{}');
        const sql = database();
        await ensureSchema(sql);
        const id = blob.pathname.split('/').pop().replace(/\.[^.]+$/, '');
        await sql`INSERT INTO audio_tracks (id, title, pathname, url, mime_type) VALUES (${id}, ${metadata.title}, ${blob.pathname}, ${blob.url}, ${metadata.mimeType}) ON CONFLICT (pathname) DO UPDATE SET title = EXCLUDED.title, url = EXCLUDED.url, mime_type = EXCLUDED.mime_type`;
      },
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Audio upload failed:', error.message);
    return res.status(400).json({ error: error.message || 'Upload failed.' });
  }
}

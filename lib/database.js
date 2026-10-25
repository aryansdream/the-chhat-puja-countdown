import { neon } from '@neondatabase/serverless';

let schemaPromise;

export function database() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('Connect a Postgres database to this Vercel project.');
  return neon(connectionString);
}

export async function ensureSchema(sql) {
  schemaPromise ||= sql`
    CREATE TABLE IF NOT EXISTS prayers (
      id TEXT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      message VARCHAR(220) NOT NULL,
      diya VARCHAR(32) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.then(() => sql`
    CREATE TABLE IF NOT EXISTS audio_tracks (
      id TEXT PRIMARY KEY,
      title VARCHAR(120) NOT NULL,
      pathname TEXT NOT NULL UNIQUE,
      url TEXT NOT NULL,
      mime_type VARCHAR(80) NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  return schemaPromise;
}

export const floatingDiyasLimit = 40;

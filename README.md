# Chhath Puja sanctuary

Minimal, responsive React website built from the uploaded `chhath_puja_2026_portal.tsx` component. Start locally with `npm install` and `npm run dev`; this starts the Vite website and local prayer/audio API. Create a production build with `npm run build`.

## Live prayer wall

Visitors submit prayers from the inline chat on the home screen. The Vercel deployment stores all prayers in Postgres and refreshes the live view every few seconds; only the newest 40 offerings become floating diyas. The complete prayer history is retained. Local development stores prayers on the local server.

## Shared audio library

The owner manages songs at `/admin`. In production, audio files are uploaded directly to Vercel Blob and their playlist metadata is stored in Postgres. Add `AUDIO_ADMIN_PASSWORD` in Vercel project environment settings, and connect Vercel Blob plus a Postgres integration so Vercel provides `BLOB_READ_WRITE_TOKEN` and `DATABASE_URL` (or `POSTGRES_URL`). The owner upload page is disabled until those settings are present. Uploaded public audio is available to visitors and updates the player automatically. Only upload audio you have permission to host and stream.

The local `data/` folder is intentionally excluded from deployment and version control. Songs and prayer records stored there stay on this computer; add songs after connecting the production Blob store.

## Calendar

The 2026 ritual dates shown here are November 13–16: Nahay-Khay, Lohanda & Kharna, Sandhya Arghya, and Usha Arghya. The countdown targets November 15 at 5:00 PM India Standard Time as a general reference; actual local arghya times vary by location.

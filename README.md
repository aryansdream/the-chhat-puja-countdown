# Chhath Puja sanctuary

Minimal, responsive React website built from the uploaded `chhath_puja_2026_portal.tsx` component. Start locally with `npm install` and `npm run dev`; this starts the Vite website and local prayer/audio API. Create a production build with `npm run build`.

## Live prayer wall

Visitors submit prayers from the inline chat on the home screen. The Vercel deployment stores all prayers in Postgres and refreshes the live view every few seconds; only the newest 40 offerings become floating diyas. The complete prayer history is retained. Local development stores prayers on the local server.

## Shared audio library

The owner manages songs at `/admin`. In production, audio files are uploaded directly to Vercel Blob and their playlist metadata is stored in Postgres. Add `AUDIO_ADMIN_PASSWORD` in Vercel project environment settings, and connect Vercel Blob plus a Postgres integration so Vercel provides `BLOB_READ_WRITE_TOKEN` and `DATABASE_URL` (or `POSTGRES_URL`). The owner upload page is disabled until those settings are present. Uploaded public audio is available to visitors and updates the player automatically. Only upload audio you have permission to host and stream.

The local `data/` folder is intentionally excluded from deployment and version control. Songs and prayer records stored there stay on this computer; add songs after connecting the production Blob store.

## Calendar

`src/festival.js` is the shared calendar for the hero, countdown, daily offerings, and ritual journey. Verified Kartik Chhath dates are included for 2026–2030, with source links in the module. Add verified four-day dates here for later years; lunar festivals must never be advanced by adding 365 days.

The active ritual changes at midnight Asia/Kolkata for all visitors, including visitors outside India. Before the festival the timer targets Nahay-Khay. During the first three days it counts to the next ritual day’s midnight, explicitly labelled as a day change rather than a local Arghya time. Usha Arghya remains visible throughout the final day. At midnight after the final day, the date range, journey, and timer switch automatically to the next festival. If the date table is exhausted, the site displays a dates-pending message rather than inventing lunar dates.

Run `node --test src/festival.test.js` for midnight boundaries, festival completion, year rollover, localized dates, and countdown arithmetic. Run `npm run build` for the production build.

## Living scene

The background is rendered procedurally in Canvas 2D: blended dawn/day/sunset/night palettes, lunar phase, temple silhouettes, rippling reflections, flickering diyas, and drifting light. It uses no background-image files. The daily ritual changes the horizon glow. Rendering is capped at approximately 30 fps on desktop and 20 fps on phones, pauses in background tabs, and respects reduced-motion preferences.

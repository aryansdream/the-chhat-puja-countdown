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

The backdrop uses responsive gradients, while a dedicated arched scene combines original daily artwork with Canvas 2D water, reflections, flickering diyas, and atmospheric light. The interactive diyas remain inside this river, separated from text and forms. Rendering is capped at approximately 30 fps on desktop and 20 fps on phones, pauses offscreen and in background tabs, and respects reduced-motion preferences.

## Daily artwork and shared music

The home page pairs generated artwork for the active ritual with a separate animated river. Shared visitor diyas are restricted to scene-local water channels and never overlap the main text or prayer form. Four original artworks are stored in `public/images/ritual-0.webp` through `ritual-3.webp`, also used on the ritual journey. Background colors follow the active day.

One persistent audio player sits outside the changing page content. Navigation among Home, The journey, Offerings and Prayer wall preserves the same audio element, song and playback position. Default volume is 20%; echo starts disabled. On phones, Music settings exposes volume, echo, delay and library controls. Browsers may require one tap on Play before allowing music.

Validation: `node --test src/festival.test.js src/riverLayout.test.js` and `npm run build`. The canvas stops rendering when its river is offscreen or the browser tab is hidden.

## Phone interaction and autoplay

On phones, the daily art leads the page and the music player stays compact at the bottom. Music settings expands volume, echo, delay and library controls. Tapping a day opens a native modal card (a bottom sheet on phones), preserving the page position, trapping keyboard focus, and supporting Escape, dismissal, and previous/next day selection.

Audible autoplay is attempted immediately. If browser policy blocks it, the first pointer or keyboard interaction unlocks playback. A manual pause is respected; page navigation does not restart a paused song.

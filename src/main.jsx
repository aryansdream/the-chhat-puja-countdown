import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { upload as uploadBlob } from '@vercel/blob/client';
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Clock3, Flame, Menu, Moon, Pause, Play, SkipBack, SkipForward, Sun, Upload, Volume2, Waves, X } from 'lucide-react';
import './styles.css';

function AudioPlayer({ language, onPlayingChange }) {
  const [tracks, setTracks] = useState([]);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.72);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('');
  const [echoEnabled, setEchoEnabled] = useState(true);
  const [echoDelay, setEchoDelay] = useState(0.24);

  const audioRef = useRef(null);
  const autoplayRef = useRef(true);
  const audioContextRef = useRef(null);
  const echoNodesRef = useRef(null);
  const tracksRef = useRef(tracks);
  const selectedRef = useRef(selected);
  const track = tracks[selected];

  tracksRef.current = tracks;
  selectedRef.current = selected;

  useEffect(() => {
    let alive = true;
    const applyTracks = (incoming) => {
      if (!alive) return;
      const next = Array.isArray(incoming) ? incoming : [];
      const currentId = tracksRef.current[selectedRef.current]?.id;
      setTracks(next);
      const preservedIndex = next.findIndex((item) => item.id === currentId);
      setSelected(preservedIndex >= 0 ? preservedIndex : 0);
      if (!currentId && next.length) autoplayRef.current = true;
      if (!next.length) { setPlaying(false); onPlayingChange?.(false); }
      setStatus(next.length ? '' : language === 'hi' ? 'साझा गीत-संग्रह अभी खाली है' : 'The shared playlist is empty');
    };

    const refresh = () => fetch('/api/audio').then((response) => {
      if (!response.ok) throw new Error('audio api unavailable');
      return response.json();
    }).then((data) => applyTracks(data.tracks)).catch(() => setStatus(language === 'hi' ? 'साझा संगीत सेवा उपलब्ध नहीं है' : 'Shared music library is unavailable'));

    refresh(); const timer = setInterval(refresh, 8000); window.addEventListener('focus', refresh);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', refresh); onPlayingChange?.(false); };
  }, [language, onPlayingChange]);

  useEffect(() => {
    const audio = audioRef.current; if (!audio || !track) return;
    audio.src = track.url; audio.autoplay = true; audio.volume = volume; audio.load();
    if (autoplayRef.current) { autoplayRef.current = false; startAudio(true); }
  }, [track?.url]);

  useEffect(() => { if (audioRef.current) audioRef.current.volume = volume; }, [volume]);

  useEffect(() => {
    if (echoNodesRef.current) {
      echoNodesRef.current.wet.gain.setTargetAtTime(echoEnabled ? 0.64 : 0, audioContextRef.current.currentTime, 0.12);
      echoNodesRef.current.feedback.gain.setTargetAtTime(echoEnabled ? 0.54 : 0, audioContextRef.current.currentTime, 0.12);
    }
  }, [echoEnabled]);

  useEffect(() => { if (echoNodesRef.current) echoNodesRef.current.delay.delayTime.setTargetAtTime(echoDelay, audioContextRef.current.currentTime, 0.08); }, [echoDelay]);
  useEffect(() => { prepareEcho(); return () => { audioContextRef.current?.close().catch(() => {}); }; }, []);

  function prepareEcho() {
    const audio = audioRef.current; if (!audio || audioNodesReady()) return audioContextRef.current;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) { setStatus(language === 'hi' ? 'इस ब्राउज़र में इको उपलब्ध नहीं है' : 'Echo is not available in this browser'); return null; }
    const context = new AudioContextClass(); const source = context.createMediaElementSource(audio);
    const dry = context.createGain(); dry.gain.value = 0.8;
    const delay = context.createDelay(1.5); delay.delayTime.value = echoDelay;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1700; filter.Q.value = 0.35;
    const wet = context.createGain(); wet.gain.value = echoEnabled ? 0.64 : 0;
    const feedback = context.createGain(); feedback.gain.value = echoEnabled ? 0.54 : 0;
    const limiter = context.createDynamicsCompressor(); limiter.threshold.value = -9; limiter.knee.value = 12; limiter.ratio.value = 4; limiter.attack.value = 0.004; limiter.release.value = 0.22;
    dry.connect(limiter); limiter.connect(context.destination); source.connect(dry); source.connect(delay); delay.connect(filter); filter.connect(wet).connect(limiter); filter.connect(feedback).connect(delay);
    audioContextRef.current = context; echoNodesRef.current = { delay, wet, feedback };
    return context;
  }

  function audioNodesReady() { return Boolean(echoNodesRef.current); }
  function changeTrack(step) { if (!tracks.length) return; autoplayRef.current = true; setSelected((index) => (index + step + tracks.length) % tracks.length); }

  async function startAudio(isAutoplay = false) {
    const audio = audioRef.current; if (!track || !audio) { setStatus(language === 'hi' ? 'साझा गीत-संग्रह अभी खाली है' : 'The shared playlist is empty'); return; }
    const context = prepareEcho(); try { if (context?.state === 'suspended') await context.resume(); } catch {}
    try { await audio.play(); if (context?.state === 'suspended') { audio.pause(); if (isAutoplay) setStatus(language === 'hi' ? 'संगीत के लिए ▶ दबाएँ' : 'Tap ▶ once to enable music'); } } catch { setPlaying(false); onPlayingChange?.(false); setStatus(isAutoplay ? (language === 'hi' ? 'संगीत के लिए ▶ दबाएँ' : 'Tap ▶ once to enable music') : (language === 'hi' ? 'यह गीत नहीं चल सका' : 'This song could not be played.')); }
  }

  function togglePlayback() {
    const audio = audioRef.current; if (!track || !audio) { setStatus(language === 'hi' ? 'साझा गीत-संग्रह अभी खाली है' : 'The shared playlist is empty'); return; }
    if (audio.paused || audioContextRef.current?.state === 'suspended') startAudio(false); else audio.pause();
  }
  const timeLabel = (value) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

  return (
    <div className="audio-player">
      <audio crossOrigin="anonymous" ref={audioRef} preload="metadata" onPlay={() => { const context = prepareEcho(); if (context?.state === 'suspended') context.resume().catch(() => {}); setPlaying(true); onPlayingChange?.(true); setStatus(''); }} onPause={() => { setPlaying(false); onPlayingChange?.(false); }} onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)} onEnded={() => changeTrack(1)} onError={() => track && setStatus(language === 'hi' ? 'इस गीत को चलाया नहीं जा सका' : 'This audio file could not be played.')} />
      <div className="audio-track-info"><strong>{track?.title || (language === 'hi' ? 'छठ के गीत' : 'Chhath songs')}</strong><span>{status || (tracks.length ? `${selected + 1} / ${tracks.length} · ${language === 'hi' ? 'साझा प्लेलिस्ट' : 'shared playlist'}` : language === 'hi' ? 'जल्द ही गीत उपलब्ध होंगे' : 'Songs will appear here when added by Aryan')}</span></div>
      <div className="audio-controls"><button onClick={() => changeTrack(-1)} disabled={!tracks.length} aria-label={language === 'hi' ? 'पिछला गीत' : 'Previous song'}><SkipBack size={17} /></button><button className="audio-play" onClick={togglePlayback} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={19} /> : <Play size={19} />}</button><button onClick={() => changeTrack(1)} disabled={!tracks.length} aria-label={language === 'hi' ? 'अगला गीत' : 'Next song'}><SkipForward size={17} /></button>
        <div className="audio-volume"><Volume2 size={16} /><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></div>
        <button className={`audio-echo ${echoEnabled ? 'active' : ''}`} type="button" aria-pressed={echoEnabled} title={language === 'hi' ? 'लाउडस्पीकर जैसा इको' : 'Roadspeaker echo'} onClick={() => setEchoEnabled((value) => !value)}><Waves size={15} /><span>{language === 'hi' ? 'इको' : 'Echo'}</span></button>
        <label className={`audio-delay ${echoEnabled ? '' : 'muted'}`} title={language === 'hi' ? 'दोहराव के बीच का समय' : 'Time between echo repeats'}><span>{language === 'hi' ? 'गूंज' : 'Delay'}</span><input aria-label={language === 'hi' ? 'गूंज के बीच का समय' : 'Echo delay'} type="range" min="0.18" max="0.95" step="0.01" value={echoDelay} disabled={!echoEnabled} onChange={(event) => setEchoDelay(Number(event.target.value))} /><small>{echoDelay.toFixed(2)}s</small></label>
        <a className="audio-add" href="/admin" aria-label={language === 'hi' ? 'मालिक के लिए गीत प्रबंधन' : 'Owner song management'}><Upload size={15} /><span>{language === 'hi' ? 'मालिक प्रबंधन' : 'Manage songs'}</span></a>
      </div>
      <div className="audio-progress"><span>{timeLabel(time)}</span><input aria-label="Seek" type="range" min="0" max={duration || 0} step="0.1" value={Math.min(time, duration || 0)} onChange={(event) => { const next = Number(event.target.value); setTime(next); if (audioRef.current) audioRef.current.currentTime = next; }} /><span>{timeLabel(duration)}</span></div>
    </div>
  );
}

function AudioAdmin() {
  const [password, setPassword] = useState(() => sessionStorage.getItem('audio-admin-token') || '');
  const [tracks, setTracks] = useState([]); const [configured, setConfigured] = useState(true); const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState('');
  const headers = () => ({ Authorization: `Bearer ${password}` });

  async function refresh() {
    const configUrl = import.meta.env.DEV ? '/api/admin/audio/config' : '/api/audio?config=1';
    const config = await fetch(configUrl).then((r) => r.json());
    setConfigured(Boolean(config.configured) && (import.meta.env.DEV || Boolean(config.storageReady)));
    const response = await fetch('/api/audio'); const data = await response.json(); setTracks(data.tracks || []);
  }

  useEffect(() => { refresh().catch(() => setStatus('Could not connect to the shared music library.')); }, []);

  async function upload(event) {
    event.preventDefault(); const form = event.currentTarget; const files = Array.from(form.elements.songs.files || []);
    if (!password || !files.length || !rights) return;
    setBusy(true); setStatus('Uploading tracks to the shared library…');
    try {
      for (const file of files) {
        if (import.meta.env.DEV) {
          const response = await fetch('/api/admin/audio', { method: 'POST', headers: { ...headers(), 'Content-Type': file.type || 'application/octet-stream', 'X-Audio-Title': encodeURIComponent(file.name) }, body: file });
          const data = await response.json(); if (!response.ok) throw new Error(data.error || `Could not upload ${file.name}`); setTracks(data.tracks || []);
        } else {
          await uploadBlob(`chhath-audio/${crypto.randomUUID()}-${file.name.replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 100)}`, file, { access: 'public', handleUploadUrl: '/api/audio-upload', contentType: file.type, clientPayload: JSON.stringify({ password, title: file.name.replace(/\.[^.]+$/, ''), mimeType: file.type }), });
          const refreshed = await fetch('/api/audio').then((response) => response.json()); setTracks(refreshed.tracks || []);
        }
      }
      form.reset(); setRights(false); setStatus('Uploaded. The shared playlist has updated for everyone.');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function removeTrack(id) {
    setStatus('');
    try {
      const response = await fetch(import.meta.env.DEV ? `/api/admin/audio/${encodeURIComponent(id)}` : `/api/audio?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not remove this track.');
      setTracks(data.tracks || []); setStatus('Track removed from the shared playlist.');
    } catch (error) { setStatus(error.message); }
  }

  return (
    <main className="audio-admin-page"><a className="brand" href="/"><span className="brand-mark"><Sun size={20} /></span><span>{language === 'hi' ? 'छठ' : 'Chhath'}<span className="brand-dot">.</span></span></a>
      <section className="audio-admin-card">
        <p className="eyebrow">OWNER MUSIC LIBRARY</p><h1>Shared songs</h1><p className="audio-admin-intro">Add or remove songs here. Changes sync to the public player automatically.</p>
        {!configured && (<p className="admin-notice">Set <code>AUDIO_ADMIN_PASSWORD</code> and connect Vercel Blob plus Postgres in the Vercel project settings before uploading songs.</p>)}
        <label className="admin-password">Owner password<input type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); sessionStorage.setItem('audio-admin-token', e.target.value); }} placeholder="Enter your owner password" /></label>
        <form className="admin-upload-form" onSubmit={upload}>
          <label className="admin-file">Audio files<input name="songs" type="file" accept="audio/mpeg,audio/mp4,audio/aac,audio/wav,audio/ogg,audio/webm,audio/flac,.mp3,.m4a,.aac,.wav,.ogg,.webm,.flac" multiple required /></label>
          <label className="admin-rights"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} /> I have permission to host and stream these songs.</label>
          <button className="admin-submit" disabled={busy || !configured || !password || !rights}>{busy ? 'Uploading…' : 'Upload to shared playlist'}</button>
        </form>
        {status && <p className="admin-status" role="status">{status}</p>}
        <div className="admin-track-list"><h2>Playlist · {tracks.length}</h2>{tracks.length ? tracks.map((track) => (<div className="admin-track" key={track.id}><span>{track.title}</span><button type="button" onClick={() => removeTrack(track.id)} disabled={!password}>Remove</button></div>)) : <p className="admin-empty">No songs have been added yet.</p>}</div>
        <a className="admin-back" href="/">← Back to the ghat</a>
      </section>
    </main>
  );
}

const rituals = [
  { date: 'Friday, 13 November', name: 'Nahay-Khay', short: 'Purification', text: 'The first day begins with a cleansing bath and a simple, sattvic meal. Homes and cooking spaces are carefully prepared for the days of worship ahead.', offerings: 'Lauki, chana dal, rice', mark: '01' },
  { date: 'Saturday, 14 November', name: 'Lohanda & Kharna', short: 'The first offering', text: 'After a day of fasting, the evening meal is prepared with care and offered before it is shared. The long fast begins after this prasad.', offerings: 'Jaggery kheer, roti, fruit', mark: '02' },
  { date: 'Sunday, 15 November', name: 'Sandhya Arghya', short: 'Offering to the setting sun', text: 'Families gather at the water’s edge as the sun descends. Offerings are raised in the soop in gratitude for life, light, and the sustaining natural world.', offerings: 'Thekua, seasonal fruit, sugarcane', mark: '03' },
  { date: 'Monday, 16 November', name: 'Usha Arghya', short: 'Offering to the rising sun', text: 'At first light, devotees return to the water to offer arghya to the rising sun. The fast concludes with paran, and prasad is shared with loved ones.', offerings: 'Water, milk, thekua, fruit', mark: '04' },
];

const samagri = [
  ['Thekua', 'A traditional wheat and jaggery prasad, prepared at home and shared with family.'],
  ['Bamboo soop', 'A woven tray for carrying fruit and offerings to the ghat.'],
  ['Sugarcane', 'A seasonal offering that also frames the place of worship.'],
  ['Seasonal fruit', 'Bananas, coconut, and local harvest offered with gratitude.'],
  ['Earthen diya', 'A small flame kept at the ghat through the evening.'],
  ['Clean water', 'Offered to the setting and rising sun with arghya.'],
];

const translations = {
  en: { home: 'Home', journey: 'The journey', offerings: 'Offerings', wall: 'Prayer wall', morning: 'Morning', evening: 'Evening', live: 'Live prayer wall', festival: 'A festival of gratitude', heroLine: <>A festival of light,<br />faith &amp; the river.</>, countLabel: 'COUNTING DOWN TO SANDHYA ARGHYA', days: 'DAYS', hours: 'HOURS', minutes: 'MINUTES', seconds: 'SECONDS', festivalLive: 'The festival has begun', countIntro: 'A quiet place to gather in the spirit of Chhath Puja.', firstLight: 'First light', daylight: 'Daylight', moonlit: 'Moonlit ghat', sunset: 'Sunset', explore: 'Explore the journey', name: 'Your name', prayer: 'Write a prayer…', earthen: 'Earthen diya', lotus: 'Lotus soop', brass: 'Brass diya', float: 'Float diya', empty: 'Be the first to float a diya.', journeyEyebrow: 'THE FOUR DAYS', journeyTitle: <>A journey in <em>devotion.</em></>, journeyIntro: 'Four days shaped by care, discipline, and gratitude to the sun and the natural world.', atGhat: 'AT THE GHAT', previous: 'Previous', nextDay: 'Next day', prepare: 'PREPARE WITH CARE', offerTitle: <>The things we <em>offer.</em></>, offerIntro: 'A small guide to the familiar offerings carried from home to the water’s edge.', wallEyebrow: 'A SHARED PRAYER', wallTitle: <>Light a diya.<br /><em>Leave a wish.</em></>, wallIntro: 'Live prayer stream. To leave a prayer, use the home page chat.', calendar: '2026 LUNAR CALENDAR', tithiCalendar: 'Tithi calendar', moonPhases: 'Moon phases', back: 'Back to the river', tagline: 'A quiet place to gather', liveConnected: 'Live · connected', reconnecting: 'Reconnecting…', serverUnavailable: 'Live server unavailable', sendSuccess: 'Your prayer is now on the live ghat.', sendError: 'Could not connect. Please try again when the live server is online.', fourDays: ['Nahay-Khay', 'Lohanda & Kharna', 'Sandhya Arghya', 'Usha Arghya'], ritualShort: ['Purification', 'The first offering', 'Offering to the setting sun', 'Offering to the rising sun'], ritualText: ['The first day begins with a cleansing bath and a simple, sattvic meal. Homes and cooking spaces are carefully prepared for the days of worship ahead.', 'After a day of fasting, the evening meal is prepared with care and offered before it is shared. The long fast begins after this prasad.', 'Families gather at the water’s edge as the sun descends. Offerings are raised in the soop in gratitude for life, light, and the sustaining natural world.', 'At first light, devotees return to the water to offer arghya to the rising sun. The fast concludes with paran, and prasad is shared with loved ones.'], ritualOfferings: ['Lauki, chana dal, rice', 'Jaggery kheer, roti, fruit', 'Thekua, seasonal fruit, sugarcane', 'Water, milk, thekua, fruit'], ritualDates: ['Friday, 13 November', 'Saturday, 14 November', 'Sunday, 15 November', 'Monday, 16 November'], samagriNames: ['Thekua', 'Bamboo soop', 'Sugarcane', 'Seasonal fruit', 'Earthen diya', 'Clean water'], samagriText: ['A traditional wheat and jaggery prasad, prepared at home and shared with family.', 'A woven tray for carrying fruit and offerings to the ghat.', 'A seasonal offering that also frames the place of worship.', 'Bananas, coconut, and local harvest offered with gratitude.', 'A small flame kept at the ghat through the evening.', 'Offered to the setting and rising sun with arghya.'], moonNames: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'], },
  hi: { home: 'मुखपृष्ठ', journey: 'चार दिनों की यात्रा', offerings: 'पूजा सामग्री', wall: 'प्रार्थना दीवार', morning: 'प्रातः', evening: 'संध्या', live: 'सजीव प्रार्थना दीवार', festival: 'कृतज्ञता का महापर्व', heroLine: <>प्रकाश, आस्था<br />और नदी का पर्व।</>, countLabel: 'संध्या अर्घ्य तक शेष समय', days: 'दिन', hours: 'घंटे', minutes: 'मिनट', seconds: 'सेकंड', festivalLive: 'पर्व आरंभ हो चुका है', countIntro: 'छठ पूजा की भावना में साथ आने का एक शांत स्थान।', firstLight: 'प्रथम किरण', daylight: 'दिन का उजाला', moonlit: 'चाँदनी घाट', sunset: 'सूर्यास्त', explore: 'पूजा की यात्रा देखें', name: 'आपका नाम', prayer: 'अपनी प्रार्थना लिखें…', earthen: 'मिट्टी का दीप', lotus: 'कमल का सूप', brass: 'पीतल का दीप', float: 'दीप प्रवाहित करें', empty: 'पहला दीप आप जलाएँ।', journeyEyebrow: 'चार पावन दिन', journeyTitle: <>भक्ति की <em>पावन यात्रा।</em></>, journeyIntro: 'सूर्य और प्रकृति के प्रति श्रद्धा, संयम और कृतज्ञता से भरे चार दिन।', atGhat: 'घाट पर अर्पण', previous: 'पिछला दिन', nextDay: 'अगला दिन', prepare: 'श्रद्धा से तैयारी', offerTitle: <>हमारे <em>पावन अर्पण।</em></>, offerIntro: 'घर से घाट तक ले जाए जाने वाले परिचित पूजन अर्पणों की छोटी-सी मार्गदर्शिका।', wallEyebrow: 'साझी प्रार्थना', wallTitle: <>दीप जलाएँ।<br /><em>मनोकामना लिखें।</em></>, wallIntro: 'सजीव प्रार्थना धारा। प्रार्थना लिखने के लिए मुखपृष्ठ पर दिए संवाद का उपयोग करें।', calendar: '2026 का चंद्र पंचांग', tithiCalendar: 'तिथि पंचांग', moonPhases: 'चंद्र कलाएँ', back: 'घाट पर लौटें', tagline: 'साथ आने का एक शांत स्थान', liveConnected: 'सजीव · जुड़ा हुआ', reconnecting: 'पुनः जुड़ रहे हैं…', serverUnavailable: 'सजीव सेवा उपलब्ध नहीं', sendSuccess: 'आपकी प्रार्थना घाट पर पहुँच गई है।', sendError: 'जुड़ नहीं सके। सजीव सेवा उपलब्ध होने पर फिर प्रयास करें।', fourDays: ['नहाय-खाय', 'लोहंडा और खरना', 'संध्या अर्घ्य', 'ऊषा अर्घ्य'], ritualShort: ['शुद्धि और तैयारी', 'पहला अर्पण', 'अस्त होते सूर्य को अर्घ्य', 'उगते सूर्य को अर्घ्य'], ritualText: ['पहले दिन स्नान के बाद सात्त्विक भोजन किया जाता है। पूजा के आने वाले दिनों के लिए घर और रसोई को श्रद्धा से तैयार किया जाता है।', 'उपवास के बाद संध्या में प्रसाद सावधानी से बनाकर अर्पित किया जाता है। प्रसाद ग्रहण करने के बाद निर्जला व्रत आरंभ होता है।', 'सूर्यास्त के समय परिवार नदी तट एकत्र होकर सूप में अर्घ्य और प्रसाद अर्पित करते हैं। यह जीवन, प्रकाश और प्रकृति के प्रति कृतज्ञता का क्षण है।', 'प्रातःकाल भक्त उगते सूर्य को अर्घ्य देने लौटते हैं। पारण के साथ व्रत पूरा होता है और प्रसाद प्रियजनों में बाँटा जाता है।'], ritualOfferings: ['लौकी, चना दाल, चावल', 'गुड़ की खीर, रोटी, फल', 'ठेकुआ, मौसमी फल, गन्ना', 'जल, दूध, ठेकुआ, फल'], ritualDates: ['शुक्रवार, 13 November', 'शनिवार, 14 November', 'रविवार, 15 November', 'सोमवार, 16 November'], samagriNames: ['ठेकुआ', 'बाँस का सूप', 'गन्ना', 'मौसमी फल', 'मिट्टी का दीप', 'स्वच्छ जल'], samagriText: ['गेहूँ और गुड़ से बना पारंपरिक प्रसाद, घर में बनाकर परिवार के साथ बाँटा जाता है।', 'फल और पूजा सामग्री घाट तक ले जाने की बाँस की टोकरी।', 'पूजा स्थल को सजाने वाला मौसमी अर्पण।', 'कृतज्ञता के साथ अर्पित केले, नारियल और स्थानीय फल।', 'संध्या में घाट पर जलाया जाने वाला छोटा पवित्र दीप।', 'डूबते और उगते सूर्य को अर्घ्य के रूप में अर्पित जल।'], moonNames: ['अमावस्या', 'शुक्ल चंद्र कला', 'प्रथम तिमाही', 'शुक्ल गिबस', 'पूर्णिमा', 'कृष्ण गिबस', 'अंतिम तिमाही', 'कृष्ण चंद्र कला'], },
};

function indiaClock(date = new Date()) { return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(date); }
function sceneForNow(date = new Date()) { const t = indiaClock(date).split(':').map(Number); const hour = t[0] + t[1] / 60; return hour >= 17.5 || hour < 5.5 ? 'night' : hour < 8 ? 'dawn' : hour < 14.5 ? 'day' : 'sunset'; }
function lunarData(date = new Date()) {
  const synodicDays = 29.530588853, knownNewMoon = Date.UTC(2000, 0, 6, 18, 14), fraction = (((date.getTime() - knownNewMoon) / (synodicDays * 86400000)) % 1 + 1) % 1;
  const illumination = Math.round((1 - Math.cos(2 * Math.PI * fraction)) * 50);
  const name = fraction < 0.03 || fraction > 0.97 ? 'New Moon' : fraction < 0.22 ? 'Waxing Crescent' : fraction < 0.28 ? 'First Quarter' : fraction < 0.47 ? 'Waxing Gibbous' : fraction < 0.53 ? 'Full Moon' : fraction < 0.72 ? 'Waning Gibbous' : fraction < 0.78 ? 'Last Quarter' : 'Waning Crescent';
  return { fraction, illumination, name };
}

function orbPosition(mode, date = new Date()) {
  const time = indiaClock(date).split(':').map(Number), hour = time[0] + time[1] / 60;
  if (mode === 'morning') return { x: 27, y: 48, body: 'sun' };
  if (mode === 'evening') return { x: 77, y: 55, body: 'sun' };
  if (mode === 'dawn') return { x: 22, y: 58, body: 'sun' };
  if (mode === 'day' || mode === 'sunset') {
    if (mode === 'sunset' && hour < 14.5) return { x: 78, y: 58, body: 'sun' };
    const progress = Math.max(0, Math.min(1, (hour - 6) / 11)); return { x: 12 + 76 * progress, y: 62 - 38 * Math.sin(Math.PI * progress), body: 'sun' };
  }
  const moon = lunarData(date), nightProgress = hour >= 19 ? (hour - 19) / 10.5 : (hour + 5) / 10.5;
  return { x: 12 + 76 * Math.max(0, Math.min(1, nightProgress)), y: 38 - 9 * Math.sin(Math.PI * nightProgress), body: moon.illumination < 4 ? 'none' : 'moon', phase: moon.fraction };
}

function countdownParts(now = Date.now()) {
  const target = Date.parse('2026-11-15T17:00:00+05:30'), diff = Math.max(0, target - now);
  return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), minutes: Math.floor((diff % 3600000) / 60000), seconds: Math.floor((diff % 60000) / 1000), passed: now >= target };
}

function GhatScene({ mode, showOrb }) {
  const ref = useRef(null);
  const modeRef = useRef(mode); const showOrbRef = useRef(showOrb);
  const animEntities = useRef({ birds: [], clouds: [] });

  useEffect(() => { modeRef.current = mode; showOrbRef.current = showOrb; }, [mode, showOrb]);

  useEffect(() => {
    const canvas = ref.current; const ctx = canvas.getContext('2d');
    
    animEntities.current.clouds = Array.from({length: 6}, () => ({ x: Math.random(), y: 0.05 + Math.random() * 0.25, speed: 0.0002 + Math.random() * 0.0004, scale: 0.4 + Math.random() * 0.8 }));
    animEntities.current.birds = Array.from({length: 14}, () => ({ x: Math.random(), y: 0.1 + Math.random() * 0.3, speed: 0.0006 + Math.random() * 0.001, scale: 0.3 + Math.random() * 0.5, flap: 10 + Math.random() * 8, phase: Math.random() * Math.PI * 2 }));

    let raf, w = 0, h = 0, t = 0;
    const sceneNames = ['night', 'dawn', 'day', 'sunset']; let sceneBlend = sceneNames.indexOf(modeRef.current); if (sceneBlend < 0) sceneBlend = 1;

    const resize = () => { const box = canvas.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 1.6); w = box.width; h = box.height; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize(); const ro = new ResizeObserver(resize); ro.observe(canvas);

    const palettes = [['#0b1520', '#182837', '#263a46', '#45505a'], ['#233b49', '#54747f', '#bd877b', '#f0c993'], ['#2d536b', '#79a6ad', '#d9cca4', '#fff0c7'], ['#172637', '#4a5962', '#a76c57', '#efaa72']];
    const hexRgb = (hex) => hex.match(/[\da-f]{2}/gi).map((v) => parseInt(v, 16));
    const blendHex = (a, b, p) => `rgb(${hexRgb(a).map((v, i) => Math.round(v + (hexRgb(b)[i] - v) * p)).join(',')})`;
    const paletteAt = (idx) => { const lo = Math.max(0, Math.min(3, Math.floor(idx))), hi = Math.min(3, lo + 1), p = Math.max(0, Math.min(1, idx - lo)); return palettes[lo].map((color, i) => blendHex(color, palettes[hi][i], p)); };

    const drawStylizedClouds = (night) => {
      animEntities.current.clouds.forEach(c => {
        c.x += c.speed; if (c.x > 1.2) { c.x = -0.3; c.y = 0.05 + Math.random() * 0.25; }
        const cx = c.x * w, cy = c.y * h + Math.sin(t*0.5 + c.phase)*2, s = c.scale * (w/1000);
        ctx.save(); ctx.globalAlpha = night ? 0.15 : (sceneBlend < 0.8 ? 0.5 : 0.85); ctx.fillStyle = night ? '#94adc0' : (sceneBlend < 0.8 ? '#ffeacc' : '#ffffff');
        ctx.beginPath(); ctx.arc(cx, cy, 30*s, Math.PI*0.5, Math.PI*1.5); ctx.arc(cx + 25*s, cy - 15*s, 35*s, Math.PI, Math.PI*2); ctx.arc(cx + 60*s, cy - 5*s, 25*s, Math.PI, Math.PI*2); ctx.arc(cx + 80*s, cy, 20*s, Math.PI*1.5, Math.PI*0.5); ctx.closePath(); ctx.fill(); ctx.restore();
      });
    };

    const drawBirds = () => {
      if (modeRef.current === 'night') return;
      ctx.save(); ctx.fillStyle = sceneBlend > 2 ? 'rgba(50,25,15,0.8)' : 'rgba(20,30,40,0.6)';
      animEntities.current.birds.forEach(b => {
        b.x += b.speed; if (b.x > 1.1) { b.x = -0.1; b.y = 0.1 + Math.random()*0.3; }
        const bx = b.x * w, by = b.y * h + Math.sin(t * 2 + b.phase) * 6, wing = Math.sin(t * b.flap + b.phase) * 8 * b.scale;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx - 10*b.scale, by - wing - 4*b.scale, bx - 16*b.scale, by - wing); ctx.quadraticCurveTo(bx - 6*b.scale, by - wing + 2*b.scale, bx, by + 3*b.scale); ctx.quadraticCurveTo(bx + 6*b.scale, by - wing + 2*b.scale, bx + 16*b.scale, by - wing); ctx.quadraticCurveTo(bx + 10*b.scale, by - wing - 4*b.scale, bx, by); ctx.fill();
      });
      ctx.restore();
    };

    const drawRiverRipples = () => {
      ctx.save(); ctx.beginPath(); ctx.rect(0, h * 0.58, w, h * 0.42); ctx.clip();
      ctx.fillStyle = `rgba(255, 235, 190, ${modeRef.current === 'night' ? 0.05 : 0.15})`;
      for(let i=0; i<12; i++) {
         const waveY = (t * 0.08 + i / 12) % 1, actualY = h * 0.62 + waveY * h * 0.38, waveWidth = w * (0.15 + waveY * 0.4);
         ctx.fillRect(w * 0.5 - waveWidth/2 + Math.sin(t+i)*15, actualY, waveWidth, 1 + waveY*2.5);
      }
      for (let i = 0; i < 20; i++) {
        const cx = w * (0.1 + ((i * 29) % 80) / 100), cy = h * (0.6 + ((i * 17) % 38) / 100);
        const phase = ((t * 0.6 + i * 1.3) % 6) / 6, rx = Math.max(12, 10 + phase * Math.min(w * 0.15, 120)), ry = rx * 0.18, alpha = (1 - phase) * 0.45;
        ctx.strokeStyle = `rgba(255,235,190,${alpha})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx + Math.sin(t * 1.5 + i) * 6, cy + Math.cos(t * 1.2 + i) * 2, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    };

    const drawCelestial = (colors, celestial = orbPosition(modeRef.current, new Date())) => {
      const sx = (w * celestial.x) / 100, sy = (h * celestial.y) / 100, r = Math.min(w * 0.065, 53);
      if (showOrbRef.current && celestial.body === 'sun') {
        const pulse = 1 + Math.sin(t * 2.5) * 0.08, haloR = r * 4 * pulse, halo = ctx.createRadialGradient(sx, sy, r * 0.2, sx, sy, haloR);
        halo.addColorStop(0, 'rgba(255,226,166,.55)'); halo.addColorStop(1, 'rgba(255,212,158,0)'); ctx.fillStyle = halo; ctx.fillRect(sx - haloR, sy - haloR, haloR * 2, haloR * 2);
        ctx.fillStyle = '#ffe5ae'; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
      }
      if (showOrbRef.current && celestial.body === 'moon') {
        const moon = lunarData(new Date()), mr = r * 0.74, illum = moon.illumination / 100;
        ctx.fillStyle = 'rgba(228,238,239,.18)'; ctx.beginPath(); ctx.arc(sx, sy, mr * (1.35 + Math.sin(t*2)*0.05), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#edf0df'; ctx.beginPath(); ctx.arc(sx, sy, mr, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.arc(sx, sy, mr, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = colors[0]; const offset = moon.fraction < 0.5 ? -2 * mr * illum : 2 * mr * illum;
        ctx.beginPath(); ctx.arc(sx + offset, sy, mr, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    };

    const drawWorshipper = (x, y, s, color, skin, faceDir) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x - 6*s, y); ctx.lineTo(x + 6*s, y); ctx.lineTo(x + 10*s, y + 25*s); ctx.lineTo(x - 10*s, y + 25*s); ctx.fill();
      ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, y - 8*s, 5.5*s, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + faceDir*1.5*s, y - 10*s, 5.5*s, Math.PI, Math.PI*2.2); ctx.fill();
      const soopX = x + faceDir * 12 * s, soopY = y + 5 * s;
      ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(x + faceDir*6*s, y + 5*s, 6*s, 2*s, faceDir*0.2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#dbad6b'; ctx.beginPath(); ctx.ellipse(soopX, soopY, 14*s, 4*s, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#c79240'; ctx.beginPath(); ctx.ellipse(soopX, soopY, 12*s, 3*s, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#e85d4f'; ctx.beginPath(); ctx.arc(soopX - 2*s, soopY - 2*s, 2*s, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5fb365'; ctx.beginPath(); ctx.arc(soopX + 3*s, soopY - 1*s, 2.5*s, 0, Math.PI*2); ctx.fill();
    };

    const drawSugarcaneMandap = (cx, baseY, s) => {
      ctx.strokeStyle = '#8fa358'; ctx.lineWidth = 3*s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 25*s, baseY); ctx.quadraticCurveTo(cx - 15*s, baseY - 40*s, cx + 5*s, baseY - 60*s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 25*s, baseY); ctx.quadraticCurveTo(cx + 15*s, baseY - 40*s, cx - 5*s, baseY - 60*s); ctx.stroke();
      ctx.fillStyle = '#658231';
      for(let i=0; i<4; i++) {
        ctx.beginPath(); ctx.ellipse(cx, baseY - 60*s, 10*s, 2*s, (i*45)*Math.PI/180, 0, Math.PI*2); ctx.fill();
      }
    };

    const scene = () => {
      t += 0.01; const target = Math.max(0, sceneNames.indexOf(modeRef.current)); sceneBlend += (target - sceneBlend) * 0.015;
      const colors = paletteAt(sceneBlend), night = modeRef.current === 'night', celestial = orbPosition(modeRef.current, new Date()), sx = (w * celestial.x) / 100, r = Math.min(w * 0.065, 53);
      
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.75);
      sky.addColorStop(0, colors[0]); sky.addColorStop(0.46, colors[1]); sky.addColorStop(0.82, colors[2]); sky.addColorStop(1, colors[3]);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      
      drawStylizedClouds(night); drawCelestial(colors); drawBirds();

      if (night) {
        ctx.fillStyle = 'rgba(229,238,227,.6)';
        for (let i = 0; i < 40; i++) { const x = (i * 97) % Math.max(1, w), y = (i * 53) % Math.floor(h * 0.55); ctx.globalAlpha = 0.25 + 0.5 * (Math.sin(t*3 + i) + 1); ctx.fillRect(x, y, i % 4 === 0 ? 2 : 1, 1); }
        ctx.globalAlpha = 1;
      }

      const water = ctx.createLinearGradient(0, h * 0.62, 0, h);
      water.addColorStop(0, blendHex('#516f75', '#875c4d', sceneBlend / 3)); water.addColorStop(0.24, blendHex('#29424b', '#27323b', sceneBlend / 3)); water.addColorStop(1, colors[0]);
      ctx.fillStyle = water; ctx.fillRect(0, h * 0.62, w, h * 0.38);
      drawRiverRipples();

      ctx.fillStyle = 'rgba(250,210,150,.18)';
      for (let i = 0; i < 9; i++) { const yy = h * 0.67 + i * 13, ww = r * 1.8 * (1 - i / 11); ctx.fillRect(sx - ww / 2 + Math.sin(t*2 + i) * 12, yy, ww, 1.5); }

      const farBankY = h * 0.596; ctx.fillStyle = blendHex('#26312c', '#55433a', sceneBlend / 3);
      ctx.beginPath(); ctx.moveTo(w * 0.17, farBankY); ctx.quadraticCurveTo(w * 0.5, h * 0.579, w * 0.83, farBankY); ctx.lineTo(w * 0.86, h * 0.655); ctx.quadraticCurveTo(w * 0.5, h * 0.665, w * 0.14, h * 0.655); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(219,190,135,.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(w * 0.18, farBankY); ctx.quadraticCurveTo(w * 0.5, h * 0.579, w * 0.82, farBankY); ctx.stroke();

      ctx.fillStyle = blendHex('#1b282b', '#3b2f29', sceneBlend / 3);
      ctx.beginPath(); ctx.moveTo(0, h * 0.59); ctx.lineTo(w * 0.19, h * 0.59); ctx.lineTo(w * 0.29, h * 0.72); ctx.lineTo(w * 0.38, h * 0.82); ctx.lineTo(0, h * 0.82); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w, h * 0.59); ctx.lineTo(w * 0.82, h * 0.59); ctx.lineTo(w * 0.72, h * 0.72); ctx.lineTo(w * 0.63, h * 0.82); ctx.lineTo(w, h * 0.82); ctx.fill();

      const sScale = Math.max(0.7, w/1200);
      drawSugarcaneMandap(w * 0.12, h * 0.64, sScale); drawSugarcaneMandap(w * 0.22, h * 0.73, sScale*1.2);
      drawSugarcaneMandap(w * 0.88, h * 0.64, sScale); drawSugarcaneMandap(w * 0.76, h * 0.75, sScale*1.2);

      const clothes = ['#c7503e', '#c79132', '#397c70', '#a34b68', '#d76e38'], skins = ['#a06f4c', '#8a5a3b', '#b58562'];
      for (let i=0; i<8; i++) { const x = w * (0.05 + i*0.025), y = h * (0.62 + (i%3)*0.03); drawWorshipper(x, y, sScale, clothes[i%5], skins[i%3], 1); }
      for (let i=0; i<8; i++) { const x = w * (0.95 - i*0.025), y = h * (0.62 + (i%3)*0.03); drawWorshipper(x, y, sScale, clothes[(i+2)%5], skins[(i+1)%3], -1); }

      for (let i = 0; i < 15; i++) {
        const lx = w * (0.1 + (i%5)*0.03), ly = h * (0.6 + Math.floor(i/5)*0.05);
        const rx = w * (0.9 - (i%5)*0.03), ry = h * (0.6 + Math.floor(i/5)*0.05);
        const flicker = Math.sin(t*10 + i)*2;
        ctx.fillStyle = `rgba(255, 180, 50, ${0.4 + flicker*0.05})`;
        ctx.beginPath(); ctx.arc(lx, ly, 4 + flicker, 0, Math.PI*2); ctx.arc(rx, ry, 4 + flicker, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ffcc44';
        ctx.beginPath(); ctx.arc(lx, ly, 1.5, 0, Math.PI*2); ctx.arc(rx, ry, 1.5, 0, Math.PI*2); ctx.fill();
      }

      raf = requestAnimationFrame(scene);
    };

    raf = requestAnimationFrame(scene);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} className="ghat-canvas" aria-label="Animated river ghat with worshippers and sugarcane" />;
}

// Strict Water Trapping & Drift for HTML Diyas
function diyaWaterPosition(index) {
  const yProgress = (((index * 37) % 100) / 100); 
  const y = 0.65 + yProgress * 0.25; 
  
  let leftLimit = 0;
  let rightLimit = 1;
  
  // Perfectly match diagonal drawn banks from y=0.59 to y=0.82
  if (y <= 0.82) {
    const t = (y - 0.59) / (0.82 - 0.59);
    leftLimit = 0.19 + t * (0.38 - 0.19);
    rightLimit = 0.82 - t * (0.82 - 0.63);
  } else {
    // Water goes across almost full width below the banks
    leftLimit = 0.05;
    rightLimit = 0.95;
  }
  
  const spread = ((index * 47 + 13) % 97) / 97;
  const padding = 0.05;
  const x = (leftLimit + padding) + spread * (rightLimit - leftLimit - padding * 2);
  
  return { 
    left: `${x * 100}%`, 
    top: `${y * 100}%`,
    '--drift-x': `${(spread * 30) - 15}px`, 
    '--drift-y': `${(spread * 15) - 7}px`
  };
}

function App() {
  const [nav, setNav] = useState('Home'); const [override, setOverride] = useState(null); const [now, setNow] = useState(Date.now());
  const [ritual, setRitual] = useState(2); const [name, setName] = useState(''); const [message, setMessage] = useState('');
  const [diya, setDiya] = useState('Earthen diya'); const [wishes, setWishes] = useState([]); const [toast, setToast] = useState('');
  const [liveState, setLiveState] = useState('connecting'); const [language, setLanguage] = useState(() => localStorage.getItem('chhath-language') === 'hi' ? 'hi' : 'en');
  const [menu, setMenu] = useState(false); const [languagePulse, setLanguagePulse] = useState(false); const [musicPlaying, setMusicPlaying] = useState(false);

  const t = translations[language]; const autoScene = sceneForNow(new Date(now)), mode = override || autoScene, themeMode = mode === 'morning' ? 'dawn' : mode === 'evening' ? 'sunset' : mode;
  const moon = useMemo(() => lunarData(new Date(now)), [now]), countdown = useMemo(() => countdownParts(now), [now]);
  const moonName = language === 'hi' ? t.moonNames[['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'].indexOf(moon.name)] || moon.name : moon.name;

  const liveLabel = { connecting: language === 'hi' ? 'प्रार्थना दीवार से जुड़ रहे हैं…' : 'Connecting to prayer wall…', connected: t.liveConnected, reconnecting: t.reconnecting, unavailable: t.serverUnavailable }[liveState] || liveState;
  const displayRituals = rituals.map((r, i) => language === 'hi' ? { ...r, name: t.fourDays[i], short: t.ritualShort[i], text: t.ritualText[i], offerings: t.ritualOfferings[i], date: t.ritualDates[i] } : r);
  const displaySamagri = samagri.map(([title, copy], i) => language === 'hi' ? [t.samagriNames[i], t.samagriText[i]] : [title, copy]);

  useEffect(() => { localStorage.setItem('chhath-language', language); document.documentElement.lang = language; }, [language]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    let active = true; const refresh = () => fetch('/api/prayers').then((response) => { if (!response.ok) throw new Error('Prayer service unavailable'); return response.json(); }).then((data) => { if (active) { setWishes(Array.isArray(data.prayers) ? data.prayers : []); setLiveState('connected'); } }).catch(() => { if (active) setLiveState('unavailable'); });
    refresh(); const timer = setInterval(refresh, 5000); return () => { active = false; clearInterval(timer); };
  }, []);

  function choose(navItem) { setMenu(false); if (navItem === nav) return; const change = () => { setNav(navItem); window.scrollTo({ top: 0, behavior: 'smooth' }); }; if (document.startViewTransition) document.startViewTransition(change); else change(); }
  function switchLanguage() { const change = () => setLanguage(language === 'en' ? 'hi' : 'en'); if (document.startViewTransition) document.startViewTransition(change); else { change(); setLanguagePulse(true); setTimeout(() => setLanguagePulse(false), 520); } }

  async function submitWish(e) {
    e.preventDefault(); const payload = { name: name.trim(), message: message.trim(), diya };
    try {
      const response = await fetch('/api/prayers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Prayer could not be shared.');
      setWishes(result.prayers || []); setName(''); setMessage(''); setToast(t.sendSuccess); setTimeout(() => setToast(''), 3200);
    } catch { setToast(t.sendError); setTimeout(() => setToast(''), 4500); }
  }

  return (
    <div id="top" className={`site ${themeMode} ${nav === 'Home' ? 'landing' : 'subpage'} ${languagePulse ? 'language-pulse' : ''} ${musicPlaying ? 'music-playing' : ''}`}>
      <style>{`
        @keyframes float-drift {
          0%, 100% { transform: translate(0, 0) rotate(-2deg); }
          50% { transform: translate(var(--drift-x), var(--drift-y)) rotate(2deg); }
        }
        .floating-diya { animation-name: float-drift; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
      `}</style>
      
      <header className="topbar">
        <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); choose('Home'); }}><span className="brand-mark"><Sun size={20} /></span><span>{language === 'hi' ? 'छठ' : 'Chhath'}<span className="brand-dot">.</span></span></a>
        <button className="menu-toggle" onClick={() => setMenu(!menu)} aria-label={language === 'hi' ? 'नेविगेशन खोलें' : 'Toggle navigation'}>{menu ? <X /> : <Menu />}</button>
        <nav className={menu ? 'nav-links open' : 'nav-links'} aria-label={language === 'hi' ? 'मुख्य नेविगेशन' : 'Main navigation'}>{['Home', 'The journey', 'Offerings', 'Prayer wall'].map((n, i) => (<button key={n} onClick={() => choose(n)} className={nav === n ? 'selected' : ''}>{[t.home, t.journey, t.offerings, t.wall][i]}</button>))}</nav>
        <div className="nav-side">
          <div className="preview-switch" aria-label={language === 'hi' ? 'समय दृश्य' : 'Scene preview'}>
            <button className={override === 'morning' || (!override && autoScene === 'dawn') ? 'active' : ''} onClick={() => setOverride(override === 'morning' ? null : 'morning')} title={t.morning}><Sun size={14} /> <span>{t.morning}</span></button>
            <button className={override === 'evening' || (!override && autoScene === 'sunset') ? 'active' : ''} onClick={() => setOverride(override === 'evening' ? null : 'evening')} title={t.evening}><Moon size={14} /><span>{t.evening}</span></button>
          </div>
          <button className="language-toggle" onClick={switchLanguage} aria-label={language === 'en' ? 'हिंदी में देखें' : 'Switch to English'}>{language === 'en' ? 'हिंदी' : 'English'}</button>
          <span className="moon-status"><Moon size={13} />{moonName} · {moon.illumination}%</span>
        </div>
      </header>
      <div className="global-scene" aria-hidden="true"><GhatScene mode={themeMode} showOrb /><div className="global-scene-shade" /></div>
      <main key={nav} className={nav === 'Home' ? 'home-view' : 'content-view'}>
        {nav === 'Home' && (
          <section className="hero" aria-label={language === 'hi' ? 'छठ पूजा घाट' : 'Chhath sanctuary'}>
            <div className="hero-shade" />
            <div className="hero-content">
              <h1><span className="hindi-title">{language === 'hi' ? 'छठ' : 'Chhath'}</span></h1>
              <div className="hero-countdown"><div className="countdown">{countdown.passed ? (<span className="festival-live">{t.festivalLive}</span>) : (<>{[['days', countdown.days, t.days], ['hours', countdown.hours, t.hours], ['minutes', countdown.minutes, t.minutes], ['seconds', countdown.seconds, t.seconds],].map(([key, value, label]) => (<div className="count-item" key={key}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>))}</>)}</div></div>
              <div className="hero-date"><CalendarDays size={15} /> {language === 'hi' ? '१३ — १६ नवंबर २०२६' : '13 — 16 November 2026'}</div>
            </div>
            <aside className="hero-chat" aria-label={t.live}>
              <div className="chat-stream">{wishes.slice(-1).reverse().map((w, i) => (<article className="chat-message" key={w.id}><div className="chat-person"><span>{w.name.slice(0, 1)}</span><strong>{w.name}</strong><small>{i === 0 ? language === 'hi' ? 'अभी' : 'just now' : `${i * 4 + 2}${language === 'hi' ? 'मि' : 'm'}`}</small></div><p>{w.message}</p></article>))}{!wishes.length && (<p className="chat-empty">{t.empty}</p>)}</div>
              <form className="inline-prayer" onSubmit={submitWish}><input aria-label={t.name} required maxLength="50" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} /><textarea aria-label={language === 'hi' ? 'प्रार्थना संदेश' : 'Prayer message'} required maxLength="220" rows="2" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t.prayer} /><div className="inline-prayer-bottom"><button type="submit">{language === 'hi' ? 'भेजें' : 'Send'} <ArrowRight size={14} /></button></div>{toast && <small className="inline-toast">{toast}</small>}</form>
            </aside>
            <div className="floating-diyas" aria-label={language === 'hi' ? 'भक्तों के दीप' : 'Floating diyas shared by visitors'}>
              {wishes.slice(-40).map((w, i) => (
                <button key={w.id} className="floating-diya" style={{ ...diyaWaterPosition(i), animationDelay: `-${(i % 7) * 0.55}s`, animationDuration: `${12 + (i % 5) * 2.3}s` }} aria-label={`${language === 'hi' ? 'दीप' : 'Diya'} · ${w.name}: ${w.message}`}>
                  <svg className="diya-art" viewBox="0 0 52 40" aria-hidden="true"><path className="diya-flame" d="M26 3C28 9 34 12 32 19c-1 4-4 6-7 6-5 0-8-4-7-9 1-4 5-6 5-11 2 2 3 4 3 6 2-2 2-5 0-8Z" /><path className="diya-flame-core" d="M26 12c2 4 4 6 3 9-.5 2-2 3-4 3-3 0-4-2-4-4 0-2 2-4 3-6 0 2 1 3 2 4 1-2 1-4 0-6Z" /><path className="diya-bowl" d="M5 27c5 0 8-2 12-4 3-2 6-2 9-2s6 0 9 2c4 2 7 4 12 4-2 7-8 10-21 10S7 34 5 27Z" /><ellipse className="diya-oil" cx="26" cy="27" rx="12" ry="2.2" /><path className="diya-rim" d="M5 27c7 0 8-6 21-6s14 6 21 6" /><path className="diya-highlight" d="M11 31c4 4 8 4 13 4" /></svg>
                  <span className="diya-tooltip"><strong>{w.name}</strong>{w.message}</span>
                </button>
              ))}
            </div>
            <div className="hero-bottom audio-open"><div className="audio-player-shell"><AudioPlayer language={language} onPlayingChange={setMusicPlaying} /></div></div>
            <div className="scene-label">{mode === 'morning' ? '01 / FIRST LIGHT' : '02 / LAST LIGHT'}<span>{override ? 'PREVIEW MODE' : 'ASIA / KOLKATA'}</span></div>
          </section>
        )}
        {nav === 'The journey' && (
          <section className="journey section" id="the-journey"><div className="section-heading"><div><p className="eyebrow align-left">{t.journeyEyebrow}</p><h2>{t.journeyTitle}</h2></div><p>{t.journeyIntro}</p></div><div className="journey-layout"><div className="ritual-list">{displayRituals.map((r, i) => (<button key={r.mark} className={`ritual-row ${ritual === i ? 'current' : ''}`} onClick={() => setRitual(i)}><span className="ritual-number">{r.mark}</span><span className="ritual-main"><strong>{r.name}</strong><small>{r.short}</small></span><span className="ritual-date">{r.date.split(', ')[1]}</span><ArrowRight className="ritual-arrow" size={17} /></button>))}</div><article className="ritual-detail" key={ritual}><p className="eyebrow align-left">{displayRituals[ritual].date}</p><div className="detail-mark">{displayRituals[ritual].mark}</div><h3>{displayRituals[ritual].name}</h3><p className="detail-short">{displayRituals[ritual].short}</p><p className="detail-copy">{displayRituals[ritual].text}</p><div className="detail-offering"><span>{t.atGhat}</span><strong>{displayRituals[ritual].offerings}</strong></div><div className="detail-controls"><button onClick={() => setRitual(Math.max(0, ritual - 1))} disabled={ritual === 0}><ArrowLeft size={16} /> {t.previous}</button><button onClick={() => setRitual(Math.min(3, ritual + 1))} disabled={ritual === 3}>{t.nextDay} <ArrowRight size={16} /></button></div></article></div></section>
        )}
        {nav === 'Offerings' && (
          <section className="samagri section" id="offerings"><div className="section-heading"><div><p className="eyebrow align-left">{t.prepare}</p><h2>{t.offerTitle}</h2></div><p>{t.offerIntro}</p></div><div className="samagri-grid">{displaySamagri.map(([title, copy], i) => (<article className="samagri-item" key={title}><span className="samagri-icon">{i === 4 ? <Flame size={19} /> : <span>0{i + 1}</span>}</span><h3>{title}</h3><p>{copy}</p></article>))}</div></section>
        )}
        {nav === 'Prayer wall' && (
          <section className="wall section" id="prayer-wall"><div className="wall-heading"><div><p className="eyebrow align-left">{t.wallEyebrow}</p><h2>{t.wallTitle}</h2><p className="wall-intro">{t.wallIntro}</p></div><div className="wall-flame"><Flame size={36} strokeWidth={1} /></div></div><div className="wall-layout"><div className="wishes"><div className="wishes-top"><span>{language === 'hi' ? 'प्रार्थना दीवार' : 'THE PRAYER WALL'} · {liveLabel.toUpperCase()}</span><span>{Math.min(wishes.length, 40)}/40 {language === 'hi' ? 'प्रवाहित दीप' : 'floating diyas'} · {wishes.length} {language === 'hi' ? 'प्रार्थनाएँ' : 'prayers'}</span></div>{wishes.slice().reverse().map((w, i) => (<article className="wish" key={w.id}><div className="wish-meta"><span><Flame size={14} />{language === 'hi' ? { 'Earthen diya': t.earthen, 'Lotus soop': t.lotus, 'Brass diya': t.brass, }[w.diya] || w.diya : w.diya}</span><span>{language === 'hi' ? 'अर्पण' : 'OFFERING'} {String(i + 1).padStart(2, '0')}</span></div><p>“{w.message}”</p><small>{w.name}</small></article>))}</div></div></section>
        )}
        {nav !== 'Home' && (
          <section className="date-note"><span>{t.calendar}</span><p>{language === 'hi' ? '८ नवंबर · कार्तिक अमावस्या (अमावस्या तिथि; खगोलीय अमावस्या ९ नवंबर, १२:३२ IST) · १३–१६ नवंबर · चतुर्थी से सप्तमी / छठ · २४ नवंबर · कार्तिक पूर्णिमा (पूर्णिमा २०:२३ IST)' : '8 Nov · Kartik Amavasya (new-moon tithi; exact new moon 9 Nov, 12:32 IST) · 13–16 Nov · Chaturthi to Saptami / Chhath · 24 Nov · Kartik Purnima (full moon 20:23 IST)'}</p><a href="https://www.drikpanchang.com/chhath/chhath-puja-calendar.html?geoname-id=1261481&year=2026" target="_blank" rel="noreferrer">{t.tithiCalendar} <ArrowRight size={14} /></a><a href="https://aa.usno.navy.mil/calculated/moon/phases?year=2026" target="_blank" rel="noreferrer">{t.moonPhases} <ArrowRight size={14} /></a></section>
        )}
      </main>
      {nav !== 'Home' && (
        <footer><a className="brand" href="#top" onClick={(e) => { e.preventDefault(); choose('Home'); }}><span className="brand-mark"><Sun size={17} /></span><span>{language === 'hi' ? 'छठ' : 'Chhath'}<span className="brand-dot">.</span></span></a><span>{t.tagline} · 2026</span><button onClick={() => choose('Home')}>{t.back} <ArrowDown size={14} /></button></footer>
      )}
      <span className={`made-by ${nav === 'Home' ? 'on-home' : 'on-subpage'}`}>Made with <span aria-label="love">♥</span> by Aryan</span>
    </div>
  );
}

createRoot(document.getElementById('root')).render(window.location.pathname.replace(/\/$/, '') === '/admin' ? <AudioAdmin /> : <App />);

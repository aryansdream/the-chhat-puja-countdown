import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { upload as uploadBlob } from '@vercel/blob/client';
import { ArrowDown, ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Clock3, Flame, Menu, Moon, Pause, Play, SkipBack, SkipForward, Sun, Upload, Volume2, Waves, X, Users } from 'lucide-react';
import './styles.css';
import { festivalState, countdownParts, ritualDate, festivalRange } from './festival.js';

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

    const refresh = () => fetch('/api/audio').then((r) => { if (!r.ok) throw new Error('api error'); return r.json(); }).then((d) => applyTracks(d.tracks)).catch(() => setStatus(language === 'hi' ? 'सेवा उपलब्ध नहीं है' : 'Library unavailable'));
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
    if (!AudioContextClass) { setStatus('Echo unavailable'); return null; }
    const context = new AudioContextClass(); const source = context.createMediaElementSource(audio);
    const dry = context.createGain(); dry.gain.value = 0.8;
    const delay = context.createDelay(1.5); delay.delayTime.value = echoDelay;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1700; filter.Q.value = 0.35;
    const wet = context.createGain(); wet.gain.value = echoEnabled ? 0.64 : 0;
    const feedback = context.createGain(); feedback.gain.value = echoEnabled ? 0.54 : 0;
    const limiter = context.createDynamicsCompressor(); limiter.threshold.value = -9; limiter.knee.value = 12; limiter.ratio.value = 4; limiter.attack.value = 0.004; limiter.release.value = 0.22;
    dry.connect(limiter); limiter.connect(context.destination); source.connect(dry); source.connect(delay); delay.connect(filter); filter.connect(wet).connect(limiter); filter.connect(feedback).connect(delay);
    audioContextRef.current = context; echoNodesRef.current = { delay, wet, feedback }; return context;
  }

  function audioNodesReady() { return Boolean(echoNodesRef.current); }
  function changeTrack(step) { if (!tracks.length) return; autoplayRef.current = true; setSelected((index) => (index + step + tracks.length) % tracks.length); }

  async function startAudio(isAutoplay = false) {
    const audio = audioRef.current; if (!track || !audio) return;
    const context = prepareEcho(); try { if (context?.state === 'suspended') await context.resume(); } catch {}
    try { await audio.play(); if (context?.state === 'suspended') { audio.pause(); if (isAutoplay) setStatus('Tap ▶ once to enable music'); } } catch { setPlaying(false); onPlayingChange?.(false); setStatus(isAutoplay ? 'Tap ▶ once to enable music' : 'Could not play.'); }
  }

  function togglePlayback() {
    const audio = audioRef.current; if (!track || !audio) return;
    if (audio.paused || audioContextRef.current?.state === 'suspended') startAudio(false); else audio.pause();
  }
  const timeLabel = (value) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;

  return (
    <div className="audio-player">
      <audio crossOrigin="anonymous" ref={audioRef} preload="metadata" onPlay={() => { const context = prepareEcho(); if (context?.state === 'suspended') context.resume().catch(() => {}); setPlaying(true); onPlayingChange?.(true); setStatus(''); }} onPause={() => { setPlaying(false); onPlayingChange?.(false); }} onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)} onEnded={() => changeTrack(1)} onError={() => track && setStatus('Error playing file.')} />
      <div className="audio-track-info"><strong>{track?.title || (language === 'hi' ? 'छठ के गीत' : 'Chhath songs')}</strong><span>{status || (tracks.length ? `${selected + 1} / ${tracks.length} · ${language === 'hi' ? 'साझा प्लेलिस्ट' : 'shared playlist'}` : language === 'hi' ? 'जल्द ही गीत उपलब्ध होंगे' : 'Songs will appear here')}</span></div>
      <div className="audio-controls"><button aria-label={language === 'hi' ? 'पिछला गीत' : 'Previous song'} onClick={() => changeTrack(-1)} disabled={!tracks.length}><SkipBack size={17} /></button><button className="audio-play" disabled={!tracks.length} aria-label={playing ? (language === 'hi' ? 'रोकें' : 'Pause music') : (language === 'hi' ? 'संगीत चलाएँ' : 'Play music')} onClick={togglePlayback}>{playing ? <Pause size={19} /> : <Play size={19} />}</button><button aria-label={language === 'hi' ? 'अगला गीत' : 'Next song'} onClick={() => changeTrack(1)} disabled={!tracks.length}><SkipForward size={17} /></button>
        <div className="audio-volume"><Volume2 size={16} /><input aria-label={language === 'hi' ? 'आवाज़' : 'Volume'} type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(Number(e.target.value))} /></div>
        <button className={`audio-echo ${echoEnabled ? 'active' : ''}`} type="button" onClick={() => setEchoEnabled(!echoEnabled)}><Waves size={15} /><span>{language === 'hi' ? 'इको' : 'Echo'}</span></button>
        <label className={`audio-delay ${echoEnabled ? '' : 'muted'}`}><span>{language === 'hi' ? 'गूंज' : 'Delay'}</span><input type="range" min="0.18" max="0.95" step="0.01" value={echoDelay} disabled={!echoEnabled} onChange={(e) => setEchoDelay(Number(e.target.value))} /><small>{echoDelay.toFixed(2)}s</small></label>
        <a className="audio-add" href="/admin"><Upload size={15} /><span>{language === 'hi' ? 'मालिक प्रबंधन' : 'Manage songs'}</span></a>
      </div>
      <div className="audio-progress"><span>{timeLabel(time)}</span><input aria-label={language === 'hi' ? 'गीत की प्रगति' : 'Song progress'} type="range" min="0" max={duration || 0} step="0.1" value={Math.min(time, duration || 0)} onChange={(e) => { const next = Number(e.target.value); setTime(next); if (audioRef.current) audioRef.current.currentTime = next; }} /><span>{timeLabel(duration)}</span></div>
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

  useEffect(() => { refresh().catch(() => setStatus('Could not connect.')); }, []);

  async function upload(event) {
    event.preventDefault(); const form = event.currentTarget; const files = Array.from(form.elements.songs.files || []);
    if (!password || !files.length || !rights) return;
    setBusy(true); setStatus('Uploading tracks...');
    try {
      for (const file of files) {
        if (import.meta.env.DEV) {
          const response = await fetch('/api/admin/audio', { method: 'POST', headers: { ...headers(), 'Content-Type': file.type || 'application/octet-stream', 'X-Audio-Title': encodeURIComponent(file.name) }, body: file });
          const data = await response.json(); if (!response.ok) throw new Error(data.error); setTracks(data.tracks || []);
        } else {
          await uploadBlob(`chhath-audio/${crypto.randomUUID()}-${file.name.replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 100)}`, file, { access: 'public', handleUploadUrl: '/api/audio-upload', contentType: file.type, clientPayload: JSON.stringify({ password, title: file.name.replace(/\.[^.]+$/, ''), mimeType: file.type }), });
          const refreshed = await fetch('/api/audio').then((r) => r.json()); setTracks(refreshed.tracks || []);
        }
      }
      form.reset(); setRights(false); setStatus('Uploaded.');
    } catch (error) { setStatus(error.message); } finally { setBusy(false); }
  }

  async function removeTrack(id) {
    setStatus('');
    try {
      const response = await fetch(import.meta.env.DEV ? `/api/admin/audio/${encodeURIComponent(id)}` : `/api/audio?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers() });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setTracks(data.tracks || []); setStatus('Track removed.');
    } catch (error) { setStatus(error.message); }
  }

  return (
    <main className="audio-admin-page"><a className="brand" href="/"><span className="brand-mark"><Sun size={20} /></span><span>Chhath<span className="brand-dot">.</span></span></a>
      <section className="audio-admin-card">
        <p className="eyebrow">OWNER MUSIC LIBRARY</p><h1>Shared songs</h1>
        {!configured && (<p className="admin-notice">Set credentials in Vercel project settings.</p>)}
        <label className="admin-password">Owner password<input type="password" value={password} onChange={(e) => { setPassword(e.target.value); sessionStorage.setItem('audio-admin-token', e.target.value); }} /></label>
        <form className="admin-upload-form" onSubmit={upload}>
          <label className="admin-file">Audio files<input name="songs" type="file" multiple required /></label>
          <label className="admin-rights"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} /> I have permission to host.</label>
          <button className="admin-submit" disabled={busy || !configured || !password || !rights}>{busy ? 'Uploading…' : 'Upload'}</button>
        </form>
        {status && <p className="admin-status">{status}</p>}
        <div className="admin-track-list"><h2>Playlist</h2>{tracks.length ? tracks.map((track) => (<div className="admin-track" key={track.id}><span>{track.title}</span><button type="button" onClick={() => removeTrack(track.id)} disabled={!password}>Remove</button></div>)) : <p>No songs.</p>}</div>
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
  en: { home: 'Home', journey: 'The journey', offerings: 'Offerings', wall: 'Prayer wall', morning: 'Morning', evening: 'Evening', live: 'Live prayer wall', festival: 'A festival of gratitude', countLabel: 'COUNTING DOWN TO SANDHYA ARGHYA', days: 'DAYS', hours: 'HOURS', minutes: 'MINUTES', seconds: 'SECONDS', festivalLive: 'The festival has begun', firstLight: 'First light', daylight: 'Daylight', moonlit: 'Moonlit ghat', sunset: 'Sunset', name: 'Your name', prayer: 'Write a prayer…', earthen: 'Earthen diya', lotus: 'Lotus soop', brass: 'Brass diya', float: 'Float diya', empty: 'Be the first to float a diya.', journeyEyebrow: 'THE FOUR DAYS', journeyTitle: <>A journey in <em>devotion.</em></>, journeyIntro: 'Four days shaped by care, discipline, and gratitude to the sun and the natural world.', atGhat: 'AT THE GHAT', previous: 'Previous', nextDay: 'Next day', prepare: 'PREPARE WITH CARE', offerTitle: <>The things we <em>offer.</em></>, offerIntro: 'A small guide to the familiar offerings carried from home to the water’s edge.', wallEyebrow: 'A SHARED PRAYER', wallTitle: <>Light a diya.<br /><em>Leave a wish.</em></>, wallIntro: 'Live prayer stream. To leave a prayer, use the home page chat.', calendar: '2026 LUNAR CALENDAR', tithiCalendar: 'Tithi calendar', moonPhases: 'Moon phases', back: 'Back to the river', tagline: 'A quiet place to gather', liveConnected: 'Live · connected', reconnecting: 'Reconnecting…', serverUnavailable: 'Live server unavailable', sendSuccess: 'Your prayer is now on the live ghat.', sendError: 'Could not connect. Please try again when the live server is online.', fourDays: ['Nahay-Khay', 'Lohanda & Kharna', 'Sandhya Arghya', 'Usha Arghya'], ritualShort: ['Purification', 'The first offering', 'Offering to the setting sun', 'Offering to the rising sun'], ritualText: ['The first day begins with a cleansing bath and a simple, sattvic meal. Homes and cooking spaces are carefully prepared for the days of worship ahead.', 'After a day of fasting, the evening meal is prepared with care and offered before it is shared. The long fast begins after this prasad.', 'Families gather at the water’s edge as the sun descends. Offerings are raised in the soop in gratitude for life, light, and the sustaining natural world.', 'At first light, devotees return to the water to offer arghya to the rising sun. The fast concludes with paran, and prasad is shared with loved ones.'], ritualOfferings: ['Lauki, chana dal, rice', 'Jaggery kheer, roti, fruit', 'Thekua, seasonal fruit, sugarcane', 'Water, milk, thekua, fruit'], ritualDates: ['Friday, 13 November', 'Saturday, 14 November', 'Sunday, 15 November', 'Monday, 16 November'], samagriNames: ['Thekua', 'Bamboo soop', 'Sugarcane', 'Seasonal fruit', 'Earthen diya', 'Clean water'], samagriText: ['A traditional wheat and jaggery prasad, prepared at home and shared with family.', 'A woven tray for carrying fruit and offerings to the ghat.', 'A seasonal offering that also frames the place of worship.', 'Bananas, coconut, and local harvest offered with gratitude.', 'A small flame kept at the ghat through the evening.', 'Offered to the setting and rising sun with arghya.'], moonNames: ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'], },
  hi: { home: 'मुखपृष्ठ', journey: 'चार दिनों की यात्रा', offerings: 'पूजा सामग्री', wall: 'प्रार्थना दीवार', morning: 'प्रातः', evening: 'संध्या', live: 'सजीव प्रार्थना दीवार', festival: 'कृतज्ञता का महापर्व', countLabel: 'संध्या अर्घ्य तक शेष समय', days: 'दिन', hours: 'घंटे', minutes: 'मिनट', seconds: 'सेकंड', festivalLive: 'पर्व आरंभ हो चुका है', firstLight: 'प्रथम किरण', daylight: 'दिन का उजाला', moonlit: 'चाँदनी घाट', sunset: 'सूर्यास्त', name: 'आपका नाम', prayer: 'अपनी प्रार्थना लिखें…', earthen: 'मिट्टी का दीप', lotus: 'कमल का सूप', brass: 'पीतल का दीप', float: 'दीप प्रवाहित करें', empty: 'पहला दीप आप जलाएँ।', journeyEyebrow: 'चार पावन दिन', journeyTitle: <>भक्ति की <em>पावन यात्रा।</em></>, journeyIntro: 'सूर्य और प्रकृति के प्रति श्रद्धा, संयम और कृतज्ञता से भरे चार दिन।', atGhat: 'घाट पर अर्पण', previous: 'पिछला दिन', nextDay: 'अगला दिन', prepare: 'श्रद्धा से तैयारी', offerTitle: <>हमारे <em>पावन अर्पण।</em></>, offerIntro: 'घर से घाट तक ले जाए जाने वाले परिचित पूजन अर्पणों की छोटी-सी मार्गदर्शिका।', wallEyebrow: 'साझी प्रार्थना', wallTitle: <>दीप जलाएँ।<br /><em>मनोकामना लिखें।</em></>, wallIntro: 'सजीव प्रार्थना धारा। प्रार्थना लिखने के लिए मुखपृष्ठ पर दिए संवाद का उपयोग करें।', calendar: '2026 का चंद्र पंचांग', tithiCalendar: 'तिथि पंचांग', moonPhases: 'चंद्र कलाएँ', back: 'घाट पर लौटें', tagline: 'साथ आने का एक शांत स्थान', liveConnected: 'सजीव · जुड़ा हुआ', reconnecting: 'पुनः जुड़ रहे हैं…', serverUnavailable: 'सजीव सेवा उपलब्ध नहीं', sendSuccess: 'आपकी प्रार्थना घाट पर पहुँच गई है।', sendError: 'जुड़ नहीं सके। सजीव सेवा उपलब्ध होने पर फिर प्रयास करें।', fourDays: ['नहाय-खाय', 'लोहंडा और खरना', 'संध्या अर्घ्य', 'ऊषा अर्घ्य'], ritualShort: ['शुद्धि और तैयारी', 'पहला अर्पण', 'अस्त होते सूर्य को अर्घ्य', 'उगते सूर्य को अर्घ्य'], ritualText: ['पहले दिन स्नान के बाद सात्त्विक भोजन किया जाता है। पूजा के आने वाले दिनों के लिए घर और रसोई को श्रद्धा से तैयार किया जाता है।', 'उपवास के बाद संध्या में प्रसाद सावधानी से बनाकर अर्पित किया जाता है। प्रसाद ग्रहण करने के बाद निर्जला व्रत आरंभ होता है।', 'सूर्यास्त के समय परिवार नदी तट एकत्र होकर सूप में अर्घ्य और प्रसाद अर्पित करते हैं। यह जीवन, प्रकाश और प्रकृति के प्रति कृतज्ञता का क्षण है।', 'प्रातःकाल भक्त उगते सूर्य को अर्घ्य देने लौटते हैं। पारण के साथ व्रत पूरा होता है और प्रसाद प्रियजनों में बाँटा जाता है।'], ritualOfferings: ['लौकी, चना दाल, चावल', 'गुड़ की खीर, रोटी, फल', 'ठेकुआ, मौसमी फल, गन्ना', 'जल, दूध, ठेकुआ, फल'], ritualDates: ['शुक्रवार, 13 November', 'शनिवार, 14 November', 'रविवार, 15 November', 'सोमवार, 16 November'], samagriNames: ['ठेकुआ', 'बाँस का सूप', 'गन्ना', 'मौसमी फल', 'मिट्टी का दीप', 'स्वच्छ जल'], samagriText: ['गेहूँ और गुड़ से बना पारंपरिक प्रसाद, घर में बनाकर परिवार के साथ बाँटा जाता है।', 'फल और पूजा सामग्री घाट तक ले जाने की बाँस की टोकरी।', 'पूजा स्थल को सजाने वाला मौसमी अर्पण।', 'कृतज्ञता के साथ अर्पित केले, नारियल और स्थानीय फल।', 'संध्या में घाट पर जलाया जाने वाला छोटा पवित्र दीप।', 'डूबते और उगते सूर्य को अर्घ्य के रूप में अर्पित जल।'], moonNames: ['अमावस्या', 'शुक्ल चंद्र कला', 'प्रथम तिमाही', 'शुक्ल गिबस', 'पूर्णिमा', 'कृष्ण गिबस', 'अंतिम तिमाही', 'कृष्ण चंद्र कला'], },
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

function GhatScene({ mode, festivalDay = -1 }) {
  const ref = useRef(null);
  const sceneSettings = useRef({ mode, festivalDay });
  useEffect(() => { sceneSettings.current = { mode, festivalDay }; }, [mode, festivalDay]);

  useEffect(() => {
    const canvas = ref.current, ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const random = (seed) => { const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
    const stars = Array.from({ length: mobile ? 65 : 150 }, (_, i) => ({ x: random(i), y: random(i + 300) * .52, r: .4 + random(i + 600) * 1.1, phase: random(i + 900) * 6.28 }));
    const dust = Array.from({ length: mobile ? 12 : 28 }, (_, i) => ({ x: random(i + 1500), y: random(i + 1600), phase: random(i + 1700) * 6.28 }));
    let width = 0, height = 0, raf = 0, previous = 0, time = 0;
    // Hand-painted palettes are blended live; the scene contains no bitmap backgrounds.
    const palettes = {
      night: ['#06141e', '#132f40', '#5e5a62', '#132e37', '#061c26', '#e8c38b'],
      dawn: ['#172d43', '#6a6874', '#e6a07c', '#49616a', '#132c37', '#ffe0a4'],
      day: ['#173c56', '#648f9d', '#c5c9b0', '#547c83', '#163b49', '#fff1bc'],
      sunset: ['#1c263f', '#795568', '#e19a6d', '#514d5e', '#182d3d', '#ffca82'],
    };
    const rgb = hex => hex.match(/[a-f\d]{2}/gi).map(n => parseInt(n, 16));
    let colors = palettes[sceneSettings.current.mode] || palettes.night;
    let liveColors = colors.map(rgb);
    const color = (i, alpha = 1) => `rgba(${liveColors[i].map(Math.round).join(',')},${alpha})`;
    const gradient = (x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([at, value]) => g.addColorStop(at, value)); return g; };
    const resize = () => {
      const box = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.7);
      width = box.width; height = box.height; canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(canvas);

    function temple(x, baseline, scale, variant) {
      ctx.save(); ctx.translate(x, baseline); ctx.scale(scale, scale);
      ctx.fillStyle = '#132b34';
      ctx.fillRect(-22, -8, 44, 10); ctx.fillRect(-18, -18, 36, 12); ctx.fillRect(-13, -49, 26, 31);
      if (variant % 2) {
        ctx.beginPath(); ctx.moveTo(-18, -49); ctx.quadraticCurveTo(-5, -65, 0, -88); ctx.quadraticCurveTo(5, -65, 18, -49); ctx.closePath(); ctx.fill();
        ctx.fillRect(-2, -98, 4, 14);
      } else {
        ctx.beginPath(); ctx.arc(0, -49, 18, Math.PI, 0); ctx.fill(); ctx.fillRect(-20, -50, 40, 5); ctx.fillRect(-1, -79, 2, 15);
      }
      ctx.strokeStyle = '#917850'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0, -95); ctx.lineTo(0, -120); ctx.stroke();
      ctx.fillStyle = '#b17651'; ctx.beginPath(); ctx.moveTo(0, -120); ctx.quadraticCurveTo(13, -121 + Math.sin(time + x) * 2, 19, -114); ctx.lineTo(0, -109); ctx.fill();
      ctx.fillStyle = 'rgba(246,192,116,.5)'; ctx.fillRect(-3, -35, 6, 13);
      ctx.restore();
    }

    function diya(x, y, size, seed) {
      const flicker = .88 + Math.sin(time * 2.4 + seed) * .12;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 9);
      glow.addColorStop(0, 'rgba(255,178,83,.24)'); glow.addColorStop(.3, 'rgba(240,133,61,.06)'); glow.addColorStop(1, 'rgba(240,133,61,0)');
      ctx.fillStyle = glow; ctx.fillRect(x - size * 9, y - size * 9, size * 18, size * 18);
      ctx.fillStyle = '#a46945'; ctx.beginPath(); ctx.ellipse(x, y + size * 1.2, size * 2.4, size * .8, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#e8b77a'; ctx.beginPath(); ctx.ellipse(x, y + size, size * 2.4, size * .45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffc16d'; ctx.beginPath(); ctx.moveTo(x, y - size * 4 * flicker); ctx.bezierCurveTo(x + size * 2, y - size, x + size, y + size, x, y + size); ctx.bezierCurveTo(x - size, y + size, x - size * 1.5, y - size, x, y - size * 4 * flicker); ctx.fill();
      ctx.fillStyle = '#fff3cc'; ctx.beginPath(); ctx.ellipse(x, y - size * .5, size * .42, size * 1.2, 0, 0, Math.PI * 2); ctx.fill();
      for (let j = 0; j < 5; j++) {
        ctx.fillStyle = `rgba(255,191,103,${.25 * (1 - j / 5)})`;
        ctx.fillRect(x - size * (1.3 + j * .25) + Math.sin(time + j + seed) * size, y + size * (3 + j * 2.3), size * (2.6 + j * .5), .7);
      }
    }

    function render(timestamp = 0) {
      const interval = reducedMotion ? 1000 : mobile ? 50 : 33;
      if (timestamp - previous < interval) { raf = requestAnimationFrame(render); return; }
      previous = timestamp; time = reducedMotion ? 0 : timestamp * .00035;
      const settings = sceneSettings.current, night = settings.mode === 'night';
      colors = palettes[settings.mode] || palettes.night;
      colors.map(rgb).forEach((target, i) => target.forEach((v, j) => { liveColors[i][j] += (v - liveColors[i][j]) * .05; }));
      const horizon = height * .53, orbX = width * (mobile ? .76 : .77), orbY = height * .28;
      ctx.fillStyle = gradient(0, 0, 0, horizon * 1.2, [[0, color(0)], [.58, color(1)], [1, color(2)]]); ctx.fillRect(0, 0, width, height);
      const atmosphere = ctx.createRadialGradient(orbX, horizon, 0, orbX, horizon, width * .55);
      atmosphere.addColorStop(0, color(5, night ? .1 : .3)); atmosphere.addColorStop(1, color(5, 0)); ctx.fillStyle = atmosphere; ctx.fillRect(0, 0, width, height);
      // Sparse stars, drifting mist, and the real lunar phase.
      const starAlpha = night ? 1 : settings.mode === 'day' ? 0 : .2;
      stars.forEach(star => { ctx.fillStyle = `rgba(231,238,228,${starAlpha * (.3 + .3 * Math.sin(time + star.phase))})`; ctx.beginPath(); ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2); ctx.fill(); });
      const radius = Math.min(width * .035, 44), halo = ctx.createRadialGradient(orbX, orbY, radius, orbX, orbY, radius * 7);
      halo.addColorStop(0, color(5, night ? .11 : .21)); halo.addColorStop(.45, color(5, .035)); halo.addColorStop(1, color(5, 0));
      ctx.fillStyle = halo; ctx.fillRect(orbX - radius * 7, orbY - radius * 7, radius * 14, radius * 14);
      ctx.save(); ctx.beginPath(); ctx.arc(orbX, orbY, radius, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = night ? '#e0e6d9' : '#ffe2a3'; ctx.fillRect(orbX - radius, orbY - radius, radius * 2, radius * 2);
      if (night) { const moon = lunarData(new Date()); ctx.fillStyle = color(0); ctx.beginPath(); ctx.arc(orbX + (moon.fraction < .5 ? -1 : 1) * radius * moon.illumination / 50, orbY, radius, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
      // Layered distant shores create depth without a photograph.
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = ['rgba(27,47,58,.28)', 'rgba(22,44,53,.45)', '#16313b'][layer]; ctx.beginPath(); ctx.moveTo(0, horizon + 30);
        for (let x = 0; x <= width + 20; x += 20) ctx.lineTo(x, horizon - 8 - layer * 7 + Math.sin(x / (100 + layer * 45) + layer * 2) * (12 + layer * 4));
        ctx.lineTo(width, horizon + 40); ctx.closePath(); ctx.fill();
      }
      const unit = Math.max(.55, Math.min(width / 1500, 1.1));
      [ .12, .19, .68, .75, .83, .92 ].forEach((x, i) => temple(width * x, horizon + 2 + (i % 2) * 8, unit * (.6 + random(i + 2400) * .6), i));
      ctx.fillStyle = gradient(0, horizon, 0, height, [[0, color(3)], [.25, color(4)], [1, color(0)]]); ctx.fillRect(0, horizon + 12, width, height);
      // A narrow path of light stretches across moving water.
      const reflection = ctx.createRadialGradient(orbX, horizon, 0, orbX, horizon, height * .55);
      reflection.addColorStop(0, color(5, .12)); reflection.addColorStop(1, color(5, 0)); ctx.fillStyle = reflection; ctx.fillRect(width * .45, horizon + 12, width * .55, height);
      for (let i = 0; i < (mobile ? 40 : 75); i++) {
        const depth = i / 75, y = horizon + 18 + depth ** 1.6 * height * .5;
        const length = (20 + depth * 230) * (mobile ? .45 : 1), wave = Math.sin(time * 2 + i * .9) * (4 + depth * 13);
        ctx.fillStyle = color(5, (.09 + Math.sin(i * 3.1) * .055) * (1 - depth * .65));
        ctx.fillRect(orbX - length / 2 + wave, y, length, .8 + depth);
      }
      for (let i = 0; i < (mobile ? 26 : 55); i++) {
        const depth = random(i + 3000), x = random(i + 3100) * width, y = horizon + 28 + depth * (height - horizon);
        const length = (12 + depth * 60) * (mobile ? .6 : 1);
        ctx.strokeStyle = `rgba(150,185,185,${.035 + depth * .04})`; ctx.lineWidth = .65; ctx.beginPath();
        ctx.moveTo(x - length, y); ctx.quadraticCurveTo(x, y + Math.sin(time * 2 + i) * 4, x + length, y); ctx.stroke();
      }
      // Stone steps and rows of lights frame the shared water.
      ctx.fillStyle = gradient(0, horizon, 0, height, [[0, '#142d32'], [1, '#071b22']]);
      ctx.beginPath(); ctx.moveTo(width, horizon); ctx.lineTo(width * .96, horizon); ctx.bezierCurveTo(width * .9, height * .67, width * .96, height * .83, width * .68, height); ctx.lineTo(width, height); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#0b2229'; ctx.beginPath(); ctx.moveTo(0, horizon + 20); ctx.lineTo(width * .06, horizon + 20); ctx.quadraticCurveTo(width * .05, height * .8, width * .22, height); ctx.lineTo(0, height); ctx.closePath(); ctx.fill();
      for (let i = 0; i < 13; i++) {
        const depth = i / 13, y = horizon + 23 + depth ** 1.6 * (height - horizon), x = width * (.963 - depth * depth * .25);
        ctx.strokeStyle = `rgba(158,146,112,${.08 + depth * .08})`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(width, y + 7); ctx.stroke();
        diya(x + 8, y - 4, .6 + depth * 1.5, i);
      }
      const lampCount = mobile ? 10 : 22;
      for (let i = 0; i < lampCount; i++) {
        const depth = random(i + 3600), x = width * (.3 + random(i + 3700) * .56) + Math.sin(time * .5 + i) * 4;
        const y = horizon + 36 + depth * (height - horizon) * .78;
        diya(x, y, .55 + depth * (mobile ? 1 : 1.55), i + 100);
      }
      dust.forEach((mote, i) => { const x = ((mote.x + time * .003) % 1) * width, y = height * (.15 + mote.y * .7) + Math.sin(time + mote.phase) * 12; ctx.fillStyle = `rgba(255,205,133,${.08 + Math.max(0, Math.sin(time + i)) * .15})`; ctx.beginPath(); ctx.arc(x, y, mobile ? .65 : 1, 0, Math.PI * 2); ctx.fill(); });
      // The daily ritual adds a gentle wash of its own light over the horizon.
      const ritualColors = ['181,210,179', '239,184,117', '245,144,88', '255,222,160'];
      if (settings.festivalDay >= 0) { const wash = ctx.createRadialGradient(width * .75, horizon, 0, width * .75, horizon, width * .45); wash.addColorStop(0, `rgba(${ritualColors[settings.festivalDay]},.065)`); wash.addColorStop(1, `rgba(${ritualColors[settings.festivalDay]},0)`); ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height); }
      raf = requestAnimationFrame(render);
    }
    const onVisibility = () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(render); };
    document.addEventListener('visibilitychange', onVisibility); raf = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);
  return <canvas ref={ref} className="ghat-canvas" aria-label="Living Chhath ghat: a changing sky, temple silhouettes, river reflections and glowing diyas" />;
}

// Position each diya relative to the clipped water layer, not the whole hero.
// The water in GhatScene starts at 62% of the scene height. The side banks
// extend farther into the river near the bottom, so the safe horizontal range
// narrows as a diya moves down the screen.
function diyaWaterPosition(index) {
  const seed = (index * 47 + 13) % 97;
  const spread = seed / 97;
  const depth = ((index * 37) % 100) / 100;

  // Coordinates are relative to .floating-diyas, which covers only the water.
  const top = 8 + depth * 52;
  const leftLimit = 29 + depth * 11;
  const rightLimit = 71 - depth * 11;
  const left = leftLimit + spread * (rightLimit - leftLimit);

  return {
    position: 'absolute',
    left: `${left}%`,
    top: `${top}%`,
    '--drift-x': `${(spread * 2 - 1) * 2}px`,
    '--drift-y': `${(spread * 2 - 1) * 1}px`,
  };
}

function App() {
  const [nav, setNav] = useState('Home'); const [override, setOverride] = useState(null); const [now, setNow] = useState(Date.now());
  const [ritual, setRitual] = useState(() => Math.max(0, festivalState().day)); const [name, setName] = useState(''); const [message, setMessage] = useState('');
  const [diya, setDiya] = useState('Earthen diya'); const [wishes, setWishes] = useState([]); const [toast, setToast] = useState('');
  const [liveState, setLiveState] = useState('connecting'); const [language, setLanguage] = useState(() => localStorage.getItem('chhath-language') === 'hi' ? 'hi' : 'en');
  const [menu, setMenu] = useState(false); const [languagePulse, setLanguagePulse] = useState(false); const [musicPlaying, setMusicPlaying] = useState(false);
  
  const t = translations[language]; const autoScene = sceneForNow(new Date(now)), mode = override || autoScene, themeMode = mode === 'morning' ? 'dawn' : mode === 'evening' ? 'sunset' : mode;
  const moon = useMemo(() => lunarData(new Date(now)), [now]);
  const phase = festivalState(now), festival = phase.festival;
  const countdown = countdownParts(now, phase.target);
  const dateRange = festivalRange(festival, language);
  const sameYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Kolkata', year: 'numeric' }).format(now)) === festival.year;
  const phaseTitle = phase.day >= 0 ? t.fourDays[phase.day] : language === 'hi' ? `छठ पूजा ${festival.year}` : `Chhath Puja ${festival.year}`;
  const countdownLabel = phase.status === 'unlisted' ? (language === 'hi' ? 'अगले पर्व की तिथियाँ जल्द आएँगी' : 'Next festival dates will be announced') : phase.day === 3 ? (language === 'hi' ? 'ऊषा अर्घ्य और पारण का पावन दिन' : 'A day of Usha Arghya, Parana and shared prasad') : phase.status === 'next-year' ? (language === 'hi' ? `${sameYear ? 'छठ पूजा' : 'अगले वर्ष के छठ पूजा'} ${festival.year} तक` : `Until ${sameYear ? '' : 'next year’s '}Chhath Puja ${festival.year}`) : (language === 'hi' ? `${t.fourDays[phase.nextDay]} के दिन तक` : `Until ${t.fourDays[phase.nextDay]} day begins`);
  const moonName = language === 'hi' ? t.moonNames[['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'].indexOf(moon.name)] || moon.name : moon.name;

  const liveLabel = { connecting: language === 'hi' ? 'प्रार्थना दीवार से जुड़ रहे हैं…' : 'Connecting to prayer wall…', connected: t.liveConnected, reconnecting: t.reconnecting, unavailable: t.serverUnavailable }[liveState] || liveState;
  const displayRituals = rituals.map((r, i) => ({ ...r, name: t.fourDays[i], short: t.ritualShort[i], text: t.ritualText[i], offerings: t.ritualOfferings[i], date: ritualDate(festival.dates[i], language, true) }));
  const displaySamagri = samagri.map(([title, copy], i) => language === 'hi' ? [t.samagriNames[i], t.samagriText[i]] : [title, copy]);

  useEffect(() => { localStorage.setItem('chhath-language', language); document.documentElement.lang = language; }, [language]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  
  useEffect(() => { setRitual(Math.max(0, phase.day)); setOverride(null); }, [phase.day, festival.year]);

  useEffect(() => {
    let active = true; const refresh = () => fetch('/api/prayers').then((response) => { if (!response.ok) throw new Error('Prayer service unavailable'); return response.json(); }).then((data) => { if (active) { setWishes(Array.isArray(data.prayers) ? data.prayers : []); setLiveState('connected'); } }).catch(() => { if (active) setLiveState('unavailable'); });
    refresh(); const timer = setInterval(refresh, 5000); return () => { active = false; clearInterval(timer); };
  }, []);

  function choose(navItem) { setMenu(false); if (navItem === nav) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; } const change = () => { setNav(navItem); window.scrollTo({ top: 0, behavior: 'smooth' }); }; if (document.startViewTransition) document.startViewTransition(change); else change(); }
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
    <div id="top" className={`site ${themeMode} ${nav === 'Home' ? 'landing' : 'subpage'} ${languagePulse ? 'language-pulse' : ''} ${musicPlaying ? 'music-playing' : ''} festival-day-${phase.day + 1}`} >
      <style>{`
        @keyframes float-drift {
          0%, 100% { transform: translate(0, 0) rotate(-2deg); }
          50% { transform: translate(var(--drift-x), var(--drift-y)) rotate(2deg); }
        }
        .floating-diya { animation-name: float-drift; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        @keyframes pulse-dot {
          0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
          100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }
      `}</style>
      
      <header className="topbar">
        <a className="brand" href="#top" onClick={(e) => { e.preventDefault(); choose('Home'); }}><span className="brand-mark"><Sun size={20} /></span><span>{language === 'hi' ? 'छठ' : 'Chhath'}<span className="brand-dot">.</span></span></a>
        <button className="menu-toggle" aria-expanded={menu} onClick={() => setMenu(!menu)} aria-label={language === 'hi' ? 'नेविगेशन खोलें' : 'Toggle navigation'}>{menu ? <X /> : <Menu />}</button>
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
      <div className="global-scene" aria-hidden="true"><GhatScene mode={themeMode} festivalDay={phase.day} /><div className="global-scene-shade" /></div>
      <main key={nav} className={nav === 'Home' ? 'home-view' : 'content-view'}>
        {nav === 'Home' && (
          <section className="hero" aria-label={language === 'hi' ? 'छठ पूजा घाट' : 'Chhath sanctuary'}>
            <div className="hero-shade" />
            <div className="hero-content">
              <p className="sanctuary-eyebrow"><span /> {language === 'hi' ? 'सूर्य की उपासना · प्रकृति का उत्सव' : 'TO THE SUN. TO LIFE. TOGETHER.'}</p>
              <h1><span className="hindi-title">छठ</span><span className="hero-title-caption">{language === 'hi' ? 'आस्था का महापर्व' : 'A quiet offering. A shared light.'}</span></h1>
              <div className="festival-today" aria-live="polite">
                <p className="festival-kicker">{phase.day >= 0 ? (language === 'hi' ? `आज · दिन ${phase.day + 1} / 4` : `TODAY · DAY ${phase.day + 1} OF 4`) : (language === 'hi' ? 'अगली पावन यात्रा' : 'THE NEXT JOURNEY')}</p>
                <h2>{phaseTitle}</h2>
                {phase.day >= 0 && <p className="festival-offerings">{t.ritualOfferings[phase.day]}</p>}
                <p className="festival-description">{phase.day >= 0 ? t.ritualShort[phase.day] : phase.status === 'next-year' ? (language === 'hi' ? 'इस वर्ष का महापर्व संपन्न। छठी मैया की कृपा बनी रहे।' : 'This year’s celebration is complete. May Chhathi Maiya’s blessings stay with you.') : t.journeyIntro}</p>
              </div>
              <div className="hero-countdown">
                <p className="festival-count-label">{countdownLabel}</p>
                {phase.target !== null && <div className="countdown" role="timer" aria-label={countdownLabel}>{[['days', countdown.days, t.days], ['hours', countdown.hours, t.hours], ['minutes', countdown.minutes, t.minutes], ['seconds', countdown.seconds, t.seconds]].map(([key, value, label]) => (<div className="count-item" key={key}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>))}</div>}
                <p className="festival-time-note">{language === 'hi' ? 'दिन भारतीय समयानुसार बदलते हैं · अर्घ्य अपने स्थानीय सूर्योदय / सूर्यास्त पर दें' : 'Days change at midnight IST · Observe Arghya at your local sunrise / sunset'}</p>
              </div>
              <div className="prayer-connection"><span className={liveState === 'connected' ? 'connected' : ''} />{liveLabel}</div>
              <div className="hero-date"><CalendarDays size={15} /> {dateRange}</div>
              <div className="festival-day-track" aria-label={language === 'hi' ? 'चार पावन दिन' : 'The four sacred days'}>{t.fourDays.map((title, i) => <button key={title} className={phase.day === i ? 'is-today' : phase.day > i ? 'is-complete' : ''} aria-current={phase.day === i ? 'date' : undefined} onClick={() => { setRitual(i); choose('The journey'); }}><span>{phase.day > i ? <Check size={12} /> : String(i + 1).padStart(2, '0')}</span><strong>{title}</strong><small>{new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }).format(new Date(festival.starts[i]))}</small></button>)}</div>
              <button className="festival-guide" onClick={() => { setRitual(Math.max(0, phase.day)); choose('The journey'); }}>{language === 'hi' ? 'आज की विधि और अर्पण' : 'Explore the rituals & offerings'} <ArrowRight size={14} /></button>
            </div>
            <aside className="hero-chat" aria-label={t.live}>
              <div className="prayer-card-heading"><span className="prayer-card-icon"><Flame size={22} /></span><div><p>{language === 'hi' ? 'एक दीप · एक प्रार्थना' : 'ONE DIYA. ONE WISH.'}</p><h2>{language === 'hi' ? 'अपनी प्रार्थना अर्पित करें।' : 'Let your prayer find light.'}</h2></div></div>
              <p className="prayer-card-intro">{language === 'hi' ? 'मन की बात लिखें, और साझा घाट पर एक दीप जलाएँ।' : 'Leave a little hope on the water. Your prayer becomes a diya on our shared ghat.'}</p>
              <div className="chat-stream">{wishes.slice(-1).reverse().map((w, i) => (<article className="chat-message" key={w.id}><div className="chat-person"><span>{w.name.slice(0, 1)}</span><strong>{w.name}</strong><small>{i === 0 ? language === 'hi' ? 'अभी' : 'just now' : `${i * 4 + 2}${language === 'hi' ? 'मि' : 'm'}`}</small></div><p>{w.message}</p></article>))}{!wishes.length && (<p className="chat-empty">{t.empty}</p>)}</div>
              <form className="inline-prayer" onSubmit={submitWish}><label className="prayer-field-label" htmlFor="prayer-name">{t.name}</label><input id="prayer-name" aria-label={t.name} required maxLength="50" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} /><label className="prayer-field-label" htmlFor="prayer-message">{language === 'hi' ? 'आपकी प्रार्थना' : 'Your prayer'}</label><textarea id="prayer-message" aria-label={language === 'hi' ? 'प्रार्थना संदेश' : 'Prayer message'} required maxLength="220" rows="2" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t.prayer} /><div className="inline-prayer-bottom"><button type="submit"><Flame size={14} /> {language === 'hi' ? 'दीप जलाएँ' : 'Float a diya'} <ArrowRight size={14} /></button></div>{toast && <small className="inline-toast">{toast}</small>}</form>
            </aside>
            <div
              className="floating-diyas"
              aria-label={language === 'hi' ? 'भक्तों के दीप' : 'Floating diyas shared by visitors'}
              style={{
                position: 'absolute',
                top: '62%',
                right: 0,
                bottom: 0,
                left: 0,
                overflow: 'hidden',
                isolation: 'isolate',
              }}
            >
              {wishes.slice(-40).map((w, i) => (
                <button key={w.id} className="floating-diya" style={{ ...diyaWaterPosition(i), pointerEvents: 'auto', animationDelay: `-${(i % 7) * 0.55}s`, animationDuration: `${12 + (i % 5) * 2.3}s` }} aria-label={`${language === 'hi' ? 'दीप' : 'Diya'} · ${w.name}: ${w.message}`}>
                  <svg className="diya-art" viewBox="0 0 52 40" aria-hidden="true"><path className="diya-flame" d="M26 3C28 9 34 12 32 19c-1 4-4 6-7 6-5 0-8-4-7-9 1-4 5-6 5-11 2 2 3 4 3 6 2-2 2-5 0-8Z" /><path className="diya-flame-core" d="M26 12c2 4 4 6 3 9-.5 2-2 3-4 3-3 0-4-2-4-4 0-2 2-4 3-6 0 2 1 3 2 4 1-2 1-4 0-6Z" /><path className="diya-bowl" d="M5 27c5 0 8-2 12-4 3-2 6-2 9-2s6 0 9 2c4 2 7 4 12 4-2 7-8 10-21 10S7 34 5 27Z" /><ellipse className="diya-oil" cx="26" cy="27" rx="12" ry="2.2" /><path className="diya-rim" d="M5 27c7 0 8-6 21-6s14 6 21 6" /><path className="diya-highlight" d="M11 31c4 4 8 4 13 4" /></svg>
                  <span className="diya-tooltip"><strong>{w.name}</strong>{w.message}</span>
                </button>
              ))}
            </div>
            <div className="hero-bottom audio-open"><div className="audio-player-shell"><AudioPlayer language={language} onPlayingChange={setMusicPlaying} /></div></div>
            <div className="scene-label">{({ morning: 'FIRST LIGHT', evening: 'LAST LIGHT', dawn: 'FIRST LIGHT', day: 'DAYLIGHT', sunset: 'LAST LIGHT', night: 'MOONLIT GHAT' })[mode]}<span>{override ? 'PREVIEW MODE' : 'ASIA / KOLKATA'}</span></div>
          </section>
        )}
        {nav === 'The journey' && (
          <section className="journey section" id="the-journey"><div className="section-heading"><div><p className="eyebrow align-left">{t.journeyEyebrow}</p><h2>{t.journeyTitle}</h2></div><p>{t.journeyIntro}</p></div><div className="journey-layout"><div className="ritual-list">{displayRituals.map((r, i) => (<button key={r.mark} aria-current={phase.day === i ? 'step' : undefined} className={`ritual-row ${ritual === i ? 'current' : ''}`} onClick={() => setRitual(i)}><span className="ritual-number">{r.mark}</span><span className="ritual-main"><strong>{r.name}</strong><small>{r.short}{phase.day === i ? (language === 'hi' ? ' · आज' : ' · Today') : ''}</small></span><span className="ritual-date">{ritualDate(festival.dates[i], language)}</span><ArrowRight className="ritual-arrow" size={17} /></button>))}</div><article className="ritual-detail" key={ritual}><p className="eyebrow align-left">{displayRituals[ritual].date}</p><div className="detail-mark">{displayRituals[ritual].mark}</div><h3>{displayRituals[ritual].name}</h3><p className="detail-short">{displayRituals[ritual].short}</p><p className="detail-copy">{displayRituals[ritual].text}</p><div className="detail-offering"><span>{t.atGhat}</span><strong>{displayRituals[ritual].offerings}</strong></div><div className="detail-controls"><button onClick={() => setRitual(Math.max(0, ritual - 1))} disabled={ritual === 0}><ArrowLeft size={16} /> {t.previous}</button><button onClick={() => setRitual(Math.min(3, ritual + 1))} disabled={ritual === 3}>{t.nextDay} <ArrowRight size={16} /></button></div></article></div></section>
        )}
        {nav === 'Offerings' && (
          <section className="samagri section" id="offerings"><div className="section-heading"><div><p className="eyebrow align-left">{t.prepare}</p><h2>{t.offerTitle}</h2></div><p>{t.offerIntro}</p></div><div className="samagri-grid">{displaySamagri.map(([title, copy], i) => (<article className="samagri-item" key={title}><span className="samagri-icon">{i === 4 ? <Flame size={19} /> : <span>0{i + 1}</span>}</span><h3>{title}</h3><p>{copy}</p></article>))}</div></section>
        )}
        {nav === 'Prayer wall' && (
          <section className="wall section" id="prayer-wall"><div className="wall-heading"><div><p className="eyebrow align-left">{t.wallEyebrow}</p><h2>{t.wallTitle}</h2><p className="wall-intro">{t.wallIntro}</p></div><div className="wall-flame"><Flame size={36} strokeWidth={1} /></div></div><div className="wall-layout"><div className="wishes"><div className="wishes-top"><span>{language === 'hi' ? 'प्रार्थना दीवार' : 'THE PRAYER WALL'} · {liveLabel.toUpperCase()}</span><span>{Math.min(wishes.length, 40)}/40 {language === 'hi' ? 'प्रवाहित दीप' : 'floating diyas'} · {wishes.length} {language === 'hi' ? 'प्रार्थनाएँ' : 'prayers'}</span></div>{wishes.slice().reverse().map((w, i) => (<article className="wish" key={w.id}><div className="wish-meta"><span><Flame size={14} />{language === 'hi' ? { 'Earthen diya': t.earthen, 'Lotus soop': t.lotus, 'Brass diya': t.brass, }[w.diya] || w.diya : w.diya}</span><span>{language === 'hi' ? 'अर्पण' : 'OFFERING'} {String(i + 1).padStart(2, '0')}</span></div><p>“{w.message}”</p><small>{w.name}</small></article>))}</div></div></section>
        )}
        {nav !== 'Home' && (
          <section className="date-note"><span>{language === 'hi' ? `छठ पंचांग ${festival.year}` : `CHHATH CALENDAR ${festival.year}`}</span><p>{dateRange} · {language === 'hi' ? 'नहाय-खाय से ऊषा अर्घ्य तक। सभी दिन भारतीय समयानुसार बदलते हैं। अर्घ्य का समय स्थानीय सूर्योदय और सूर्यास्त पर निर्भर है।' : 'Nahay-Khay through Usha Arghya. Days follow India time; Arghya timings follow your local sunrise and sunset.'}</p><a href={`https://www.drikpanchang.com/chhath/chhath-puja-calendar.html?year=${festival.year}`} target="_blank" rel="noreferrer">{t.tithiCalendar} <ArrowRight size={14} /></a><a href={`https://aa.usno.navy.mil/calculated/moon/phases?year=${festival.year}`} target="_blank" rel="noreferrer">{t.moonPhases} <ArrowRight size={14} /></a></section>
        )}
      </main>
      {nav !== 'Home' && (
        <footer><a className="brand" href="#top" onClick={(e) => { e.preventDefault(); choose('Home'); }}><span className="brand-mark"><Sun size={17} /></span><span>{language === 'hi' ? 'छठ' : 'Chhath'}<span className="brand-dot">.</span></span></a><span>{t.tagline} · {festival.year}</span><button onClick={() => choose('Home')}>{t.back} <ArrowDown size={14} /></button></footer>
      )}
      <span className={`made-by ${nav === 'Home' ? 'on-home' : 'on-subpage'}`}>Made with <span aria-label="love">♥</span> by Aryan</span>
    </div>
  );
}

createRoot(document.getElementById('root')).render(window.location.pathname.replace(/\/$/, '') === '/admin' ? <AudioAdmin /> : <App />);
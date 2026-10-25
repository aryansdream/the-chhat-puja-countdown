  const displayRituals = rituals.map((r, i) => language === 'hi' ? { ...r, name: t.fourDays[i], short: t.ritualShort[i], text: t.ritualText[i], offerings: t.ritualOfferings[i], date: t.ritualDates[i] } : r);
  const displaySamagri = samagri.map(([title, copy], i) => language === 'hi' ? [t.samagriNames[i], t.samagriText[i]] : [title, copy]);

  useEffect(() => { localStorage.setItem('chhath-language', language); document.documentElement.lang = language; }, [language]);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  
  // Simulate live users fluctuating
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineUsers(prev => Math.max(120, prev + Math.floor(Math.random() * 5) - 2));
    }, 4500);
    return () => clearInterval(interval);
  }, []);

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
        @keyframes pulse-dot {
          0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
          100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }
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
              <h1><span className="hindi-title">छठ</span></h1>
              <div className="hero-countdown"><div className="countdown">{countdown.passed ? (<span className="festival-live">{t.festivalLive}</span>) : (<>{[['days', countdown.days, t.days], ['hours', countdown.hours, t.hours], ['minutes', countdown.minutes, t.minutes], ['seconds', countdown.seconds, t.seconds],].map(([key, value, label]) => (<div className="count-item" key={key}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>))}</>)}</div></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '20px', fontSize: '0.9rem', color: 'rgba(255,255,255,0.9)' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#4ade80', borderRadius: '50%', animation: 'pulse-dot 2s infinite' }}></span>
                <span><strong>{onlineUsers}</strong> {language === 'hi' ? 'भक्त अभी लाइव हैं' : 'devotees online'}</span>
              </div>
              <div className="hero-date"><CalendarDays size={15} /> {language === 'hi' ? '१३ — १६ नवंबर २०२६' : '13 — 16 November 2026'}</div>
            </div>
            <aside className="hero-chat" aria-label={t.live}>
              <div className="chat-stream">{wishes.slice(-1).reverse().map((w, i) => (<article className="chat-message" key={w.id}><div className="chat-person"><span>{w.name.slice(0, 1)}</span><strong>{w.name}</strong><small>{i === 0 ? language === 'hi' ? 'अभी' : 'just now' : `${i * 4 + 2}${language === 'hi' ? 'मि' : 'm'}`}</small></div><p>{w.message}</p></article>))}{!wishes.length && (<p className="chat-empty">{t.empty}</p>)}</div>
              <form className="inline-prayer" onSubmit={submitWish}><input aria-label={t.name} required maxLength="50" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} /><textarea aria-label={language === 'hi' ? 'प्रार्थना संदेश' : 'Prayer message'} required maxLength="220" rows="2" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t.prayer} /><div className="inline-prayer-bottom"><button type="submit">{language === 'hi' ? 'भेजें' : 'Send'} <ArrowRight size={14} /></button></div>{toast && <small className="inline-toast">{toast}</small>}</form>
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

function LockedTopic({topic}) {
  const state = window.MA_STATE?.auth;
  const retry = state === 'error' || state === 'limited';
  return <section className="pa-gutter mx-auto max-w-[920px] py-12">
    <div className="pa-card rounded-2xl p-6">
      <Lock size={28}/><h1 className="font-display mt-4 text-[30px] font-semibold">{topic.title}</h1>
      <p className="pa-muted mt-4">{retry ? 'Не удалось загрузить тему. Повторите попытку.' : 'Эта тема доступна по подписке на патофизиологию. Две пробные темы открыты всем.'}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {retry ? <button className="pa-btn" onClick={()=>location.reload()}>Повторить загрузку</button> : <a className="pa-btn pa-btn-primary" href={window.MA?.signedIn() ? '../auth/#account' : window.MA?.loginUrl()}> {window.MA?.signedIn() ? 'Мой аккаунт' : 'Войти в аккаунт'}</a>}
        <a className="pa-btn" href="#disease">Открыть пробную тему</a>
      </div>
    </div>
  </section>;
}

function PathoAtlas() {
  const [store, setStore] = useState(loadStore);
  const [view, setView] = useState(location.hash === '#run' ? 'run' : window.MA_TOPIC ? 'topic' : 'home');
  const [topicId, setTopicId] = useState(window.MA_TOPIC || TOPICS[0].id);
  const [tab, setTabRaw] = useState('passport');
  const [query, setQuery] = useState('');
  const [navOpen, setNavOpen] = useState(false);
  const mode = store.mode;
  const setMode = (m) => setStore((s) => ({ ...s, mode: m }));
  const first = useRef(true);

  useEffect(() => { saveStore(store); }, [store]);
  useEffect(() => { window.MA?.mount(document.querySelectorAll('[data-ma-acct]')); }, []);
  useEffect(() => {
    window.MAP?.sections('pathophys', TOPICS.map(t => ({id:t.id,n:t.title,total:1,learned:store.done[t.id]?1:0,seen:store.done[t.id]?1:0,locked:!!t.locked&&!SUBJECT_ACCESS})));
  }, [store.done]);
  useEffect(() => {
    const t=TOPIC_MAP[topicId];
    if(view==='topic' && !t.locked)window.MAP?.last({atlas:'pathophys',title:t.title,sub:SECTION_TITLE(t.section),url:location.href});
  }, [view,topicId]);

  useEffect(() => {
    const fromHash = () => {
      try {
        const h = (window.location.hash || '').slice(1).replace(/^topic\//,'');
        if (TOPIC_MAP[h]) { setTopicId(h); setView('topic'); } else setView(h === 'run' ? 'run' : 'home');
      } catch (e) { /* ignore */ }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    try { window.scrollTo({ top: 0 }); } catch (e) { /* ignore */ }
  }, [view, topicId]);

  const openTopic = (id, t) => { if(!TOPIC_MAP[id])return; location.hash=id; setTopicId(id); setTabRaw(t || 'passport'); setView('topic'); setNavOpen(false); };
  const setTab = (t) => setTabRaw(t);
  const goHome = () => { location.hash=''; setView('home'); setNavOpen(false); };
  const goRun = () => { location.hash='run'; setView('run'); setNavOpen(false); };

  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  const topic = TOPIC_MAP[topicId];
  const crumb = view === 'topic' ? topic.title : view === 'run' ? 'Экзаменационный прогон' : 'Обзор';
  const sidebarProps = { view, topicId, store, query, setQuery, onOpen: openTopic, onHome: goHome, onRun: goRun };

  return (
    <div className="pa-root min-h-screen lg:flex">
      <style>{CSS}</style>
      <style>{VIZ_CSS}</style>

      <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:w-[300px] lg:shrink-0" aria-label="Навигация">
        <Sidebar {...sidebarProps} />
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Навигация">
          <button type="button" className="absolute inset-0 h-full w-full" style={{ background: 'rgba(8,10,20,.55)' }} onClick={() => setNavOpen(false)} aria-label="Закрыть меню" />
          <div className="absolute inset-y-0 left-0 w-[86%] max-w-[340px] shadow-2xl" style={{ paddingTop: 'env(safe-area-inset-top,0px)', paddingLeft: 'env(safe-area-inset-left,0px)', background: 'var(--nav)' }}>
            <Sidebar {...sidebarProps} onClose={() => setNavOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="pa-topbar pa-sticky sticky z-30 border-b">
          <div className="pa-gutter flex h-14 items-center gap-3">
            <div className="-ml-1 lg:hidden"><button type="button" className="pa-btn" style={{ padding: '.45rem .6rem' }} onClick={() => setNavOpen(true)} aria-label="Открыть меню"><Menu size={19} aria-hidden="true" /></button></div>
            <div className="hidden min-w-0 flex-1 truncate text-[14px] font-medium sm:block">
              <span className="pa-faint hidden sm:inline">Атлас патофизиологии / </span>{crumb}
            </div>
            <div className="ml-auto"><ModeToggle mode={mode} setMode={setMode} /></div>
            <a href="../" className="pa-btn pa-all-atlases">Все атласы</a>
            <a href="../cabinet/" className="pa-btn" aria-label="Личный кабинет"><GraduationCap size={18}/></a>
            <span data-ma-acct className="hidden sm:inline" />
          </div>
        </div>

        <main>
          {view === 'home' && <HomeView store={store} onOpen={openTopic} onRun={goRun} />}
          {view === 'topic' && (topic.locked ? <LockedTopic topic={topic}/> : <TopicView topic={topic} tab={tab} setTab={setTab} mode={mode} store={store} setStore={setStore} onOpen={openTopic} />)}
          {view === 'run' && <RunView onOpen={openTopic} />}
        </main>
      </div>
    </div>
  );
}

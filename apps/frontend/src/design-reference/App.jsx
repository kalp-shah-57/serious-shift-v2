/* Serious Shift — root App */

const { useState: useS, useEffect: useE, useRef: useR, useMemo: useM, useCallback: useCB } = React;

function App() {
  const { MACROS, KEYS, SUBS, macroMap, keyMap, subMap } = useLookup();

  // Persisted state: path, bookmarks, mode, density, dark
  const load = (k, fb) => {
    try { const v = localStorage.getItem("ss_" + k); return v ? JSON.parse(v) : fb; } catch { return fb; }
  };
  const save = (k, v) => { try { localStorage.setItem("ss_" + k, JSON.stringify(v)); } catch {} };

  // path: [] | ["macro", id] | ["macro", id, "key", id] | ["macro", id, "key", id, "sub", id]
  // Or special: ["bookmarks"]
  const [path, setPath] = useS(() => load("path", []));
  const [bookmarks, setBookmarks] = useS(() => load("bookmarks", []));
  const [mode, setMode] = useS(() => load("mode", "editorial")); // editorial | software
  const [density, setDensity] = useS(() => load("density", 1));
  const [theme, setTheme] = useS(() => load("theme", "light"));
  const [tweaksOn, setTweaksOn] = useS(false);
  const [search, setSearch] = useS("");
  const [searchOpen, setSearchOpen] = useS(false);

  useE(() => save("path", path), [path]);
  useE(() => save("bookmarks", bookmarks), [bookmarks]);
  useE(() => save("mode", mode), [mode]);
  useE(() => save("density", density), [density]);
  useE(() => save("theme", theme), [theme]);

  useE(() => {
    document.documentElement.dataset.mode = mode;
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty("--density", density);
  }, [mode, density, theme]);

  // Edit-mode (Tweaks) integration
  useE(() => {
    const handler = (e) => {
      if (!e.data) return;
      if (e.data.type === "__activate_edit_mode") setTweaksOn(true);
      if (e.data.type === "__deactivate_edit_mode") setTweaksOn(false);
    };
    window.addEventListener("message", handler);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", handler);
  }, []);

  // ----- Zoom overlay machinery -----
  const [zoom, setZoom] = useS(null);
  const pendingPathRef = useR(null);

  const runZoom = (startEl, endTarget, color, nextPath) => {
    if (!startEl) { setPath(nextPath); return; }
    const rect = startEl.getBoundingClientRect();
    // Compute target rect: the area where the next layer's title will land
    const end = endTarget || { top: 80, left: rect.left, width: rect.width, height: rect.height };
    setZoom({
      start: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      end,
      color,
    });
    pendingPathRef.current = nextPath;
  };

  const onZoomEnd = useCB(() => {
    if (pendingPathRef.current) {
      setPath(pendingPathRef.current);
      pendingPathRef.current = null;
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    setZoom(null);
  }, []);

  // Helper to compute "end" rect using an anchor guess (centered near top)
  const computeEnd = () => {
    const vw = window.innerWidth;
    const targetW = Math.min(vw - 96, 1200);
    return {
      top: 120,
      left: (vw - targetW) / 2,
      width: targetW,
      height: 260,
    };
  };

  // ----- Navigation -----
  const openMacro = (m, e) => {
    const el = e?.currentTarget || document.querySelector(`[data-zoom-id="macro-${m.id}"]`);
    runZoom(el, computeEnd(), "var(--macro)", ["macro", m.id]);
  };
  const openKey = (k, e) => {
    const el = e?.currentTarget || document.querySelector(`[data-zoom-id="key-${k.id}"]`);
    runZoom(el, computeEnd(), "var(--key)", ["macro", k.macroId, "key", k.id]);
  };
  const openSub = (s, e) => {
    const el = e?.currentTarget || document.querySelector(`[data-zoom-id="sub-${s.id}"]`);
    runZoom(el, computeEnd(), "var(--sub)", ["macro", s.macroId, "key", s.keyId, "sub", s.id]);
  };

  // Wrap open fns so onClick's currentTarget reaches us
  const wrap = (fn) => (node) => {
    const e = window.event; // React synthetic event's currentTarget already lost by then; use dom query
    const el = document.querySelector(
      node.number
        ? `[data-zoom-id="macro-${node.id}"]`
        : node.macroId && !node.keyId
        ? `[data-zoom-id="key-${node.id}"]`
        : `[data-zoom-id="sub-${node.id}"]`
    );
    fn(node, { currentTarget: el });
  };

  const goBack = () => {
    if (path[0] === "bookmarks") { setPath([]); return; }
    if (path.length <= 2) setPath([]);
    else if (path.length === 4) setPath(path.slice(0, 2));
    else if (path.length === 6) setPath(path.slice(0, 4));
  };

  const goHome = () => setPath([]);
  const goBookmarks = () => setPath(["bookmarks"]);

  // Breadcrumbs
  const crumbs = [];
  crumbs.push({ label: "Serious Shift", onClick: goHome, current: path.length === 0 });
  if (path[0] === "bookmarks") {
    crumbs.push({ label: "Saved", current: true });
  }
  if (path[0] === "macro") {
    const m = macroMap[path[1]];
    crumbs.push({ label: m.title, onClick: () => setPath(["macro", m.id]), current: path.length === 2 });
    if (path[2] === "key") {
      const k = keyMap[path[3]];
      crumbs.push({ label: k.title, onClick: () => setPath(["macro", m.id, "key", k.id]), current: path.length === 4 });
      if (path[4] === "sub") {
        const s = subMap[path[5]];
        crumbs.push({ label: s.title, current: true });
      }
    }
  }

  // Bookmarks
  const toggleBookmark = (id) => {
    setBookmarks((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]));
  };

  // Search index
  const searchResults = useM(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const match = (s) => s.toLowerCase().includes(q);
    return {
      macros: MACROS.filter((m) => match(m.title) || match(m.lede)).slice(0, 5),
      keys: KEYS.filter((k) => match(k.title) || match(k.lede)).slice(0, 6),
      subs: SUBS.filter((s) => match(s.title)).slice(0, 10),
    };
  }, [search]);

  // Render the current layer
  let layer;
  if (path[0] === "bookmarks") {
    layer = (
      <BookmarksLayer
        bookmarks={bookmarks}
        clearBookmark={(id) => toggleBookmark(id)}
        onOpenMacro={(m) => openMacro(m)}
        onOpenKey={(k) => openKey(k)}
        onOpenSub={(s) => openSub(s)}
      />
    );
  } else if (path.length === 0) {
    layer = (
      <MacrosLayer
        onOpenMacro={(m) => {
          const el = document.querySelector(`[data-zoom-id="macro-${m.id}"]`);
          runZoom(el, computeEnd(), "var(--macro)", ["macro", m.id]);
        }}
        bookmarks={bookmarks}
        toggle={toggleBookmark}
      />
    );
  } else if (path.length === 2) {
    const m = macroMap[path[1]];
    layer = (
      <KeysLayer
        macro={m}
        onOpenKey={(k) => {
          const el = document.querySelector(`[data-zoom-id="key-${k.id}"]`);
          runZoom(el, computeEnd(), "var(--key)", ["macro", m.id, "key", k.id]);
        }}
        back={goBack}
        bookmarks={bookmarks}
        toggle={toggleBookmark}
      />
    );
  } else if (path.length === 4) {
    const k = keyMap[path[3]];
    layer = (
      <SubsLayer
        keyTrend={k}
        onOpenSub={(s) => {
          const el = document.querySelector(`[data-zoom-id="sub-${s.id}"]`);
          runZoom(el, computeEnd(), "var(--sub)", ["macro", k.macroId, "key", k.id, "sub", s.id]);
        }}
        back={goBack}
      />
    );
  } else if (path.length === 6) {
    const s = subMap[path[5]];
    layer = (
      <EvidenceLayer
        sub={s}
        back={goBack}
        navigateToSub={(s2) => setPath(["macro", s2.macroId, "key", s2.keyId, "sub", s2.id])}
        bookmarks={bookmarks}
        toggle={toggleBookmark}
      />
    );
  }

  return (
    <div className="shell">
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">S</div>
            <span className="brand-name">
              Serious Shi<span className="brand-f">f</span>t
            </span>
            <span className="brand-suffix">TREND MAP · 2026</span>
          </div>
          <div className="topbar-center">
            <div className="search">
              <Icon.Search className="search-icon" />
              <input
                placeholder="Search scenarios, key trends, sub-trends…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 160)}
              />
              {searchOpen && searchResults && (
                <div className="search-results hide-scroll">
                  {["macros", "keys", "subs"].map((k) => {
                    const items = searchResults[k];
                    if (!items.length) return null;
                    const kind = { macros: "Scenarios", keys: "Key trends", subs: "Sub-trends" }[k];
                    const openFn = { macros: (x) => openMacro(x), keys: (x) => openKey(x), subs: (x) => openSub(x) }[k];
                    return (
                      <div className="search-group" key={k}>
                        <div className="search-group-head">{kind}</div>
                        {items.map((it) => (
                          <button
                            key={it.id}
                            className="search-item"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSearch("");
                              setSearchOpen(false);
                              setTimeout(() => openFn(it), 10);
                            }}
                          >
                            <span>{it.title}</span>
                            <span className="search-item-kind">
                              {k === "subs" ? "N" + it.number : kind.slice(0, -1)}
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  {searchResults.macros.length + searchResults.keys.length + searchResults.subs.length === 0 && (
                    <div className="search-group-head" style={{ padding: "16px 14px" }}>No matches</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="topbar-right">
            <div className="seg" role="tablist" aria-label="Design mode">
              <button aria-pressed={mode === "editorial"} onClick={() => setMode("editorial")}>Editorial</button>
              <button aria-pressed={mode === "software"} onClick={() => setMode("software")}>Software</button>
            </div>
            <button className="icon-btn" onClick={goBookmarks} title="Saved" aria-label="Saved">
              <Icon.Bookmarks width="16" height="16" />
              {bookmarks.length > 0 && (
                <span style={{
                  position: "absolute", transform: "translate(10px,-8px)",
                  background: "var(--sub)", color: "var(--paper)",
                  fontFamily: "var(--font-mono)", fontSize: 9,
                  borderRadius: 999, padding: "1px 5px", fontWeight: 500,
                }}>{bookmarks.length}</span>
              )}
            </button>
            <button className="icon-btn" onClick={() => setTheme(theme === "light" ? "dark" : "light")} title="Theme" aria-label="Theme">
              {theme === "light" ? <Icon.Moon width="16" height="16" /> : <Icon.Sun width="16" height="16" />}
            </button>
          </div>
        </div>
        {crumbs.length > 1 && (
          <nav className="crumbs">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="crumb-sep">/</span>}
                {c.current ? (
                  <span className="crumb-current">{c.label}</span>
                ) : (
                  <button onClick={c.onClick}>{c.label}</button>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
      </div>

      <main className="view">{layer}</main>

      <footer className="site-foot">
        <div className="site-foot-inner">
          <span className="foot-left">© 2026 Serious Shi<span className="brand-f">f</span>t · Trend Map</span>
          <span className="foot-right">
            <span className="foot-dim">Powered by</span> TrendWatching
          </span>
        </div>
      </footer>

      <ZoomOverlay zoomState={zoom} onEnd={onZoomEnd} />

      {tweaksOn && (
        <div className="tweaks-panel">
          <div className="tweaks-title">Tweaks</div>
          <div className="tweaks-row">
            <label>Mode</label>
            <div className="seg">
              <button aria-pressed={mode === "editorial"} onClick={() => setMode("editorial")} style={{ fontSize: 11 }}>Edit.</button>
              <button aria-pressed={mode === "software"} onClick={() => setMode("software")} style={{ fontSize: 11 }}>Soft.</button>
            </div>
          </div>
          <div className="tweaks-row">
            <label>Density</label>
            <input
              type="range" min="0.72" max="1.15" step="0.02"
              value={density}
              onChange={(e) => setDensity(+e.target.value)}
            />
          </div>
          <div className="tweaks-row">
            <label>Theme</label>
            <div className="seg">
              <button aria-pressed={theme === "light"} onClick={() => setTheme("light")} style={{ fontSize: 11 }}>Light</button>
              <button aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} style={{ fontSize: 11 }}>Dark</button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 10, lineHeight: 1.5 }}>
            Editorial leans on Instrument Serif and airy rhythm. Software is Geist-only, tighter.
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);


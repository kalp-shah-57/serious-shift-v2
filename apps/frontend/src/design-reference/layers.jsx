/* Layer views: macros, keys, subs, evidence */

const { useState: useStateL, useMemo: useMemoL } = React;

// ---------- Macro layer ----------
function MacrosLayer({ onOpenMacro, bookmarks, toggle }) {
  const { MACROS, keysByMacro } = useLookup();
  return (
    <div className="layer-wrap">
      <header className="layer-head">
        <div>
          <p className="layer-eyebrow">
            <Chip kind="macro">2026 Edition</Chip>
          </p>
          <h1 className="layer-title" style={{ marginTop: 18 }}>Six scenarios for the decade of consumer realignment.</h1>
          <p className="layer-sub">
            Each scenario reframes the forces reshaping demand — how people decide, belong,
            and spend. Open one to see the key trends it contains, and the sub-trends
            underneath.
          </p>
        </div>
        <div className="layer-meta">
          <div className="layer-meta-row"><span>Scenarios</span><b>06</b></div>
          <div className="layer-meta-row"><span>Key trends</span><b>10</b></div>
          <div className="layer-meta-row"><span>Sub-trends</span><b>100</b></div>
          <div className="layer-meta-row"><span>Last updated</span><b>Apr 2026</b></div>
        </div>
      </header>
      <div className="macro-grid">
        {MACROS.map((m) => (
          <MacroCard
            key={m.id}
            macro={m}
            onOpen={onOpenMacro}
            keysCount={keysByMacro[m.id].length}
            bookmarks={bookmarks}
            toggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Keys layer ----------
function KeysLayer({ macro, onOpenKey, back, bookmarks, toggle }) {
  const { keysByMacro, subsByKey } = useLookup();
  const keys = keysByMacro[macro.id];
  return (
    <div className="layer-wrap">
      <button className="back" onClick={back}>
        <Icon.Back width="14" height="14" /> Scenarios
      </button>
      <header className="layer-head">
        <div>
          <p className="layer-eyebrow">
            <Chip kind="macro">Scenario {macro.number}</Chip>
          </p>
          <h1 className="layer-title" style={{ marginTop: 18 }}>{macro.title}</h1>
          <p className="layer-sub">{macro.lede}</p>
        </div>
        <div className="layer-meta">
          <div className="layer-meta-row"><span>Horizon</span><b>{macro.horizon}</b></div>
          <div className="layer-meta-row"><span>Region</span><b>{macro.region}</b></div>
          <div className="layer-meta-row"><span>Key trends</span><b>{String(keys.length).padStart(2, "0")}</b></div>
        </div>
      </header>
      <div className="key-grid">
        {keys.map((k) => (
          <KeyCard
            key={k.id}
            keyTrend={k}
            onOpen={onOpenKey}
            subCount={subsByKey[k.id].length}
            bookmarks={bookmarks}
            toggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}

// ---------- Subs layer ----------
function SubsLayer({ keyTrend, onOpenSub, back }) {
  const { subsByKey, macroMap } = useLookup();
  const macro = macroMap[keyTrend.macroId];
  const subs = subsByKey[keyTrend.id];
  return (
    <div className="layer-wrap">
      <button className="back" onClick={back}>
        <Icon.Back width="14" height="14" /> {macro.title}
      </button>
      <header className="layer-head">
        <div>
          <p className="layer-eyebrow">
            <Chip kind="key">Key trend</Chip>
          </p>
          <h1 className="layer-title" style={{ marginTop: 18 }}>{keyTrend.title}</h1>
          <p className="layer-sub">{keyTrend.lede}</p>
        </div>
        <div className="layer-meta">
          <div className="layer-meta-row"><span>Scenario</span><b>{macro.title}</b></div>
          <div className="layer-meta-row"><span>Sub-trends</span><b>{String(subs.length).padStart(2, "0")}</b></div>
          <div className="layer-meta-row"><span>Velocity</span><b>Accelerating</b></div>
        </div>
      </header>
      <div className="sub-list">
        {subs.map((s) => <SubRow key={s.id} sub={s} onOpen={onOpenSub} />)}
      </div>
    </div>
  );
}

// ---------- Evidence layer ----------
function EvidenceLayer({ sub, back, navigateToSub, bookmarks, toggle }) {
  const { subMap, keyMap, macroMap, subsByKey } = useLookup();
  const keyTrend = keyMap[sub.keyId];
  const macro = macroMap[sub.macroId];
  const siblings = subsByKey[keyTrend.id].filter((s) => s.id !== sub.id);
  const active = bookmarks.includes(sub.id);
  return (
    <div className="layer-wrap">
      <button className="back" onClick={back}>
        <Icon.Back width="14" height="14" /> {keyTrend.title}
      </button>
      <header className="layer-head">
        <div>
          <p className="layer-eyebrow">
            <Chip kind="sub">Sub-trend N{sub.number}</Chip>
          </p>
          <h1 className="layer-title" style={{ marginTop: 18 }}>{sub.title}</h1>
          <p className="layer-sub">{sub.lede}</p>
        </div>
        <div className="layer-meta">
          <div className="layer-meta-row"><span>Scenario</span><b>{macro.title}</b></div>
          <div className="layer-meta-row"><span>Key trend</span><b>{keyTrend.title}</b></div>
          <div className="layer-meta-row"><span>Evidence</span><b>{String(sub.evidence.length).padStart(2,'0')} voices</b></div>
          <span
            role="button"
            tabIndex={0}
            className="save-trend"
            onClick={() => toggle(sub.id)}
            onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(sub.id);}}}
            aria-pressed={active}
          >
            <Icon.Bookmark filled={active} width="14" height="14" />
            {active ? "Saved" : "Save trend"}
          </span>
        </div>
      </header>

      <div className="evidence-wrap">
        <div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".1em",
              color: "var(--ink-3)",
              textTransform: "uppercase",
              margin: "0 0 22px",
            }}
          >
            Evidence · three voices
          </p>
          <div className="evidence-list">
            {sub.evidence.map((e, i) => <EvidenceCard key={i} item={e} />)}
          </div>
        </div>
        <aside className="sidebar">
          <h4>Signal</h4>
          <div className="signals">
            {sub.signals.map((s, i) => (
              <div className="signal-row" key={i}>
                <span className="signal-label">{s.label}</span>
                <span className="signal-value">{s.value}</span>
              </div>
            ))}
          </div>
          <h4>More within {keyTrend.title}</h4>
          <div className="sibling-subs">
            {siblings.slice(0, 6).map((s) => (
              <button key={s.id} className="sibling-sub" onClick={() => navigateToSub(s)}>
                <span className="sibling-num">N{s.number}</span>
                <span>{s.title}</span>
                <Icon.Arrow width="14" height="14" style={{opacity:.5}} />
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------- Bookmarks layer ----------
function BookmarksLayer({ bookmarks, clearBookmark, onOpenMacro, onOpenKey, onOpenSub }) {
  const { macroMap, keyMap, subMap } = useLookup();
  if (bookmarks.length === 0) {
    return (
      <div className="layer-wrap">
        <header className="layer-head">
          <div>
            <p className="layer-eyebrow">Saved</p>
            <h1 className="layer-title">Nothing saved yet.</h1>
            <p className="layer-sub">Bookmark trends from anywhere in the map — they'll collect here.</p>
          </div>
        </header>
      </div>
    );
  }
  const items = bookmarks.map((id) => {
    if (macroMap[id]) return { kind: "Macro", node: macroMap[id], open: () => onOpenMacro(macroMap[id]) };
    if (keyMap[id]) return { kind: "Key", node: keyMap[id], open: () => onOpenKey(keyMap[id]) };
    if (subMap[id]) return { kind: "Sub", node: subMap[id], open: () => onOpenSub(subMap[id]) };
    return null;
  }).filter(Boolean);
  return (
    <div className="layer-wrap">
      <header className="layer-head">
        <div>
          <p className="layer-eyebrow">Saved</p>
          <h1 className="layer-title">Your bookmarked trends.</h1>
          <p className="layer-sub">{items.length} item{items.length === 1 ? "" : "s"} across the map.</p>
        </div>
      </header>
      <div className="sub-list" style={{ gridTemplateColumns: "1fr" }}>
        {items.map((it, i) => (
          <div key={i} role="button" tabIndex={0} className="sub-row" onClick={it.open} onKeyDown={(e)=>{if(e.key==='Enter'){it.open();}}} style={{ gridTemplateColumns: "80px 1fr auto auto", cursor:'pointer' }}>
            <span className="sub-num">{it.kind.toUpperCase()}</span>
            <span className="sub-title">{it.node.title}</span>
            <span
              role="button"
              tabIndex={0}
              className="back"
              onClick={(e) => { e.stopPropagation(); clearBookmark(it.node.id); }}
              onKeyDown={(e)=>{if(e.key==='Enter'||e.key===' '){e.stopPropagation();e.preventDefault();clearBookmark(it.node.id);}}}
              style={{ padding: "6px 10px", cursor:'pointer' }}
            >
              Remove
            </span>
            <Icon.Arrow className="sub-arrow" width="16" height="16" />
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  MacrosLayer,
  KeysLayer,
  SubsLayer,
  EvidenceLayer,
  BookmarksLayer,
});


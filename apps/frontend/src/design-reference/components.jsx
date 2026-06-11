/* Serious Shift — app (React + Babel)
   4 layers: MACROS → KEYS (for a macro) → SUBS (for a key) → EVIDENCE (for a sub)
   Shared-element zoom transition between layers.
*/

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ---------- Icons ----------
const Icon = {
  Search: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  ),
  Arrow: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Back: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Bookmark: ({ filled, ...p }) => (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M6 4h12v17l-6-4-6 4V4z" strokeLinejoin="round" />
    </svg>
  ),
  Bookmarks: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M6 4h12v17l-6-4-6 4V4z" strokeLinejoin="round" />
    </svg>
  ),
  Sun: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" strokeLinecap="round" />
    </svg>
  ),
  Moon: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M20 15.5A8 8 0 1 1 8.5 4a7 7 0 0 0 11.5 11.5z" />
    </svg>
  ),
  Sliders: (p) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
      <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6" strokeLinecap="round" />
    </svg>
  ),
};

// ---------- Lookup helpers ----------
function useLookup() {
  const { MACROS, KEYS, SUBS } = window.TREND_DATA;
  return useMemo(() => {
    const macroMap = Object.fromEntries(MACROS.map((m) => [m.id, m]));
    const keyMap = Object.fromEntries(KEYS.map((k) => [k.id, k]));
    const subMap = Object.fromEntries(SUBS.map((s) => [s.id, s]));
    const keysByMacro = Object.fromEntries(
      MACROS.map((m) => [m.id, KEYS.filter((k) => k.macroId === m.id)])
    );
    const subsByKey = Object.fromEntries(
      KEYS.map((k) => [k.id, SUBS.filter((s) => s.keyId === k.id)])
    );
    return { MACROS, KEYS, SUBS, macroMap, keyMap, subMap, keysByMacro, subsByKey };
  }, []);
}

// ---------- Chip ----------
function Chip({ kind, children }) {
  const cls = { macro: "chip-macro", key: "chip-key", sub: "chip-sub" }[kind];
  return (
    <span className={`chip ${cls}`}>
      <span className="dot" />
      {children}
    </span>
  );
}

// ---------- Bookmark button ----------
function BookmarkButton({ id, bookmarks, toggle }) {
  const active = bookmarks.includes(id);
  return (
    <span
      className="bookmark-btn"
      role="button"
      tabIndex={0}
      data-active={active}
      aria-label={active ? "Remove bookmark" : "Add bookmark"}
      onClick={(e) => {
        e.stopPropagation();
        toggle(id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          e.preventDefault();
          toggle(id);
        }
      }}
    >
      <Icon.Bookmark filled={active} width="16" height="16" />
    </span>
  );
}

// ---------- Macro card ----------
function MacroCard({ macro, onOpen, keysCount, bookmarks, toggle }) {
  return (
    <button
      className="card card-macro macro-card"
      data-zoom-id={`macro-${macro.id}`}
      onClick={() => onOpen(macro)}
    >
      <BookmarkButton id={macro.id} bookmarks={bookmarks} toggle={toggle} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="macro-num">SCENARIO {macro.number}</span>
        <Chip kind="macro">Macro</Chip>
      </div>
      <h2>{macro.title}</h2>
      <p>{macro.lede}</p>
      <div className="macro-card-foot">
        <span>{keysCount} key trend{keysCount === 1 ? "" : "s"} · {macro.horizon}</span>
        <Icon.Arrow className="arrow" width="18" height="18" />
      </div>
    </button>
  );
}

// ---------- Key trend card ----------
function KeyCard({ keyTrend, onOpen, subCount, bookmarks, toggle }) {
  return (
    <button
      className="card card-key key-card"
      data-zoom-id={`key-${keyTrend.id}`}
      onClick={() => onOpen(keyTrend)}
    >
      <BookmarkButton id={keyTrend.id} bookmarks={bookmarks} toggle={toggle} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="macro-num">KEY TREND</span>
        <Chip kind="key">Key</Chip>
      </div>
      <h3>{keyTrend.title}</h3>
      <p>{keyTrend.lede}</p>
      <div className="key-card-foot">
        <span>{subCount} sub-trends</span>
        <Icon.Arrow className="arrow" width="18" height="18" />
      </div>
    </button>
  );
}

// ---------- Sub-trend row ----------
function SubRow({ sub, onOpen }) {
  return (
    <button
      className="sub-row"
      data-zoom-id={`sub-${sub.id}`}
      onClick={() => onOpen(sub)}
    >
      <span className="sub-num">N{sub.number}</span>
      <span className="sub-title">{sub.title}</span>
      <Icon.Arrow className="sub-arrow" width="16" height="16" />
    </button>
  );
}

// ---------- Evidence card ----------
function EvidenceCard({ item }) {
  const initials = item.voice.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  return (
    <article className="evidence-card">
      <p className="evidence-quote">{item.quote}</p>
      <div className="evidence-attr">
        <div className="evidence-who">
          <div className="evidence-avatar">{initials}</div>
          <div>
            <div className="evidence-name">{item.voice.name}</div>
            <div className="evidence-role">{item.voice.role}</div>
          </div>
        </div>
        <div className="evidence-src">{item.voice.src}</div>
      </div>
    </article>
  );
}

// ---------- Zoom transition overlay ----------
// Animates a clone of the clicked card expanding toward the next layer's head.
function ZoomOverlay({ zoomState, onEnd }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!zoomState) return;
    const el = ref.current;
    // Force reflow, then set "end" position so CSS transition kicks in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!el) return;
        el.style.top = zoomState.end.top + "px";
        el.style.left = zoomState.end.left + "px";
        el.style.width = zoomState.end.width + "px";
        el.style.height = zoomState.end.height + "px";
        el.style.opacity = "0";
      });
    });
    const t = setTimeout(onEnd, 560);
    return () => clearTimeout(t);
  }, [zoomState, onEnd]);
  if (!zoomState) return null;
  const { start, color } = zoomState;
  return (
    <div
      ref={ref}
      className="zoom-overlay"
      style={{
        top: start.top,
        left: start.left,
        width: start.width,
        height: start.height,
        borderLeft: `3px solid ${color}`,
      }}
    />
  );
}

// Export components to window for other files
Object.assign(window, {
  useLookup,
  Icon,
  Chip,
  BookmarkButton,
  MacroCard,
  KeyCard,
  SubRow,
  EvidenceCard,
  ZoomOverlay,
});


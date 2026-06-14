import { Routes, Route, NavLink, Link, Navigate } from 'react-router-dom'
import { useTheme } from './hooks/useTheme'
import { Icon } from './views/map/icons'
import Map from './views/Map'
import About from './views/About'
import ThinkerProfile from './views/ThinkerProfile'
import Daily from './views/Daily'

// Map child routes
import MapLanding     from './views/map/MapLanding'
import MacroDetail    from './views/map/MacroDetail'
import DomainDetail   from './views/map/DomainDetail'
import KtDetail       from './views/map/KtDetail'
import SubTrendDetail from './views/map/SubTrendDetail'
import SynthesisIndex from './views/map/SynthesisIndex'
import ThinkerIndex   from './views/map/ThinkerIndex'
import ThinkerDetail  from './views/map/ThinkerDetail'

// ─── Soft-launch: secondary views intentionally hidden ──────────────────────
// Keynote, Leaderboard, Predictions, and Explore pages are temporarily
// hidden from user access. Files and data remain intact under src/pages/
// and can be restored by re-adding imports + routes below and adding the
// corresponding nav items. Do not delete these files.
//
// import Keynote     from './views/Keynote'
// import Leaderboard from './views/Leaderboard'
// import Predictions from './views/Predictions'
// import Explore     from './views/Explore'

const WHATSAPP_URL = 'https://chat.whatsapp.com/EFptoaGlMau7sNog3onRP2?mode=gi_t'

export default function App() {
  const { theme, toggle } = useTheme()
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      <header className="border-b border-neutral-800 sticky top-0 z-50 bg-neutral-950/95 backdrop-blur-sm">
        {/* 3-column grid keeps the nav truly centered in the viewport
            regardless of how wide the logo and theme-toggle columns are. */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-28 sm:h-32 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Logo — routes home (which is the Map).
              The PNG is dark artwork; we invert it in dark mode via the
              .ss-logo class (see index.css) so it reads white on the dark
              header, and leaves it untouched in light mode. */}
          <Link to="/map" className="flex items-center shrink-0 justify-self-start" aria-label="Serious Shi(f)t — home">
            <img
              src="/logo.png"
              alt="Serious Shi(f)t"
              className="ss-logo h-24 sm:h-28 w-auto select-none"
              draggable="false"
            />
          </Link>

          <nav className="hidden sm:flex items-center gap-8 justify-self-center">
            <NavLink
              to="/map/thinkers"
              className={({ isActive }) =>
                `text-sm font-bold tracking-wide uppercase transition-colors ${
                  isActive ? 'text-cream' : 'text-neutral-500 hover:text-neutral-300'
                }`
              }
            >
              Thinkers
            </NavLink>
            <a
              href="https://info.trendwatching.com/serious-shift/about"
              className="text-sm font-bold tracking-wide uppercase text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              About
            </a>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold tracking-wide uppercase text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Join WhatsApp
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0 justify-self-end">
            <button
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-8 h-8 flex items-center justify-center rounded-md text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors"
            >
              {theme === 'dark'
                ? <Icon.Sun  className="w-4 h-4" />
                : <Icon.Moon className="w-4 h-4" />
              }
            </button>
          </div>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="sm:hidden border-b border-neutral-800 overflow-x-auto">
        <div className="flex px-4 gap-4 py-2">
          <NavLink
            to="/map/thinkers"
            className={({ isActive }) =>
              `text-xs tracking-wide uppercase whitespace-nowrap transition-colors ${
                isActive ? 'text-cream font-medium' : 'text-neutral-500'
              }`
            }
          >
            Thinkers
          </NavLink>
          <a
            href="https://info.trendwatching.com/serious-shift/about"
            className="text-xs tracking-wide uppercase whitespace-nowrap text-neutral-500"
          >
            About
          </a>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs tracking-wide uppercase whitespace-nowrap text-neutral-500"
          >
            Join WhatsApp
          </a>
        </div>
      </nav>

      <main className="flex-1">
        <Routes>
          {/* Home = the map. */}
          <Route path="/" element={<Navigate to="/map" replace />} />

          {/* Map — nested routes share data context via layout.
             Static segments (synthesis/thinkers/macros/domains) take
             precedence over the :domainSlug param by route ranking. */}
          <Route path="/map" element={<Map />}>
            <Route index element={<MapLanding />} />
            <Route path="macros/:slug" element={<MacroDetail />} />
            <Route path="domains/:domainId" element={<DomainDetail />} />
            <Route path="synthesis" element={<SynthesisIndex />} />
            <Route path="thinkers" element={<ThinkerIndex />} />
            <Route path="thinkers/:slug" element={<ThinkerDetail />} />
            {/* Deep hierarchy — slug-based, cinematic warp at every layer.
               Scenario layer removed: domain → key trend → sub-trend. */}
            <Route path=":domainSlug" element={<DomainDetail />} />
            <Route path=":domainSlug/:ktSlug" element={<KtDetail />} />
            <Route
              path=":domainSlug/:ktSlug/:subTrendSlug"
              element={<SubTrendDetail />}
            />
          </Route>

          <Route path="/about" element={<About />} />
          <Route path="/thinker/:name" element={<ThinkerProfile />} />
          <Route path="/daily" element={<Daily />} />

          {/* ─── Soft-launch: secondary routes intentionally hidden ────────
             These pages exist but are unreachable by URL during the soft
             launch. To restore, uncomment the imports at the top of this
             file and the matching routes below. Do not delete page files.
             <Route path="/keynote"     element={<Keynote />} />
             <Route path="/leaderboard" element={<Leaderboard />} />
             <Route path="/predictions" element={<Predictions />} />
             <Route path="/explore"     element={<Explore />} />
          ─────────────────────────────────────────────────────────────── */}

          {/* Anything else falls back to the map. */}
          <Route path="*" element={<Navigate to="/map" replace />} />
        </Routes>
      </main>

    </div>
  )
}

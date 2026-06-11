import { useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../hooks/useData'
import IndustrySelector from '../components/IndustrySelector'

// In-memory cache for personalized results
const personalizationCache = {}

export default function Keynote() {
  const { data: keynote, loading } = useData('keynote.json')
  const { data: thinkers } = useData('thinkers.json')
  const { data: daily } = useData('daily.json')
  const { data: stats } = useData('stats.json')
  const [industry, setIndustry] = useState('General')
  const [personalizedSections, setPersonalizedSections] = useState(null)
  const [personalizing, setPersonalizing] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const personalize = useCallback(async (targetIndustry) => {
    if (!targetIndustry || targetIndustry === 'General' || !keynote?.sections) {
      setPersonalizedSections(null)
      setError(null)
      return
    }

    // Check cache
    if (personalizationCache[targetIndustry]) {
      setPersonalizedSections(personalizationCache[targetIndustry])
      setError(null)
      return
    }

    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setPersonalizing(true)
    setError(null)

    try {
      const res = await fetch('/api/personalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: targetIndustry,
          sections: keynote.sections,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`API returned ${res.status}`)

      const data = await res.json()
      personalizationCache[targetIndustry] = data.sections
      setPersonalizedSections(data.sections)
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Personalization failed:', err)
        setError('Industry view unavailable — showing general content')
        setPersonalizedSections(null)
      }
    } finally {
      setPersonalizing(false)
    }
  }, [keynote])

  const handleIndustryChange = (value) => {
    setIndustry(value)
    personalize(value)
  }

  if (loading || !keynote) return <Loading />

  const activeSections = personalizedSections || keynote.sections

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <h1 className="font-editorial text-5xl sm:text-7xl tracking-tight text-cream leading-none">
            Serious Shi<span className="text-accent">(f)</span>t
          </h1>
          <p className="mt-6 text-neutral-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            How AI will transform your consumers — tracked, scored, and updated continuously
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 text-sm text-neutral-500">
            <span>Last updated: April 2026</span>
            <span className="text-neutral-700">&middot;</span>
            <span>{stats?.thinkers || '—'} thinkers &middot; {stats?.claims?.toLocaleString() || '—'} claims &middot; {stats?.predictions?.toLocaleString() || '—'} predictions</span>
          </div>

          {/* Industry selector */}
          <div className="mt-6 flex justify-center">
            <IndustrySelector value={industry} onChange={handleIndustryChange} />
          </div>
        </div>
      </section>

      {/* Daily briefing banner */}
      {daily?.sections?.length > 0 && (
        <Link to="/daily" className="block border-b border-neutral-800 bg-accent/5 hover:bg-accent/8 transition-colors">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              <span className="text-xs text-neutral-300">
                Daily Update: <span className="text-cream font-medium">{daily.date}</span>
              </span>
            </div>
            <span className="text-[10px] text-neutral-500">
              {daily.new_claims_analyzed} claims analyzed against {daily.historical_claims_referenced} historical reference points
            </span>
          </div>
        </Link>
      )}

      {/* Loading overlay */}
      {personalizing && (
        <div className="border-b border-neutral-800 bg-neutral-900/50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-center gap-3">
            <span className="inline-block w-2 h-2 bg-accent rounded-full animate-pulse" />
            <span className="text-sm text-neutral-400 tracking-wide">
              Tailoring insights for <span className="text-cream font-medium">{industry}</span>...
            </span>
          </div>
        </div>
      )}

      {/* Error notice */}
      {error && !personalizing && (
        <div className="border-b border-neutral-800 bg-amber-950/20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 text-center">
            <span className="text-xs text-amber-400/80">{error}</span>
          </div>
        </div>
      )}

      {/* Personalized badge */}
      {personalizedSections && !personalizing && (
        <div className="border-b border-neutral-800 bg-accent/5">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 bg-accent rounded-full" />
            <span className="text-xs text-neutral-400">
              Personalized for <span className="text-cream">{industry}</span>
            </span>
            <button
              onClick={() => handleIndustryChange('General')}
              className="text-xs text-neutral-600 hover:text-neutral-400 ml-2 underline"
            >
              Reset to general
            </button>
          </div>
        </div>
      )}

      {/* Intro */}
      {keynote.intro && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <div className="prose-body text-neutral-300 text-base leading-relaxed">
            {keynote.intro.split('\n\n').map((p, i) => (
              <p key={i}>{cleanText(p)}</p>
            ))}
          </div>
        </section>
      )}

      {/* Sections */}
      {activeSections?.map((section, idx) => (
        <Section
          key={`${industry}-${idx}`}
          section={section}
          index={idx}
          thinkers={thinkers}
          personalized={!!section.personalized}
        />
      ))}
    </div>
  )
}

function Section({ section, index, thinkers, personalized }) {
  const mentionedThinkers = thinkers?.filter(t =>
    section.body?.includes(t.name)
  ) || []

  const paragraphs = (section.body || '').split('\n\n').filter(p => p.trim().length > 10 && !p.trim().startsWith('Key thinkers:'))
  const num = String(index + 1).padStart(2, '0')
  const titleClean = (section.title || '').replace(/^\d+\.\s*/, '')

  return (
    <section className="border-t border-neutral-800">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex items-baseline gap-4 mb-6">
          <span className="font-mono text-accent text-sm tracking-wider">{num}</span>
          <h2 className="font-editorial text-2xl sm:text-3xl text-cream leading-tight">{titleClean}</h2>
          {personalized && (
            <span className="text-[9px] uppercase tracking-widest text-accent/60 ml-auto">tailored</span>
          )}
        </div>

        <div className="prose-body text-neutral-300 text-base leading-relaxed">
          {paragraphs.map((p, i) => (
            <p key={i}>{renderWithScores(cleanText(p))}</p>
          ))}
        </div>

        {mentionedThinkers.length > 0 && (
          <div className="mt-8 pt-4 border-t border-neutral-800/50">
            <p className="text-[10px] uppercase tracking-widest text-neutral-600 mb-2">Key thinkers</p>
            <div className="flex flex-wrap gap-3">
              {mentionedThinkers.map(t => (
                <span key={t.id} className="text-xs text-neutral-500">
                  {t.name}
                  <span className={`ml-1 font-mono text-[10px] font-semibold ${scoreColor(t.credibility_score)}`}>
                    ({t.credibility_score?.toFixed(1)})
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function scoreColor(score) {
  if (score >= 53) return 'text-green-400'
  if (score >= 50) return 'text-amber-400'
  return 'text-red-400'
}

function cleanText(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim()
}

function renderWithScores(text) {
  // Match patterns: (Altman, 52.8) or (52.8) or (9.8)
  const regex = /\(([A-Za-z]+,\s*)?(\d{1,3}\.\d)\)/g
  const parts = []
  let last = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    const name = match[1] || ''
    const score = parseFloat(match[2])
    parts.push(
      <span key={match.index}>
        ({name}<span className={`font-mono font-semibold ${scoreColor(score)}`}>{match[2]}</span>)
      </span>
    )
    last = regex.lastIndex
  }

  if (last < text.length) {
    parts.push(text.slice(last))
  }

  return parts.length > 1 ? parts : text
}

function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <span className="text-neutral-600 text-sm tracking-wider uppercase">Loading intelligence...</span>
    </div>
  )
}

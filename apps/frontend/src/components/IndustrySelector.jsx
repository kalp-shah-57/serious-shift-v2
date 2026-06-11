import { useState, useRef, useEffect } from 'react'

const presets = ['General', 'Retail', 'Healthcare', 'Financial Services', 'Media', 'Technology', 'Education', 'Manufacturing']

export default function IndustrySelector({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customText, setCustomText] = useState('')
  const ref = useRef(null)
  const inputRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus input when custom opens
  useEffect(() => {
    if (showCustom && inputRef.current) inputRef.current.focus()
  }, [showCustom])

  const select = (v) => {
    setOpen(false)
    setShowCustom(false)
    onChange(v)
  }

  const handleCustomSubmit = () => {
    if (!customText.trim()) return
    select(customText.trim())
    setCustomText('')
  }

  const displayLabel = value === 'General' ? 'General audience' : value

  return (
    <div ref={ref} className="relative inline-block">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="group flex items-center gap-2 border border-neutral-700 hover:border-neutral-500 transition-colors px-4 py-2"
      >
        <span className="text-[10px] uppercase tracking-widest text-neutral-600">Reading as</span>
        <span className="text-sm text-cream font-medium">{displayLabel}</span>
        <svg
          className={`w-3 h-3 text-neutral-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 bg-neutral-900 border border-neutral-700 z-50 overflow-hidden animate-in">
          {presets.map((item) => (
            <button
              key={item}
              onClick={() => select(item)}
              className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                value === item
                  ? 'text-cream bg-neutral-800'
                  : 'text-neutral-400 hover:text-cream hover:bg-neutral-800/60'
              }`}
            >
              {item}
              {value === item && (
                <span className="float-right text-accent text-xs mt-0.5">&#10003;</span>
              )}
            </button>
          ))}

          {/* Divider */}
          <div className="border-t border-neutral-800" />

          {/* Custom option */}
          {!showCustom ? (
            <button
              onClick={() => setShowCustom(true)}
              className="w-full text-left px-4 py-2.5 text-sm text-neutral-500 hover:text-cream hover:bg-neutral-800/60 transition-colors"
            >
              Custom industry...
            </button>
          ) : (
            <div className="p-3 flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
                placeholder="e.g. Luxury fashion"
                className="flex-1 bg-neutral-800 border border-neutral-700 text-sm text-neutral-200 px-3 py-1.5 focus:outline-none focus:border-accent placeholder-neutral-600"
              />
              <button
                onClick={handleCustomSubmit}
                disabled={!customText.trim()}
                className="bg-accent text-white text-xs px-3 py-1.5 font-medium hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Go
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

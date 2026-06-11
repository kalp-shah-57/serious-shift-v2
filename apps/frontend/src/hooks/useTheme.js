import { useEffect, useState } from 'react'

/**
 * useTheme — manages dark / light mode.
 *
 * Default: dark (matches the app's existing dark-first design).
 * Persisted in localStorage under the key 'ss-theme'.
 *
 * Applies the theme by toggling the 'light' class on <html>.
 * The index.css `html.light { }` block overrides Tailwind's neutral-*
 * CSS variables to produce the warm TrendWatching-inspired light palette.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('ss-theme') || 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') {
      root.classList.add('light')
    } else {
      root.classList.remove('light')
    }
    try {
      localStorage.setItem('ss-theme', theme)
    } catch {
      // localStorage unavailable — theme works but won't persist
    }
  }, [theme])

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggle }
}

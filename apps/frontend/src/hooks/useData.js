import { useState, useEffect } from 'react'

const cache = {}

// The backend (apps/backend) serves the same shapes the old static
// public/data/*.json files held. NEXT_PUBLIC_API_BASE points at it
// (e.g. http://localhost:8080); empty means same-origin.
// Default to https:// if the value is given without a scheme (a common
// mistake — a scheme-less URL would otherwise be treated as a relative path),
// and trim any trailing slash.
const RAW_BASE = (process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/+$/, '')
export const API_BASE = RAW_BASE && !/^https?:\/\//i.test(RAW_BASE) ? `https://${RAW_BASE}` : RAW_BASE

// One-time log so you can confirm WHICH build is live and what base it resolved to.
// If you don't see this line (or it shows a scheme-less/old value), the browser is
// still running a pre-rebuild bundle — redeploy the frontend and hard-refresh.
if (typeof window !== 'undefined') {
  console.info('[useData] API base =', API_BASE || '(same-origin)')
}

export function useData(file) {
  const [data, setData] = useState(cache[file] || null)
  const [loading, setLoading] = useState(!cache[file])

  useEffect(() => {
    if (cache[file]) return
    const url = `${API_BASE}/api/${file.replace(/\.json$/, '')}`
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`${url} → ${r.status}`); return r.json() })
      .then(d => { cache[file] = d; setData(d); setLoading(false) })
      .catch(err => { console.error('useData fetch failed:', err); setLoading(false) })
  }, [file])

  return { data, loading }
}

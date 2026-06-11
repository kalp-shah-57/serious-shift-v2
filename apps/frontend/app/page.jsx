'use client'

import dynamic from 'next/dynamic'

// Client-only: the app uses HashRouter + framer-motion and is purely
// interactive, so we skip SSR and render it in the browser.
const Spa = dynamic(() => import('../src/Spa'), { ssr: false })

export default function Page() {
  return <Spa />
}

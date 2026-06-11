import React from 'react'
import { HashRouter } from 'react-router-dom'
import App from './App'

// Mounts the existing React app unchanged. HashRouter keeps client-side
// routing entirely in the URL fragment, so it works without server routes —
// the faithful equivalent of the old Vite main.jsx.
export default function Spa() {
  return (
    <React.StrictMode>
      <HashRouter>
        <App />
      </HashRouter>
    </React.StrictMode>
  )
}

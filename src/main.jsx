import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { firebaseConfigError, missingFirebaseConfig } from './firebase.js'

// Shown instead of the app when Firebase env vars are missing, so a
// misconfigured deploy shows what to fix instead of a blank page.
function FirebaseSetupNeeded() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1e1b4b',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ maxWidth: '520px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '28px', margin: '0 0 12px' }}>Setup needed</h1>
        <p style={{ fontSize: '16px', lineHeight: 1.6, opacity: 0.9 }}>
          StudyFlow AI is not configured yet. The following environment
          variables are missing — set them in Vercel (Project Settings →
          Environment Variables) and redeploy:
        </p>
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '16px 0',
            textAlign: 'left',
            display: 'inline-block',
          }}
        >
          {missingFirebaseConfig.map((name) => (
            <li
              key={name}
              style={{
                fontFamily: 'monospace',
                fontSize: '15px',
                background: 'rgba(255,255,255,0.12)',
                borderRadius: '6px',
                padding: '8px 12px',
                marginBottom: '8px',
              }}
            >
              {name}
            </li>
          ))}
        </ul>
        <p style={{ fontSize: '14px', opacity: 0.7 }}>
          {firebaseConfigError}
        </p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {firebaseConfigError ? <FirebaseSetupNeeded /> : <App />}
    </ErrorBoundary>
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

const redirect = sessionStorage.getItem('chime-spa-redirect')
if (redirect) {
  sessionStorage.removeItem('chime-spa-redirect')
  if (redirect !== window.location.pathname + window.location.search + window.location.hash) {
    window.history.replaceState(null, '', redirect)
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './theme-dark.css'
import { applyTheme } from './lib/theme'

applyTheme()
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)


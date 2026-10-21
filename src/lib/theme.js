// Dashboard light / dark / follow the device. Kept per browser.
const KEY = 'gh_admin_theme'

export function getThemeChoice() {
  try { return localStorage.getItem(KEY) || 'auto' } catch { return 'auto' }
}

function resolve(choice) {
  if (choice === 'dark' || choice === 'light') return choice
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(choice = getThemeChoice()) {
  document.documentElement.setAttribute('data-theme', resolve(choice))
}

export function setThemeChoice(choice) {
  try { localStorage.setItem(KEY, choice) } catch { /* private mode */ }
  applyTheme(choice)
}

// follow the device while on "auto"
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (getThemeChoice() === 'auto') applyTheme('auto')
  })
}

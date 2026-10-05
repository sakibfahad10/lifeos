export type ThemeMode = 'system' | 'light' | 'dark'

const THEME_STORAGE_KEY = 'lifeos-theme'

export function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

export function applyTheme(mode: ThemeMode) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Ignore localStorage errors (e.g. private mode)
  }

  const isDark =
    mode === 'dark' ||
    (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }

  window.dispatchEvent(
    new CustomEvent('lifeos:theme-change', {
      detail: { theme: mode, isDark },
    })
  )
}

export function toggleThemeMode(): ThemeMode {
  const current = getStoredTheme()
  const isCurrentlyDark =
    current === 'dark' ||
    (current === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  const nextMode: ThemeMode = isCurrentlyDark ? 'light' : 'dark'
  applyTheme(nextMode)
  return nextMode
}

export function initTheme(): () => void {
  if (typeof window === 'undefined') return () => {}

  const current = getStoredTheme()
  applyTheme(current)

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = () => {
    if (getStoredTheme() === 'system') {
      applyTheme('system')
    }
  }

  mediaQuery.addEventListener('change', handleChange)
  return () => mediaQuery.removeEventListener('change', handleChange)
}

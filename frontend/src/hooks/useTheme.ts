import { useCallback, useEffect } from 'react'

type Theme = 'dark' | 'light'

export function useTheme() {
  const getTheme = (): Theme => {
    const stored = localStorage.getItem('tcb_theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  const applyTheme = useCallback((theme: Theme) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('tcb_theme', theme)
  }, [])

  useEffect(() => {
    applyTheme(getTheme())
  }, [applyTheme])

  const toggle = useCallback(() => {
    const current = getTheme()
    const next: Theme = current === 'dark' ? 'light' : 'dark'
    applyTheme(next)
  }, [applyTheme])

  const setTheme = useCallback((theme: Theme) => {
    applyTheme(theme)
  }, [applyTheme])

  return { getTheme, toggle, setTheme }
}

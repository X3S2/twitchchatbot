import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../hooks/useTheme'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { getTheme, toggle } = useTheme()
  const isDark = getTheme() === 'dark'

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? t('theme.toggle_light') : t('theme.toggle_dark')}
      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title={isDark ? t('theme.toggle_light') : t('theme.toggle_dark')}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-yellow-400" />
      ) : (
        <Moon className="w-5 h-5 text-gray-600" />
      )}
    </button>
  )
}

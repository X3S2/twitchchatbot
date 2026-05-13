import { useTranslation } from 'react-i18next'

export function LangToggle() {
  const { i18n } = useTranslation()
  const current = i18n.language.startsWith('en') ? 'en' : 'de'

  const toggle = () => {
    const next = current === 'de' ? 'en' : 'de'
    i18n.changeLanguage(next)
    localStorage.setItem('tcb_lang', next)
  }

  return (
    <button
      onClick={toggle}
      className="px-2 py-1 text-sm font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      aria-label={current === 'de' ? 'Switch to English' : 'Auf Deutsch wechseln'}
    >
      {current === 'de' ? 'EN' : 'DE'}
    </button>
  )
}

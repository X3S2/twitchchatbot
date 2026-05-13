import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const COOKIE_KEY = 'tcb_cookie_consent'

export function CookieBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(() => !localStorage.getItem(COOKIE_KEY))

  if (!visible) return null

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-gray-600 dark:text-gray-300 flex-1">
          {t('cookie.message')}
        </p>
        <button
          onClick={accept}
          className="px-4 py-2 bg-twitch-purple text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
        >
          {t('cookie.accept')}
        </button>
      </div>
    </div>
  )
}

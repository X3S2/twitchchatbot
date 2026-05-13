import { useTranslation } from 'react-i18next'
import { ThemeToggle } from '../components/ThemeToggle'
import { LangToggle } from '../components/LangToggle'

export default function Login() {
  const { t } = useTranslation()

  const handleLogin = async () => {
    const res = await fetch('/api/auth/login', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      window.location.href = data.auth_url
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <LangToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm text-center">
        <img src="/favicon.svg" alt="TCB" className="w-20 h-20 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-2">{t('app_name')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          {t('auth.login_description')}
        </p>

        <button
          onClick={handleLogin}
          className="w-full py-3 px-6 bg-twitch-purple hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-3 text-lg"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
          </svg>
          {t('auth.login_with_twitch')}
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function Setup() {
  const { t } = useTranslation()
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [botUsername, setBotUsername] = useState('')
  const [botToken, setBotToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          bot_username: botUsername || undefined,
          bot_token: botToken || undefined,
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: t('setup.success') })
      } else {
        const data = await res.json()
        if (data.detail?.includes('bereits')) {
          setMessage({ type: 'error', text: t('setup.already_done') })
        } else {
          setMessage({ type: 'error', text: data.detail ?? t('common.error') })
        }
      }
    } catch {
      setMessage({ type: 'error', text: t('common.error') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/favicon.svg" alt="TCB" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">{t('setup.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">{t('setup.subtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('setup.client_id')}</label>
            <input
              type="text"
              required
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('setup.client_secret')}</label>
            <input
              type="password"
              required
              value={clientSecret}
              onChange={e => setClientSecret(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('setup.bot_username')}</label>
            <input
              type="text"
              value={botUsername}
              onChange={e => setBotUsername(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('setup.bot_token')}</label>
            <input
              type="password"
              value={botToken}
              onChange={e => setBotToken(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
              autoComplete="off"
            />
          </div>

          {message && (
            <p className={`text-sm p-3 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-twitch-purple hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? t('setup.saving') : t('setup.save')}
          </button>
        </form>
      </div>
    </div>
  )
}

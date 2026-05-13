import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">{t('dashboard.title')}</h1>
      {user && (
        <p className="text-gray-500 dark:text-gray-400">
          {t('dashboard.welcome', { name: user.display_name ?? user.twitch_username })}
        </p>
      )}
      <div className="mt-8 text-gray-400 dark:text-gray-600">
        <p>{t('dashboard.no_tenants')}</p>
      </div>
    </div>
  )
}

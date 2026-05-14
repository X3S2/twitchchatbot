import { useTranslation } from 'react-i18next'
import { useAuth } from '../hooks/useAuth'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'

interface Tenant { id: string; channel_name: string }

async function fetchTenants(): Promise<Tenant[]> {
  const res = await fetch('/api/tenants', { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

export default function Dashboard() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: tenants, isLoading } = useQuery({ queryKey: ['tenants'], queryFn: fetchTenants })

  useEffect(() => {
    if (!isLoading && tenants && tenants.length === 1) {
      navigate(`/tenants/${tenants[0].id}`, { replace: true })
    }
  }, [isLoading, tenants, navigate])

  if (isLoading) return null

  if (tenants && tenants.length > 1) {
    navigate('/tenants', { replace: true })
    return null
  }

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
        <Link to="/tenants" className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" />{t('tenant.add')}
        </Link>
      </div>
    </div>
  )
}

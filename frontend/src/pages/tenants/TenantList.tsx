import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight } from 'lucide-react'
import { LED } from '../../components/LED'

interface Tenant {
  id: string
  channel_name: string
  display_name: string
  approved: boolean
  bot_mode: string
  stream_live: boolean
}

interface BotStatus {
  status: string
}

async function fetchTenants(): Promise<Tenant[]> {
  const res = await fetch('/api/tenants', { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function createTenant(data: { channel_name: string; display_name: string }) {
  const res = await fetch('/api/tenants', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default function TenantList() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: tenants = [], isLoading } = useQuery({ queryKey: ['tenants'], queryFn: fetchTenants })
  const [showForm, setShowForm] = useState(false)
  const [channel, setChannel] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')

  const createMut = useMutation({
    mutationFn: createTenant,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      setShowForm(false)
      setChannel('')
      setDisplayName('')
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('tenant.my_tenants')}</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" />{t('tenant.add')}
        </button>
      </div>

      {showForm && (
        <div className="mb-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-semibold mb-4">{t('tenant.new')}</h2>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('tenant.channel_name')}</label>
              <input
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="twitch_kanal_name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('tenant.display_name')}</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Mein Kanal"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => createMut.mutate({ channel_name: channel, display_name: displayName })} disabled={!channel.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
                {t('save')}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-500 py-8">{t('loading')}</div>
      ) : tenants.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          <p className="mb-3">{t('tenant.empty')}</p>
          <button onClick={() => setShowForm(true)} className="text-purple-600 hover:underline">{t('tenant.add_first')}</button>
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((tenant) => (
            <Link key={tenant.id} to={`/tenants/${tenant.id}`} className="block bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:border-purple-400 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <LED status={tenant.approved ? 'online' : 'offline'} />
                  <div>
                    <p className="font-medium">{tenant.display_name || tenant.channel_name}</p>
                    <p className="text-sm text-gray-500">#{tenant.channel_name}</p>
                  </div>
                  {!tenant.approved && (
                    <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 px-2 py-0.5 rounded">{t('tenant.pending_approval')}</span>
                  )}
                  {tenant.stream_live && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-semibold">LIVE</span>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

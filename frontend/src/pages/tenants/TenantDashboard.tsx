import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { LED } from '../../components/LED'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'
import { Activity, Filter, Ban, Terminal, BarChart2, Settings, Users } from 'lucide-react'

interface Tenant {
  id: string
  channel_name: string
  display_name: string
  approved: boolean
  stream_live: boolean
}

interface BotStatus {
  status: string
  last_heartbeat: string | null
  error_message: string | null
  stream_live: boolean
}

interface Stats {
  totals: { bans: number; timeouts: number; filter_hits: number }
}

async function fetchTenant(id: string): Promise<Tenant> {
  const res = await fetch(`/api/tenants/${id}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function fetchBotStatus(id: string): Promise<BotStatus> {
  const res = await fetch(`/api/tenants/${id}/bot/status`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function fetchStats(id: string): Promise<Stats> {
  const res = await fetch(`/api/tenants/${id}/stats?period=week`, { credentials: 'include' })
  if (!res.ok) return { totals: { bans: 0, timeouts: 0, filter_hits: 0 } }
  return res.json()
}

async function startBot(id: string): Promise<void> {
  const res = await fetch(`/api/tenants/${id}/bot/start`, { method: 'POST', credentials: 'include' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Fehler ${res.status}`)
  }
}
async function stopBot(id: string): Promise<void> {
  const res = await fetch(`/api/tenants/${id}/bot/stop`, { method: 'POST', credentials: 'include' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Fehler ${res.status}`)
  }
}

export default function TenantDashboard() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [botError, setBotError] = useState<string | null>(null)

  const { data: tenant } = useQuery({ queryKey: ['tenant', id], queryFn: () => fetchTenant(id!) })
  const { data: botStatus, refetch: refetchStatus } = useQuery({ queryKey: ['bot-status', id], queryFn: () => fetchBotStatus(id!), refetchInterval: 30000 })
  const { data: stats } = useQuery({ queryKey: ['stats', id], queryFn: () => fetchStats(id!) })

  useWebSocket({
    room: `tenant:${id}`,
    onMessage: () => {
      qc.invalidateQueries({ queryKey: ['bot-status', id] })
      qc.invalidateQueries({ queryKey: ['stats', id] })
    },
  })

  if (!tenant) return <div className="p-6 text-center text-gray-500">{t('loading')}</div>

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{tenant.display_name || tenant.channel_name}</h1>
          <p className="text-sm text-gray-500">#{tenant.channel_name}</p>
        </div>
        <div className="flex items-center gap-3">
          {botStatus?.status === 'offline' || botStatus?.status === 'error' ? (
            <button onClick={() => { setBotError(null); startBot(id!).then(() => { setBotError(null); refetchStatus() }).catch((e) => setBotError(e.message)) }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
              {t('bot.start')}
            </button>
          ) : (
            <button onClick={() => stopBot(id!).then(() => refetchStatus()).catch(() => {})} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
              {t('bot.stop')}
            </button>
          )}
          <LED status={botStatus?.status || 'offline'} showLabel />
        </div>
        {botError && (
          <div className="mt-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
            {botError}
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<Ban className="w-5 h-5 text-red-500" />} label={t('stats.total_bans')} value={stats?.totals.bans ?? 0} />
        <StatCard icon={<Activity className="w-5 h-5 text-yellow-500" />} label={t('stats.total_timeouts')} value={stats?.totals.timeouts ?? 0} />
        <StatCard icon={<Filter className="w-5 h-5 text-purple-500" />} label={t('stats.filter_hits')} value={stats?.totals.filter_hits ?? 0} />
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <QuickLink to={`/tenants/${id}/filters`} icon={<Filter className="w-5 h-5" />} label={t('nav.filters')} />
        <QuickLink to={`/tenants/${id}/bans`} icon={<Ban className="w-5 h-5" />} label={t('nav.bans')} />
        <QuickLink to={`/tenants/${id}/commands`} icon={<Terminal className="w-5 h-5" />} label={t('nav.commands')} />
        <QuickLink to={`/tenants/${id}/stats`} icon={<BarChart2 className="w-5 h-5" />} label={t('nav.stats')} />
        <QuickLink to={`/tenants/${id}/settings`} icon={<Settings className="w-5 h-5" />} label={t('nav.settings')} />
        <QuickLink to={`/tenants/${id}/moderators`} icon={<Users className="w-5 h-5" />} label={t('nav.moderators')} />
      </div>

      {botStatus?.error_message && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <p className="text-red-700 dark:text-red-400 text-sm font-medium">{t('bot.error')}: {botStatus.error_message}</p>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4">
      <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">{icon}</div>
      <div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex flex-col items-center gap-2 hover:border-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors">
      <div className="text-purple-600 dark:text-purple-400">{icon}</div>
      <span className="text-sm font-medium text-center">{label}</span>
    </Link>
  )
}

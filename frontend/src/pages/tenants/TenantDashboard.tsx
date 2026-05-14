import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef } from 'react'
import React from 'react'
import { LED } from '../../components/LED'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useQueryClient } from '@tanstack/react-query'
import { Activity, Filter, Ban, Terminal, BarChart2, Settings, Users, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'

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
  const [botPending, setBotPending] = useState(false)
  const botPendingRef = React.useRef(false)

  const startPending = () => { setBotPending(true); botPendingRef.current = true }
  const endPending = () => {
    setTimeout(() => {
      setBotPending(false)
      botPendingRef.current = false
      qc.invalidateQueries({ queryKey: ['bot-status', id] })
    }, 3000)
  }

  const { data: tenant } = useQuery({ queryKey: ['tenant', id], queryFn: () => fetchTenant(id!) })
  const { data: botStatus } = useQuery({ queryKey: ['bot-status', id], queryFn: () => fetchBotStatus(id!), refetchInterval: 30000 })
  const { data: stats } = useQuery({ queryKey: ['stats', id], queryFn: () => fetchStats(id!) })

  useWebSocket({
    room: `tenant:${id}`,
    onMessage: () => {
      if (!botPendingRef.current) {
        qc.invalidateQueries({ queryKey: ['bot-status', id] })
      }
      qc.invalidateQueries({ queryKey: ['stats', id] })
    },
  })

  if (!tenant) return <div className="p-6 text-center text-gray-500">{t('loading')}</div>

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{tenant.display_name || tenant.channel_name}</h1>
            <p className="text-sm text-gray-500">#{tenant.channel_name}</p>
          </div>
          <div className="flex items-center gap-3">
            {botPending ? (
              <button disabled className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm opacity-80 cursor-not-allowed flex items-center gap-2">
                <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                {t('bot.pending')}
              </button>
            ) : botStatus?.status === 'offline' || botStatus?.status === 'error' ? (
              <button onClick={() => {
                setBotError(null); startPending()
                startBot(id!).then(() => setBotError(null)).catch((e: Error) => setBotError(e.message)).finally(() => endPending())
              }} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                {t('bot.start')}
              </button>
            ) : (
              <button onClick={() => {
                setBotError(null); startPending()
                stopBot(id!).catch((e: Error) => setBotError(e.message)).finally(() => endPending())
              }} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
                {t('bot.stop')}
              </button>
            )}
            <LED status={botStatus?.status || 'offline'} showLabel />
          </div>
        </div>
        {botError && (
          <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
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

      {/* Live Chat */}
      <LiveChat tenantId={id!} />

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

interface ChatMsg {
  username: string
  display_name: string
  color: string | null
  text: string
  ts: string
}

function LiveChat({ tenantId }: { tenantId: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [maxMessages, setMaxMessages] = useState(100)
  const [open, setOpen] = useState(true)
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const maxMessagesRef = useRef(100)

  useEffect(() => {
    maxMessagesRef.current = maxMessages
  }, [maxMessages])

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${proto}//${window.location.host}/api/ws/tenant/${tenantId}/chat`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onerror = () => ws.close()
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as unknown
        const payload = msg as { type?: string; messages?: ChatMsg[]; limit?: number }
        if (payload.type === 'chat_history' && Array.isArray(payload.messages)) {
          const limit = Math.max(10, Math.min(500, Number(payload.limit || 100)))
          setMaxMessages(limit)
          setMessages(payload.messages.slice(-limit))
          return
        }
        if (payload.type === 'chat_message') {
          const chatMsg = payload as ChatMsg
          setMessages(prev => {
            const next = [...prev, chatMsg]
            const limit = maxMessagesRef.current
            return next.length > limit ? next.slice(-limit) : next
          })
        }
      } catch { /* ignore */ }
    }
    return () => { ws.close(); wsRef.current = null }
  }, [tenantId])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-medium text-sm">Live Chat</span>
          <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} title={connected ? 'Verbunden' : 'Getrennt'} />
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="h-72 overflow-y-auto px-4 pb-3 pt-1 space-y-1 font-mono text-xs bg-gray-950 dark:bg-gray-950">
          {messages.length === 0 && (
            <p className="text-gray-500 mt-4 text-center">{connected ? 'Warte auf Nachrichten…' : 'Keine Verbindung'}</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className="flex gap-1 leading-relaxed">
              <span className="text-gray-500 shrink-0">{new Date(m.ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              <span className="shrink-0" style={{ color: m.color || '#a78bfa' }}>{m.display_name || m.username}</span>
              <span className="text-gray-300 dark:text-gray-200 break-all">: {m.text}</span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}

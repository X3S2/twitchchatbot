import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { LED } from '../../components/LED'
import { useWebSocket } from '../../hooks/useWebSocket'

interface BotInstance {
  tenant_id: string
  channel_name: string
  approved: boolean
  status: string
  last_heartbeat: string | null
  error_message: string | null
  stream_live: boolean
}

async function fetchInstances(): Promise<BotInstance[]> {
  const res = await fetch('/api/tenants/admin/instances', { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler beim Laden der Instanzen')
  return res.json()
}

async function startBot(tenant_id: string): Promise<void> {
  const res = await fetch('/api/tenants/' + tenant_id + '/bot/start', { method: 'POST', credentials: 'include' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Fehler beim Starten des Bots')
  }
}

async function stopBot(tenant_id: string): Promise<void> {
  const res = await fetch('/api/tenants/' + tenant_id + '/bot/stop', { method: 'POST', credentials: 'include' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || 'Fehler beim Stoppen des Bots')
  }
}

export default function AdminIndex() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const { data: instances = [], isLoading } = useQuery({ queryKey: ['admin-instances'], queryFn: fetchInstances, refetchInterval: 30000 })

  const setRowError = (tenant_id: string, msg: string) => setRowErrors(prev => ({ ...prev, [tenant_id]: msg }))
  const clearRowError = (tenant_id: string) => setRowErrors(prev => { const n = { ...prev }; delete n[tenant_id]; return n })

  const startMut = useMutation({
    mutationFn: ({ tenant_id }: { tenant_id: string }) => startBot(tenant_id),
    onSuccess: (_d, { tenant_id }) => { clearRowError(tenant_id); qc.invalidateQueries({ queryKey: ['admin-instances'] }) },
    onError: (err: Error, { tenant_id }) => setRowError(tenant_id, err.message),
  })
  const stopMut = useMutation({
    mutationFn: ({ tenant_id }: { tenant_id: string }) => stopBot(tenant_id),
    onSuccess: (_d, { tenant_id }) => { clearRowError(tenant_id); qc.invalidateQueries({ queryKey: ['admin-instances'] }) },
    onError: (err: Error, { tenant_id }) => setRowError(tenant_id, err.message),
  })

  // Echtzeit-Updates via WebSocket
  useWebSocket({
    room: 'admin',
    onMessage: () => qc.invalidateQueries({ queryKey: ['admin-instances'] }),
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t('admin.title')}</h1>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold">{t('admin.bot_instances')}</h2>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-gray-500">{t('loading')}</div>
        ) : instances.length === 0 ? (
          <div className="p-6 text-center text-gray-500">{t('admin.no_instances')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 text-left">{t('admin.channel')}</th>
                <th className="px-4 py-2 text-left">{t('admin.status')}</th>
                <th className="px-4 py-2 text-left">{t('admin.stream')}</th>
                <th className="px-4 py-2 text-left">{t('admin.last_heartbeat')}</th>
                <th className="px-4 py-2 text-left">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {instances.map((inst) => (
                <tr key={inst.tenant_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2 font-medium">
                    {inst.channel_name}
                    {!inst.approved && <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">{t('admin.pending')}</span>}
                  </td>
                  <td className="px-4 py-2"><LED status={inst.status} showLabel /></td>
                  <td className="px-4 py-2">
                    {inst.stream_live ? <span className="text-red-500 font-semibold">LIVE</span> : <span className="text-gray-400">–</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-500">
                    {inst.last_heartbeat ? new Date(inst.last_heartbeat).toLocaleString() : '–'}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      {(inst.status === 'offline' || inst.status === 'error') ? (
                        <button
                          onClick={() => startMut.mutate({ tenant_id: inst.tenant_id })}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          {t('admin.start')}
                        </button>
                      ) : (
                        <button
                          onClick={() => stopMut.mutate({ tenant_id: inst.tenant_id })}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                        >
                          {t('admin.stop')}
                        </button>
                      )}
                      {rowErrors[inst.tenant_id] && (
                        <span className="text-xs text-red-500">{rowErrors[inst.tenant_id]}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

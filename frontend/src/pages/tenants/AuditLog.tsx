import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'

interface AuditEntry {
  id: string
  actor_id: string | null
  actor_username: string | null
  action: string
  detail: string | null
  created_at: string
}

async function fetchAudit(tenantId: string, page: number, action: string): Promise<{ items: AuditEntry[]; total: number }> {
  const params = new URLSearchParams({ offset: String((page - 1) * 50), limit: '50' })
  if (action) params.set('action', action)
  const res = await fetch(`/api/tenants/${tenantId}/audit?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

export default function AuditLog() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['audit', id, page, actionFilter], queryFn: () => fetchAudit(id!, page, actionFilter) })

  const totalPages = data ? Math.ceil(data.total / 50) : 0

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('audit.title')}</h1>
        <input value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1) }} placeholder={t('audit.filter_action')} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm w-48 focus:outline-none focus:ring-2 focus:ring-purple-500" />
      </div>

      {isLoading ? (
        <div className="text-center text-gray-500">{t('loading')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {!data || data.items.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t('audit.empty')}</div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">{t('audit.actor')}</th>
                    <th className="px-4 py-2 text-left">{t('audit.action')}</th>
                    <th className="px-4 py-2 text-left">{t('audit.detail')}</th>
                    <th className="px-4 py-2 text-left">{t('audit.time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.items.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-2 font-medium">{entry.actor_username || 'System'}</td>
                      <td className="px-4 py-2"><code className="text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{entry.action}</code></td>
                      <td className="px-4 py-2 text-gray-500 max-w-xs truncate">{entry.detail || '–'}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">{new Date(entry.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-40">{t('pagination.prev')}</button>
                  <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-40">{t('pagination.next')}</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert, Trash2, Zap } from 'lucide-react'

interface ScanFilter {
  id: string
  name: string
  description: string | null
  trigger_action: string
  enabled: boolean
}

interface Optin {
  scan_filter_id: string
  filter_name: string
  auto_ban: boolean
}

async function fetchAllFilters(): Promise<ScanFilter[]> {
  const res = await fetch('/api/name-scan/filters', { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

async function fetchOptins(tenantId: string): Promise<Optin[]> {
  const res = await fetch(`/api/name-scan/tenants/${tenantId}/optins`, { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

async function addOptin(tenantId: string, scanFilterId: string): Promise<void> {
  await fetch(`/api/name-scan/tenants/${tenantId}/optins`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scan_filter_id: scanFilterId, auto_ban: false }),
  })
}

async function removeOptin(tenantId: string, scanFilterId: string): Promise<void> {
  await fetch(`/api/name-scan/tenants/${tenantId}/optins/${scanFilterId}`, {
    method: 'DELETE', credentials: 'include',
  })
}

async function applyAll(tenantId: string, filterId: string): Promise<{ ok: boolean; banned: number; skipped: number }> {
  const res = await fetch(`/api/name-scan/tenants/${tenantId}/filters/${filterId}/apply-all`, {
    method: 'POST', credentials: 'include',
  })
  if (!res.ok) throw new Error('Fehler beim Massen-Ban')
  return res.json()
}

export default function TenantNameScan() {
  const { t } = useTranslation()
  const { id: tenantId } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [confirmFilter, setConfirmFilter] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [applyResult, setApplyResult] = useState<{ banned: number; skipped: number } | null>(null)

  const { data: allFilters = [] } = useQuery({ queryKey: ['ns-filters'], queryFn: fetchAllFilters })
  const { data: optins = [] } = useQuery({ queryKey: ['ns-optins', tenantId], queryFn: () => fetchOptins(tenantId!) })

  const optinMut = useMutation({
    mutationFn: (id: string) => addOptin(tenantId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ns-optins', tenantId] }),
  })
  const removeMut = useMutation({
    mutationFn: (id: string) => removeOptin(tenantId!, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ns-optins', tenantId] }),
  })
  const applyMut = useMutation({
    mutationFn: (filterId: string) => applyAll(tenantId!, filterId),
    onSuccess: (data) => {
      setApplyResult({ banned: data.banned, skipped: data.skipped })
      setConfirmFilter(null)
      setConfirmed(false)
    },
  })

  const optinIds = new Set(optins.map((o) => o.scan_filter_id))
  const nonOptedFilters = allFilters.filter((f) => f.enabled && !optinIds.has(f.id))

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ShieldAlert className="w-6 h-6 text-purple-500" />
        {t('name_scan.title')}
      </h1>

      {/* Success result */}
      {applyResult && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-5 py-4 text-sm text-green-800 dark:text-green-300 flex justify-between items-center">
          <span>{t('name_scan.apply_result', { banned: applyResult.banned, skipped: applyResult.skipped })}</span>
          <button onClick={() => setApplyResult(null)} className="text-green-600 hover:underline text-xs">Schließen</button>
        </div>
      )}

      {/* Active optins */}
      <div>
        <h2 className="font-semibold mb-3">{t('name_scan.active_filters')}</h2>
        {optins.length === 0 ? (
          <p className="text-sm text-gray-400">{t('name_scan.no_optins')}</p>
        ) : (
          <div className="space-y-3">
            {optins.map((o) => (
              <div key={o.scan_filter_id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{o.filter_name}</p>
                  <span className="text-xs text-gray-500">{t('name_scan.auto_ban')}: {o.auto_ban ? '✓' : '✗'}</span>
                </div>
                <div className="flex gap-2">
                  {/* Apply-All button */}
                  {confirmFilter === o.scan_filter_id ? (
                    <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">
                      <span className="text-xs text-red-700 dark:text-red-300">{t('name_scan.confirm_apply')}</span>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                        {t('name_scan.confirm_checkbox')}
                      </label>
                      <button
                        disabled={!confirmed || applyMut.isPending}
                        onClick={() => applyMut.mutate(o.scan_filter_id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs disabled:opacity-40 hover:bg-red-700"
                      >
                        {applyMut.isPending ? '...' : t('name_scan.apply_now')}
                      </button>
                      <button onClick={() => { setConfirmFilter(null); setConfirmed(false) }} className="text-xs text-gray-500 hover:underline">{t('cancel')}</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setConfirmFilter(o.scan_filter_id); setConfirmed(false) }}
                      className="flex items-center gap-1 px-3 py-1.5 border border-orange-400 text-orange-600 rounded-lg text-xs hover:bg-orange-50 dark:hover:bg-orange-900/10"
                    >
                      <Zap className="w-3 h-3" />
                      {t('name_scan.apply_all')}
                    </button>
                  )}
                  <button onClick={() => removeMut.mutate(o.scan_filter_id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available filters to opt-in */}
      {nonOptedFilters.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3">{t('name_scan.available_filters')}</h2>
          <div className="space-y-2">
            {nonOptedFilters.map((f) => (
              <div key={f.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{f.name}</p>
                  {f.description && <p className="text-xs text-gray-500">{f.description}</p>}
                </div>
                <button
                  onClick={() => optinMut.mutate(f.id)}
                  className="px-3 py-1.5 border border-purple-400 text-purple-600 rounded-lg text-xs hover:bg-purple-50 dark:hover:bg-purple-900/10"
                >
                  {t('name_scan.activate')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

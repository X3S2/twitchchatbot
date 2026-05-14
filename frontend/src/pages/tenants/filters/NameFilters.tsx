import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, X, Save } from 'lucide-react'

interface NameFilter {
  id: string
  name: string
  enabled: boolean
  test_mode: boolean
  patterns: { id: string; pattern: string; is_regex: boolean; is_whitelist: boolean }[]
  tiers: { id: string; tier_order: number; action: string; duration_seconds: number; message_template: string | null }[]
}

type EditPattern = { pattern: string; is_regex: boolean; is_whitelist: boolean }
type EditTier = { tier_order: number; action: string; duration_seconds: number; message_template: string }
interface EditState {
  id: string; name: string; enabled: boolean; test_mode: boolean
  patterns: EditPattern[]; tiers: EditTier[]
}

const iCls = 'px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500'

async function fetchFilters(tenantId: string): Promise<NameFilter[]> {
  const res = await fetch(`/api/tenants/${tenantId}/filters/name`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}
async function deleteFilter(tenantId: string, filterId: string) {
  await fetch(`/api/tenants/${tenantId}/filters/name/${filterId}`, { method: 'DELETE', credentials: 'include' })
}
async function toggleFilter(tenantId: string, filterId: string, current: boolean) {
  const res = await fetch(`/api/tenants/${tenantId}/filters/name/${filterId}`, {
    method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled: !current }),
  })
  if (!res.ok) throw new Error(`${res.status}`)
}
async function createFilter(tenantId: string, name: string) {
  const res = await fetch(`/api/tenants/${tenantId}/filters/name`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, enabled: true }),
  })
  if (!res.ok) throw new Error(await res.text())
}
async function updateFilter(tenantId: string, filterId: string, data: EditState) {
  const res = await fetch(`/api/tenants/${tenantId}/filters/name/${filterId}`, {
    method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: data.name, enabled: data.enabled, test_mode: data.test_mode,
      patterns: data.patterns, tiers: data.tiers,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export default function NameFilters() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: filters = [], isLoading } = useQuery({ queryKey: ['name-filters', id], queryFn: () => fetchFilters(id!) })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')
  const [editing, setEditing] = useState<EditState | null>(null)

  const deleteMut = useMutation({ mutationFn: (fid: string) => deleteFilter(id!, fid), onSuccess: () => qc.invalidateQueries({ queryKey: ['name-filters', id] }) })
  const toggleMut = useMutation({ mutationFn: ({ fid, cur }: { fid: string; cur: boolean }) => toggleFilter(id!, fid, cur), onSuccess: () => qc.invalidateQueries({ queryKey: ['name-filters', id] }), onError: (e: Error) => { if (e.message === '401') qc.invalidateQueries({ queryKey: ['auth', 'me'] }) } })
  const createMut = useMutation({ mutationFn: () => createFilter(id!, createName), onSuccess: () => { qc.invalidateQueries({ queryKey: ['name-filters', id] }); setShowCreate(false); setCreateName('') } })
  const updateMut = useMutation({ mutationFn: () => updateFilter(id!, editing!.id, editing!), onSuccess: () => { qc.invalidateQueries({ queryKey: ['name-filters', id] }); setEditing(null) } })

  function toggleExpand(fid: string) { setExpanded((p) => { const n = new Set(p); n.has(fid) ? n.delete(fid) : n.add(fid); return n }) }

  function startEdit(filter: NameFilter) {
    setEditing({
      id: filter.id, name: filter.name, enabled: filter.enabled, test_mode: filter.test_mode,
      patterns: filter.patterns.map(({ pattern, is_regex, is_whitelist }) => ({ pattern, is_regex, is_whitelist: is_whitelist ?? false })),
      tiers: filter.tiers.map(({ tier_order, action, duration_seconds, message_template }) => ({ tier_order, action, duration_seconds, message_template: message_template ?? '' })),
    })
  }

  function setE<K extends keyof EditState>(key: K, val: EditState[K]) { setEditing((e) => e ? { ...e, [key]: val } : e) }
  function updPat(i: number, key: keyof EditPattern, val: unknown) { setEditing((e) => e ? { ...e, patterns: e.patterns.map((p, idx) => idx === i ? { ...p, [key]: val } : p) } : e) }
  function updTier(i: number, key: keyof EditTier, val: unknown) { setEditing((e) => e ? { ...e, tiers: e.tiers.map((t, idx) => idx === i ? { ...t, [key]: val } : t) } : e) }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('filters.name_title')}</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" />{t('filters.new')}
        </button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h2 className="font-semibold text-sm">{t('filters.new')}</h2>
          <div className="flex gap-2">
            <input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder={t('filters.name_placeholder')}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyDown={(e) => e.key === 'Enter' && createName.trim() && createMut.mutate()} autoFocus />
            <button onClick={() => createMut.mutate()} disabled={!createName.trim() || createMut.isPending}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-purple-700">{t('save')}</button>
            <button onClick={() => { setShowCreate(false); setCreateName('') }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">{t('cancel')}</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-500">{t('loading')}</div>
      ) : filters.length === 0 ? (
        <div className="text-center text-gray-500 py-12">{t('filters.empty')}</div>
      ) : (
        <div className="space-y-3">
          {filters.map((filter) => {
            const isEditing = editing?.id === filter.id
            return (
              <div key={filter.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleExpand(filter.id)} className="text-gray-400 hover:text-gray-600">
                      {expanded.has(filter.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{filter.name}</span>
                        {filter.test_mode && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Test-Mode</span>}
                        {!filter.enabled && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Inaktiv</span>}
                      </div>
                      <p className="text-xs text-gray-500">{filter.patterns.length} {t('filters.patterns')} · {filter.tiers.length} {t('filters.tiers')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleMut.mutate({ fid: filter.id, cur: filter.enabled })} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                      {filter.enabled ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                    </button>
                    <button onClick={() => isEditing ? setEditing(null) : startEdit(filter)}
                      className={`p-1.5 rounded ${isEditing ? 'bg-purple-100 dark:bg-purple-900/30' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                      <Pencil className={`w-4 h-4 ${isEditing ? 'text-purple-600' : 'text-gray-500'}`} />
                    </button>
                    <button onClick={() => deleteMut.mutate(filter.id)} className="p-1.5 hover:bg-red-50 rounded">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Edit panel */}
                {isEditing && editing && (
                  <div className="border-t border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 px-4 py-4 space-y-4">
                    <div className="flex flex-wrap gap-3 items-center">
                      <input value={editing.name} onChange={(e) => setE('name', e.target.value)}
                        className={`${iCls} min-w-[180px]`} placeholder={t('filters.name_placeholder')} />
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={editing.enabled} onChange={(e) => setE('enabled', e.target.checked)} className="w-3.5 h-3.5 accent-purple-600" />
                        {t('filters.enabled')}
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={editing.test_mode} onChange={(e) => setE('test_mode', e.target.checked)} className="w-3.5 h-3.5 accent-blue-500" />
                        Test-Mode
                      </label>
                    </div>

                    {/* Patterns */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('filters.patterns')}</p>
                      <div className="space-y-2">
                        {editing.patterns.map((pat, i) => (
                          <div key={i} className="flex items-center gap-2 flex-wrap">
                            <input value={pat.pattern} onChange={(e) => updPat(i, 'pattern', e.target.value)}
                              className={`${iCls} flex-1 min-w-[140px] font-mono`} placeholder="Muster oder Regex…" />
                            <label className="flex items-center gap-1 text-xs cursor-pointer whitespace-nowrap">
                              <input type="checkbox" checked={pat.is_regex} onChange={(e) => updPat(i, 'is_regex', e.target.checked)} className="w-3.5 h-3.5" />
                              Regex
                            </label>
                            <label className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 cursor-pointer whitespace-nowrap">
                              <input type="checkbox" checked={pat.is_whitelist} onChange={(e) => updPat(i, 'is_whitelist', e.target.checked)} className="w-3.5 h-3.5 accent-green-600" />
                              Whitelist
                            </label>
                            <button onClick={() => setEditing((e) => e ? { ...e, patterns: e.patterns.filter((_, idx) => idx !== i) } : e)} className="text-red-400 hover:text-red-600">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setEditing((e) => e ? { ...e, patterns: [...e.patterns, { pattern: '', is_regex: false, is_whitelist: false }] } : e)}
                        className="mt-2 flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800">
                        <Plus className="w-3 h-3" />{t('filters.add_pattern')}
                      </button>
                    </div>

                    {/* Tiers */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('filters.tiers')} ({t('filters.tiers_hint')})</p>
                      <div className="space-y-2">
                        {editing.tiers.map((tier, i) => (
                          <div key={i} className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-500 whitespace-nowrap">Stufe {i + 1} â†’</span>
                            <select value={tier.action} onChange={(e) => updTier(i, 'action', e.target.value)} className={iCls}>
                              <option value="warn">warn</option>
                              <option value="timeout">timeout</option>
                              <option value="ban">ban</option>
                            </select>
                            {tier.action === 'timeout' && (
                              <>
                                <input type="number" min={1} value={tier.duration_seconds} onChange={(e) => updTier(i, 'duration_seconds', Number(e.target.value))}
                                  className={`${iCls} w-20`} />
                                <span className="text-xs text-gray-500">s</span>
                              </>
                            )}
                            <button onClick={() => setEditing((e) => e ? { ...e, tiers: e.tiers.filter((_, idx) => idx !== i) } : e)} className="text-red-400 hover:text-red-600">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setEditing((e) => e ? { ...e, tiers: [...e.tiers, { tier_order: e.tiers.length + 1, action: 'ban', duration_seconds: 0, message_template: '' }] } : e)}
                        className="mt-2 flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800">
                        <Plus className="w-3 h-3" />{t('filters.add_tier')}
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button onClick={() => updateMut.mutate()} disabled={!editing.name.trim() || updateMut.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded text-sm disabled:opacity-50 hover:bg-purple-700">
                        <Save className="w-3.5 h-3.5" />{t('save')}
                      </button>
                      <button onClick={() => setEditing(null)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                        {t('cancel')}
                      </button>
                      {updateMut.isError && <span className="text-xs text-red-500">{String(updateMut.error)}</span>}
                    </div>
                  </div>
                )}

                {/* Expanded read-only view */}
                {!isEditing && expanded.has(filter.id) && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('filters.patterns')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {filter.patterns.length === 0 ? <span className="text-xs text-gray-400 italic">{t('filters.no_patterns')}</span> : filter.patterns.map((p) => (
                          <span key={p.id} className={`px-2 py-0.5 rounded text-xs font-mono ${p.is_whitelist ? 'bg-green-100 text-green-700' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'}`}>
                            {p.is_whitelist && '\u2713 '}{p.pattern}
                            {p.is_regex && <span className="ml-1 text-[9px] opacity-60">regex</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('filters.tiers')}</p>
                      {filter.tiers.length === 0 ? <span className="text-xs text-gray-400 italic">{t('filters.no_tiers')}</span> : (
                        <div className="space-y-1">
                          {filter.tiers.map((tier) => (
                            <div key={tier.id} className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Tier {tier.tier_order}</span>
                              <span className={`px-1.5 py-0.5 rounded ${tier.action === 'ban' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{tier.action}</span>
                              {tier.duration_seconds > 0 && <span>{tier.duration_seconds}s</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

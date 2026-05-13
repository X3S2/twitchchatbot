import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Plus, Pencil, Trash2, Copy, ToggleLeft, ToggleRight, ChevronDown, ChevronRight } from 'lucide-react'

interface ChatFilter {
  id: string
  name: string
  enabled: boolean
  case_sensitive: boolean
  test_mode: boolean
  priority: number
  terms: { id: string; term: string; is_regex: boolean; is_whitelist: boolean }[]
  tiers: { id: string; tier_order: number; threshold: number; action: string; duration_seconds: number }[]
}

async function fetchFilters(tenantId: string): Promise<ChatFilter[]> {
  const res = await fetch(`/api/tenants/${tenantId}/filters/chat`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function deleteFilter(tenantId: string, filterId: string) {
  await fetch(`/api/tenants/${tenantId}/filters/chat/${filterId}`, { method: 'DELETE', credentials: 'include' })
}

async function toggleFilter(tenantId: string, filterId: string, filter: ChatFilter) {
  await fetch(`/api/tenants/${tenantId}/filters/chat/${filterId}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...filter, terms: filter.terms, tiers: filter.tiers, enabled: !filter.enabled }),
  })
}

async function duplicateFilter(tenantId: string, filterId: string) {
  await fetch(`/api/tenants/${tenantId}/filters/chat/${filterId}/duplicate`, { method: 'POST', credentials: 'include' })
}

async function createFilter(tenantId: string, name: string) {
  const res = await fetch(`/api/tenants/${tenantId}/filters/chat`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, enabled: true }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export default function ChatFilters() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: filters = [], isLoading } = useQuery({ queryKey: ['chat-filters', id], queryFn: () => fetchFilters(id!) })
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState('')

  const deleteMut = useMutation({ mutationFn: (fid: string) => deleteFilter(id!, fid), onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-filters', id] }) })
  const toggleMut = useMutation({ mutationFn: (filter: ChatFilter) => toggleFilter(id!, filter.id, filter), onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-filters', id] }) })
  const dupMut = useMutation({ mutationFn: (fid: string) => duplicateFilter(id!, fid), onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-filters', id] }) })
  const createMut = useMutation({
    mutationFn: () => createFilter(id!, createName),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chat-filters', id] }); setShowCreate(false); setCreateName('') },
  })

  function toggleExpand(fid: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(fid) ? n.delete(fid) : n.add(fid); return n })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('filters.chat_title')}</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" />{t('filters.new')}
        </button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h2 className="font-semibold text-sm">{t('filters.new')}</h2>
          <div className="flex gap-2">
            <input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={t('filters.name_placeholder')}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              onKeyDown={(e) => e.key === 'Enter' && createName.trim() && createMut.mutate()}
              autoFocus
            />
            <button onClick={() => createMut.mutate()} disabled={!createName.trim() || createMut.isPending}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-purple-700">
              {t('save')}
            </button>
            <button onClick={() => { setShowCreate(false); setCreateName('') }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-500">{t('loading')}</div>
      ) : filters.length === 0 ? (
        <div className="text-center text-gray-500 py-12">{t('filters.empty')}</div>
      ) : (
        <div className="space-y-3">
          {filters.map((filter) => (
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
                    <p className="text-xs text-gray-500">{filter.terms.length} {t('filters.terms')} · {filter.tiers.length} {t('filters.tiers')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleMut.mutate(filter)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                    {filter.enabled ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  </button>
                  <button onClick={() => dupMut.mutate(filter.id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded" title="Duplizieren">
                    <Copy className="w-4 h-4 text-gray-500" />
                  </button>
                  <button className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                    <Pencil className="w-4 h-4 text-gray-500" />
                  </button>
                  <button onClick={() => deleteMut.mutate(filter.id)} className="p-1.5 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>

              {expanded.has(filter.id) && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 space-y-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('filters.terms')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {filter.terms.map((term) => (
                        <span key={term.id} className={`px-2 py-0.5 rounded text-xs font-mono ${term.is_whitelist ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {term.is_whitelist && '✓ '}{term.term}
                          {term.is_regex && <span className="ml-1 text-[9px] opacity-60">regex</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('filters.tiers')}</p>
                    <div className="space-y-1">
                      {filter.tiers.map((tier) => (
                        <div key={tier.id} className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Tier {tier.tier_order}</span>
                          <span>ab {tier.threshold}x</span>
                          <span className={`px-1.5 py-0.5 rounded ${tier.action === 'ban' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{tier.action}</span>
                          {tier.duration_seconds > 0 && <span>{tier.duration_seconds}s</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

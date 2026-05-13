import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Plus, Trash2, Search, Download } from 'lucide-react'

interface Ban {
  id: string
  twitch_user_id: string
  twitch_username: string | null
  type: string
  duration_seconds: number | null
  reason: string | null
  note: string | null
  failover_protected: boolean
  created_at: string
}

async function fetchBans(tenantId: string, search: string, type: string): Promise<Ban[]> {
  const params = new URLSearchParams({ limit: '200' })
  if (search) params.set('search', search)
  if (type) params.set('type', type)
  const res = await fetch(`/api/tenants/${tenantId}/bans?${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function unbanUser(tenantId: string, banId: string) {
  await fetch(`/api/tenants/${tenantId}/bans/${banId}`, { method: 'DELETE', credentials: 'include' })
}

async function addBan(tenantId: string, data: { twitch_user_id: string; twitch_username: string; type: string; reason: string }) {
  const res = await fetch(`/api/tenants/${tenantId}/bans`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

export default function BanList() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newUserId, setNewUserId] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newReason, setNewReason] = useState('')
  const [newType, setNewType] = useState('permanent')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: bans = [], isLoading } = useQuery({ queryKey: ['bans', id, search, typeFilter], queryFn: () => fetchBans(id!, search, typeFilter) })
  const unbanMut = useMutation({ mutationFn: (banId: string) => unbanUser(id!, banId), onSuccess: () => qc.invalidateQueries({ queryKey: ['bans', id] }) })
  const addMut = useMutation({
    mutationFn: (data: Parameters<typeof addBan>[1]) => addBan(id!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bans', id] }); setShowAdd(false); setNewUserId(''); setNewUsername(''); setNewReason('') },
  })

  function toggleSelect(banId: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(banId) ? n.delete(banId) : n.add(banId); return n })
  }

  async function bulkUnban() {
    for (const banId of selected) {
      await unbanUser(id!, banId)
    }
    setSelected(new Set())
    qc.invalidateQueries({ queryKey: ['bans', id] })
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('bans.title')}</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button onClick={bulkUnban} className="px-3 py-2 bg-yellow-600 text-white rounded-lg text-sm hover:bg-yellow-700">
              {t('bans.unban_selected')} ({selected.size})
            </button>
          )}
          <a href={`/api/tenants/${id}/bans/export?format=csv`} className="flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
            <Download className="w-4 h-4" /> CSV
          </a>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
            <Plus className="w-4 h-4" />{t('bans.add')}
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('bans.search')} className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none">
          <option value="">{t('bans.all_types')}</option>
          <option value="permanent">Permanent</option>
          <option value="timeout">Timeout</option>
        </select>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h2 className="font-semibold">{t('bans.new')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={newUserId} onChange={(e) => setNewUserId(e.target.value)} placeholder={t('bans.twitch_user_id')} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm" />
            <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder={t('bans.username')} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm" />
            <input value={newReason} onChange={(e) => setNewReason(e.target.value)} placeholder={t('bans.reason')} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm sm:col-span-2" />
            <select value={newType} onChange={(e) => setNewType(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm">
              <option value="permanent">Permanent</option>
              <option value="timeout">Timeout</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMut.mutate({ twitch_user_id: newUserId, twitch_username: newUsername, type: newType, reason: newReason })} disabled={!newUserId.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50">{t('save')}</button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500">{t('loading')}</div>
        ) : bans.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t('bans.empty')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 w-10"><input type="checkbox" onChange={(e) => e.target.checked ? setSelected(new Set(bans.map(b => b.id))) : setSelected(new Set())} /></th>
                <th className="px-4 py-2 text-left">{t('bans.user')}</th>
                <th className="px-4 py-2 text-left">{t('bans.type')}</th>
                <th className="px-4 py-2 text-left">{t('bans.reason')}</th>
                <th className="px-4 py-2 text-left">{t('bans.date')}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {bans.map((ban) => (
                <tr key={ban.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3"><input type="checkbox" checked={selected.has(ban.id)} onChange={() => toggleSelect(ban.id)} /></td>
                  <td className="px-4 py-3 font-medium">{ban.twitch_username || ban.twitch_user_id}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ban.type === 'permanent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{ban.type}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{ban.reason || '–'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(ban.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => unbanMut.mutate(ban.id)} className="p-1 hover:bg-red-50 text-red-500 rounded" title={t('bans.unban')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
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

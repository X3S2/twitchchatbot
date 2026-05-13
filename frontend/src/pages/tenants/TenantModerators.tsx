import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface Moderator {
  id: string
  twitch_user_id: string
  twitch_username: string
  role: string
}

async function fetchMods(tenantId: string): Promise<Moderator[]> {
  const res = await fetch(`/api/tenants/${tenantId}/moderators`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function addMod(tenantId: string, data: { twitch_user_id: string; twitch_username: string; role: string }) {
  const res = await fetch(`/api/tenants/${tenantId}/moderators`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

async function removeMod(tenantId: string, modId: string) {
  await fetch(`/api/tenants/${tenantId}/moderators/${modId}`, { method: 'DELETE', credentials: 'include' })
}

const ROLES = ['viewer', 'moderator', 'manager']
const roleBadge = (r: string) => {
  const m: Record<string, string> = { viewer: 'bg-gray-100 text-gray-600', moderator: 'bg-green-100 text-green-700', manager: 'bg-blue-100 text-blue-700' }
  return m[r] || 'bg-gray-100 text-gray-600'
}

export default function TenantModerators() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: mods = [], isLoading } = useQuery({ queryKey: ['mods', id], queryFn: () => fetchMods(id!) })
  const [showForm, setShowForm] = useState(false)
  const [userId, setUserId] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('moderator')

  const addMut = useMutation({
    mutationFn: () => addMod(id!, { twitch_user_id: userId, twitch_username: username, role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mods', id] }); setShowForm(false); setUserId(''); setUsername('') },
  })
  const removeMut = useMutation({ mutationFn: (modId: string) => removeMod(id!, modId), onSuccess: () => qc.invalidateQueries({ queryKey: ['mods', id] }) })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('mods.title')}</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" />{t('mods.add')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h2 className="font-semibold">{t('mods.add')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder={t('mods.user_id')} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm" />
            <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t('mods.username')} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm" />
            <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMut.mutate()} disabled={!userId.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50">{t('save')}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">{t('cancel')}</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-500">{t('loading')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          {mods.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t('mods.empty')}</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left">{t('user.username')}</th>
                  <th className="px-4 py-2 text-left">Twitch ID</th>
                  <th className="px-4 py-2 text-left">{t('user.role')}</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {mods.map((mod) => (
                  <tr key={mod.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3 font-medium">{mod.twitch_username}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{mod.twitch_user_id}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${roleBadge(mod.role)}`}>{mod.role}</span></td>
                    <td className="px-4 py-3">
                      <button onClick={() => removeMut.mutate(mod.id)} className="p-1.5 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

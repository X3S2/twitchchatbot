import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState, useRef } from 'react'
import { Plus, Trash2, Search, HelpCircle, X } from 'lucide-react'

interface Moderator {
  id: string
  twitch_user_id: string
  twitch_username: string
  role: string
}

interface TwitchUserSuggestion {
  twitch_id: string
  current_username: string
}

async function fetchMods(tenantId: string): Promise<Moderator[]> {
  const res = await fetch(`/api/tenants/${tenantId}/moderators`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function searchTwitchUsers(q: string): Promise<TwitchUserSuggestion[]> {
  if (q.length < 2) return []
  const res = await fetch(`/api/twitch-users?q=${encodeURIComponent(q)}`, { credentials: 'include' })
  if (!res.ok) return []
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

const ROLES = ['viewer', 'editor']
const roleBadge = (r: string) => {
  const m: Record<string, string> = { viewer: 'bg-gray-100 text-gray-600', editor: 'bg-blue-100 text-blue-700' }
  return m[r] || 'bg-gray-100 text-gray-600'
}

export default function TenantModerators() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: mods = [], isLoading } = useQuery({ queryKey: ['mods', id], queryFn: () => fetchMods(id!) })
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('viewer')
  const [suggestions, setSuggestions] = useState<TwitchUserSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleUsernameChange = (val: string) => {
    setUsername(val)
    setUserId('')
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (val.length >= 2) {
      searchTimer.current = setTimeout(async () => {
        const results = await searchTwitchUsers(val)
        setSuggestions(results)
        setShowSuggestions(results.length > 0)
      }, 300)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const selectSuggestion = (s: TwitchUserSuggestion) => {
    setUsername(s.current_username)
    setUserId(s.twitch_id)
    setSuggestions([])
    setShowSuggestions(false)
  }

  const addMut = useMutation({
    mutationFn: () => addMod(id!, { twitch_user_id: userId, twitch_username: username, role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mods', id] }); setShowForm(false); setUserId(''); setUsername('') },
  })
  const removeMut = useMutation({ mutationFn: (modId: string) => removeMod(id!, modId), onSuccess: () => qc.invalidateQueries({ queryKey: ['mods', id] }) })

  const resetForm = () => { setShowForm(false); setUsername(''); setUserId(''); setSuggestions([]); setShowSuggestions(false) }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{t('mods.title')}</h1>
          <button type="button" onClick={() => setShowHelp(v => !v)} className="text-gray-400 hover:text-purple-600"><HelpCircle className="w-4 h-4" /></button>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" />{t('mods.add')}
        </button>
      </div>

      {showHelp && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm space-y-2">
          <div className="flex justify-between items-start">
            <span className="font-semibold text-blue-700 dark:text-blue-300">Moderatoren</span>
            <button onClick={() => setShowHelp(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
            <p>Hier verwaltest du TCB-Moderatoren für deinen Kanal. Das sind <strong>keine</strong> Twitch-Moderatoren, sondern Nutzer die Zugriff auf dieses Dashboard haben.</p>
            <p><strong>Viewer:</strong> Kann Statistiken und Banlisten einsehen, aber nichts ändern.</p>
            <p><strong>Editor:</strong> Kann Bans, Filter und Befehle verwalten.</p>
            <p>Suche nach dem Twitch-Benutzernamen oder gib die Twitch-ID manuell ein.</p>
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
          <h2 className="font-semibold">{t('mods.add')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <div className="flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder={t('mods.username')}
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              {showSuggestions && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                  {suggestions.map((s) => (
                    <button key={s.twitch_id} onMouseDown={() => selectSuggestion(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between">
                      <span>{s.current_username}</span>
                      <span className="text-xs text-gray-400 font-mono">{s.twitch_id}</span>
                    </button>
                  ))}
                </div>
              )}
              {userId && <p className="text-xs text-green-600 mt-1 font-mono">ID: {userId}</p>}
              {!userId && username.length > 1 && suggestions.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">{t('mods.not_in_db')}</p>
              )}
            </div>
            <div>
              <input value={userId} onChange={(e) => setUserId(e.target.value)}
                placeholder="Twitch ID (manuell)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm" />
            </div>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addMut.mutate()} disabled={!userId.trim() || !username.trim() || addMut.isPending}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50">{t('save')}</button>
            <button onClick={resetForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">{t('cancel')}</button>
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

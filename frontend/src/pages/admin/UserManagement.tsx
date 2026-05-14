import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Ban, UserX, HelpCircle, X } from 'lucide-react'

interface UserItem {
  id: string
  twitch_id: string
  twitch_username: string
  display_name: string
  role: string
  banned: boolean
  avatar_url: string | null
  created_at: string
}

async function fetchUsers(): Promise<UserItem[]> {
  const res = await fetch('/api/admin/users', { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function banUser(id: string) { await fetch(`/api/admin/users/${id}/ban`, { method: 'POST', credentials: 'include' }) }
async function unbanUser(id: string) { await fetch(`/api/admin/users/${id}/unban`, { method: 'POST', credentials: 'include' }) }
async function kickUser(id: string) { await fetch(`/api/admin/users/${id}/kick`, { method: 'POST', credentials: 'include' }) }

export default function UserManagement() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: users = [], isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: fetchUsers })
  const banMut = useMutation({ mutationFn: banUser, onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }) })
  const unbanMut = useMutation({ mutationFn: unbanUser, onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }) })
  const kickMut = useMutation({ mutationFn: kickUser, onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }) })
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold">{t('admin.user_management')}</h1>
        <button type="button" onClick={() => setShowHelp(v => !v)} className="text-gray-400 hover:text-purple-600"><HelpCircle className="w-4 h-4" /></button>
      </div>
      {showHelp && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm space-y-2">
          <div className="flex justify-between items-start">
            <span className="font-semibold text-blue-700 dark:text-blue-300">Nutzerverwaltung</span>
            <button onClick={() => setShowHelp(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
            <p>Alle registrierten Nutzer, die sich per Twitch angemeldet haben.</p>
            <p><strong>Sperren:</strong> Blockiert den Login für diesen Nutzer. Bestehende Sessions werden beim nächsten Request beendet.</p>
            <p><strong>Kick:</strong> Invalidiert alle aktiven Sessions sofort, ohne den Account dauerhaft zu sperren.</p>
            <p><strong>Rollen:</strong> <em>admin</em> = Vollzugriff auf dieses Panel · <em>user</em> = normaler Streamer-Account.</p>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500">{t('loading')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 text-left">{t('user.username')}</th>
                <th className="px-4 py-2 text-left">{t('user.role')}</th>
                <th className="px-4 py-2 text-left">{t('user.status')}</th>
                <th className="px-4 py-2 text-left">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 flex items-center gap-2">
                    {u.avatar_url && <img src={u.avatar_url} className="w-7 h-7 rounded-full" alt="" />}
                    <span className="font-medium">{u.display_name || u.twitch_username}</span>
                  </td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">{u.role}</span></td>
                  <td className="px-4 py-3">
                    {u.banned ? <span className="text-red-500 text-xs font-semibold">GEBANNT</span> : <span className="text-green-500 text-xs">Aktiv</span>}
                  </td>
                  <td className="px-4 py-3 flex gap-2">
                    {u.banned ? (
                      <button onClick={() => unbanMut.mutate(u.id)} className="px-2 py-1 bg-green-600 text-white rounded text-xs">Entsperren</button>
                    ) : (
                      <button onClick={() => banMut.mutate(u.id)} className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded text-xs">
                        <Ban className="w-3 h-3" /> Sperren
                      </button>
                    )}
                    <button onClick={() => kickMut.mutate(u.id)} className="flex items-center gap-1 px-2 py-1 bg-yellow-600 text-white rounded text-xs">
                      <UserX className="w-3 h-3" /> Kick
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

import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'

interface ChatCommand {
  id: string
  name: string
  permission_level: string
  action_type: string
  response_template: string | null
  cooldown_global_seconds: number
  cooldown_user_seconds: number
  enabled: boolean
}

const PERMISSION_LEVELS = ['everyone', 'subscriber', 'vip', 'moderator', 'broadcaster']
const ACTION_TYPES = ['respond', 'ban', 'timeout', 'delete']

async function fetchCommands(tenantId: string): Promise<ChatCommand[]> {
  const res = await fetch(`/api/tenants/${tenantId}/commands`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function deleteCommand(tenantId: string, cmdId: string) {
  await fetch(`/api/tenants/${tenantId}/commands/${cmdId}`, { method: 'DELETE', credentials: 'include' })
}

async function createCommand(tenantId: string, data: Partial<ChatCommand>) {
  const res = await fetch(`/api/tenants/${tenantId}/commands`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

async function updateCommand(tenantId: string, cmdId: string, data: Partial<ChatCommand>) {
  const res = await fetch(`/api/tenants/${tenantId}/commands/${cmdId}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

export default function Commands() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: commands = [], isLoading } = useQuery({ queryKey: ['commands', id], queryFn: () => fetchCommands(id!) })
  const [showForm, setShowForm] = useState(false)
  const [editCmd, setEditCmd] = useState<ChatCommand | null>(null)
  const [form, setForm] = useState({ name: '', permission_level: 'everyone', action_type: 'respond', response_template: '', cooldown_global_seconds: 30, cooldown_user_seconds: 60 })

  const deleteMut = useMutation({ mutationFn: (cmdId: string) => deleteCommand(id!, cmdId), onSuccess: () => qc.invalidateQueries({ queryKey: ['commands', id] }) })
  const saveMut = useMutation({
    mutationFn: () => editCmd ? updateCommand(id!, editCmd.id, form) : createCommand(id!, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commands', id] }); setShowForm(false); setEditCmd(null); setForm({ name: '', permission_level: 'everyone', action_type: 'respond', response_template: '', cooldown_global_seconds: 30, cooldown_user_seconds: 60 }) },
  })

  function openEdit(cmd: ChatCommand) {
    setEditCmd(cmd)
    setForm({ name: cmd.name, permission_level: cmd.permission_level, action_type: cmd.action_type, response_template: cmd.response_template || '', cooldown_global_seconds: cmd.cooldown_global_seconds, cooldown_user_seconds: cmd.cooldown_user_seconds })
    setShowForm(true)
  }

  const permBadge = (p: string) => {
    const colors: Record<string, string> = { everyone: 'bg-gray-100 text-gray-600', subscriber: 'bg-blue-100 text-blue-700', vip: 'bg-yellow-100 text-yellow-700', moderator: 'bg-green-100 text-green-700', broadcaster: 'bg-red-100 text-red-700' }
    return colors[p] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('commands.title')}</h1>
        <button onClick={() => { setEditCmd(null); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" />{t('commands.new')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
          <h2 className="font-semibold">{editCmd ? t('commands.edit') : t('commands.new')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">{t('commands.name')}</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="!command" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('commands.permission')}</label>
              <select value={form.permission_level} onChange={(e) => setForm((f) => ({ ...f, permission_level: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none">
                {PERMISSION_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('commands.action')}</label>
              <select value={form.action_type} onChange={(e) => setForm((f) => ({ ...f, action_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none">
                {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('commands.response')}</label>
              <input value={form.response_template} onChange={(e) => setForm((f) => ({ ...f, response_template: e.target.value }))} placeholder="{user} → ..." className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('commands.cooldown_global')} (s)</label>
              <input type="number" value={form.cooldown_global_seconds} onChange={(e) => setForm((f) => ({ ...f, cooldown_global_seconds: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('commands.cooldown_user')} (s)</label>
              <input type="number" value={form.cooldown_user_seconds} onChange={(e) => setForm((f) => ({ ...f, cooldown_user_seconds: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveMut.mutate()} disabled={!form.name.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm disabled:opacity-50">{t('save')}</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">{t('cancel')}</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-500">{t('loading')}</div>
      ) : commands.length === 0 ? (
        <div className="text-center text-gray-500 py-12">{t('commands.empty')}</div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 text-left">{t('commands.name')}</th>
                <th className="px-4 py-2 text-left">{t('commands.permission')}</th>
                <th className="px-4 py-2 text-left">{t('commands.action')}</th>
                <th className="px-4 py-2 text-left">{t('commands.cooldown_global')}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {commands.map((cmd) => (
                <tr key={cmd.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-mono font-medium">{cmd.name}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${permBadge(cmd.permission_level)}`}>{cmd.permission_level}</span></td>
                  <td className="px-4 py-3 text-gray-500">{cmd.action_type}</td>
                  <td className="px-4 py-3 text-gray-500">{cmd.cooldown_global_seconds}s</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(cmd)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"><Pencil className="w-4 h-4 text-gray-500" /></button>
                      <button onClick={() => deleteMut.mutate(cmd.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

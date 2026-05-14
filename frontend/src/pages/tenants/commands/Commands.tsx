import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Plus, Trash2, Pencil, Info, X, HelpCircle } from 'lucide-react'

const ACTION_INFO: Record<string, string> = {
  respond: 'Sendet eine Chat-Nachricht als Antwort. Im Template können {user} (Aufrufer) und {args} (Parameter) genutzt werden.',
  ban: 'Bannt den Nutzer, der den Befehl aufruft (oder den als Parameter angegebenen User). Nur für Moderatoren sinnvoll.',
  timeout: 'Gibt dem Nutzer einen Timeout. Dauer wird in der Bot-Konfiguration festgelegt.',
  delete: 'Löscht die Nachricht, die den Befehl ausgelöst hat, direkt aus dem Chat.',
  bot_stop: 'Stoppt den Bot für diesen Kanal. Nur mit Broadcaster-Berechtigung empfohlen.',
  bot_restart: 'Startet den Bot neu (Verbindung trennen und wiederherstellen). Nützlich bei Verbindungsproblemen.',
  unban_user: 'Entbannt einen User aus der Ban-Liste. Parameter: Twitch-Username. Beispiel: !unban spambot123',
  test_mode_toggle: '[Beta] Schaltet den Test-Modus des Filters um — Aktionen werden geloggt, aber nicht ausgeführt.',
}

const ACTION_SYNTAX: Record<string, string> = {
  respond: '!befehl [args]  →  gibt {template} aus',
  ban: '!befehl  →  Aufrufer wird gebannt',
  timeout: '!befehl  →  Aufrufer bekommt Timeout',
  delete: '!befehl  →  auslösende Nachricht wird gelöscht',
  bot_stop: '!befehl  →  Bot verlässt den Kanal',
  bot_restart: '!befehl  →  Bot Verbindung wird neu aufgebaut',
  unban_user: '!befehl <username>  →  User aus Ban-Liste entfernen',
  test_mode_toggle: '!befehl  →  Filter-Test-Modus an/aus',
}

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
const ACTION_TYPES = ['respond', 'ban', 'timeout', 'delete', 'bot_stop', 'bot_restart', 'unban_user', 'test_mode_toggle']

async function fetchCommands(tenantId: string): Promise<ChatCommand[]> {
  const res = await fetch(`/api/tenants/${tenantId}/commands`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  const data = await res.json()
  // map backend field names → frontend interface
  return data.map((c: Record<string, unknown>) => ({
    id: c.id as string,
    name: c.command_name as string,
    permission_level: c.permission_level as string,
    action_type: c.action_type as string,
    response_template: (c.response_template as string | null) ?? null,
    cooldown_global_seconds: c.global_cooldown_sec as number,
    cooldown_user_seconds: c.user_cooldown_sec as number,
    enabled: c.enabled as boolean,
  }))
}

async function deleteCommand(tenantId: string, cmdId: string) {
  await fetch(`/api/tenants/${tenantId}/commands/${cmdId}`, { method: 'DELETE', credentials: 'include' })
}

async function createCommand(tenantId: string, data: Partial<ChatCommand>) {
  const res = await fetch(`/api/tenants/${tenantId}/commands`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command_name: data.name,
      permission_level: data.permission_level,
      action_type: data.action_type,
      response_template: data.response_template || null,
      global_cooldown_sec: data.cooldown_global_seconds,
      user_cooldown_sec: data.cooldown_user_seconds,
      enabled: data.enabled ?? true,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
}

async function updateCommand(tenantId: string, cmdId: string, data: Partial<ChatCommand>) {
  const res = await fetch(`/api/tenants/${tenantId}/commands/${cmdId}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command_name: data.name,
      permission_level: data.permission_level,
      action_type: data.action_type,
      response_template: data.response_template || null,
      global_cooldown_sec: data.cooldown_global_seconds,
      user_cooldown_sec: data.cooldown_user_seconds,
      enabled: data.enabled,
    }),
  })
  if (!res.ok) throw new Error(await res.text())
}

export default function Commands() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editCmd, setEditCmd] = useState<ChatCommand | null>(null)
  const [form, setForm] = useState({ name: '', permission_level: 'everyone', action_type: 'respond', response_template: '', cooldown_global_seconds: 30, cooldown_user_seconds: 60, enabled: true })
  const [showActionInfo, setShowActionInfo] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showTemplateHelp, setShowTemplateHelp] = useState(false)

  const deleteMut = useMutation({ mutationFn: (cmdId: string) => deleteCommand(id!, cmdId), onSuccess: () => qc.invalidateQueries({ queryKey: ['commands', id] }) })
  const { data: commands = [], isLoading } = useQuery({ queryKey: ['commands', id], queryFn: () => fetchCommands(id!) })
  const saveMut = useMutation({
    mutationFn: () => editCmd ? updateCommand(id!, editCmd.id, form) : createCommand(id!, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['commands', id] }); setShowForm(false); setEditCmd(null); setForm({ name: '', permission_level: 'everyone', action_type: 'respond', response_template: '', cooldown_global_seconds: 30, cooldown_user_seconds: 60, enabled: true }) },
    onError: (e: Error) => alert(e.message),
  })

  const toggleEnabledMut = useMutation({
    mutationFn: (cmd: ChatCommand) => updateCommand(id!, cmd.id, { enabled: !cmd.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['commands', id] }),
    onError: (e: Error) => alert(e.message),
  })

  function openEdit(cmd: ChatCommand) {
    setEditCmd(cmd)
    setForm({ name: cmd.name, permission_level: cmd.permission_level, action_type: cmd.action_type, response_template: cmd.response_template || '', cooldown_global_seconds: cmd.cooldown_global_seconds, cooldown_user_seconds: cmd.cooldown_user_seconds, enabled: cmd.enabled })
    setShowForm(true)
  }

  const permBadge = (p: string) => {
    const colors: Record<string, string> = { everyone: 'bg-gray-100 text-gray-600', subscriber: 'bg-blue-100 text-blue-700', vip: 'bg-yellow-100 text-yellow-700', moderator: 'bg-green-100 text-green-700', broadcaster: 'bg-red-100 text-red-700' }
    return colors[p] || 'bg-gray-100 text-gray-600'
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{t('commands.title')}</h1>
          <button type="button" onClick={() => setShowHelp(v => !v)} className="text-gray-400 hover:text-purple-600" title="Hilfe">
            <Info className="w-4 h-4" />
          </button>
        </div>
        <button onClick={() => { setEditCmd(null); setForm({ name: '', permission_level: 'everyone', action_type: 'respond', response_template: '', cooldown_global_seconds: 30, cooldown_user_seconds: 60, enabled: true }); setShowForm(true) }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" />{t('commands.new')}
        </button>
      </div>
      {showHelp && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm space-y-2">
          <div className="flex justify-between items-start">
            <span className="font-semibold text-blue-700 dark:text-blue-300">{t('help.commands.title')}</span>
            <button onClick={() => setShowHelp(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
            <p dangerouslySetInnerHTML={{ __html: t('help.commands.p1') }} />
            <ul className="ml-3 space-y-0.5 font-mono text-xs">
              <li>{t('help.commands.li1')}</li>
              <li>{t('help.commands.li2')}</li>
              <li>{t('help.commands.li3')}</li>
              <li>{t('help.commands.li4')}</li>
              <li>{t('help.commands.li5')}</li>
            </ul>
            <p dangerouslySetInnerHTML={{ __html: t('help.commands.p2') }} />
            <p dangerouslySetInnerHTML={{ __html: t('help.commands.p3') }} />
            <p dangerouslySetInnerHTML={{ __html: t('help.commands.p4') }} />
            <p dangerouslySetInnerHTML={{ __html: t('help.commands.p5') }} />
          </div>
        </div>
      )}

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
              <select value={form.permission_level} onChange={(e) => setForm((f) => ({ ...f, permission_level: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none">
                {PERMISSION_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 flex items-center gap-1">
                {t('commands.action')}
                <button type="button" onClick={() => setShowActionInfo(v => !v)} className="text-gray-400 hover:text-purple-600">
                  <Info className="w-3.5 h-3.5" />
                </button>
              </label>
              {showActionInfo && (
                <div className="mb-2 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-xs space-y-1.5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-purple-700 dark:text-purple-300">Aktionen erklärt</span>
                    <button onClick={() => setShowActionInfo(false)}><X className="w-3.5 h-3.5 text-gray-400" /></button>
                  </div>
                  {Object.entries(ACTION_INFO).map(([key, desc]) => (
                    <div key={key}><span className="font-mono font-semibold">{key}</span>: <span className="text-gray-600 dark:text-gray-400">{desc}</span></div>
                  ))}
                </div>
              )}
              <select value={form.action_type} onChange={(e) => setForm((f) => ({ ...f, action_type: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none">
                {ACTION_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              {/* Syntax preview */}
              {ACTION_SYNTAX[form.action_type] && (
                <p className="mt-1.5 px-2 py-1 bg-gray-50 dark:bg-gray-800 rounded font-mono text-[11px] text-gray-500 dark:text-gray-400">
                  {ACTION_SYNTAX[form.action_type]}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 flex items-center gap-1">
                {t('commands.response')}
                <button type="button" onClick={() => setShowTemplateHelp(v => !v)} className="text-gray-400 hover:text-purple-600" title="Verfügbare Variablen">
                  <HelpCircle className="w-3 h-3" />
                </button>
              </label>
              {showTemplateHelp && (
                <div className="mb-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs space-y-1.5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">Verfügbare Variablen</span>
                    <button onClick={() => setShowTemplateHelp(false)}><X className="w-3 h-3 text-gray-400" /></button>
                  </div>
                  <div><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">{'{user}'}</span> <span className="text-gray-600 dark:text-gray-400">— Twitch-Username des Befehlsaufrufers</span></div>
                  <div><span className="font-mono bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded">{'{args}'}</span> <span className="text-gray-600 dark:text-gray-400">— alle Parameter nach dem Befehlsnamen (leerzeichen-getrennt)</span></div>
                </div>
              )}
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
            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  className="w-4 h-4 accent-purple-600"
                />
                Befehl aktiviert
              </label>
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
                <th className="px-4 py-2 text-left">Status</th>
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
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleEnabledMut.mutate(cmd)}
                      className={`px-2 py-1 rounded text-xs border ${cmd.enabled ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-300 text-gray-500 bg-gray-50'}`}
                    >
                      {cmd.enabled ? 'Aktiv' : 'Deaktiviert'}
                    </button>
                  </td>
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

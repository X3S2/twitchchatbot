import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Save, Eye, EyeOff } from 'lucide-react'

interface AppSettings {
  twitch_client_id: string
  twitch_client_secret: string
  bot_default_username: string
  bot_default_token: string
  maintenance_mode: boolean
  maintenance_message: string
  require_approval: boolean
}

async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch('/api/admin/settings', { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function saveSettings(data: AppSettings) {
  const res = await fetch('/api/admin/settings', {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export default function AdminSettings() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['admin-settings'], queryFn: fetchSettings })
  const [form, setForm] = useState<AppSettings | null>(null)
  const [showClientSecret, setShowClientSecret] = useState(false)
  const [showBotToken, setShowBotToken] = useState(false)
  const [saved, setSaved] = useState(false)

  if (data && !form) setForm(data)

  const saveMut = useMutation({
    mutationFn: () => saveSettings(form!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-settings'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  const set = (key: keyof AppSettings, value: unknown) => setForm((f) => f ? { ...f, [key]: value } : f)

  if (isLoading || !form) return <div className="p-6 text-center text-gray-500">{t('loading')}</div>

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">{t('admin.settings_title')}</h1>

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <h2 className="font-semibold">{t('admin.twitch_app')}</h2>
        <Field label="Client ID">
          <input value={form.twitch_client_id} onChange={(e) => set('twitch_client_id', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Client Secret">
          <div className="relative">
            <input type={showClientSecret ? 'text' : 'password'} value={form.twitch_client_secret} onChange={(e) => set('twitch_client_secret', e.target.value)} className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowClientSecret((v) => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
              {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
      </section>

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <h2 className="font-semibold">{t('admin.shared_bot')}</h2>
        <Field label={t('admin.bot_username')}>
          <input value={form.bot_default_username} onChange={(e) => set('bot_default_username', e.target.value)} className={inputCls} />
        </Field>
        <Field label={t('admin.bot_token')}>
          <div className="relative">
            <input type={showBotToken ? 'text' : 'password'} value={form.bot_default_token} onChange={(e) => set('bot_default_token', e.target.value)} className={`${inputCls} pr-10`} />
            <button type="button" onClick={() => setShowBotToken((v) => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
              {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </Field>
      </section>

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <h2 className="font-semibold">{t('admin.platform')}</h2>
        <Field label={t('admin.require_approval')}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.require_approval} onChange={(e) => set('require_approval', e.target.checked)} className="w-4 h-4 accent-purple-600" />
            <span className="text-sm">{t('admin.require_approval_hint')}</span>
          </label>
        </Field>
        <Field label={t('admin.maintenance_mode')}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.maintenance_mode} onChange={(e) => set('maintenance_mode', e.target.checked)} className="w-4 h-4 accent-yellow-500" />
            <span className="text-sm">{t('admin.maintenance_mode_hint')}</span>
          </label>
        </Field>
        {form.maintenance_mode && (
          <Field label={t('admin.maintenance_message')}>
            <textarea value={form.maintenance_message} onChange={(e) => set('maintenance_message', e.target.value)} rows={3} className={inputCls} />
          </Field>
        )}
      </section>

      <div className="flex items-center gap-3">
        <button onClick={() => saveMut.mutate()} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Save className="w-4 h-4" />{t('save')}
        </button>
        {saved && <span className="text-green-600 text-sm">{t('settings.saved')}</span>}
      </div>
    </div>
  )
}

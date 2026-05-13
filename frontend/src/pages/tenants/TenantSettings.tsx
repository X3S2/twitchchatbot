import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Save, Eye, EyeOff, CheckCircle } from 'lucide-react'

interface TenantSettingsData {
  display_name: string
  bot_mode: string
  own_bot_username: string | null
  own_bot_token_set: boolean
  own_client_id_set: boolean
  own_client_secret_set: boolean
  stream_awareness: boolean
  bot_language: string
  reconnect_mode: string
  reconnect_max_attempts: number
  retention_days: number
  new_mod_default_role: string
}

interface TenantSettingsForm {
  display_name: string
  bot_mode: string
  own_bot_username: string
  own_bot_token: string
  own_client_id: string
  own_client_secret: string
  stream_awareness: boolean
  bot_language: string
  reconnect_mode: string
  reconnect_max_attempts: number
  retention_days: number
  new_mod_default_role: string
}

async function fetchSettings(tenantId: string): Promise<TenantSettingsData> {
  const res = await fetch(`/api/tenants/${tenantId}/settings`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function saveSettings(tenantId: string, data: Partial<TenantSettingsForm>) {
  // Strip empty credential fields so backend keeps existing values
  const payload: Record<string, unknown> = { ...data }
  if (!payload.own_bot_token) delete payload.own_bot_token
  if (!payload.own_client_id) delete payload.own_client_id
  if (!payload.own_client_secret) delete payload.own_client_secret
  const res = await fetch(`/api/tenants/${tenantId}/settings`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default function TenantSettings() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [showToken, setShowToken] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [saved, setSaved] = useState(false)

  const { data, isLoading } = useQuery({ queryKey: ['tenant-settings', id], queryFn: () => fetchSettings(id!) })
  const [form, setForm] = useState<TenantSettingsForm | null>(null)
  const [formInit, setFormInit] = useState(false)

  if (data && !formInit) {
    setForm({
      display_name: data.display_name,
      bot_mode: data.bot_mode,
      own_bot_username: data.own_bot_username || '',
      own_bot_token: '',
      own_client_id: '',
      own_client_secret: '',
      stream_awareness: data.stream_awareness,
      bot_language: data.bot_language,
      reconnect_mode: data.reconnect_mode,
      reconnect_max_attempts: data.reconnect_max_attempts,
      retention_days: data.retention_days,
      new_mod_default_role: data.new_mod_default_role,
    })
    setFormInit(true)
  }

  const saveMut = useMutation({
    mutationFn: () => saveSettings(id!, form!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant-settings', id] })
      setFormInit(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const set = (key: keyof TenantSettingsForm, value: unknown) =>
    setForm((f) => f ? { ...f, [key]: value } : f)

  if (isLoading || !form || !data) return <div className="p-6 text-center text-gray-500">{t('loading')}</div>

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <h2 className="font-semibold">{t('settings.general')}</h2>
        <Field label={t('settings.display_name')}>
          <input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} className={inputCls} />
        </Field>
        <Field label={t('settings.bot_mode')}>
          <select value={form.bot_mode} onChange={(e) => set('bot_mode', e.target.value)} className={inputCls}>
            <option value="shared">Shared Bot</option>
            <option value="own_bot">Eigener Bot-Account</option>
            <option value="own_full">Eigener Bot + eigene App-Credentials</option>
          </select>
        </Field>
        <Field label={t('settings.bot_language')}>
          <select value={form.bot_language} onChange={(e) => set('bot_language', e.target.value)} className={inputCls}>
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Field label={t('settings.stream_awareness')}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.stream_awareness} onChange={(e) => set('stream_awareness', e.target.checked)} className="w-4 h-4 accent-purple-600" />
            <span className="text-sm">{t('settings.stream_awareness_hint')}</span>
          </label>
        </Field>
        <Field label={t('settings.retention_days')}>
          <input type="number" min={1} max={365} value={form.retention_days} onChange={(e) => set('retention_days', Number(e.target.value))} className={inputCls} />
        </Field>
        <Field label={t('settings.new_mod_default_role')}>
          <select value={form.new_mod_default_role} onChange={(e) => set('new_mod_default_role', e.target.value)} className={inputCls}>
            <option value="viewer">Viewer (nur Lesen)</option>
            <option value="editor">Editor (Bearbeiten)</option>
          </select>
        </Field>
      </section>

      {form.bot_mode !== 'shared' && (
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
          <h2 className="font-semibold">{t('settings.bot_credentials')}</h2>
          <Field label={t('settings.own_bot_username')}>
            <input value={form.own_bot_username} onChange={(e) => set('own_bot_username', e.target.value)} className={inputCls} />
          </Field>
          <Field label={t('settings.own_bot_token')}>
            <div className="relative">
              <input type={showToken ? 'text' : 'password'} value={form.own_bot_token} onChange={(e) => set('own_bot_token', e.target.value)}
                placeholder={data.own_bot_token_set ? '••••••••••••••••' : t('settings.token_placeholder')} className={`${inputCls} pr-10`} />
              <button type="button" onClick={() => setShowToken((v) => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {data.own_bot_token_set && !form.own_bot_token && (
              <p className="flex items-center gap-1 text-xs text-green-600 mt-1"><CheckCircle className="w-3 h-3" />{t('settings.already_set')}</p>
            )}
          </Field>
          {form.bot_mode === 'own_full' && (
            <>
              <Field label={t('settings.own_client_id')}>
                <input value={form.own_client_id} onChange={(e) => set('own_client_id', e.target.value)}
                  placeholder={data.own_client_id_set ? '••••••••••••••••' : ''} className={inputCls} />
                {data.own_client_id_set && !form.own_client_id && (
                  <p className="flex items-center gap-1 text-xs text-green-600 mt-1"><CheckCircle className="w-3 h-3" />{t('settings.already_set')}</p>
                )}
              </Field>
              <Field label={t('settings.own_client_secret')}>
                <div className="relative">
                  <input type={showSecret ? 'text' : 'password'} value={form.own_client_secret} onChange={(e) => set('own_client_secret', e.target.value)}
                    placeholder={data.own_client_secret_set ? '••••••••••••••••' : ''} className={`${inputCls} pr-10`} />
                  <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {data.own_client_secret_set && !form.own_client_secret && (
                  <p className="flex items-center gap-1 text-xs text-green-600 mt-1"><CheckCircle className="w-3 h-3" />{t('settings.already_set')}</p>
                )}
              </Field>
            </>
          )}
        </section>
      )}

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <h2 className="font-semibold">{t('settings.reconnect')}</h2>
        <Field label={t('settings.reconnect_mode')}>
          <select value={form.reconnect_mode} onChange={(e) => set('reconnect_mode', e.target.value)} className={inputCls}>
            <option value="auto">Auto</option>
            <option value="manual">Manual</option>
          </select>
        </Field>
        <Field label={t('settings.reconnect_max_attempts')}>
          <input type="number" min={0} value={form.reconnect_max_attempts} onChange={(e) => set('reconnect_max_attempts', Number(e.target.value))} className={inputCls} />
        </Field>
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

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {children}
    </div>
  )
}




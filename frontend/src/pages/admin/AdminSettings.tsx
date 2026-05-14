import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Save, Eye, EyeOff, CheckCircle, FlaskConical, HelpCircle, X } from 'lucide-react'

interface AppSettingsData {
  client_id_set: boolean
  client_secret_set: boolean
  bot_username: string | null
  bot_token_set: boolean
  bot_refresh_token_set: boolean
  global_retention_days: number
  maintenance_mode: boolean
  maintenance_message: string | null
}

interface AppSettingsForm {
  client_id: string
  client_secret: string
  bot_username: string
  bot_token: string
  bot_refresh_token: string
  global_retention_days: number
  maintenance_mode: boolean
  maintenance_message: string
}

interface TestCredentialsResult {
  ok: boolean
  error?: string
  client_id?: string
  login?: string
  expires_in?: number
  scopes?: string[]
  refreshed?: boolean
}

async function fetchSettings(): Promise<AppSettingsData> {
  const res = await fetch('/api/admin/settings', { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function saveSettings(data: AppSettingsForm) {
  const payload: Record<string, unknown> = {
    global_retention_days: data.global_retention_days,
    maintenance_mode: data.maintenance_mode,
    maintenance_message: data.maintenance_message,
  }
  if (data.client_id) payload.client_id = data.client_id
  if (data.client_secret) payload.client_secret = data.client_secret
  if (data.bot_username) payload.bot_username = data.bot_username
  if (data.bot_token) payload.bot_token = data.bot_token
  if (data.bot_refresh_token) payload.bot_refresh_token = data.bot_refresh_token
  const res = await fetch('/api/admin/settings', {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
}

async function testCredentials(): Promise<TestCredentialsResult> {
  const res = await fetch('/api/admin/test-credentials', { method: 'POST', credentials: 'include' })
  return res.json()
}

async function testBotToken(): Promise<TestCredentialsResult> {
  const res = await fetch('/api/admin/test-bot-token', { method: 'POST', credentials: 'include' })
  return res.json()
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'

function formatExpiry(expires_in: number | undefined): string {
  const secs = expires_in ?? 0
  if (secs <= 0) return 'abgelaufen'
  if (secs < 3600) return `${Math.round(secs / 60)}min`
  return `${Math.round(secs / 3600)}h`
}

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
  const [form, setForm] = useState<AppSettingsForm | null>(null)
  const [formInit, setFormInit] = useState(false)
  const [showClientSecret, setShowClientSecret] = useState(false)
  const [showBotToken, setShowBotToken] = useState(false)
  const [showBotRefreshToken, setShowBotRefreshToken] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testResult, setTestResult] = useState<TestCredentialsResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [testBotResult, setTestBotResult] = useState<TestCredentialsResult | null>(null)
  const [testingBot, setTestingBot] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  if (data && !formInit) {
    setForm({
      client_id: '',
      client_secret: '',
      bot_username: data.bot_username || '',
      bot_token: '',
      bot_refresh_token: '',
      global_retention_days: data.global_retention_days,
      maintenance_mode: data.maintenance_mode,
      maintenance_message: data.maintenance_message || '',
    })
    setFormInit(true)
  }

  const saveMut = useMutation({
    mutationFn: () => saveSettings(form!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      setFormInit(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await testCredentials()
    setTestResult(result)
    setTesting(false)
  }

  const handleTestBotToken = async () => {
    setTestingBot(true)
    setTestBotResult(null)
    const result = await testBotToken()
    setTestBotResult(result)
    setTestingBot(false)
  }

  const set = (key: keyof AppSettingsForm, value: unknown) =>
    setForm((f) => f ? { ...f, [key]: value } : f)

  if (isLoading || !form || !data) return <div className="p-6 text-center text-gray-500">{t('loading')}</div>

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{t('admin.settings_title')}</h1>
        <button type="button" onClick={() => setShowHelp(v => !v)} className="text-gray-400 hover:text-purple-600"><HelpCircle className="w-4 h-4" /></button>
      </div>
      {showHelp && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm space-y-2">
          <div className="flex justify-between items-start">
            <span className="font-semibold text-blue-700 dark:text-blue-300">{t('help.admin_settings.title')}</span>
            <button onClick={() => setShowHelp(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
            <p dangerouslySetInnerHTML={{ __html: t('help.admin_settings.p1') }} />
            <p dangerouslySetInnerHTML={{ __html: t('help.admin_settings.p2') }} />
            <p dangerouslySetInnerHTML={{ __html: t('help.admin_settings.p3') }} />
            <p dangerouslySetInnerHTML={{ __html: t('help.admin_settings.p4') }} />
          </div>
        </div>
      )}

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <h2 className="font-semibold">{t('admin.twitch_app')}</h2>
        <p className="text-xs text-gray-500">{t('admin.credentials_hint')}</p>
        <Field label="Client ID">
          <input value={form.client_id} onChange={(e) => set('client_id', e.target.value)}
            placeholder={data.client_id_set ? '••••••••••••••••' : ''} className={inputCls} />
          {data.client_id_set && !form.client_id && (
            <p className="flex items-center gap-1 text-xs text-green-600 mt-1"><CheckCircle className="w-3 h-3" />{t('settings.already_set')}</p>
          )}
        </Field>
        <Field label="Client Secret">
          <div className="relative">
            <input type={showClientSecret ? 'text' : 'password'} value={form.client_secret} onChange={(e) => set('client_secret', e.target.value)}
              placeholder={data.client_secret_set ? '••••••••••••••••' : ''} className={`${inputCls} pr-10`} />
            {form.client_secret && (
              <button type="button" onClick={() => setShowClientSecret((v) => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          {data.client_secret_set && !form.client_secret && (
            <p className="flex items-center gap-1 text-xs text-green-600 mt-1"><CheckCircle className="w-3 h-3" />{t('settings.already_set')}</p>
          )}
        </Field>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={handleTest} disabled={testing}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
            <FlaskConical className="w-4 h-4" />
            {testing ? t('admin.testing') : t('admin.test_credentials')}
          </button>
          {testResult && (
            <span className={`text-xs font-medium ${testResult.ok ? 'text-green-600' : 'text-red-500'}`}>
              {testResult.ok
                ? `✓ ${t('admin.credentials_ok')} (${formatExpiry(testResult.expires_in)})`
                : `✗ ${testResult.error || t('admin.credentials_fail')}`}
            </span>
          )}
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <h2 className="font-semibold">{t('admin.shared_bot')}</h2>
        <Field label={t('admin.bot_username')}>
          <input value={form.bot_username} onChange={(e) => set('bot_username', e.target.value)} className={inputCls} />
        </Field>
        <Field label={t('admin.bot_token')}>
          <div className="relative">
            <input type={showBotToken ? 'text' : 'password'} value={form.bot_token} onChange={(e) => set('bot_token', e.target.value)}
              placeholder={data.bot_token_set ? '••••••••••••••••' : ''} className={`${inputCls} pr-10`} />
            {form.bot_token && (
              <button type="button" onClick={() => setShowBotToken((v) => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                {showBotToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          {data.bot_token_set && !form.bot_token && (
            <p className="flex items-center gap-1 text-xs text-green-600 mt-1"><CheckCircle className="w-3 h-3" />{t('settings.already_set')}</p>
          )}
        </Field>
        <Field label={t('admin.bot_refresh_token')}>
          <div className="relative">
            <input type={showBotRefreshToken ? 'text' : 'password'} value={form.bot_refresh_token} onChange={(e) => set('bot_refresh_token', e.target.value)}
              placeholder={data.bot_refresh_token_set ? '••••••••••••••••' : ''} className={`${inputCls} pr-10`} />
            {form.bot_refresh_token && (
              <button type="button" onClick={() => setShowBotRefreshToken((v) => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
                {showBotRefreshToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">{t('admin.bot_refresh_token_hint')}</p>
          {data.bot_refresh_token_set && !form.bot_refresh_token && (
            <p className="flex items-center gap-1 text-xs text-green-600 mt-1"><CheckCircle className="w-3 h-3" />{t('settings.already_set')}</p>
          )}
        </Field>
        {data.bot_token_set && (
          <div className="flex items-center gap-3 pt-1">
            <button onClick={handleTestBotToken} disabled={testingBot}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
              <FlaskConical className="w-4 h-4" />
              {testingBot ? t('admin.testing') : t('admin.test_bot_token')}
            </button>
            {testBotResult && (
              <span className={`text-xs font-medium ${testBotResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                {testBotResult.ok
                  ? `✓ @${testBotResult.login}${testBotResult.refreshed ? ' (automatisch erneuert)' : ''} (${formatExpiry(testBotResult.expires_in)})`
                  : `✗ ${testBotResult.error || t('admin.credentials_fail')}`}
              </span>
            )}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <h2 className="font-semibold">{t('admin.platform')}</h2>
        <Field label={t('settings.retention_days')}>
          <input type="number" min={1} max={730} value={form.global_retention_days} onChange={(e) => set('global_retention_days', Number(e.target.value))} className={inputCls} />
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

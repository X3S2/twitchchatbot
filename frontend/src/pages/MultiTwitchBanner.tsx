import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { Ban, Plus, Trash2, Loader } from 'lucide-react'

const BAN_REASONS = [
  'Hass & Hetze',
  'Rassismus / Diskriminierung',
  'Mobbing / Harassment',
  'Spam / Bot-Account',
  'Doxxing / Privatsphäre-Verletzung',
  'Ban-Evasion',
  'Sonstiges',
]

interface ChannelEntry {
  channel: string
  status: 'pending' | 'success' | 'error'
  message?: string
}

async function banOnChannel(username: string, channel: string, reason: string, token: string): Promise<void> {
  const res = await fetch(`/api/multi-ban`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_username: username, channel, reason, token: token || undefined }),
  })
  if (!res.ok) throw new Error((await res.json()).detail || 'Fehler')
}

export default function MultiTwitchBanner() {
  const { t } = useTranslation()
  const [target, setTarget] = useState('')
  const [reason, setReason] = useState(BAN_REASONS[0])
  const [customReason, setCustomReason] = useState('')
  const [channels, setChannels] = useState<string[]>([''])
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [results, setResults] = useState<ChannelEntry[]>([])
  const [running, setRunning] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const effectiveReason = reason === 'Sonstiges' ? customReason : reason

  function addChannel() { setChannels((c) => [...c, '']) }
  function removeChannel(i: number) { setChannels((c) => c.filter((_, idx) => idx !== i)) }
  function setChannel(i: number, val: string) { setChannels((c) => { const n = [...c]; n[i] = val; return n }) }

  const validChannels = channels.map((c) => c.trim().toLowerCase()).filter(Boolean)

  async function executeBans() {
    if (!target.trim() || validChannels.length === 0 || !effectiveReason.trim()) return
    setRunning(true)
    setConfirmed(false)
    const res: ChannelEntry[] = validChannels.map((ch) => ({ channel: ch, status: 'pending' as const }))
    setResults([...res])
    for (let i = 0; i < res.length; i++) {
      try {
        await banOnChannel(target.trim(), res[i].channel, effectiveReason, token)
        res[i] = { ...res[i], status: 'success' }
      } catch (e: unknown) {
        res[i] = { ...res[i], status: 'error', message: (e as Error).message }
      }
      setResults([...res])
    }
    setRunning(false)
  }

  const successCount = results.filter((r) => r.status === 'success').length
  const errorCount = results.filter((r) => r.status === 'error').length

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Ban className="w-6 h-6 text-red-500" />
        <h1 className="text-2xl font-bold">{t('mtb.title')}</h1>
      </div>
      <p className="text-sm text-gray-500">{t('mtb.description')}</p>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <h2 className="font-semibold">{t('mtb.target')}</h2>
        <div>
          <label className="block text-sm font-medium mb-1.5">{t('mtb.username')}</label>
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="twitchusername" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">{t('mtb.reason')}</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls}>
            {BAN_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {reason === 'Sonstiges' && (
            <input value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder={t('mtb.custom_reason')} className={`${inputCls} mt-2`} />
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{t('mtb.channels')}</h2>
          <button onClick={addChannel} className="flex items-center gap-1 text-sm text-purple-600 hover:underline">
            <Plus className="w-4 h-4" />{t('mtb.add_channel')}
          </button>
        </div>
        {channels.map((ch, i) => (
          <div key={i} className="flex gap-2">
            <input value={ch} onChange={(e) => setChannel(i, e.target.value)} placeholder={t('mtb.channel_placeholder')} className={`${inputCls} flex-1`} />
            {channels.length > 1 && (
              <button onClick={() => removeChannel(i)} className="p-2 hover:bg-red-50 rounded-lg text-red-500">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
        <h2 className="font-semibold">{t('mtb.token_optional')}</h2>
        <p className="text-xs text-gray-500">{t('mtb.token_hint')}</p>
        <div className="relative">
          <input type={showToken ? 'text' : 'password'} value={token} onChange={(e) => setToken(e.target.value)}
            placeholder="oauth:..." className={`${inputCls} pr-10`} />
          <button type="button" onClick={() => setShowToken((v) => !v)} className="absolute right-2 top-2 text-gray-400 hover:text-gray-600">
            {showToken ? '👁' : '🙈'}
          </button>
        </div>
      </div>

      {/* Confirmation + Execute */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-3">
        <p className="text-sm text-red-700 dark:text-red-400 font-medium">
          {t('mtb.confirm_text', { count: validChannels.length, user: target || '–', reason: effectiveReason || '–' })}
        </p>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="w-4 h-4 accent-red-600" />
          <span className="text-sm">{t('mtb.confirm_checkbox')}</span>
        </label>
        <button
          onClick={executeBans}
          disabled={!confirmed || !target.trim() || validChannels.length === 0 || !effectiveReason.trim() || running}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-40"
        >
          {running ? <Loader className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
          {t('mtb.execute', { count: validChannels.length })}
        </button>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('mtb.results')}</h2>
            <div className="flex gap-3 text-sm">
              {successCount > 0 && <span className="text-green-600">✓ {successCount}</span>}
              {errorCount > 0 && <span className="text-red-600">✗ {errorCount}</span>}
            </div>
          </div>
          <div className="space-y-1.5">
            {results.map((r) => (
              <div key={r.channel} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className="font-medium">#{r.channel}</span>
                <div className="flex items-center gap-2">
                  {r.status === 'pending' && <Loader className="w-4 h-4 animate-spin text-gray-400" />}
                  {r.status === 'success' && <span className="text-green-600 text-xs font-medium">{t('mtb.banned')}</span>}
                  {r.status === 'error' && <span className="text-red-600 text-xs">{r.message || t('mtb.error')}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'

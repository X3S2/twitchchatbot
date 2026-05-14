import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface Stats {
  period: string
  bans_by_day: { day: string; count: number }[]
  timeouts_by_day: { day: string; count: number }[]
  top_filters: { filter_name: string; hits: number }[]
  top_terms: { term: string; hits: number }[]
  totals: { bans: number; timeouts: number; filter_hits: number }
}

async function fetchStats(id: string, period: string): Promise<Stats> {
  const res = await fetch(`/api/tenants/${id}/stats?period=${period}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

export default function StatsPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week')
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', id, period],
    queryFn: () => fetchStats(id!, period),
  })

  // Merge bans + timeouts by day for combined chart
  const chartData = (() => {
    if (!stats) return []
    const map: Record<string, { day: string; bans: number; timeouts: number }> = {}
    for (const d of stats.bans_by_day) {
      map[d.day] = { day: d.day, bans: d.count, timeouts: 0 }
    }
    for (const d of stats.timeouts_by_day) {
      if (!map[d.day]) map[d.day] = { day: d.day, bans: 0, timeouts: d.count }
      else map[d.day].timeouts = d.count
    }
    return Object.values(map).sort((a, b) => a.day.localeCompare(b.day))
  })()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('stats.title')}</h1>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1 rounded-lg text-sm ${period === p ? 'bg-purple-600 text-white' : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
              {t(`stats.period_${p}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center text-gray-500">{t('loading')}</div>
      ) : stats ? (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: t('stats.total_bans'), value: stats.totals.bans, color: 'text-red-500' },
              { label: t('stats.total_timeouts'), value: stats.totals.timeouts, color: 'text-yellow-500' },
              { label: t('stats.filter_hits'), value: stats.totals.filter_hits, color: 'text-purple-500' },
            ].map((s) => (
              <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <p className={`text-3xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <h2 className="font-semibold mb-4">{t('stats.bans_over_time')}</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  cursor={{ fill: 'rgba(139,92,246,0.08)' }}
                  allowEscapeViewBox={{ x: true, y: true }}
                  contentStyle={isDark
                    ? { background: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#f3f4f6' }
                    : { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#111827' }}
                />
                <Legend />
                <Bar dataKey="bans" fill="#ef4444" name={t('stats.bans')} />
                <Bar dataKey="timeouts" fill="#f59e0b" name={t('stats.timeouts')} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Filters + Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <h2 className="font-semibold mb-3">{t('stats.top_filters')}</h2>
              {stats.top_filters.length === 0 ? (
                <p className="text-sm text-gray-400">{t('stats.no_data')}</p>
              ) : stats.top_filters.map((f) => (
                <div key={f.filter_name} className="flex items-center justify-between py-1 text-sm">
                  <span className="truncate">{f.filter_name}</span>
                  <span className="font-semibold ml-2">{f.hits}</span>
                </div>
              ))}
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <h2 className="font-semibold mb-3">{t('stats.top_terms')}</h2>
              {stats.top_terms.length === 0 ? (
                <p className="text-sm text-gray-400">{t('stats.no_data')}</p>
              ) : stats.top_terms.map((t2) => (
                <div key={t2.term} className="flex items-center justify-between py-1 text-sm">
                  <span className="font-mono truncate">{t2.term}</span>
                  <span className="font-semibold ml-2">{t2.hits}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

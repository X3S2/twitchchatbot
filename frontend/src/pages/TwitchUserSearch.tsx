import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Search, ExternalLink } from 'lucide-react'

interface TwitchUser {
  twitch_id: string
  current_username: string
  avatar_url: string | null
  first_seen: string
  last_seen: string
}

interface BanRecord {
  tenant_id: string
  type: string
  reason: string | null
  created_at: string
}

async function searchUsers(q: string): Promise<TwitchUser[]> {
  if (q.length < 2) return []
  const res = await fetch(`/api/twitch-users?q=${encodeURIComponent(q)}`, { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

async function fetchUserDetail(twitch_id: string): Promise<TwitchUser> {
  const res = await fetch(`/api/twitch-users/${twitch_id}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function fetchUserBans(twitch_id: string): Promise<BanRecord[]> {
  const res = await fetch(`/api/twitch-users/${twitch_id}/bans`, { credentials: 'include' })
  if (res.status === 403) return [] // non-admin gets 403
  if (!res.ok) return []
  return res.json()
}

export default function TwitchUserSearch() {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)

  const { data: results = [] } = useQuery({
    queryKey: ['user-search', q],
    queryFn: () => searchUsers(q),
    enabled: q.length >= 2,
    staleTime: 30000,
  })

  const { data: detail } = useQuery({
    queryKey: ['user-detail', selected],
    queryFn: () => fetchUserDetail(selected!),
    enabled: !!selected,
  })

  const { data: bans = [] } = useQuery({
    queryKey: ['user-bans', selected],
    queryFn: () => fetchUserBans(selected!),
    enabled: !!selected,
  })

  return (
    <div className="p-6 space-y-5">
      <h1 className="text-2xl font-bold">{t('users.search_title')}</h1>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setSelected(null) }}
          placeholder={t('users.search_placeholder')}
          className="w-full max-w-md pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        {/* Results list */}
        {results.length > 0 && (
          <div className="lg:w-72 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 flex-shrink-0">
            {results.map((user) => (
              <button
                key={user.twitch_id}
                onClick={() => setSelected(user.twitch_id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-50 dark:hover:bg-purple-900/10 text-left transition-colors ${selected === user.twitch_id ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                )}
                <span className="font-medium text-sm">{user.current_username}</span>
              </button>
            ))}
          </div>
        )}

        {/* Detail panel */}
        {selected && detail && (
          <div className="flex-1 space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center gap-4 mb-4">
                {detail.avatar_url ? (
                  <img src={detail.avatar_url} alt="" className="w-14 h-14 rounded-full" />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700" />
                )}
                <div>
                  <h2 className="text-lg font-bold">{detail.current_username}</h2>
                  <p className="text-xs text-gray-500 font-mono">ID: {detail.twitch_id}</p>
                  <a href={`https://twitch.tv/${detail.current_username}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-purple-600 hover:underline mt-0.5">
                    <ExternalLink className="w-3 h-3" />Twitch-Profil
                  </a>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{t('users.first_seen')}</p>
                  <p>{new Date(detail.first_seen).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">{t('users.last_seen')}</p>
                  <p>{new Date(detail.last_seen).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Ban history */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <h3 className="font-semibold mb-3">{t('users.ban_history')}</h3>
              {bans.length === 0 ? (
                <p className="text-sm text-gray-400">{t('users.no_bans')}</p>
              ) : (
                <div className="space-y-2">
                  {bans.map((ban, i) => (
                    <div key={i} className="flex items-start justify-between text-sm py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <div>
                        <span className={`text-xs px-2 py-0.5 rounded mr-2 ${ban.type === 'permanent' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{ban.type}</span>
                        <span className="text-gray-500">{ban.reason || '–'}</span>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{new Date(ban.created_at).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {q.length >= 2 && results.length === 0 && !selected && (
          <div className="text-gray-500 text-sm py-4">{t('users.no_results')}</div>
        )}
      </div>
    </div>
  )
}

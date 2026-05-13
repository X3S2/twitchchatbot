import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface User {
  id: string
  twitch_id: string
  twitch_username: string
  display_name: string
  avatar_url: string | null
  role: 'admin' | 'streamer' | 'moderator' | 'viewer'
  dark_mode: boolean
  language: string
  timezone: string
}

async function fetchMe(): Promise<User> {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  if (!res.ok) throw new Error('unauthenticated')
  return res.json()
}

async function refreshToken(): Promise<void> {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
  if (!res.ok) throw new Error('refresh_failed')
}

async function logoutFetch(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

export function useAuth() {
  const queryClient = useQueryClient()

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const logoutMutation = useMutation({
    mutationFn: logoutFetch,
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null)
      queryClient.clear()
    },
  })

  const refreshMutation = useMutation({
    mutationFn: refreshToken,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
    },
  })

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    logout: () => logoutMutation.mutate(),
    refresh: () => refreshMutation.mutate(),
    error,
  }
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  read: boolean
  created_at: string
}

async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch('/api/notifications', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch notifications')
  return res.json()
}

async function fetchUnreadCount(): Promise<number> {
  const res = await fetch('/api/notifications/unread-count', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch unread count')
  const data = await res.json()
  return data.count
}

async function markRead(id: string): Promise<void> {
  await fetch(`/api/notifications/${id}/read`, { method: 'POST', credentials: 'include' })
}

async function markAllRead(): Promise<void> {
  await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'include' })
}

async function deleteNotification(id: string): Promise<void> {
  await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'include' })
}

export function useNotifications() {
  const qc = useQueryClient()

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000,
  })

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: fetchUnreadCount,
    refetchInterval: 15000,
  })

  const markReadMutation = useMutation({
    mutationFn: markRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return {
    notifications,
    unreadCount,
    isLoading,
    markRead: markReadMutation.mutate,
    markAllRead: markAllReadMutation.mutate,
    deleteNotification: deleteMutation.mutate,
  }
}

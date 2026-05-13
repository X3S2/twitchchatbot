import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Plus, Trash2, Link2, CheckCircle } from 'lucide-react'

interface SharedConnection {
  id: string
  partner_channel_name: string
  role: 'source' | 'target'
  status: 'active' | 'pending' | 'rejected'
  created_at: string
}

interface BanInvitation {
  id: string
  sender_channel: string
  created_at: string
}

async function fetchConnections(tenantId: string): Promise<SharedConnection[]> {
  const res = await fetch(`/api/tenants/${tenantId}/bans/shared`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function fetchInvitations(tenantId: string): Promise<BanInvitation[]> {
  const res = await fetch(`/api/tenants/${tenantId}/bans/invitations`, { credentials: 'include' })
  if (!res.ok) return []
  return res.json()
}

async function sendInvitation(tenantId: string, targetChannel: string) {
  await fetch(`/api/tenants/${tenantId}/bans/invitations`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_channel_name: targetChannel }),
  })
}

async function acceptInvitation(tenantId: string, invId: string) {
  await fetch(`/api/tenants/${tenantId}/bans/invitations/${invId}/accept`, { method: 'POST', credentials: 'include' })
}

async function rejectInvitation(tenantId: string, invId: string) {
  await fetch(`/api/tenants/${tenantId}/bans/invitations/${invId}/reject`, { method: 'POST', credentials: 'include' })
}

async function deleteConnection(tenantId: string, conId: string) {
  await fetch(`/api/tenants/${tenantId}/bans/shared/${conId}`, { method: 'DELETE', credentials: 'include' })
}

export default function SharedBans() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: connections = [] } = useQuery({ queryKey: ['shared-bans', id], queryFn: () => fetchConnections(id!) })
  const { data: invitations = [] } = useQuery({ queryKey: ['ban-invitations', id], queryFn: () => fetchInvitations(id!) })
  const [inviteTarget, setInviteTarget] = useState('')

  const sendInvMut = useMutation({
    mutationFn: () => sendInvitation(id!, inviteTarget),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shared-bans', id] }); setInviteTarget('') },
  })
  const acceptMut = useMutation({ mutationFn: (invId: string) => acceptInvitation(id!, invId), onSuccess: () => { qc.invalidateQueries({ queryKey: ['ban-invitations', id] }); qc.invalidateQueries({ queryKey: ['shared-bans', id] }) } })
  const rejectMut = useMutation({ mutationFn: (invId: string) => rejectInvitation(id!, invId), onSuccess: () => qc.invalidateQueries({ queryKey: ['ban-invitations', id] }) })
  const delMut = useMutation({ mutationFn: (conId: string) => deleteConnection(id!, conId), onSuccess: () => qc.invalidateQueries({ queryKey: ['shared-bans', id] }) })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">{t('bans.shared_title')}</h1>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <h2 className="font-semibold mb-3">{t('bans.pending_invitations')}</h2>
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between">
                <span className="text-sm font-medium">{inv.sender_channel}</span>
                <div className="flex gap-2">
                  <button onClick={() => acceptMut.mutate(inv.id)} className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                    <CheckCircle className="w-3 h-3" />{t('bans.accept')}
                  </button>
                  <button onClick={() => rejectMut.mutate(inv.id)} className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-800">{t('bans.reject')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Invitation */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <h2 className="font-semibold mb-3">{t('bans.send_invitation')}</h2>
        <div className="flex gap-3">
          <input value={inviteTarget} onChange={(e) => setInviteTarget(e.target.value)} placeholder={t('bans.target_channel')} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          <button onClick={() => sendInvMut.mutate()} disabled={!inviteTarget.trim()} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">
            <Link2 className="w-4 h-4" />{t('bans.invite')}
          </button>
        </div>
      </div>

      {/* Active Connections */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <h2 className="font-semibold mb-3">{t('bans.connections')}</h2>
        {connections.length === 0 ? (
          <p className="text-sm text-gray-400">{t('bans.no_connections')}</p>
        ) : (
          <div className="space-y-2">
            {connections.map((conn) => (
              <div key={conn.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${conn.role === 'source' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{conn.role}</span>
                  <span className="font-medium text-sm">{conn.partner_channel_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded ${conn.status === 'active' ? 'bg-green-100 text-green-700' : conn.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{conn.status}</span>
                </div>
                <button onClick={() => delMut.mutate(conn.id)} className="p-1.5 hover:bg-red-50 rounded">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

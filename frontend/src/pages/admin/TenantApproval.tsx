import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Check, X } from 'lucide-react'

interface PendingTenant {
  id: string
  channel_name: string
  display_name: string
  user_id: string
  approval_requested_at: string
}

async function fetchPending(): Promise<PendingTenant[]> {
  const res = await fetch('/api/tenants?approved=false', { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  const all = await res.json()
  return all.filter((t: PendingTenant & { approved: boolean }) => !t.approved)
}

async function approve(id: string) {
  await fetch(`/api/tenants/${id}/approve`, { method: 'POST', credentials: 'include' })
}

async function reject(id: string) {
  await fetch(`/api/tenants/${id}/reject`, { method: 'POST', credentials: 'include' })
}

export default function TenantApproval() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: pending = [], isLoading } = useQuery({ queryKey: ['pending-tenants'], queryFn: fetchPending, refetchInterval: 30000 })

  const approveMut = useMutation({ mutationFn: approve, onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-tenants'] }) })
  const rejectMut = useMutation({ mutationFn: reject, onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-tenants'] }) })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">{t('admin.tenant_approval')}</h1>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        {isLoading ? (
          <div className="p-6 text-center text-gray-500">{t('loading')}</div>
        ) : pending.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{t('admin.no_pending')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase">
                <th className="px-4 py-2 text-left">{t('tenant.channel')}</th>
                <th className="px-4 py-2 text-left">{t('tenant.requested_at')}</th>
                <th className="px-4 py-2 text-left">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {pending.map((t2) => (
                <tr key={t2.id}>
                  <td className="px-4 py-3 font-medium">{t2.channel_name}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(t2.approval_requested_at).toLocaleString()}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => approveMut.mutate(t2.id)} className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                      <Check className="w-3 h-3" />{t('admin.approve')}
                    </button>
                    <button onClick={() => rejectMut.mutate(t2.id)} className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
                      <X className="w-3 h-3" />{t('admin.reject')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

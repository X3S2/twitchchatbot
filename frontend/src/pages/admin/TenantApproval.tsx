import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Check, X, ShieldOff, HelpCircle } from 'lucide-react'

interface Tenant {
  id: string
  channel_name: string
  display_name: string
  user_id: string
  approved: boolean
  approval_requested_at: string
}

async function fetchAllTenants(): Promise<Tenant[]> {
  const res = await fetch('/api/tenants', { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function approve(id: string) {
  await fetch(`/api/tenants/${id}/approve`, { method: 'POST', credentials: 'include' })
}

async function reject(id: string) {
  await fetch(`/api/tenants/${id}/reject`, { method: 'POST', credentials: 'include' })
}

async function revoke(id: string) {
  await fetch(`/api/tenants/${id}/revoke`, { method: 'POST', credentials: 'include' })
}

function TenantTable({ rows, actions }: { rows: Tenant[]; actions: (t: Tenant) => React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 uppercase">
          <th className="px-4 py-2 text-left">{t('tenant.channel')}</th>
          <th className="px-4 py-2 text-left">{t('tenant.requested_at')}</th>
          <th className="px-4 py-2 text-left">{t('admin.actions')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="px-4 py-3 font-medium">{row.channel_name}</td>
            <td className="px-4 py-3 text-gray-500">{new Date(row.approval_requested_at).toLocaleString()}</td>
            <td className="px-4 py-3 flex gap-2">{actions(row)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function TenantApproval() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: tenants = [], isLoading } = useQuery({ queryKey: ['all-tenants-approval'], queryFn: fetchAllTenants, refetchInterval: 30000 })

  const approveMut = useMutation({ mutationFn: approve, onSuccess: () => qc.invalidateQueries({ queryKey: ['all-tenants-approval'] }) })
  const rejectMut = useMutation({ mutationFn: reject, onSuccess: () => qc.invalidateQueries({ queryKey: ['all-tenants-approval'] }) })
  const revokeMut = useMutation({ mutationFn: revoke, onSuccess: () => qc.invalidateQueries({ queryKey: ['all-tenants-approval'] }) })

  const pending = tenants.filter((t) => !t.approved)
  const approved = tenants.filter((t) => t.approved)
  const [showHelp, setShowHelp] = useState(false)

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{t('admin.tenant_approval')}</h1>
        <button type="button" onClick={() => setShowHelp(v => !v)} className="text-gray-400 hover:text-purple-600"><HelpCircle className="w-4 h-4" /></button>
      </div>
      {showHelp && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm space-y-2">
          <div className="flex justify-between items-start">
            <span className="font-semibold text-blue-700 dark:text-blue-300">Tenant-Freigabe</span>
            <button onClick={() => setShowHelp(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
            <p>Neue Streamern müssen vor der Nutzung freigeschaltet werden. Hier siehst du alle ausstehenden Anfragen.</p>
            <p><strong>Genehmigen:</strong> Schaltet den Kanal frei – der Bot kann dann gestartet werden.</p>
            <p><strong>Ablehnen:</strong> Verhindert die Nutzung für diesen Kanal.</p>
            <p><strong>Sperren:</strong> Widerruft eine bereits erteilte Freigabe und stoppt den Bot automatisch.</p>
          </div>
        </div>
      )}

      {/* Pending section */}
      <div>
        <h2 className="text-base font-semibold mb-3">{t('admin.pending')} ({pending.length})</h2>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">{t('loading')}</div>
          ) : pending.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t('admin.no_pending')}</div>
          ) : (
            <TenantTable rows={pending} actions={(row) => (
              <>
                <button onClick={() => approveMut.mutate(row.id)} className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700">
                  <Check className="w-3 h-3" />{t('admin.approve')}
                </button>
                <button onClick={() => rejectMut.mutate(row.id)} className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">
                  <X className="w-3 h-3" />{t('admin.reject')}
                </button>
              </>
            )} />
          )}
        </div>
      </div>

      {/* Approved section */}
      <div>
        <h2 className="text-base font-semibold mb-3">{t('admin.approved')} ({approved.length})</h2>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          {isLoading ? (
            <div className="p-6 text-center text-gray-500">{t('loading')}</div>
          ) : approved.length === 0 ? (
            <div className="p-8 text-center text-gray-500">{t('admin.no_approved')}</div>
          ) : (
            <TenantTable rows={approved} actions={(row) => (
              <button onClick={() => revokeMut.mutate(row.id)} className="flex items-center gap-1 px-3 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600">
                <ShieldOff className="w-3 h-3" />{t('admin.revoke')}
              </button>
            )} />
          )}
        </div>
      </div>
    </div>
  )
}

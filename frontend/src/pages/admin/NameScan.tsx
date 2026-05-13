import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface NameScanFilter {
  id: string
  name: string
  description: string | null
  trigger_action: string
  enabled: boolean
  created_at: string
}

async function fetchFilters(): Promise<NameScanFilter[]> {
  const res = await fetch('/api/name-scan/filters', { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function deleteFilter(id: string) {
  await fetch(`/api/name-scan/filters/${id}`, { method: 'DELETE', credentials: 'include' })
}

export default function NameScanPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: filters = [], isLoading } = useQuery({ queryKey: ['name-scan-filters'], queryFn: fetchFilters })
  const deleteMut = useMutation({ mutationFn: deleteFilter, onSuccess: () => qc.invalidateQueries({ queryKey: ['name-scan-filters'] }) })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('admin.name_scan')}</h1>
        <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" />{t('admin.new_scan_filter')}
        </button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center text-gray-500">{t('loading')}</div>
        ) : filters.length === 0 ? (
          <div className="text-center text-gray-500 py-8">{t('admin.no_scan_filters')}</div>
        ) : filters.map((f) => (
          <div key={f.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{f.name}</p>
              {f.description && <p className="text-sm text-gray-500">{f.description}</p>}
              <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${f.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {f.enabled ? 'Aktiv' : 'Inaktiv'}
              </span>
              <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{f.trigger_action}</span>
            </div>
            <div className="flex gap-2">
              <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => deleteMut.mutate(f.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

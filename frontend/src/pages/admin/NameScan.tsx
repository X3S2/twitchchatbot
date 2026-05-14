import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Plus, Pencil, Trash2, HelpCircle, X, Save } from 'lucide-react'

interface NameScanFilter {
  id: string
  name: string
  description: string | null
  trigger_action: string
  enabled: boolean
  created_at: string
}

interface FilterForm {
  name: string
  description: string
  trigger_action: string
  enabled: boolean
}

const emptyForm = (): FilterForm => ({ name: '', description: '', trigger_action: 'flag', enabled: true })

async function fetchFilters(): Promise<NameScanFilter[]> {
  const res = await fetch('/api/name-scan/filters', { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler')
  return res.json()
}

async function deleteFilter(id: string) {
  await fetch(`/api/name-scan/filters/${id}`, { method: 'DELETE', credentials: 'include' })
}

async function createFilter(data: FilterForm) {
  const res = await fetch('/api/name-scan/filters', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function updateFilter(id: string, data: Partial<FilterForm>) {
  const res = await fetch(`/api/name-scan/filters/${id}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export default function NameScanPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { data: filters = [], isLoading } = useQuery({ queryKey: ['name-scan-filters'], queryFn: fetchFilters })
  const deleteMut = useMutation({ mutationFn: deleteFilter, onSuccess: () => qc.invalidateQueries({ queryKey: ['name-scan-filters'] }) })
  const createMut = useMutation({ mutationFn: createFilter, onSuccess: () => { qc.invalidateQueries({ queryKey: ['name-scan-filters'] }); setShowCreate(false); setCreateForm(emptyForm()) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<FilterForm> }) => updateFilter(id, data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['name-scan-filters'] }); setEditFilter(null) } })
  const [showHelp, setShowHelp] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<FilterForm>(emptyForm())
  const [editFilter, setEditFilter] = useState<NameScanFilter | null>(null)
  const [editForm, setEditForm] = useState<FilterForm>(emptyForm())

  const openEdit = (f: NameScanFilter) => {
    setEditFilter(f)
    setEditForm({ name: f.name, description: f.description || '', trigger_action: f.trigger_action, enabled: f.enabled })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">{t('admin.name_scan')}</h1>
          <button type="button" onClick={() => setShowHelp(v => !v)} className="text-gray-400 hover:text-purple-600"><HelpCircle className="w-4 h-4" /></button>
        </div>
        <button onClick={() => { setShowCreate(true); setCreateForm(emptyForm()) }} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700">
          <Plus className="w-4 h-4" />{t('admin.new_scan_filter')}
        </button>
      </div>
      {showHelp && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm space-y-2">
          <div className="flex justify-between items-start">
            <span className="font-semibold text-blue-700 dark:text-blue-300">Namensscan-Filter (Admin)</span>
            <button onClick={() => setShowHelp(false)}><X className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="space-y-1.5 text-gray-700 dark:text-gray-300">
            <p>Hier definierst du plattformweite Namensmuster, die verdächtige Twitch-Konten identifizieren (z.B. Bot-Namen, bekannte Trollmuster).</p>
            <p><strong>Filterregel erstellen:</strong> Gib Name, Beschreibung und die gewünschte Aktion bei einem Treffer an.</p>
            <p><strong>Aktiv/Inaktiv:</strong> Inaktive Filter werden von keinem Tenant ausgeführt, auch wenn dieser eingeloggt ist.</p>
            <p>Tenants können über die <em>Namensscan</em>-Seite ihres Dashboards einzeln entscheiden, welche Filter sie nutzen möchten.</p>
          </div>
        </div>
      )}

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
              <button onClick={() => openEdit(f)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><Pencil className="w-4 h-4" /></button>
              <button onClick={() => deleteMut.mutate(f.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{t('admin.new_scan_filter')}</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <FilterFormFields form={createForm} setForm={setCreateForm} />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">{t('cancel')}</button>
              <button onClick={() => createMut.mutate(createForm)} disabled={!createForm.name || createMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50">
                <Save className="w-4 h-4" />{createMut.isPending ? '…' : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editFilter && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditFilter(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">{editFilter.name}</h2>
              <button onClick={() => setEditFilter(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <FilterFormFields form={editForm} setForm={setEditForm} />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditFilter(null)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">{t('cancel')}</button>
              <button onClick={() => updateMut.mutate({ id: editFilter.id, data: editForm })} disabled={!editForm.name || updateMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50">
                <Save className="w-4 h-4" />{updateMut.isPending ? '…' : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FilterFormFields({ form, setForm }: { form: FilterForm; setForm: (f: FilterForm) => void }) {
  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Name *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Beschreibung</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={inputCls} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Aktion bei Treffer</label>
        <select value={form.trigger_action} onChange={(e) => setForm({ ...form, trigger_action: e.target.value })} className={inputCls}>
          <option value="flag">Flag (nur markieren)</option>
          <option value="warn">Warnen</option>
          <option value="ban">Bannen</option>
          <option value="log">Log (nur protokollieren)</option>
        </select>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="w-4 h-4 accent-purple-600" />
        <span className="text-sm">Aktiv</span>
      </label>
    </div>
  )
}

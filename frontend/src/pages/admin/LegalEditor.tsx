import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Save, ChevronDown, ChevronRight } from 'lucide-react'

interface LegalPageData {
  slug: string
  title_de: string
  title_en: string
  content_de: string
  content_en: string
}

async function fetchLegal(slug: string): Promise<LegalPageData> {
  const res = await fetch(`/api/legal/${slug}`, { credentials: 'include' })
  if (!res.ok) throw new Error('Fehler beim Laden')
  return res.json()
}

async function patchLegal(slug: string, data: Partial<LegalPageData>) {
  const res = await fetch(`/api/legal/${slug}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
}

const iCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
const taCls = `${iCls} font-mono resize-y min-h-[240px]`

function LegalPageEditor({ slug, label }: { slug: string; label: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<LegalPageData | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['legal-page', slug],
    queryFn: () => fetchLegal(slug),
  })

  // Initialise form once data arrives (if not already set)
  if (data && !form) setForm(data)

  const saveMut = useMutation({
    mutationFn: () => patchLegal(slug, form!),
  })

  function setF(key: keyof LegalPageData, value: string) {
    setForm((f) => f ? { ...f, [key]: value } : f)
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          <span className="font-semibold">{label}</span>
        </div>
        <a
          href={`/legal/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t('admin.legal_preview')}
        </a>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4 space-y-4">
          {isLoading || !form ? (
            <div className="text-sm text-gray-500">{t('loading')}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('admin.legal_title_de')}</label>
                  <input value={form.title_de} onChange={(e) => setF('title_de', e.target.value)} className={iCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('admin.legal_title_en')}</label>
                  <input value={form.title_en} onChange={(e) => setF('title_en', e.target.value)} className={iCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('admin.legal_content_de')} <span className="text-gray-400">(HTML)</span></label>
                <textarea value={form.content_de} onChange={(e) => setF('content_de', e.target.value)} className={taCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('admin.legal_content_en')} <span className="text-gray-400">(HTML)</span></label>
                <textarea value={form.content_en} onChange={(e) => setF('content_en', e.target.value)} className={taCls} />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => saveMut.mutate()}
                  disabled={saveMut.isPending}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />{t('save')}
                </button>
                {saveMut.isSuccess && <span className="text-xs text-green-600">{t('saved')}</span>}
                {saveMut.isError && <span className="text-xs text-red-500">{String(saveMut.error)}</span>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function LegalEditor() {
  const { t } = useTranslation()
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('admin.legal_pages')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('admin.legal_pages_hint')}</p>
      </div>
      <LegalPageEditor slug="impressum" label="Impressum" />
      <LegalPageEditor slug="datenschutz" label={t('admin.datenschutz')} />
    </div>
  )
}

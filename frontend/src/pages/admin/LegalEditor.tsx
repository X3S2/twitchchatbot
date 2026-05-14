import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Save, ChevronDown, ChevronRight, FileText } from 'lucide-react'

const IMPRESSUM_DE = `<h2>Impressum</h2>

<h3>Angaben gemäß § 5 TMG</h3>
<p>
  <strong>Vorname Nachname</strong><br />
  Musterstraße 1<br />
  12345 Musterstadt<br />
  Deutschland
</p>

<h3>Kontakt</h3>
<p>
  E-Mail: <a href="mailto:kontakt@example.com">kontakt@example.com</a>
</p>

<h3>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h3>
<p>
  Vorname Nachname<br />
  Musterstraße 1<br />
  12345 Musterstadt
</p>

<p class="text-sm text-gray-500 mt-4">
  Dieses Impressum gilt für alle Angebote unter dieser Domain.
</p>`

const IMPRESSUM_EN = `<h2>Legal Notice (Impressum)</h2>

<h3>Information pursuant to § 5 TMG</h3>
<p>
  <strong>First Last Name</strong><br />
  Sample Street 1<br />
  12345 Sample City<br />
  Germany
</p>

<h3>Contact</h3>
<p>
  E-Mail: <a href="mailto:contact@example.com">contact@example.com</a>
</p>

<h3>Responsible for content according to § 55 para. 2 RStV</h3>
<p>
  First Last Name<br />
  Sample Street 1<br />
  12345 Sample City
</p>`

const DATENSCHUTZ_DE = `<h2>Datenschutzerklärung</h2>

<h3>1. Verantwortlicher</h3>
<p>
  Vorname Nachname, Musterstraße 1, 12345 Musterstadt<br />
  E-Mail: <a href="mailto:datenschutz@example.com">datenschutz@example.com</a>
</p>

<h3>2. Erhobene Daten</h3>
<p>
  Diese Plattform verarbeitet folgende personenbezogene Daten:
</p>
<ul>
  <li>Twitch-Benutzername und Twitch-ID (bei Login via Twitch OAuth)</li>
  <li>Profilbild-URL (von Twitch bereitgestellt)</li>
  <li>Technische Zugriffsdaten (IP-Adresse, Browser, Zeitstempel) in Server-Logs</li>
</ul>

<h3>3. Zweck der Datenverarbeitung</h3>
<p>
  Die Daten werden ausschließlich zur Bereitstellung des Dienstes (Chat-Bot-Verwaltung) verwendet.
  Eine Weitergabe an Dritte findet nicht statt.
</p>

<h3>4. Rechtsgrundlage</h3>
<p>
  Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)
  sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb der Plattform).
</p>

<h3>5. Speicherdauer</h3>
<p>
  Daten werden gelöscht, sobald sie für den Verarbeitungszweck nicht mehr erforderlich sind,
  spätestens nach Löschung des Nutzerkontos.
</p>

<h3>6. Ihre Rechte</h3>
<p>
  Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung
  sowie das Recht auf Datenübertragbarkeit. Wenden Sie sich dazu an die oben genannte E-Mail-Adresse.
</p>

<h3>7. Beschwerderecht</h3>
<p>
  Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
</p>`

const DATENSCHUTZ_EN = `<h2>Privacy Policy</h2>

<h3>1. Controller</h3>
<p>
  First Last Name, Sample Street 1, 12345 Sample City<br />
  E-Mail: <a href="mailto:privacy@example.com">privacy@example.com</a>
</p>

<h3>2. Data Collected</h3>
<p>This platform processes the following personal data:</p>
<ul>
  <li>Twitch username and Twitch ID (on login via Twitch OAuth)</li>
  <li>Profile picture URL (provided by Twitch)</li>
  <li>Technical access data (IP address, browser, timestamp) in server logs</li>
</ul>

<h3>3. Purpose of Processing</h3>
<p>
  Data is used exclusively to provide the service (chat bot management).
  Data is not shared with third parties.
</p>

<h3>4. Legal Basis</h3>
<p>
  Processing is based on Art. 6(1)(b) GDPR (performance of contract) and
  Art. 6(1)(f) GDPR (legitimate interest in secure platform operation).
</p>

<h3>5. Retention</h3>
<p>
  Data is deleted when no longer necessary for the processing purpose,
  at the latest upon account deletion.
</p>

<h3>6. Your Rights</h3>
<p>
  You have the right to access, rectification, erasure, restriction of processing,
  and data portability. Contact the e-mail address above.
</p>`

const TEMPLATES: Record<string, { content_de: string; content_en: string }> = {
  impressum: { content_de: IMPRESSUM_DE, content_en: IMPRESSUM_EN },
  datenschutz: { content_de: DATENSCHUTZ_DE, content_en: DATENSCHUTZ_EN },
}

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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-500">{t('admin.legal_content_de')} <span className="text-gray-400">(HTML)</span></label>
                  {TEMPLATES[slug] && (
                    <button type="button" onClick={() => setF('content_de', TEMPLATES[slug].content_de)}
                      className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800">
                      <FileText className="w-3 h-3" />Vorlage einfügen
                    </button>
                  )}
                </div>
                <textarea value={form.content_de} onChange={(e) => setF('content_de', e.target.value)} className={taCls} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-gray-500">{t('admin.legal_content_en')} <span className="text-gray-400">(HTML)</span></label>
                  {TEMPLATES[slug] && (
                    <button type="button" onClick={() => setF('content_en', TEMPLATES[slug].content_en)}
                      className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800">
                      <FileText className="w-3 h-3" />Vorlage einfügen
                    </button>
                  )}
                </div>
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

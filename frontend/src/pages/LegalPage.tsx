import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface LegalContent {
  slug: string
  title_de: string
  title_en: string
  content_de: string
  content_en: string
}

export default function LegalPage() {
  const { slug } = useParams<{ slug: string }>()
  const { t, i18n } = useTranslation()
  const [content, setContent] = useState<LegalContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const lang = i18n.language.startsWith('en') ? 'en' : 'de'

  useEffect(() => {
    if (!slug) return
    fetch(`/api/legal/${slug}`)
      .then(res => {
        if (res.status === 404) { setNotFound(true); return null }
        return res.json()
      })
      .then(data => { if (data) setContent(data) })
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <div className="p-8 text-gray-400">{t('legal.loading')}</div>
  if (notFound || !content) return <div className="p-8 text-red-400">{t('legal.not_found')}</div>

  const title = lang === 'en' ? content.title_en : content.title_de
  const body = lang === 'en' ? content.content_en : content.content_de

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">{title}</h1>
      <div
        className="[&_p]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_a]:text-purple-600 [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </div>
  )
}

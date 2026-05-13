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
        className="prose dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: body }}
      />
    </div>
  )
}

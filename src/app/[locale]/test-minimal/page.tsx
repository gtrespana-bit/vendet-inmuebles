import { getTranslations } from 'next-intl/server'

export default async function TestMinimalPage() {
  const t = await getTranslations()
  
  return (
    <div>
      <h1>{t('common.test')}</h1>
      <p>Minimal page for Lighthouse testing</p>
    </div>
  )
}
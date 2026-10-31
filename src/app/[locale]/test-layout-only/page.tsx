import { devOnlyPage } from '@/lib/dev-only'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/Header'
import BottomTabNav from '@/components/BottomTabNav'

export default async function TestLayoutOnlyPage() {
  devOnlyPage()
  const t = await getTranslations()
  
  return (
    <div>
      <Header />
      <h1>{t('common.test')}</h1>
      <p>Test with only essential layout components</p>
      <BottomTabNav />
    </div>
  )
}
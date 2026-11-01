import { redirect } from 'next/navigation'

export default async function LegacyLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  const queryParams = await searchParams
  const prefix = locale === 'en' ? '/en' : ''
  const redirectValue = queryParams.redirect
  const query = typeof redirectValue === 'string'
    ? `?redirect=${encodeURIComponent(redirectValue)}`
    : ''
  redirect(`${prefix}/login${query}`)
}

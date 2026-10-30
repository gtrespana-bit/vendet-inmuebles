import { redirect } from 'next/navigation'

export default function LegacyLoginPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const prefix = params.locale === 'en' ? '/en' : ''
  const redirectValue = searchParams?.redirect
  const query = typeof redirectValue === 'string'
    ? `?redirect=${encodeURIComponent(redirectValue)}`
    : ''
  redirect(`${prefix}/login${query}`)
}

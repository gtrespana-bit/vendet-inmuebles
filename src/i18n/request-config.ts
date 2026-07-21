import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  // Validación manual de locale sin usar hasLocale que no existe en esta versión
  const locale = routing.locales.includes(requested as string)
    ? (requested as string)
    : routing.defaultLocale

  return {
    locale,
    messages: (await import(`./dictionaries/${locale}.json`)).default,
  }
})

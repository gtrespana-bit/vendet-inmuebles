import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  
  // Type guard para validar el locale
  const isValidLocale = (locale: string): locale is 'es' | 'en' => {
    return locale === 'es' || locale === 'en'
  }
  
  // Usar type guard para asegurar tipo correcto
  const locale: 'es' | 'en' = isValidLocale(requested as string) 
    ? (requested as 'es' | 'en')
    : routing.defaultLocale

  return {
    locale,
    messages: (await import(`./dictionaries/${locale}.json`)).default,
  }
})

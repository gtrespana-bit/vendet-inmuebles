/**
 * Convierte un cuerpo HTML de correo transaccional en una alternativa legible
 * en texto plano (multipart/alternative). Evita la penalización MIME_HTML_ONLY
 * en filtros antispam (SpamAssassin, Gmail, Outlook/Hotmail).
 */
export function htmlToPlainText(html: string): string {
  if (!html) return ''

  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, label) => {
      const cleanLabel = String(label).replace(/<[^>]+>/g, '').trim()
      const cleanHref = String(href).trim()
      if (!cleanHref || cleanHref.startsWith('mailto:')) {
        return cleanLabel || cleanHref.replace(/^mailto:/i, '')
      }
      if (!cleanLabel || cleanLabel === cleanHref) return cleanHref
      return `${cleanLabel} (${cleanHref})`
    })
    .replace(/<\/(p|div|h1|h2|h3|h4|tr|li|table)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

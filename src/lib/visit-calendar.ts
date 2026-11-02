/**
 * Utilidades isomórficas (sin `'use client'`) para:
 *  1. Generar archivos `.ics` (RFC 5545) y enlaces de Google Calendar
 *     en zona horaria de Venezuela (`America/Caracas`, UTC-04:00).
 *  2. Exportar solicitudes de visita / leads a CSV seguro contra inyección de fórmulas.
 */

export interface CalendarVisitEventInput {
  id?: string | null
  propertyTitle: string
  propertyUrl: string
  location?: string | null
  modalidad: 'presencial' | 'videollamada' | 'llamada'
  fechaPreferida: string // YYYY-MM-DD
  franjaHoraria?: string | null
  counterpartyName?: string | null
  notes?: string | null
  locale?: 'es' | 'en'
}

interface UtcWindow {
  startUtc: string
  endUtc: string
}

/**
 * Convierte `YYYY-MM-DD` + franja horaria local de Venezuela (UTC-4 fijo, sin DST)
 * a marcas UTC compactas `YYYYMMDDTHHMMSSZ` para compatibilidad universal en Google/Apple/Outlook.
 */
export function resolveVenezuelaVisitUtcWindow(
  fechaIso: string,
  franjaHoraria?: string | null,
): UtcWindow | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(fechaIso || '').trim())
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  // Hora local VET (UTC-4) -> UTC = horaLocal + 4
  let localStartHour = 10
  let localStartMin = 0
  if (franjaHoraria === 'manana') {
    localStartHour = 9
    localStartMin = 30
  } else if (franjaHoraria === 'tarde') {
    localStartHour = 15
    localStartMin = 0
  } else if (franjaHoraria === 'fin_de_semana') {
    localStartHour = 10
    localStartMin = 30
  }

  const startMs = Date.UTC(year, month - 1, day, localStartHour + 4, localStartMin, 0)
  if (!Number.isFinite(startMs)) return null
  const endMs = startMs + 60 * 60 * 1000 // 1 hora

  const fmt = (ms: number) =>
    new Date(ms)
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z')

  return { startUtc: fmt(startMs), endUtc: fmt(endMs) }
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function modalitySummaryPrefix(
  modalidad: CalendarVisitEventInput['modalidad'],
  isEn: boolean,
): string {
  if (modalidad === 'videollamada') return isEn ? 'Video tour' : 'Videollamada inmueble'
  if (modalidad === 'llamada') return isEn ? 'Advisor call' : 'Llamada inmueble'
  return isEn ? 'Property visit' : 'Visita inmueble'
}

export function buildGoogleCalendarUrl(input: CalendarVisitEventInput): string | null {
  const win = resolveVenezuelaVisitUtcWindow(input.fechaPreferida, input.franjaHoraria)
  if (!win) return null
  const isEn = input.locale === 'en'
  const title = `${modalitySummaryPrefix(input.modalidad, isEn)}: ${input.propertyTitle}`
  const detailsParts = [
    input.counterpartyName
      ? `${isEn ? 'Contact' : 'Contacto'}: ${input.counterpartyName}`
      : '',
    input.notes ? `${isEn ? 'Notes' : 'Notas'}: ${input.notes}` : '',
    `${isEn ? 'Listing' : 'Ficha'}: ${input.propertyUrl}`,
  ].filter(Boolean)

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${win.startUtc}/${win.endUtc}`,
    details: detailsParts.join('\n'),
    location: input.location || 'Venezuela',
    ctz: 'America/Caracas',
  })

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildVisitIcsContent(input: CalendarVisitEventInput): string | null {
  const win = resolveVenezuelaVisitUtcWindow(input.fechaPreferida, input.franjaHoraria)
  if (!win) return null
  const isEn = input.locale === 'en'
  const summary = `${modalitySummaryPrefix(input.modalidad, isEn)}: ${input.propertyTitle}`
  const description = [
    input.counterpartyName
      ? `${isEn ? 'Contact' : 'Contacto'}: ${input.counterpartyName}`
      : '',
    input.notes ? `${isEn ? 'Notes' : 'Notas'}: ${input.notes}` : '',
    `${isEn ? 'Listing' : 'Ficha'}: ${input.propertyUrl}`,
  ]
    .filter(Boolean)
    .join('\n')

  const uidSeed = String(input.id || `${input.fechaPreferida}-${input.propertyTitle}`)
    .replace(/[^a-zA-Z0-9-]/g, '')
    .slice(0, 48)
  const dtStamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Venezuela Inmuebles//Agenda de Visitas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:visita-${uidSeed || 'evento'}@venezuela-inmuebles.online`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${win.startUtc}`,
    `DTEND:${win.endUtc}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(input.location || 'Venezuela')}`,
    `URL:${escapeIcsText(input.propertyUrl)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

export interface VisitCsvRow {
  createdAt: string
  status: string
  propertyTitle: string
  location?: string | null
  modality: string
  preferredDate?: string | null
  timeSlot?: string | null
  contactName: string
  contactPhone: string
  contactEmail?: string | null
  assignedAgent?: string | null
  message?: string | null
  sellerNote?: string | null
}

function escapeCsvCell(raw: unknown): string {
  const str = String(raw ?? '')
    .replace(/\r?\n/g, ' ')
    .trim()
  // Prevención de CSV Formula Injection en Excel / Google Sheets
  const neutralized = /^[=+\-@]/.test(str) ? `'${str}` : str
  if (/[",;]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`
  }
  return neutralized
}

export function buildVisitsCsv(rows: VisitCsvRow[], locale: 'es' | 'en' = 'es'): string {
  const isEn = locale === 'en'
  const headers = isEn
    ? [
        'Date received',
        'Status',
        'Property',
        'Location',
        'Modality',
        'Preferred date',
        'Time slot',
        'Buyer name',
        'Phone / WhatsApp',
        'Email',
        'Assigned advisor',
        'Buyer message',
        'Advisor note',
      ]
    : [
        'Fecha solicitud',
        'Estado',
        'Inmueble',
        'Ubicación',
        'Modalidad',
        'Fecha sugerida',
        'Horario',
        'Interesado',
        'Teléfono / WhatsApp',
        'Correo',
        'Asesor asignado',
        'Comentario comprador',
        'Nota interna',
      ]

  const lines = [headers.map(escapeCsvCell).join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.createdAt,
        r.status,
        r.propertyTitle,
        r.location || '',
        r.modality,
        r.preferredDate || '',
        r.timeSlot || '',
        r.contactName,
        r.contactPhone,
        r.contactEmail || '',
        r.assignedAgent || '',
        r.message || '',
        r.sellerNote || '',
      ]
        .map(escapeCsvCell)
        .join(','),
    )
  }

  return `\uFEFF${lines.join('\r\n')}`
}

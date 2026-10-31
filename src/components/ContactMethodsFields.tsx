'use client'

import { Mail, MessageSquare, Phone } from 'lucide-react'
import type { ClaveMetodoContacto } from '@/lib/contact-methods'

/** Valores del formulario. La clave presente (aunque sea '') = método marcado. */
export type MetodosContactoForm = Partial<Record<ClaveMetodoContacto, string>>

export interface ContactMethodsLabels {
  title: string
  desc: string
  whatsappLabel: string
  phoneCallsLabel: string
  emailLabel: string
  messengerLabel: string
  chatAuto: string
  /** Aviso opcional para publicaciones antiguas sin métodos configurados. */
  legacyHint?: string
}

interface Props {
  value: MetodosContactoForm
  onChange: (value: MetodosContactoForm) => void
  labels: ContactMethodsLabels
  /** Prefijo para los id de los checkboxes (evita duplicados si se usa dos veces). */
  idPrefix?: string
  className?: string
}

const CAMPOS: Array<{
  key: ClaveMetodoContacto
  labelKey: 'whatsappLabel' | 'phoneCallsLabel' | 'emailLabel' | 'messengerLabel'
  icon: typeof Phone
  iconLabel: string
  type: 'tel' | 'email' | 'url'
  placeholder: string
  inputMode?: 'tel'
}> = [
  { key: 'whatsapp', labelKey: 'whatsappLabel', icon: MessageSquare, iconLabel: '💚', type: 'tel', placeholder: '+58 412 1234567', inputMode: 'tel' },
  { key: 'telefono', labelKey: 'phoneCallsLabel', icon: Phone, iconLabel: '', type: 'tel', placeholder: '+58 412 1234567', inputMode: 'tel' },
  { key: 'email', labelKey: 'emailLabel', icon: Mail, iconLabel: '', type: 'email', placeholder: 'nombre@correo.com' },
  { key: 'messenger', labelKey: 'messengerLabel', icon: MessageSquare, iconLabel: '', type: 'url', placeholder: 'https://m.me/tuusuario' },
]

/**
 * Bloque de métodos de contacto por publicación, compartido por "Publicar" y
 * "Editar anuncio" para que la elección de Llamar/WhatsApp (y email/Messenger)
 * sea idéntica en ambos flujos.
 */
export default function ContactMethodsFields({ value, onChange, labels, idPrefix = 'contact', className = '' }: Props) {
  const toggle = (key: ClaveMetodoContacto, checked: boolean) => {
    if (checked) {
      onChange({ ...value, [key]: value[key] ?? '' })
      return
    }
    const next = { ...value }
    delete next[key]
    onChange(next)
  }

  const update = (key: ClaveMetodoContacto, text: string) => {
    onChange({ ...value, [key]: text })
  }

  return (
    <section className={`bg-blue-50/60 border border-blue-200 rounded-xl p-5 space-y-4 ${className}`.trim()}>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare size={18} aria-hidden="true" />
          {labels.title}
        </h2>
        <p className="text-xs text-gray-500 mt-1">{labels.desc}</p>
        {labels.legacyHint && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
            {labels.legacyHint}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {CAMPOS.map((campo) => {
          const Icon = campo.icon
          const marcado = value[campo.key] !== undefined
          const inputId = `${idPrefix}-${campo.key}`
          return (
            <div key={campo.key} className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg p-3">
              <input
                type="checkbox"
                id={inputId}
                checked={marcado}
                onChange={(e) => toggle(campo.key, e.target.checked)}
                className="mt-1 rounded text-brand-primary"
              />
              <div className="flex-1">
                <label htmlFor={inputId} className="text-sm font-medium flex items-center gap-1.5">
                  {campo.iconLabel ? `${campo.iconLabel} ` : ''}
                  <Icon size={14} aria-hidden="true" /> {labels[campo.labelKey]}
                </label>
                {marcado && (
                  <input
                    type={campo.type}
                    inputMode={campo.inputMode}
                    value={value[campo.key] ?? ''}
                    onChange={(e) => update(campo.key, e.target.value)}
                    placeholder={campo.placeholder}
                    aria-label={labels[campo.labelKey]}
                    className="mt-1 w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="flex items-center gap-2 text-xs text-gray-500">
        <MessageSquare size={12} aria-hidden="true" />
        <span>{labels.chatAuto}</span>
      </p>
    </section>
  )
}

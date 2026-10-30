'use client'

import { useEffect, useState } from 'react'
import styles from './theme-switcher.module.css'

type ThemeId = 'esmeralda' | 'marino' | 'oliva'

const STORAGE_KEY = 'vi-theme'

const THEMES: { id: ThemeId; name: string; hint: string; swatch: string[] }[] = [
  {
    id: 'esmeralda',
    name: 'Esmeralda',
    hint: 'Verde profundo · bronce',
    swatch: ['#0E3B33', '#B07C2E', '#F6F1E6'],
  },
  {
    id: 'marino',
    name: 'Marino',
    hint: 'Azul noche · latón',
    swatch: ['#16294B', '#B08542', '#F4F1E9'],
  },
  {
    id: 'oliva',
    name: 'Oliva',
    hint: 'Verde salvia · terracota',
    swatch: ['#3E5543', '#A85B36', '#F5F1E7'],
  },
]

const THEME_COLOR: Record<ThemeId, string> = {
  esmeralda: '#0E3B33',
  marino: '#16294B',
  oliva: '#3E5543',
}

function applyTheme(theme: ThemeId) {
  if (theme === 'esmeralda') {
    delete document.documentElement.dataset.theme
  } else {
    document.documentElement.dataset.theme = theme
  }

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', THEME_COLOR[theme])
  }
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>('esmeralda')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeId | null
    if (stored && THEMES.some((item) => item.id === stored)) {
      setTheme(stored)
      applyTheme(stored)
    }
  }, [])

  const choose = (next: ThemeId) => {
    setTheme(next)
    applyTheme(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* storage can be blocked; the theme still applies for this visit */
    }
    setOpen(false)
  }

  const current = THEMES.find((item) => item.id === theme) ?? THEMES[0]

  return (
    <div className={styles.root}>
      {open && (
        <div className={styles.panel} role="group" aria-label="Elegir paleta de colores">
          <p className={styles.panelTitle}>Paleta de marca</p>
          <p className={styles.panelHint}>Compara las tres y elige una.</p>

          <ul className={styles.list}>
            {THEMES.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`${styles.option} ${item.id === theme ? styles.optionActive : ''}`}
                  aria-pressed={item.id === theme}
                  onClick={() => choose(item.id)}
                >
                  <span className={styles.swatches} aria-hidden="true">
                    {item.swatch.map((color) => (
                      <span key={color} style={{ background: color }} />
                    ))}
                  </span>
                  <span className={styles.optionText}>
                    <span className={styles.optionName}>{item.name}</span>
                    <span className={styles.optionHint}>{item.hint}</span>
                  </span>
                  <span className={styles.check} aria-hidden="true">
                    {item.id === theme ? '●' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-label={`Cambiar paleta (actual: ${current.name})`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={styles.toggleSwatches} aria-hidden="true">
          {current.swatch.map((color) => (
            <span key={color} style={{ background: color }} />
          ))}
        </span>
        <span className={styles.toggleLabel}>
          Paleta
          <strong>{current.name}</strong>
        </span>
      </button>
    </div>
  )
}

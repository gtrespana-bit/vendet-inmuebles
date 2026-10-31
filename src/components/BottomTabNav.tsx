'use client'

import { usePathname } from 'next/navigation'
import LocalLink from '@/components/LocalLink'
import { Home, Search, PlusCircle, MessageCircle, User } from 'lucide-react'
import { useLocalizedMessages } from '@/hooks/useLocalizedMessages'
import { useEffect, useState } from 'react'

// El menú inferior fijo se muestra en TODOS los móviles (navegador y PWA
// instalada): la web móvil se ve igual que la app, con su menú fijo abajo.
const MOBILE_MQ = '(max-width: 767px)'

export default function BottomTabNav() {
  const pathname = usePathname()
  const normalizedPathname = pathname.replace(/^\/en(?=\/|$)/, '') || '/'
  const { t } = useLocalizedMessages()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ)
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const navItems = [
    { href: '/', icon: Home, label: t('bottomNav.home') },
    { href: '/catalogo', icon: Search, label: t('bottomNav.search') },
    { href: '/publicar-inmueble', icon: PlusCircle, label: t('bottomNav.publish'), highlight: true },
    { href: '/chat', icon: MessageCircle, label: t('bottomNav.chat') },
    { href: '/dashboard', icon: User, label: t('bottomNav.profile') },
  ]

  if (!isMobile) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      role="navigation"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = normalizedPathname === item.href || (item.href !== '/' && normalizedPathname.startsWith(`${item.href}/`))
          return (
            <LocalLink
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full transition ${
                item.highlight ? '-mt-4' : ''
              }`}
            >
              {item.highlight ? (
                <div className="w-14 h-14 bg-brand-accent rounded-full flex items-center justify-center shadow-lg shadow-yellow-200 active:scale-95 transition-transform">
                  <Icon size={26} className="text-[var(--on-gold)]" />
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Icon
                    size={22}
                    className={isActive ? 'text-brand-primary' : 'text-gray-400'}
                  />
                  <span
                    className={`text-[10px] mt-0.5 font-medium ${
                      isActive ? 'text-brand-primary' : 'text-gray-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
              )}
            </LocalLink>
          )
        })}
      </div>
    </nav>
  )
}

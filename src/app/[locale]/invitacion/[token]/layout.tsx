import type { Metadata } from 'next'
import { NOINDEX_ROBOTS } from '@/lib/seo-metadata'

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
}

export default function InvitacionAgenciaLayout({ children }: { children: React.ReactNode }) {
  return children
}

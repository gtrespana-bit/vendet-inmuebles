import { Suspense } from 'react'
import BuscarClient from './BuscarClient'
import { Loader2 } from 'lucide-react'

export default function BuscarPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin h-8 w-8 text-brand-primary" />
      </div>
    }>
      <BuscarClient searchParams={searchParams} />
    </Suspense>
  )
}

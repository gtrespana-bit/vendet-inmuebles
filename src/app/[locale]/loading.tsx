export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm">Cargando...</p>
      </div>
    </div>
  )
}

import { supabase } from '@/lib/supabase'

export default async function TestCatalogPage() {
  try {
    // Test the same query as used in catalog page
    const { data, count, error } = await supabase
      .from('productos')
      .select('id, titulo, precio_usd, estado, imagen_url, ubicacion_ciudad, ubicacion_estado, creado_en, subcategoria, boosteado_en, destacado, destacado_hasta, vendedor_verificado', { count: 'exact' })
      .eq('activo', true)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
      .order('creado_en', { ascending: false })
      .limit(12)

    if (error) {
      return (
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Test Catalog - Error</h1>
          <pre className="bg-red-100 p-4 rounded">
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      )
    }

    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Test Catalog - Success</h1>
        <p>Found {data?.length} products</p>
        <p>Total count: {count}</p>
        <div className="mt-4">
          {data?.map((product: any) => (
            <div key={product.id} className="mb-2 p-2 bg-gray-100 rounded">
              <strong>ID:</strong> {product.id} <br />
              <strong>Title:</strong> {product.titulo} <br />
              <strong>Price:</strong> ${product.precio_usd} <br />
              <a href={`/inmueble/${product.id}`} className="text-blue-600 hover:underline">
                View Product
              </a>
            </div>
          ))}
        </div>
      </div>
    )
  } catch (err) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Test Catalog - Exception</h1>
        <pre className="bg-red-100 p-4 rounded">
          {err instanceof Error ? err.message : 'Unknown error'}
        </pre>
      </div>
    )
  }
}
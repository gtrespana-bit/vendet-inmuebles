import { supabase } from '@/lib/supabase'

export default async function TestProductPage() {
  try {
    // First get a product ID
    const { data: products } = await supabase
      .from('productos')
      .select('id')
      .limit(1)

    if (!products || products.length === 0) {
      return (
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Test Product - No Products Found</h1>
          <p>No products found in database</p>
        </div>
      )
    }

    const productId = products[0].id
    console.log('Testing product ID:', productId)

    // Now try to fetch the product by ID (same query as getProduct function)
    const { data: product, error } = await supabase
      .from('productos')
      .select('id, titulo, descripcion, precio_usd, estado, categoria_id, subcategoria, marca, modelo, ubicacion_estado, ubicacion_ciudad, activo, visitas, creado_en, user_id, imagen_url, destacado, destacado_hasta, boosteado_en')
      .eq('id', productId)
      .eq('activo', true)
      .or('estado_moderacion.is.null,estado_moderacion.eq.aprobado')
      .single()

    if (error) {
      return (
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Test Product - Error</h1>
          <p>Error fetching product with ID: {productId}</p>
          <pre className="bg-red-100 p-4 rounded">
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      )
    }

    if (!product) {
      return (
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Test Product - Not Found</h1>
          <p>No product found with ID: {productId}</p>
        </div>
      )
    }

    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Test Product - Success</h1>
        <p>Product found successfully!</p>
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <strong>ID:</strong> {product.id} <br />
          <strong>Title:</strong> {product.titulo} <br />
          <strong>Description:</strong> {product.descripcion?.substring(0, 100)}... <br />
          <strong>Price:</strong> ${product.precio_usd} <br />
          <strong>Category ID:</strong> {product.categoria_id || 'None'} <br />
        </div>
      </div>
    )
  } catch (err) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Test Product - Exception</h1>
        <pre className="bg-red-100 p-4 rounded">
          {err instanceof Error ? err.message : 'Unknown error'}
        </pre>
      </div>
    )
  }
}
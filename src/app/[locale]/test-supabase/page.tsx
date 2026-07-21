import { supabase } from '@/lib/supabase'

export default async function TestSupabasePage() {
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('productos')
      .select('id, titulo, categoria_id')
      .limit(5)

    if (error) {
      return (
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Supabase Test - Error</h1>
          <pre className="bg-red-100 p-4 rounded">
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      )
    }

    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Supabase Test - Success</h1>
        <p>Connection successful! Found {data?.length} products:</p>
        <ul className="mt-4">
          {data?.map((product: any) => (
            <li key={product.id} className="mb-2 p-2 bg-gray-100 rounded">
              <strong>ID:</strong> {product.id} <br />
              <strong>Title:</strong> {product.titulo}
            </li>
          ))}
        </ul>
      </div>
    )
  } catch (err) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Supabase Test - Exception</h1>
        <pre className="bg-red-100 p-4 rounded">
          {err instanceof Error ? err.message : 'Unknown error'}
        </pre>
      </div>
    )
  }
}
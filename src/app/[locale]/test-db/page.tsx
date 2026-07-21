import { supabase } from '@/lib/supabase';
import LocalLink from '@/components/LocalLink';

export const dynamic = 'force-dynamic';

export default async function TestDBPage({ params }: { params: { locale: string } }) {
  const { locale } = await params;
  
  // Consultar las primeras 5 propiedades activas directamente
  const { data: propiedades, error } = await supabase
    .from('productos')
    .select('id, titulo, activo, precio_usd')
    .eq('activo', true)
    .limit(5);

  if (error) {
    return (
      <div className="p-10 text-red-600">
        <h1 className="text-2xl font-bold">Error de Conexión a BD</h1>
        <p>{error.message}</p>
        <p>Código: {error.code}</p>
      </div>
    );
  }

  if (!propiedades || propiedades.length === 0) {
    return (
      <div className="p-10 text-yellow-600">
        <h1 className="text-2xl font-bold">No hay datos</h1>
        <p>No se encontraron propiedades activas en la tabla 'productos'.</p>
        <p>Verifica que hayas insertado datos y que tengan `activo = true`.</p>
      </div>
    );
  }

  return (
    <div className="p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Prueba de Base de Datos (Productos Activos)</h1>
      <p className="mb-4">Si ves esta lista, la conexión a Supabase funciona correctamente.</p>
      
      <div className="grid gap-4">
        {propiedades.map((prop) => (
          <div key={prop.id} className="border p-4 rounded shadow bg-white">
            <h2 className="text-xl font-semibold">{prop.titulo}</h2>
            <p className="text-gray-600">ID: {prop.id}</p>
            <p className="text-green-600 font-bold">${prop.precio_usd}</p>
            <div className="mt-2 flex gap-2">
              <LocalLink 
                href={`/${locale}/inmueble/${prop.id}`}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Ver Detalle Real
              </LocalLink>
              <a 
                href={`/${locale}/inmueble/${prop.id}`}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                target="_blank"
              >
                Abrir en nueva pestaña
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-bold">Instrucciones:</h3>
        <ol className="list-decimal ml-5 mt-2 space-y-1">
          <li>Haz clic en "Ver Detalle Real" en cualquiera de los items.</li>
          <li>Si la página de detalle carga, el problema era el ID que estabas usando antes.</li>
          <li>Si da 404 de nuevo, revisa los logs de Vercel en tiempo real mientras haces clic.</li>
        </ol>
      </div>
    </div>
  );
}

/**
 * Catálogo único de ambientes, servicios y amenidades de un inmueble.
 *
 * Se usa en:
 * - Formulario de publicación (/publicar-inmueble) y de edición (/inmueble/editar/[id]).
 * - Filtros avanzados del catálogo (URL `?amenidades=clave1,clave2`).
 * - Ficha del anuncio, para traducir los nombres guardados en la BD.
 *
 * `name` es el valor canónico que se guarda en `caracteristicas.nombre` (en
 * español y sin cambios entre idiomas). `key` es estable para filtros y para
 * buscar las traducciones `catalog.extra.amenity.<key>` (ES/EN).
 *
 * IMPORTANTE: no renombrar los `name` existentes; los anuncios ya guardan ese
 * texto y se quedarían sin etiqueta/coincidencia.
 */

export const AMENITY_GROUPS = ['ambientes', 'servicios', 'seguridad', 'exteriores'] as const
export type AmenityGroupKey = (typeof AMENITY_GROUPS)[number]

export interface AmenityDefinition {
  key: string
  name: string
  group: AmenityGroupKey
  /**
   * `false` para las que el formulario edita con un control propio
   * (electricidad, agua y amueblado) y por tanto no se repiten como checkbox.
   */
  formOption?: boolean
}

export const AMENITIES: readonly AmenityDefinition[] = [
  // Ambientes
  { key: 'sala', name: 'Sala', group: 'ambientes' },
  { key: 'comedor', name: 'Comedor', group: 'ambientes' },
  { key: 'cocina', name: 'Cocina', group: 'ambientes' },
  { key: 'cocinaEquipada', name: 'Cocina equipada', group: 'ambientes' },
  { key: 'lavanderia', name: 'Lavandería', group: 'ambientes' },
  { key: 'estudio', name: 'Estudio', group: 'ambientes' },
  { key: 'familyRoom', name: 'Family room', group: 'ambientes' },
  { key: 'walkInCloset', name: 'Walk-in closet', group: 'ambientes' },
  { key: 'banoVisitas', name: 'Baño de visitas', group: 'ambientes' },
  { key: 'deposito', name: 'Depósito', group: 'ambientes' },
  { key: 'balcon', name: 'Balcón o terraza', group: 'ambientes' },
  { key: 'patio', name: 'Patio interior', group: 'ambientes' },

  // Servicios
  { key: 'gas', name: 'Gas doméstico', group: 'servicios' },
  { key: 'aire', name: 'Aire acondicionado', group: 'servicios' },
  { key: 'ventiladores', name: 'Ventiladores', group: 'servicios' },
  { key: 'generador', name: 'Generador eléctrico', group: 'servicios' },
  { key: 'ascensor', name: 'Ascensor', group: 'servicios' },
  { key: 'cisterna', name: 'Cisterna', group: 'servicios' },
  { key: 'internet', name: 'Internet o fibra óptica', group: 'servicios' },
  { key: 'cable', name: 'Cable o TV satelital', group: 'servicios' },
  { key: 'calentador', name: 'Calentador de agua', group: 'servicios' },
  { key: 'riego', name: 'Sistema de riego', group: 'servicios' },
  { key: 'agua24', name: 'Agua 24 horas', group: 'servicios', formOption: false },
  { key: 'electricidad110', name: 'Electricidad 110V', group: 'servicios', formOption: false },
  { key: 'electricidad220', name: 'Electricidad 220V', group: 'servicios', formOption: false },
  { key: 'amueblado', name: 'Amueblado', group: 'servicios', formOption: false },
  { key: 'amuebladoParcial', name: 'Amueblado parcialmente', group: 'servicios', formOption: false },

  // Seguridad
  { key: 'seguridad', name: 'Seguridad 24 horas', group: 'seguridad' },
  { key: 'camaras', name: 'Cámaras de seguridad', group: 'seguridad' },
  { key: 'conjuntoPrivado', name: 'Conjunto privado', group: 'seguridad' },
  { key: 'urbanizacionCerrada', name: 'Urbanización cerrada', group: 'seguridad' },
  { key: 'portonElectrico', name: 'Portón eléctrico', group: 'seguridad' },
  { key: 'cercaElectrica', name: 'Cerca eléctrica', group: 'seguridad' },
  { key: 'alarma', name: 'Alarma de seguridad', group: 'seguridad' },
  { key: 'controlAcceso', name: 'Control de acceso', group: 'seguridad' },

  // Exteriores y áreas comunes
  { key: 'piscina', name: 'Piscina', group: 'exteriores' },
  { key: 'jardin', name: 'Jardín', group: 'exteriores' },
  { key: 'parrillera', name: 'Área de parrillera', group: 'exteriores' },
  { key: 'gimnasio', name: 'Gimnasio', group: 'exteriores' },
  { key: 'salonFiestas', name: 'Salón de fiestas', group: 'exteriores' },
  { key: 'cancha', name: 'Cancha deportiva', group: 'exteriores' },
  { key: 'juegosInfantiles', name: 'Área de juegos infantiles', group: 'exteriores' },
  { key: 'estacionamientoVisitantes', name: 'Estacionamiento de visitantes', group: 'exteriores' },
] as const

export interface AmenityGroup {
  key: AmenityGroupKey
  options: readonly AmenityDefinition[]
}

/** Opciones que se muestran como checkbox en los formularios, agrupadas. */
export const FORM_AMENITY_GROUPS: readonly AmenityGroup[] = AMENITY_GROUPS
  .map((group) => ({ key: group, options: AMENITIES.filter((item) => item.group === group && item.formOption !== false) }))
  .filter((group) => group.options.length > 0)

/** Lista plana de todas las amenidades (incluye las de control propio). */
export const ALL_AMENITIES: readonly AmenityDefinition[] = AMENITIES

/** Normaliza un nombre para comparar sin depender de mayúsculas ni tildes. */
export function normalizarAmenidad(valor: unknown): string {
  if (typeof valor !== 'string') return ''
  return valor.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es')
}

const AMENITY_BY_NORMALIZED_NAME = new Map<string, AmenityDefinition>(
  AMENITIES.map((item) => [normalizarAmenidad(item.name), item]),
)

/** Devuelve la definición del catálogo para un nombre guardado (o null). */
export function buscarAmenidad(nombre: unknown): AmenityDefinition | null {
  const clave = normalizarAmenidad(nombre)
  return clave ? AMENITY_BY_NORMALIZED_NAME.get(clave) ?? null : null
}

/** Clave i18n (`catalog.extra.amenity.<key>`) de un nombre guardado, o null. */
export function claveAmenidad(nombre: unknown): string | null {
  return buscarAmenidad(nombre)?.key ?? null
}

/**
 * Nombre canónico del catálogo si el valor se reconoce (sin distinguir
 * mayúsculas ni tildes); si no, devuelve el texto recortado tal cual.
 */
export function nombreCanonicoAmenidad(nombre: string): string {
  return buscarAmenidad(nombre)?.name ?? nombre.trim()
}

/** Orden de presentación (catálogo primero; desconocidas al final). */
export function ordenAmenidad(nombre: string): number {
  const definicion = buscarAmenidad(nombre)
  return definicion ? AMENITIES.indexOf(definicion) : Number.MAX_SAFE_INTEGER
}

/**
 * Lee `caracteristicas` tal y como lo devuelve la vista (jsonb: array de textos,
 * array de objetos, texto separado por comas o mapa clave→bool) y devuelve la
 * lista limpia y sin duplicados. NO recorta: se muestran todas las que el dueño
 * haya guardado, aunque no estén en el catálogo.
 */
export function leerAmenidades(valor: unknown): string[] {
  const candidatas: string[] = []

  if (Array.isArray(valor)) {
    for (const item of valor) {
      const texto = typeof item === 'string'
        ? item
        : (item as { nombre?: unknown; label?: unknown; name?: unknown } | null)?.nombre
          || (item as { label?: unknown } | null)?.label
          || (item as { name?: unknown } | null)?.name
      if (typeof texto === 'string' && texto.trim()) candidatas.push(texto.trim())
    }
  } else if (typeof valor === 'string') {
    candidatas.push(...valor.split(/[,;|]/).map((item) => item.trim()).filter(Boolean))
  } else if (valor && typeof valor === 'object') {
    for (const [clave, activo] of Object.entries(valor as Record<string, unknown>)) {
      if (activo === true || activo === 1 || (typeof activo === 'string' && activo.trim())) {
        candidatas.push(typeof activo === 'string' && activo !== 'true'
          ? activo.trim()
          : clave.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letra) => letra.toUpperCase()))
      }
    }
  }

  const vistas = new Set<string>()
  const resultado: string[] = []
  for (const nombre of candidatas) {
    const clave = normalizarAmenidad(nombre)
    if (!clave || vistas.has(clave)) continue
    vistas.add(clave)
    resultado.push(nombre)
  }
  return resultado
}

/**
 * Catálogo curado de urbanizaciones y zonas residenciales/comerciales de alta
 * demanda en Venezuela + utilidades puras de búsqueda geográfica y cálculo de $/m².
 *
 * Compatible con `node --experimental-strip-types` (sin imports `@/`).
 */

export interface CiudadUrbanizaciones {
  ciudad: string
  estado: string
  aliases?: readonly string[]
  zonas: readonly string[]
}

export const URBANIZACIONES_VENEZUELA: readonly CiudadUrbanizaciones[] = [
  {
    ciudad: 'Caracas',
    estado: 'Distrito Capital',
    aliases: ['Libertador', 'Chacao', 'Baruta', 'Sucre', 'El Hatillo', 'Petare'],
    zonas: [
      'Las Mercedes',
      'Altamira',
      'Los Palos Grandes',
      'La Castellana',
      'Campo Alegre',
      'El Rosal',
      'Chuao',
      'Valle Arriba',
      'Prados del Este',
      'Santa Fe',
      'Cumbres de Curumo',
      'Los Naranjos',
      'El Hatillo',
      'La Lagunita',
      'Cerro Verde',
      'Sebucán',
      'Los Chorros',
      'El Cafetal',
      'Terrazas del Ávila',
      'La Tahona',
      'La Trinidad',
      'San Bernardino',
      'La Florida',
      'El Paraíso',
      'Montalbán',
    ],
  },
  {
    ciudad: 'San Antonio de los Altos',
    estado: 'Miranda',
    aliases: ['Los Salias', 'Los Teques', 'Guarenas', 'Guatire'],
    zonas: [
      'La Rosaleda',
      'El Picacho',
      'Las Minas',
      'Los Castores',
      'Parque El Retiro',
      'Buenaventura',
      'Nueva Casarapa',
    ],
  },
  {
    ciudad: 'Valencia',
    estado: 'Carabobo',
    aliases: ['Naguanagua', 'San Diego', 'Tocuyito', 'Guacara'],
    zonas: [
      'El Viñedo',
      'Prebo',
      'La Trigaleña',
      'El Parral',
      'Las Chimeneas',
      'Guataparo',
      'Altos de Guataparo',
      'La Viña',
      'Los Mangos',
      'Camoruco',
      'Agua Blanca',
      'Mañongo',
      'La Granja',
      'Tazajal',
      'Palma Real',
      'El Remanso',
      'Monteserino',
      'Paso Real',
      'Zona Industrial Municipal Norte',
    ],
  },
  {
    ciudad: 'Maracaibo',
    estado: 'Zulia',
    aliases: ['San Francisco', 'Cabimas'],
    zonas: [
      'Tierra Negra',
      'Bella Vista',
      'Lago Mar Beach',
      'La Virginia',
      'Milagro Norte',
      'El Rosal Sur',
      'Isla Dorada',
      'La Lago',
      'Ciudadela Faría',
      'Las Naciones',
      'Los Olivos',
    ],
  },
  {
    ciudad: 'Lechería',
    estado: 'Anzoátegui',
    aliases: ['Diego Bautista Urbaneja', 'Barcelona', 'Puerto La Cruz', 'Sotillo', 'Simón Bolívar'],
    zonas: [
      'Las Villas',
      'Pueblo Viejo',
      'Marina del Rey',
      'El Morro',
      'Cerro Amarillo',
      'Playa Mansa',
      'Guaicamar',
      'Venecia',
      'Nueva Barcelona',
      'Pascal',
    ],
  },
  {
    ciudad: 'Barquisimeto',
    estado: 'Lara',
    aliases: ['Iribarren', 'Cabudare', 'Palavecino'],
    zonas: [
      'Nueva Segovia',
      'El Este',
      'Los Leones',
      'Santa Elena',
      'Colinas de Santa Rosa',
      'Las Trinitarias',
      'Roca Coronado',
      'Fundalara',
      'Valle Hondo',
      'Agua Viva',
    ],
  },
  {
    ciudad: 'Maracay',
    estado: 'Aragua',
    aliases: ['Girardot', 'Turmero', 'Cagua', 'El Limón'],
    zonas: [
      'Las Delicias',
      'Base Aragua',
      'Andrés Bello',
      'El Castaño',
      'Cantarrana',
      'San Isidro',
      'Calicanto',
      'La Soledad',
      'Bosque Alto',
    ],
  },
  {
    ciudad: 'Porlamar',
    estado: 'Nueva Esparta',
    aliases: ['Mariño', 'Maneiro', 'Pampatar', 'La Asunción', 'Margarita'],
    zonas: [
      'Costa Azul',
      'Playa El Ángel',
      'Jorge Coll',
      'Los Robles',
      'Playa Moreno',
      'Rattan Plaza',
      'Playa Guacuco',
      'El Yaque',
      'Juan Griego',
    ],
  },
  {
    ciudad: 'Mérida',
    estado: 'Mérida',
    aliases: ['Libertador', 'Ejido', 'Campo Elías'],
    zonas: [
      'Las Tapias',
      'El Rosario',
      'La Pedregosa',
      'Alto Prado',
      'Santa María',
      'Los Chorros de Milla',
      'La Hechicera',
    ],
  },
  {
    ciudad: 'San Cristóbal',
    estado: 'Táchira',
    aliases: ['Cárdenas', 'Táriba', 'Guásimos'],
    zonas: [
      'Barrio Obrero',
      'Pirineos',
      'Las Acacias',
      'Pueblo Nuevo',
      'Quinimarí',
      'Santa Teresa',
      'Paramillo',
    ],
  },
  {
    ciudad: 'Puerto Ordaz',
    estado: 'Bolívar',
    aliases: ['Caroní', 'Ciudad Guayana', 'San Félix', 'Ciudad Bolívar'],
    zonas: [
      'Alta Vista',
      'Los Olivos',
      'Villa Africana',
      'Roraima',
      'Ventuari',
      'Campo B',
      'Villa Brasil',
      'Unare',
    ],
  },
  {
    ciudad: 'Maturín',
    estado: 'Monagas',
    aliases: [],
    zonas: ['Tipuro', 'Juanico', 'Palma Real', 'Las Garzas', 'San Miguel'],
  },
  {
    ciudad: 'Cumaná',
    estado: 'Sucre',
    aliases: [],
    zonas: ['San Luis', ' Cristóbal Colón', 'Avenida Perimetral', 'Santa Inés'].map((z) => z.trim()),
  },
]

export const CIUDADES_PRINCIPALES_BUSQUEDA: readonly string[] = [
  'Caracas',
  'Valencia',
  'Maracaibo',
  'Lechería',
  'Barquisimeto',
  'Maracay',
  'Porlamar',
  'Mérida',
  'San Cristóbal',
  'Puerto Ordaz',
  'San Diego',
  'Naguanagua',
  'Barcelona',
  'Puerto La Cruz',
  'Maturín',
  'Cumaná',
]

function normalizeGeoToken(raw: string): string {
  return raw
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const ALL_POPULAR_ZONES: readonly string[] = Array.from(
  new Set(URBANIZACIONES_VENEZUELA.flatMap((entry) => entry.zonas))
)

const KNOWN_CITY_MAP = new Map<string, string>(
  [
    ...CIUDADES_PRINCIPALES_BUSQUEDA.map((c) => [normalizeGeoToken(c), c] as const),
    ...URBANIZACIONES_VENEZUELA.flatMap((entry) => [
      [normalizeGeoToken(entry.ciudad), entry.ciudad] as const,
      ...(entry.aliases || []).map((a) => [normalizeGeoToken(a), a] as const),
    ]),
  ]
)

/**
 * Devuelve urbanizaciones/zonas sugeridas según estado y/o ciudad-municipio seleccionados.
 * Si no hay filtro activo, devuelve las urbanizaciones más buscadas del país.
 */
export function getUrbanizacionesSugeridas(estado?: string | null, ciudad?: string | null): string[] {
  const normEstado = estado ? normalizeGeoToken(estado) : ''
  const normCiudad = ciudad ? normalizeGeoToken(ciudad) : ''

  if (!normEstado && !normCiudad) {
    return ALL_POPULAR_ZONES.slice(0, 32)
  }

  const matched = new Set<string>()
  for (const entry of URBANIZACIONES_VENEZUELA) {
    const entryEstado = normalizeGeoToken(entry.estado)
    const entryCiudad = normalizeGeoToken(entry.ciudad)
    const aliases = (entry.aliases || []).map(normalizeGeoToken)

    const cityMatch =
      normCiudad &&
      (entryCiudad === normCiudad ||
        aliases.includes(normCiudad) ||
        entryCiudad.includes(normCiudad) ||
        normCiudad.includes(entryCiudad))

    // Área Metropolitana de Caracas abarca Distrito Capital + municipios mirandinos (Chacao, Baruta, Sucre, El Hatillo)
    const stateMatch =
      normEstado &&
      (entryEstado === normEstado ||
        (normEstado === 'miranda' && entryCiudad === 'caracas') ||
        (normEstado === 'distrito capital' && entryCiudad === 'caracas'))

    if ((normCiudad && cityMatch) || (!normCiudad && stateMatch)) {
      for (const z of entry.zonas) matched.add(z)
    }
  }

  if (matched.size === 0 && normEstado) {
    for (const entry of URBANIZACIONES_VENEZUELA) {
      if (normalizeGeoToken(entry.estado) === normEstado) {
        for (const z of entry.zonas) matched.add(z)
      }
    }
  }

  return Array.from(matched)
}

/**
 * Clasifica el texto ingresado en el buscador rápido de portada:
 * - Si coincide con una ciudad conocida → `{ kind: 'ciudad', value: CiudadCanonica }`
 * - Si coincide con una urbanización o texto libre → `{ kind: 'zona', value }`
 */
export function classifyLocationInput(raw: string): { kind: 'empty' | 'ciudad' | 'zona'; value: string } {
  const trimmed = raw.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!trimmed) return { kind: 'empty', value: '' }

  const norm = normalizeGeoToken(trimmed)
  const knownCity = KNOWN_CITY_MAP.get(norm)
  if (knownCity) {
    return { kind: 'ciudad', value: knownCity }
  }
  return { kind: 'zona', value: trimmed }
}

/**
 * Limpia un término de texto libre para usarlo de forma segura dentro de un `.or(...)` de PostgREST,
 * eliminando comas, paréntesis, comodines y caracteres de control que romperían la sintaxis del filtro.
 */
export function sanitizePostgrestSearchTerm(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .replace(/[,()*%\\'"`;]/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

/**
 * Calcula el precio por m² redondeado al entero más cercano.
 * Prioriza `areaConstruida` (si > 0) y como respaldo usa `areaTotal` (si > 0).
 */
export function calculatePricePerM2(
  price: unknown,
  builtArea?: unknown,
  totalArea?: unknown
): number | null {
  const numPrice = Number(price)
  if (!Number.isFinite(numPrice) || numPrice <= 0) return null

  const built = Number(builtArea)
  const total = Number(totalArea)
  const effectiveArea = Number.isFinite(built) && built > 0
    ? built
    : Number.isFinite(total) && total > 0
      ? total
      : 0

  if (effectiveArea <= 0) return null
  const ratio = Math.round(numPrice / effectiveArea)
  return ratio > 0 ? ratio : null
}

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import {
  buildSavedSearchLabel,
  buildSavedSearchQueryString,
  computeSavedSearchFingerprint,
  hasMeaningfulSavedSearchFilters,
  matchesSavedSearch,
  normalizeSavedSearchFilters,
} from '../src/lib/saved-searches.ts'
import {
  computeComparisonHighlights,
  MAX_COMPARE_ITEMS,
  parseCompareIds,
  toggleCompareItem,
} from '../src/lib/property-compare.ts'
import {
  computeZonePriceBenchmark,
  estimateDirectFinancing,
  estimateRentalMoveIn,
  estimateRentalYield,
} from '../src/lib/financial-estimator.ts'
import {
  buildGoogleCalendarUrl,
  buildVisitIcsContent,
  buildVisitsCsv,
  resolveVenezuelaVisitUtcWindow,
} from '../src/lib/visit-calendar.ts'
import {
  normalizarRutaParaAgrupacion,
  sanitizarUrlRuta,
} from '../src/lib/error-diagnostics.ts'

test('Etapa B — Búsquedas guardadas: huella determinista, etiqueta legible y coincidencias precisas', () => {
  const f1 = normalizeSavedSearchFilters({
    operacion: 'venta',
    categoria: 'Casas',
    estado: 'Carabobo',
    ciudad: 'San Diego',
    zona: 'Poblado de San Diego',
    precioMax: '100000',
    habitaciones: '3',
  })
  const f2 = normalizeSavedSearchFilters(
    new URLSearchParams(
      'zona=poblado+de+san+diego&ciudad=SAN+DIEGO&estado=carabobo&operacion=VENTA&categoria=casas&precioMax=100000&habitaciones=3',
    ),
  )

  assert.equal(hasMeaningfulSavedSearchFilters(f1), true)
  assert.equal(hasMeaningfulSavedSearchFilters(normalizeSavedSearchFilters({})), false)
  assert.equal(computeSavedSearchFingerprint(f1), computeSavedSearchFingerprint(f2))

  const labelEs = buildSavedSearchLabel(f1, 'es')
  const labelEn = buildSavedSearchLabel(f1, 'en')
  assert.match(labelEs, /Venta/)
  assert.match(labelEs, /Poblado de San Diego/)
  assert.match(labelEs, /\$100,000/)
  assert.match(labelEn, /Sale/)
  assert.match(buildSavedSearchQueryString(f1), /operacion=venta/)

  const matchOk = matchesSavedSearch(
    {
      id: '63d4a689-ebf3-436e-86fc-fff6509b9afb',
      titulo: 'Casa Quinta en el Poblado de San Diego',
      operacion_slug: 'venta',
      tipo_nombre: 'Casa',
      estado: 'Carabobo',
      ciudad: 'San Diego',
      zona: 'Poblado de San Diego',
      precio_usd: 85000,
      habitaciones: 4,
    },
    f1,
  )
  assert.equal(matchOk, true)

  // Falla si supera presupuesto
  assert.equal(
    matchesSavedSearch(
      {
        id: '63d4a689-ebf3-436e-86fc-fff6509b9afc',
        titulo: 'Casa de lujo en San Diego',
        operacion_slug: 'venta',
        tipo_nombre: 'Casa',
        estado: 'Carabobo',
        ciudad: 'San Diego',
        zona: 'Poblado de San Diego',
        precio_usd: 150000,
        habitaciones: 4,
      },
      f1,
    ),
    false,
  )

  // Falla si es alquiler en vez de venta
  assert.equal(
    matchesSavedSearch(
      {
        id: '63d4a689-ebf3-436e-86fc-fff6509b9afd',
        titulo: 'Casa en alquiler Poblado de San Diego',
        operacion_slug: 'alquiler',
        tipo_nombre: 'Casa',
        estado: 'Carabobo',
        ciudad: 'San Diego',
        zona: 'Poblado de San Diego',
        precio_usd: 600,
        habitaciones: 3,
      },
      f1,
    ),
    false,
  )
})

test('Etapa B — Comparador: límite de 4 inmuebles, cálculo de mejores métricas e higiene SEO', () => {
  const id1 = '11111111-1111-4111-8111-111111111111'
  const id2 = '22222222-2222-4222-8222-222222222222'
  const id3 = '33333333-3333-4333-8333-333333333333'
  const id4 = '44444444-4444-4444-8444-444444444444'
  const id5 = '55555555-5555-4555-8555-555555555555'

  const parsed = parseCompareIds(`${id1},${id2},${id1},invalido,${id3},${id4},${id5}`)
  assert.equal(parsed.length, MAX_COMPARE_ITEMS)
  assert.deepEqual(parsed, [id1, id2, id3, id4])

  let list = []
  for (const id of [id1, id2, id3, id4]) {
    const res = toggleCompareItem(list, { id, title: `Prop ${id}` })
    assert.equal(res.action, 'added')
    list = res.next
  }
  const overLimit = toggleCompareItem(list, { id: id5, title: 'Prop 5' })
  assert.equal(overLimit.action, 'limit_reached')
  assert.equal(overLimit.next.length, 4)

  const removed = toggleCompareItem(list, { id: id2, title: 'Prop 2' })
  assert.equal(removed.action, 'removed')
  assert.equal(removed.next.length, 3)

  const highlights = computeComparisonHighlights([
    {
      id: id1,
      title: 'Apartamento compacto',
      price: 55000,
      currency: 'USD',
      operation: 'venta',
      builtArea: 65,
      totalArea: 65,
      bedrooms: 2,
      hasVideo: false,
      hasTour: false,
      hasFloorPlan: false,
      verifiedSeller: true,
      amenities: ['Planta eléctrica', 'Pozo de agua'],
    },
    {
      id: id2,
      title: 'Casa amplia',
      price: 90000,
      currency: 'USD',
      operation: 'venta',
      builtArea: 180,
      totalArea: 240,
      bedrooms: 4,
      hasVideo: true,
      hasTour: true,
      hasFloorPlan: true,
      verifiedSeller: true,
      amenities: ['Pozo de agua', 'Jardín'],
    },
  ])

  assert.equal(highlights.lowestPriceId, id1)
  // id2 tiene $500/m² vs id1 $846/m²
  assert.equal(highlights.lowestPricePerM2Id, id2)
  assert.equal(highlights.largestAreaId, id2)
  assert.equal(highlights.mostBedroomsId, id2)
  assert.deepEqual(highlights.allAmenities, ['Jardín', 'Planta eléctrica', 'Pozo de agua'])

  // Higiene SEO de /comparar
  const comparePage = readFileSync('src/app/[locale]/comparar/page.tsx', 'utf8')
  assert.match(comparePage, /robots:\s*\{\s*index:\s*false,\s*follow:\s*true\s*\}/)
  const robotsSource = readFileSync('src/app/robots.ts', 'utf8')
  assert.match(robotsSource, /'\/comparar'/)
})

test('Etapa B — Calculadora inmobiliaria venezolana: financiamiento directo, BCV, ROI y alquiler', () => {
  const fin = estimateDirectFinancing({
    priceUsd: 100000,
    downPaymentPct: 40,
    termMonths: 12,
    annualInterestPct: 0,
    closingCostsPct: 2.5,
    bcvRate: 50,
  })
  assert.equal(fin.downPaymentUsd, 40000)
  assert.equal(fin.closingCostsUsd, 2500)
  assert.equal(fin.upfrontTotalUsd, 42500)
  assert.equal(fin.financedPrincipalUsd, 60000)
  assert.equal(fin.monthlyPaymentUsd, 5000)
  assert.equal(fin.priceVes, 5000000)
  assert.equal(fin.monthlyPaymentVes, 250000)

  const roi = estimateRentalYield({
    priceUsd: 80000,
    estimatedMonthlyRentUsd: 600,
    annualExpensesPct: 10,
  })
  assert.equal(roi.grossAnnualIncomeUsd, 7200)
  assert.equal(roi.grossYieldPct, 9)
  assert.equal(roi.netAnnualIncomeUsd, 6480)
  assert.equal(roi.netYieldPct, 8.1)
  assert.ok(roi.paybackYears && roi.paybackYears > 12 && roi.paybackYears < 13)

  const moveIn = estimateRentalMoveIn({
    monthlyRentUsd: 450,
    depositMonths: 2,
    advanceMonths: 1,
    adminFeeMonths: 1,
    bcvRate: 45,
  })
  assert.equal(moveIn.totalMoveInUsd, 1800)
  assert.equal(moveIn.totalMoveInVes, 81000)

  const benchmark = computeZonePriceBenchmark(820, [950, 1000, 1080, 1120])
  assert.ok(benchmark)
  assert.equal(benchmark.medianPricePerM2, 1040)
  assert.equal(benchmark.positioning, 'below_market')
  assert.ok(benchmark.deltaPct < -15)
  assert.equal(computeZonePriceBenchmark(900, [950]), null)
})

test('Etapa B — Calendario (.ics / Google Calendar VET UTC-4) y exportación CSV anti-inyección', () => {
  // 09:30 VET (America/Caracas, UTC-4) === 13:30 UTC
  const win = resolveVenezuelaVisitUtcWindow('2026-11-14', 'manana')
  assert.deepEqual(win, {
    startUtc: '20261114T133000Z',
    endUtc: '20261114T143000Z',
  })

  const gcal = buildGoogleCalendarUrl({
    id: 'vis-123',
    propertyTitle: 'Casa Quinta en San Diego',
    propertyUrl: 'https://venezuela-inmuebles.online/inmueble/casa-quinta',
    location: 'Poblado de San Diego, Carabobo',
    modalidad: 'presencial',
    fechaPreferida: '2026-11-14',
    franjaHoraria: 'manana',
    counterpartyName: 'María Pérez',
    notes: 'Confirmado en garita principal',
    locale: 'es',
  })
  assert.ok(gcal)
  assert.match(gcal, /calendar\.google\.com\/calendar\/render/)
  assert.match(gcal, /20261114T133000Z%2F20261114T143000Z/)
  assert.match(gcal, /ctz=America%2FCaracas/)

  const ics = buildVisitIcsContent({
    id: 'vis-123',
    propertyTitle: 'Casa Quinta en San Diego',
    propertyUrl: 'https://venezuela-inmuebles.online/inmueble/casa-quinta',
    location: 'San Diego, Carabobo',
    modalidad: 'videollamada',
    fechaPreferida: '2026-11-14',
    franjaHoraria: 'tarde',
    locale: 'es',
  })
  assert.ok(ics)
  assert.match(ics, /BEGIN:VCALENDAR/)
  assert.match(ics, /DTSTART:20261114T190000Z/)
  assert.match(ics, /SUMMARY:Videollamada inmueble: Casa Quinta en San Diego/)

  // CSV neutraliza payloads `=CMD(...)` de inyección de fórmulas
  const csv = buildVisitsCsv([
    {
      createdAt: '2026-11-01 14:20',
      status: 'Pendiente',
      propertyTitle: 'Casa, "El Bosque"',
      location: 'Valencia, Carabobo',
      modality: 'Visita presencial',
      preferredDate: '2026-11-14',
      timeSlot: 'Mañana',
      contactName: '=HYPERLINK("https://evil.example","Click")',
      contactPhone: '+584121234567',
      contactEmail: 'comprador@example.com',
      assignedAgent: 'Ana Gómez',
      message: 'Me interesa visitar el sábado',
      sellerNote: '',
    },
  ])
  assert.match(csv, /"'=HYPERLINK\(""https:\/\/evil\.example"",""Click""\)"/)
})

test('Etapa B — Disparo en tiempo real de alertas inmediatas al publicar o aprobar en moderación', () => {
  const propertiesRoute = readFileSync('src/app/api/properties/route.ts', 'utf8')
  const publicarRoute = readFileSync('src/app/api/publicar/route.ts', 'utf8')
  const moderarRoute = readFileSync('src/app/api/admin/moderar-producto/route.ts', 'utf8')

  assert.match(propertiesRoute, /dispararAlertasInmediatasPorInmueble/)
  assert.match(publicarRoute, /dispararAlertasInmediatasPorInmueble/)
  assert.match(moderarRoute, /dispararAlertasInmediatasPorInmueble/)
})

test('Etapa B — Migración 021 en PostgreSQL (PGlite): RLS estricto para búsquedas y visitas de agencia', async () => {
  const db = new PGlite()

  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role SUPERUSER;

    CREATE TABLE public.perfiles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre text
    );
    CREATE TABLE public.agencias (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      nombre text NOT NULL,
      owner_id uuid NOT NULL REFERENCES public.perfiles(id)
    );
    CREATE TABLE public.agencia_miembros (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      agencia_id uuid NOT NULL REFERENCES public.agencias(id),
      user_id uuid NOT NULL REFERENCES public.perfiles(id),
      rol text NOT NULL,
      estado text NOT NULL DEFAULT 'activo'
    );
    CREATE TABLE public.inmuebles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id uuid NOT NULL REFERENCES public.perfiles(id),
      agencia_id uuid REFERENCES public.agencias(id),
      agente_asignado_id uuid REFERENCES public.perfiles(id),
      titulo text NOT NULL
    );
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT SELECT ON public.perfiles, public.agencias, public.agencia_miembros, public.inmuebles TO authenticated;
  `)

  await db.exec(readFileSync('supabase/migrations/021_etapa_b_alertas_visitas_comparador.sql', 'utf8'))
  await db.exec(readFileSync('supabase/migrations/022_etapa_b_visitas_comprador_rls.sql', 'utf8'))

  const uBuyer = (await db.query("INSERT INTO perfiles (nombre) VALUES ('Comprador') RETURNING id")).rows[0].id
  const uAgencyOwner = (await db.query("INSERT INTO perfiles (nombre) VALUES ('Dueño Agencia') RETURNING id")).rows[0].id
  const uAgent = (await db.query("INSERT INTO perfiles (nombre) VALUES ('Agente Asignado') RETURNING id")).rows[0].id
  const uStranger = (await db.query("INSERT INTO perfiles (nombre) VALUES ('Externo') RETURNING id")).rows[0].id

  const agenciaId = (
    await db.query("INSERT INTO agencias (nombre, owner_id) VALUES ('Inmobiliaria Centro', $1) RETURNING id", [uAgencyOwner])
  ).rows[0].id

  await db.query(
    "INSERT INTO agencia_miembros (agencia_id, user_id, rol, estado) VALUES ($1, $2, 'agente', 'activo')",
    [agenciaId, uAgent],
  )

  const propId = (
    await db.query(
      "INSERT INTO inmuebles (usuario_id, agencia_id, agente_asignado_id, titulo) VALUES ($1, $2, $3, 'Casa en San Diego') RETURNING id",
      [uAgencyOwner, agenciaId, uAgent],
    )
  ).rows[0].id

  // 1. Búsquedas guardadas: uBuyer inserta la suya, uStranger no puede leerla
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uBuyer}', false);`)
  await db.query(
    `INSERT INTO busquedas_guardadas (user_id, nombre, huella_filtros, query_string)
     VALUES ($1, 'Venta San Diego', 'srch_12345678', 'operacion=venta&ciudad=San+Diego')`,
    [uBuyer],
  )
  const ownSearches = await db.query('SELECT id FROM busquedas_guardadas')
  assert.equal(ownSearches.rows.length, 1)

  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${uStranger}', false);`)
  const strangerSearches = await db.query('SELECT id FROM busquedas_guardadas')
  assert.equal(strangerSearches.rows.length, 0)

  // 2. Solicitudes de visita: insertada vía service_role; visible para comprador, agente asignado y dueño de agencia, invisible para uStranger
  await db.exec('RESET ROLE;')
  const visitId = (
    await db.query(
      `INSERT INTO solicitudes_visita (inmueble_id, propietario_id, agencia_id, agente_id, solicitante_user_id, nombre_contacto, telefono_contacto, modalidad)
       VALUES ($1, $2, $3, $4, $5, 'María Pérez', '+584121234567', 'presencial')
       RETURNING id`,
      [propId, uAgencyOwner, agenciaId, uAgent, uBuyer],
    )
  ).rows[0].id

  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${uAgent}', false);`)
  const agentVisits = await db.query('SELECT id FROM solicitudes_visita')
  assert.equal(agentVisits.rows.length, 1)

  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${uAgencyOwner}', false);`)
  const ownerVisits = await db.query('SELECT id FROM solicitudes_visita')
  assert.equal(ownerVisits.rows.length, 1)

  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${uStranger}', false);`)
  const strangerVisits = await db.query('SELECT id FROM solicitudes_visita')
  assert.equal(strangerVisits.rows.length, 0)

  // 3. Migración 022: el comprador autenticado puede autocancelar su cita pero NO autoconfirmarla
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${uBuyer}', false);`)
  await assert.rejects(
    db.query("UPDATE solicitudes_visita SET estado = 'confirmada' WHERE id = $1", [visitId]),
  )
  await db.query("UPDATE solicitudes_visita SET estado = 'cancelada' WHERE id = $1", [visitId])
  const afterBuyerCancel = await db.query('SELECT estado FROM solicitudes_visita WHERE id = $1', [
    visitId,
  ])
  assert.equal(afterBuyerCancel.rows[0].estado, 'cancelada')
})

test('Monitor de errores: normaliza slugs dinámicos y descarta _rsc efímero de Next.js', () => {
  assert.equal(
    sanitizarUrlRuta('/inmueble/casa-quinta-en-san-diego-63d4a689?_rsc=mOUSFlFhBhxE8UbP'),
    '/inmueble/casa-quinta-en-san-diego-63d4a689',
  )
  assert.equal(
    normalizarRutaParaAgrupacion('/en/inmueble/casa-quinta-en-san-diego-63d4a689?_rsc=abc'),
    '/inmueble/:slug',
  )
  assert.equal(
    normalizarRutaParaAgrupacion('/inmueble/editar/63d4a689-ebf3-436e-86fc-fff6509b9afb'),
    '/inmueble/editar/:id',
  )
  assert.equal(
    normalizarRutaParaAgrupacion('/vendedor/inmobiliaria-carabobo'),
    '/vendedor/:slug',
  )
})

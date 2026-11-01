# Revisión integral — Venezuela Inmuebles

**Referencia:** código en `17b65fec1aaf67cb0819533a2db806aa363bf838` (incluye PR #32).  
**Modalidad:** auditoría técnica y funcional de solo lectura. No se han cambiado permisos, suscripciones, saldos, anuncios ni código de la aplicación.  
**Resultado:** hay una base funcional, pero **no considero correcto afirmar que toda la web está terminada o que todo funciona bien**. Hay fallos comprobados de negocio, navegación de listados, sesiones, traducción y SEO, además de riesgos de seguridad que deben tratarse antes de ampliar el uso comercial.

> **Seguimiento:** las primeras correcciones de seguridad están documentadas en [SEGURIDAD_BLOQUE_1.md](SEGURIDAD_BLOQUE_1.md). Este informe conserva los resultados originales de la auditoría; no describe por sí solo el estado posterior a esas correcciones.

## 1. Qué se ha comprobado y qué no

### Trabajo ejecutado

- Inventario de **57 archivos de rutas API**, revisión de los controles comunes y análisis específico de publicación, edición, pagos, planes, administración, mensajería, push, archivos y correo.
- Lectura de páginas, componentes compartidos, configuración, SQL y pruebas.
- `npm ci`, TypeScript, lint, **84/84 pruebas**, prueba adicional de traducciones de edición y build de producción: correctos. El build genera 660 páginas; eso **no significa 660 recorridos funcionales probados**.
- **50 comprobaciones HTTP locales** con servidor de producción: 30 peticiones a páginas/recursos y 20 a API sin credenciales.
- Lectura pública de portada, créditos, planes en inglés, pagos, una ficha real y un listado por estado en la web publicada.
- Consultas **de solo lectura** al proyecto real: tablas, vistas, privilegios de columnas, RLS, funciones, triggers, buckets, agregados y salud de servicios.
- Auditoría de dependencias con el registro npm disponible en el momento de esta revisión.

### Límites de la revisión

- El servidor local utiliza valores Supabase de ejemplo: no mide tiempos reales de producción ni inventario real. Los errores de conexión a ese servicio de ejemplo no se han clasificado como fallos de la web publicada.
- La lectura pública de la web no equivale a una sesión completa de navegador interactivo. **No se ha ejecutado Lighthouse/axe ni medido Core Web Vitals reales**; tampoco una validación visual exhaustiva en móviles físicos.
- No se han usado cuentas reales para publicar, pagar, gastar créditos, cambiar planes o intercambiar documentos. Esos recorridos necesitan pruebas controladas en staging y una prueba final autorizada.
- No se ha intentado explotar vulnerabilidades, saturar servicios ni demostrar exfiltración.
- No se han verificado paneles de Search Console, correo SMTP entregado, DNS de correo, restauración de backups, límites comerciales de Vercel ni MFA de administradores.
- Es una auditoría amplia de la aplicación disponible, **no una certificación de seguridad ni una garantía de ausencia de errores**.

**Evidencias resumidas:** `evidencias_revision_integral.json`. No contiene tokens ni comprobantes privados.

## 2. Resumen por área

| Área | Evaluación | Principal motivo |
|---|---|---|
| Seguridad y permisos | Correcciones prioritarias | Dependencias con avisos; guard de sesión con fallback sin firma; límites eludibles por escritura directa |
| Pagos y monetización | No dar por cerrado | Dos circuitos de compra; créditos incluidos no entregados por el circuito revisado; operaciones administrativas no atómicas |
| Planes y pruebas | Mejora reciente, aún incompleto | El plazo se conserva al cambiar, pero la bajada no pausa automáticamente el exceso y hay prestaciones anunciadas sin recorrido implementado |
| Publicación y edición | Inconsistente | Dos formularios/API; edición recorta a 20 fotos sin respetar 8/20/30; cambios parciales no transaccionales |
| Búsqueda y listados | Fallo comprobado | Un listado real muestra cero resultados donde existen 19 ventas públicas |
| SEO | Necesita revisión transversal | Canonicals heredados a la portada, títulos duplicados, indexación de cuenta/pagos y sitemap incoherente |
| Idiomas y textos | Fallos visibles | Claves internas en Créditos y contenido español en páginas inglesas |
| Rendimiento | Optimizable, sin nota CWV | JS compartido relevante, fotos sin optimización y consultas duplicadas/no-store amplio |
| Accesibilidad | Base parcial; falta prueba de navegador | Idioma HTML incorrecto en inglés, landmarks anidados y foco de modales |
| Operación, privacidad y calidad | Incompleto | Retención prometida no demostrada, cron diario para avisos diferidos y sin CI versionada |

### Prioridades

- **P0:** atender antes de aumentar exposición: dependencias sensibles con avisos severos.
- **P1:** siguiente bloque de trabajo: fallos de seguridad de aplicación, sesiones, monetización, límites, listados y SEO estructural.
- **P2:** estabilización: mensajes, operación, accesibilidad, rendimiento y consistencia.
- **P3:** mejoras de contenido/diseño una vez resuelto lo anterior.

«Confirmado en código/BD» no significa «explotación realizada». Se especifica cuando una conclusión requiere pruebas adicionales.

## 3. Seguridad

### F01 — P0 · Dependencias con avisos de seguridad

**Confirmado por npm audit.** Instalado: Next **14.2.35**, next-intl **3.26.5**, sharp **0.33.5**, nodemailer **6.10.1**, Sentry **7.120.4**.

- Árbol completo: **29 paquetes señalados** — 1 crítico, 8 altos, 18 moderados y 2 bajos.
- Excluyendo dependencias de desarrollo: **12** — 1 crítico, 5 altos, 4 moderados y 2 bajos.
- No son 29 ataques distintos ni prueba de que todos sean explotables en Vercel. Algunos avisos dependen de configuración, plataforma o funciones no utilizadas.
- Next y sharp merecen especial atención porque hay optimización/decodificación de imágenes y subida de archivos no confiables. `dangerouslyAllowSVG: true` amplía la superficie que conviene revisar.

**Acción:** actualización planificada a versiones corregidas y compatibles, con regresión de next-intl, cookies, middleware e imágenes. No ejecutar `npm audit fix --force` indiscriminadamente.

**Referencias de avisos devueltos por npm:** [Next/imágenes SVG](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [sharp/libvips](https://github.com/advisories/GHSA-f88m-g3jw-g9cj), [next-intl](https://github.com/advisories/GHSA-8f24-v5vv-gm5j). Confirmar versiones corregidas al ejecutar la actualización.

**Cierre:** auditoría sin vulnerabilidades altas/críticas aplicables al despliegue, o excepciones documentadas con análisis de exposición y mitigación.

### F02 — P1 · Los límites de anuncios/fotos no están asegurados en la base de datos

**Confirmado por código y permisos reales.** `checkPlanLimits` se usa en las API de creación, pero el propietario puede insertar inmuebles y cambiar `activo` directamente con Supabase. Las políticas verifican propiedad, no cupo. El trigger real `set_inmueble_defaults` genera slug/fecha; no impone límites.

Además, el propio panel reactiva anuncios con `.update({activo: true})`, sin comprobar el plan. El conteo y la inserción en las API son operaciones separadas, expuestas a carreras concurrentes. Las imágenes también tienen políticas de inserción basadas en propiedad.

**Impacto:** superar 3/10 anuncios o las fotos admitidas, incluso sin manipular otro usuario; los controles del formulario no bastan.

**Archivos:** `src/lib/plans.ts`; `src/app/api/properties/route.ts`; `src/app/[locale]/dashboard/components/tabs/TabProductos.tsx:70–76,218–221`; privilegios/RLS de `inmuebles` e `inmueble_imagenes`.

**Acción:** servicio/RPC transaccional para crear/reactivar, bloqueo por cuenta y regla única de cuota en BD; preservar las operaciones legítimas del propietario. Probar también dos peticiones simultáneas.

### F03 — P1 · El proveedor de sesión puede desuscribirse y no volver a escuchar

**Confirmado en código; falta reproducción de navegador autenticado.** El efecto de `AuthProvider` depende de `session`, modifica `session` y tiene un guard `initialized.current`. Tras cambiar sesión, React ejecuta cleanup (`cancelled=true`, unsubscribe) y el siguiente efecto sale porque ya está inicializado. En Strict Mode también debe revisarse el montaje doble.

**Impacto esperado:** cabecera, menús y estado de cuenta desincronizados tras login/logout/renovación de token, o carga incompleta en desarrollo.

**Archivo:** `src/components/AuthProvider.tsx:25–88`.

**Acción:** una suscripción por montaje, sin depender del estado que ella actualiza; cleanup correcto, prueba de login → refresh → logout → cambio de cuenta → expiración.

### F04 — P1 · La guardia de servidor acepta payload JWT sin verificar firma cuando hay un fallo de red

**Confirmado en código.** `getVerifiedUserFromCookies()` recurre a decodificar el token y comprobar su caducidad si Supabase tarda/falla; `getServerUser()` también decodifica sin validar firma. El código reconoce que ese parseo local no verifica la firma; que las API estén protegidas no convierte esa guardia en una verificación de sesión.

**Importante:** las API revisadas sí verifican el token contra Supabase. **No he demostrado acceso administrativo a datos ni una toma de cuenta.** El problema es que la guardia de renderizado no cumple la garantía de autenticación que su nombre promete.

**Archivo:** `src/lib/supabase-server.ts:30–49,71–115`; layouts de admin/dashboard.

**Acción:** verificación criptográfica local con claves confiables o rechazo seguro cuando no pueda verificarse. Unificar el criterio admin: layout por emails frente a API que además admite `app_metadata.role`.

### F05 — P1 · La vista pública expone datos que no deben confundirse con preferencias de botones

**Confirmado leyendo las vistas reales.** `vw_propiedades_publicas` y `vw_perfiles_publicos` incluyen el teléfono del perfil; la primera también dirección exacta, coordenadas y otros campos. El email sí se condiciona a `email_visible`; el teléfono no se condiciona a `metodos_contacto` de un anuncio.

**Impacto:** ocultar «Llamar» o elegir solo chat no impide que alguien lea el teléfono por la API pública. Si la promesa al anunciante es privacidad del dato, la interfaz no la asegura.

**Acción:** definir publicación/consentimiento por dato y restringir las vistas, no solo sus botones. Revisar especialmente coordenadas/dirección si se ofrece ubicación aproximada. No he incluido datos personales en esta auditoría.

### F06 — P1 · Subidas R2 con validación insuficiente y límite incompatible con el transporte

**Confirmado en código; comportamiento de archivos maliciosos no probado.** El multipart R2 admite 8 MB y comprueba MIME declarado, no decodifica la imagen como el flujo OCR. La URL prefirmada antigua no fija `ContentLength`. `/api/r2-upload` GET escribe un archivo de diagnóstico por cada llamada autenticada, sin ser una operación administrativa ni limpieza inmediata.

**Riesgos:** consumo de almacenamiento, archivos no válidos y peticiones que la plataforma puede rechazar antes del código. El límite habitual del body de una función Vercel debe contrastarse con el despliegue; anunciar 8 MB no lo garantiza.

**Archivos:** `src/app/api/r2-upload/route.ts`; `src/lib/r2-client.ts:45–60`.

**Acción:** validación real y reescritura de imágenes, límites coherentes de bytes/píxeles, claves inmutables, restricción de presigned y diagnóstico solo admin sin residuos.

### F07 — P2 · Rate limiter general no atómico y fail-open

**Confirmado.** Cuenta registros y luego inserta asíncronamente. Si la BD tarda 2,5 s o falla, permite continuar. Guardar una IP en el registro no equivale a limitar por IP: el filtro principal utiliza `identifier`.

**Archivo:** `src/lib/rate-limit.ts:62–142`.

**Acción:** reservas atómicas y política por operación. Reutilizar el enfoque de presupuesto OCR, que sí falla cerrado, en operaciones costosas/sensibles. Evitar registros sin retención efectiva.

**Revisión adicional pendiente:** los endpoints push aceptan destinos HTTPS sin allowlist de proveedores. Revisar riesgo SSRF/abuso de suscripciones en entorno controlado; no se han enviado solicitudes a destinos internos.

## 4. Pagos, planes y consistencia de negocio

### F08 — P1 · Sigue abierto el circuito antiguo de compra con importes elegidos por el navegador

**Confirmado.** `/api/comprar-creditos` permite cualquier entero positivo de créditos y precio no negativo, sin cotejar el catálogo ni confirmar la existencia del archivo. Después propone aprobación en Telegram.

**No acredita automáticamente:** el riesgo es un circuito paralelo manipulable que depende de que el administrador detecte la discrepancia; el nuevo checkout sí calcula precios en servidor.

**Acción:** retirar creación de compras antiguas o dirigir todo a órdenes con precio de servidor; conservar únicamente la revisión del historial pendiente. Un pago no debe poder aprobarse por dos sistemas.

### F09 — P1 · Ajustes administrativos no atómicos

**Confirmado.** `admin/add-creditos` lee saldo y escribe un valor absoluto, luego registra la transacción. El rollback también escribe el saldo anterior. Una compra/consumo concurrente puede perderse o sobrescribirse. `admin/planes` cancela suscripciones y después crea la nueva en peticiones independientes: un fallo intermedio deja una cuenta sin su plan anterior.

**Archivos:** `src/app/api/admin/add-creditos/route.ts`; `src/app/api/admin/planes/route.ts`.

**Acción:** RPC de saldo/ledger y cambios de plan en una sola transacción, bloqueo de fila e idempotencia. Los RPC nuevos de órdenes ya ofrecen parte de esta protección; no ocurre lo mismo en todos los caminos antiguos.

### F10 — P1 · Créditos incluidos en el plan anunciados, pero sin circuito de entrega/consumo conectado

**Confirmado en el recorrido revisado y en las funciones reales.** Se guarda `creditos_incluidos` y se anuncia 5/20 al mes. Activar un plan no los suma a `credito_balance`. `usar_boost` y `usar_destacado` descuentan únicamente de ese saldo. No se ha encontrado un proceso que renueve o consuma el cupo incluido; tampoco un trigger real de suscripción que lo haga.

**Archivos:** migraciones `009–011`; `src/lib/plans.ts`; funciones reales `usar_boost`, `usar_destacado`; `vercel.json`.

**Impacto:** una prestación vendida puede no estar disponible al cliente.

**Acción:** separar créditos incluidos/comprados y definir entrega inicial, vencimiento, renovación, cambios de plan y uso provisional. Probar que subir/cambiar repetidamente no genere créditos duplicados.

### F11 — P1 · Al bajar de plan no se aplica lo que promete la FAQ a los anuncios sobrantes

**Confirmado.** La FAQ dice que se pausarán automáticamente los anuncios adicionales. `checkPlanLimits` cambia el cupo y bloquea nuevas publicaciones, pero no pausa anuncios existentes. Las escrituras directas de reactivación agravan la diferencia (F02).

**Acción:** decidir regla de selección de anuncios conservados, avisar antes del vencimiento y ejecutarla de manera idempotente, o cambiar expresamente la promesa comercial. No pausar anuncios reales sin esa decisión.

**Decisión relacionada:** documentar explícitamente el cupo durante la prueba y al finalizar. El catálogo vigente aplica los límites del plan de prueba (10/ilimitados para Profesional/Agencia), y después los de Gratuita (3). Las pantallas y los procesos de vencimiento deben seguir esa misma regla, sin reiniciar el plazo al cambiar de plan.

### F12 — P1 · Gestión de equipos/agencia anunciada, sin recorrido completo encontrado

**Confirmado como ausencia en el repositorio revisado; verificar si existe otro sistema externo.** Se anuncia «5 usuarios», créditos compartidos, publicación masiva y mensajería por agente. Hay tablas de agencias/miembros, pero el registro crea perfil/suscripción, no un equipo; no aparecen pantallas/API de invitaciones, roles, cupos o saldo compartido.

**Acción:** implementar y probar esos recorridos o retirar temporalmente las promesas. Tipo de cuenta, plan contratado y pertenencia a una agencia deben ser conceptos distintos.

### F13 — P1 · La edición de imágenes no respeta los límites del plan y puede borrar fotos de Agencia

**Confirmado.** POST limita a 8/20/30 según plan. PATCH aplica siempre `.slice(0,20)`, sin consultar el plan. Al guardar un anuncio de Agencia con más de 20 fotos, las restantes salen de la lista conservada y se eliminan sus filas. Una cuenta gratuita podría guardar hasta 20 por ese endpoint.

También se actualizan campos, características y fotos en pasos independientes: un error posterior puede dejar una edición parcial.

**Archivo:** `src/app/api/properties/route.ts:285–335`.

**Acción:** mismo validador/cupo en alta y edición; rechazar de forma explícita un exceso en vez de truncar silenciosamente; transacción para la edición completa.

### F14 — P2 · OCR: gratuito y provisional, pero pendiente de validación operativa con comprobantes reales

**Riesgo aceptado, no un fallo nuevo:** una imagen coherente no prueba el ingreso. Las comprobaciones actuales son conservadoras, pero admiten pocos formatos de fecha/hora y etiquetas. Un recibo legítimo con AM/PM, formatos distintos, teléfono internacional o datos enmascarados puede ir a revisión.

**Acciones pendientes:** conjunto de muestras reales anonimizadas por banco/Binance; medir falsos rechazos/activaciones; explicar motivos en ambos idiomas; facilitar resubidas tras el límite de intentos mediante soporte; alertas de pagos provisionales sin revisar. La revocación no deshace publicidad ya disfrutada: debe haber un procedimiento para créditos consumidos.

No contratar otra API de pago: las mejoras propuestas son compatibles con el OCR abierto y los límites aceptados.

### F15 — P2 · La revisión administrativa puede ocultar pagos pendientes antiguos

**Confirmado en código.** El panel consulta los últimos 100 pagos de todos los estados y genera enlaces firmados para sus intentos. Los pendientes antiguos pueden quedar fuera; no hay paginación/filtro suficiente para garantizar la revisión de todo el backlog.

**Archivos:** `src/app/api/admin/pagos/route.ts`; `src/app/[locale]/admin/PagosTab.tsx`.

**Acción:** bandeja priorizada por pendiente/provisional, antigüedad, búsqueda por referencia/orden, paginación y descarga bajo demanda en vez de firmar todos los intentos a la vez.

## 5. Búsqueda, publicaciones y experiencia de usuario

### F16 — P1 · Listado real vacío donde hay 19 inmuebles publicados

**Comprobado en la web y contrastado en BD.** `https://venezuela-inmuebles.online/propiedades/venta/carabobo` muestra «No hay propiedades disponibles en esta zona». La vista pública tiene **19 ventas** con `ubicacion_estado_id='carabobo'` en la consulta de auditoría.

La consulta de esa página pide relaciones heredadas `property_images(url), states(name), cities(name)` desde la vista. `public.property_images` no existe en el proyecto consultado. Además filtra con `operacion_tipo=Venta` en vez del campo vigente `tipo_operacion=venta`. La página no gestiona el error y presenta ausencia de datos como ausencia de inventario.

**Archivo:** `src/app/[locale]/propiedades/venta/[estado]/page.tsx:64–78`. Revisar también alquiler y ciudades, que mantienen consultas similares.

**Acción:** usar los campos agregados reales de la vista; distinguir error de servicio de «sin resultados»; pruebas con inventario conocido para estado y ciudad en ambos idiomas.

### F17 — P1 · La página Créditos muestra claves internas de traducción

**Reproducido en producción pública y local.** Aparecen `creditos.subtitle`, `creditos.boostDesc`, `creditos.featureDesc` y `creditos.orFeatured` en lugar del texto. Los logs locales registran `FORMATTING_ERROR`.

Causa: mensajes con etiquetas rich text se leen con `t()` sin los renderizadores necesarios; `orFeatured` requiere `{count}`, pero se llama sin él y se intenta reemplazar después de formatear.

**Archivo:** `src/app/[locale]/creditos/page.tsx:44,56,66,104`.

**Acción:** `t.rich`/valores ICU correctamente definidos; evitar HTML manual cuando no es necesario. Test de render real ES/EN que falle ante claves visibles/errores de formato, no solo presencia de claves JSON.

### F18 — P2 · Textos comerciales y métodos de pago contradictorios

**Comprobado en la web.** Créditos anuncia Transferencia, aunque el checkout admite Pago Móvil/Binance. Explica aprobación manual y horario «8am–10pm», sin describir la activación provisional nueva. Ofrece destacado de 12 h/4 créditos, pero la función real revisada acepta 24 h/6 o 48 h/10.

**Archivos:** `src/app/[locale]/creditos/page.tsx:68–70,119–139`; diccionarios; función real `usar_destacado`.

**Acción:** catálogo único de prestaciones/precios/métodos y texto de estados reales. El usuario debe saber qué compra, cuándo se activa y qué significa «provisional».

### F19 — P2 · Dos sistemas de publicación y reactivación confusa

**Confirmado.** `/publicar-inmueble` usa `/api/properties`; `/publicar` usa `/api/publicar` y conserva categorías/condiciones de productos («marca», «modelo», «Para repuestos»). Uno aprueba directamente; otro confía en el estado de moderación enviado por el cliente. No hay una política de moderación única en esos dos caminos.

El botón «reactivar vendido» del panel cambia `activo`, pero no `vendido`; la vista pública exige `NOT vendido`. Puede informar de una reactivación sin volver a publicar.

**Archivos:** ambas páginas/API de publicar; `TabProductos.tsx:70–76`; definición real de la vista.

**Acción:** un solo formulario/caso de uso inmobiliario, validadores y moderación del servidor; transición vendido → disponible explícita, autorizada y sujeta al cupo.

**Deuda de código adicional:** `src/lib/properties.ts` filtra habitaciones/área después de paginar y no aplica el parámetro `amenities`. Esto puede desajustar resultados/totales cuando se utilicen esos filtros; requiere pruebas del helper y sus consumidores, no dar por hecho que afecta a todos los filtros actuales del catálogo.

## 6. SEO e idiomas

### F20 — P1 · Canonicals heredados incorrectamente a la portada

**Reproducido en HTML de producción local.** `/planes`, `/creditos`, `/contacto`, `/faq`, `/como-funciona`, `/sobre-nosotros`, legales y otras rutas heredan `canonical=https://venezuela-inmuebles.online`; en inglés heredan `/en`. Señalan una URL distinta como versión preferida de su propio contenido.

Catálogo, blog y ficha tienen metadatos propios en mayor medida. Varios títulos además duplican «Venezuela Inmuebles» al incluir la marca en la página y en la plantilla del layout.

**Archivos:** `src/app/[locale]/layout.tsx`; metadata de páginas afectadas. Ejemplo público `/en/planes` muestra título duplicado.

**Acción:** canonical/hreflang correctos por ruta, títulos sin duplicación, OG URL coherente. Test automatizado de metadata para cada familia de páginas y sus dos idiomas.

### F21 — P2 · Páginas de cuenta/pago heredan indexación pública

**Reproducido.** Login, registro, confirmación y pagos incluyen `index, follow`. Robots bloquea algunas rutas sin cubrir todas sus variantes inglesas y omite pagos. **Bloquear en robots no equivale a noindex ni es una medida de seguridad.**

**Acción:** metadata `noindex` en áreas de cuenta/checkout y variantes ES/EN; revisar si las páginas de publicación son landing pública o formulario privado. Mantener estas rutas fuera del sitemap.

### F22 — P2 · Sitemap, fechas y calidad de landings incoherentes

**Comprobado.** El sitemap incluye `/buscar` aunque robots lo bloquea; incluye publicación sin definir su estrategia de indexación. Gran parte de `lastModified` es la fecha de generación, no una modificación real. La consulta de inmuebles se limita a 5.000 sin paginación y no comprueba `error` explícitamente.

**Archivo:** `src/app/sitemap.ts`; `src/app/robots.ts`.

**Acción:** alinear indexación/sitemap, fechas reales, errores visibles y sitemap index cuando crezca el inventario. Evaluar las numerosas landings locales sin anuncios o con contenido repetido: no afirmar una penalización de Google, pero evitar generar páginas de poco valor solo para aumentar URLs.

### F23 — P2 · Internacionalización incompleta y `lang` HTML incorrecto

**Comprobado.** `/en/planes` mezcla botones en inglés y casi todo el contenido/precios/FAQ en español. `src/app/layout.tsx` fija `<html lang="es">` también en `/en`. Parte de las rutas antiguas usa links `/${locale}` sin normalizar la estrategia `as-needed`, y `LocalLink` pierde query/hash si recibe un objeto LinkProps en vez de string.

**Impacto:** navegación, lectores de pantalla, confianza y metadatos inconsistentes.

**Acción:** textos completos en diccionarios, idioma real del documento y pruebas de rutas/queries/retorno tras autenticación. Revisar todos los retornos de registro y confirmación en ambos idiomas. En la web publicada, `/pagos?plan=profesional` construye el login con `redirect=%2Fpagos`, sin conservar `?plan=profesional`. Se ha confirmado la pérdida del parámetro, no que todo pago falle: falta comprobar el comportamiento tras iniciar sesión.

## 7. Rendimiento y accesibilidad

### F24 — P2 · Optimización de imágenes y consultas con margen importante

**Confirmado por build/código, no por CWV de usuarios.** JS compartido inicial del build: aproximadamente **204 kB**; el admin alcanza un presupuesto mayor. `.next/static` ocupa unos 3 MB y el artefacto standalone unos 122 MB (no son bytes descargados por cada usuario). La galería usa `unoptimized` incluso para el hero y miniaturas, pudiendo descargar originales grandes.

El cliente service-role fuerza `no-store` para todas sus lecturas. En la ficha, metadata y página vuelven a llamar a `getPublicProperty`; un slug puede originar búsqueda por UUID fallida y búsqueda por slug en ambos lugares, sin memoización compartida explícita.

**Archivos:** `next.config.js` (splitChunks manual); `src/components/PropertyGallery.tsx`; `src/lib/supabase-server.ts`; ficha de inmueble.

**Acción:** medir LCP/INP/CLS reales móvil/escritorio, optimizar imágenes y thumbnails en origen, caché selectiva con invalidación, `React.cache` por petición donde proceda y presupuesto de JS. No volver a introducir datos obsoletos por cachear indiscriminadamente.

### F25 — P2 · Accesibilidad parcial: idioma, landmarks y modales

**Confirmado en HTML/código.** Pagos y Contacto renderizan otro `<main>` dentro del `<main>` del layout. La galería tiene Escape/flechas y `aria-modal`, pero no se aprecia captura/restauración de foco ni aislamiento del fondo. El enlace de salto está en inglés en español.

**Acción:** un solo main, gestión de foco de todos los diálogos, etiquetas y errores asociados a campos, mensajes con `aria-live`, contraste y objetivos táctiles. Validar teclado, zoom 200–400%, lector de pantalla y anchos 360/390/768/1440. **Contrastes y WCAG global no se han certificado con esta revisión de código.**

## 8. Operación, privacidad, comunicaciones y calidad

### F26 — P2 · La política de retención publicada promete más de lo implementado

**Confirmado el texto; no verificada una automatización externa.** Eliminar cuenta dice que ciertos datos se anonimizan y eliminan automáticamente tras 30 días. No se ha localizado un proceso equivalente para nuevas órdenes/intentos/imágenes OCR. Las órdenes referencian perfiles sin borrado en cascada, por lo que la eliminación requiere un procedimiento deliberado.

Además existe un componente CookieConsent, pero no está montado en el layout; Analytics, SpeedInsights y el tracking propio sí lo están. Esto no prueba por sí solo una infracción legal: hay que determinar cookies/datos utilizados, jurisdicción aplicable y obligaciones reales.

**Archivos:** diccionario `deleteAccount.keptText`; migración 010; `src/app/[locale]/layout.tsx`; `src/components/CookieConsent.tsx`.

**Acción:** política veraz de retención, anonimización/borrado con excepciones legales, inventario de terceros y mecanismo de preferencias si corresponde. Revisión legal independiente; no prometer un plazo automático inexistente.

### F27 — P2 · Cron diario para avisos diseñados como diferidos por minutos

**Confirmado.** `vercel.json` ejecuta la cola a las 09:00 una vez al día. La lógica agrupa avisos de chat con reintentos de 10/15 minutos y un máximo por lote de 15 por defecto. Sin otro scheduler, un reintento puede esperar un día y la capacidad diaria es baja.

El cron admite secreto en query, que puede acabar en logs; preferible solo cabecera. La cola selecciona pendientes sin reservarlos antes del envío: dos ejecuciones concurrentes pueden duplicar correos.

**Archivos:** `vercel.json`; `src/app/api/cron/notificaciones-email/route.ts`; `src/lib/notificaciones-email.ts`.

**Acción:** frecuencia viable dentro de las cuotas gratuitas, reservar trabajos en BD, límites/reintentos idempotentes y alertas de backlog. Verificar si existe un scheduler externo antes de cambiar nada. No se ha comprobado la entrega SMTP ni SPF/DKIM/DMARC.

### F28 — P2 · Observabilidad y recuperación no están verificadas de extremo a extremo

**Confirmado parcialmente en código; infraestructura pendiente.** La integración de Sentry en Next está comentada, aunque se importa/inicializa en otros archivos. No se puede asegurar captura completa de errores con sourcemaps. Numerosos errores se silencian o se presentan como listas vacías. El viejo documento de lanzamiento marca puntos «corregidos» que han cambiado posteriormente: no es una certificación vigente.

**Acción:** error tracking operativo y sin datos sensibles, logs estructurados de órdenes/webhooks, alertas de fallos y cuotas, health checks y prueba de restauración de backup. Confirmar MFA y permisos de Vercel/GitHub/Supabase. Evitar logs de claves/token/recibos completos.

### F29 — P2 · Las pruebas actuales no cubren los recorridos que se están rompiendo

**Confirmado.** Las 84 pruebas pasan, pero no detectan los textos rotos de Créditos ni el listado real vacío. Hay pruebas útiles de helpers y PostgreSQL/PGlite, pero faltan recorridos con navegador y una base representativa. No hay workflow CI versionado en `.github` ni script `npm test` en package.json; Vercel sí está compilando los PR.

**Acción:** CI con tests/build/audit, smoke HTTP de producción, pruebas Playwright de alta/login/logout/publicación/edición/filtros/planes/pagos/moderación y test de metadata/rich translations. Roles de prueba: visitante, particular, profesional, agencia y admin; cuenta nueva, prueba vigente/vencida, pago activo/provisional/rechazado.

## 9. Lo que está razonablemente bien y conviene conservar

- TypeScript, lint y build no presentan errores en el estado revisado.
- Las API sensibles son explícitas sobre autenticación: en las pruebas locales 18 peticiones sin token recibieron 401; cron/webhook sin configuración devolvieron 503 y no ejecutaron acciones.
- RLS está habilitado en las **32 tablas públicas** observadas. No basta para validar reglas de negocio, pero es una buena base.
- Las funciones nuevas de pagos y cambios de prueba no admiten ejecución directa por anon/authenticated; utilizan service-role.
- Las funciones financieras antiguas inspeccionadas contienen comprobaciones internas admin/propietario, aunque su permiso EXECUTE es amplio. No se ha encontrado un «cualquiera puede aprobar pagos» por ese solo permiso.
- Cédulas, comprobantes y justificantes nuevos están en buckets privados; fotos de perfil son públicas, como corresponde a su función.
- Los RPC de órdenes reservan evidencia y evitan otorgamiento doble; conservan intentos y permiten resubida. Esto debe mantenerse al unificar los circuitos.
- La migración de prueba conserva las fechas, no crea nuevas pruebas ni acredita saldo al cambiar.
- `/pagos?plan=profesional` ya existe en producción; no reproduce el 404 anterior.
- En la ficha pública revisada se muestran múltiples ambientes/servicios, incluidas cámaras de seguridad; la galería y botones de contacto están presentes.
- Escapado de JSON-LD y popups del mapa; redirecciones de autenticación con helper de rutas internas; CSP/HSTS y otras cabeceras presentes localmente.
- `/test-db`, `/diagnostico` y rutas desconocidas retornan 404 en producción local.
- Fuentes autoalojadas y configuración básica responsive/PWA. El service worker actual gestiona push, no demuestra funcionamiento offline completo.
- Salud de Auth, DB, REST y Storage del proyecto: correcta en el instante de la consulta. Eso no garantiza disponibilidad futura.

## 10. Plan de trabajo recomendado

### Bloque A — Seguridad y fiabilidad de cuenta

1. Actualización de dependencias con evaluación de avisos aplicables (F01).
2. Corregir AuthProvider y validación de sesiones sin fallback inseguro (F03–F04).
3. Cuotas transaccionales al publicar/reactivar y protección de vistas públicas (F02, F05).
4. Subidas y rate limits robustos (F06–F07).

**Aceptación:** no se puede eludir un cupo con REST/concurrencia; una cuenta no ve datos de otra; login/logout/renovación consistentes; sin credenciales falsas aceptadas por fallos de red.

### Bloque B — Lo que el cliente compra debe existir y funcionar

1. Unificar compra de créditos, saldos y cambios admin (F08–F09).
2. Entregar/consumir créditos de plan y acordar límites de prueba/bajada (F10–F11).
3. Resolver o dejar de anunciar prestaciones de agencia no implementadas (F12).
4. Evitar pérdida de fotos y ediciones parciales (F13).
5. Mejorar cola de revisión y calibración OCR sin pagar APIs (F14–F15).

**Aceptación:** un pago concede el producto exacto una vez; una repetición o rechazo no deja saldo/plan incoherente; guardar un anuncio Agencia no elimina sus fotos 21–30.

### Bloque C — Conversión, inventario e idiomas

1. Listados por estado/ciudad (F16).
2. Traducciones y textos de compra coherentes (F17–F18).
3. Unificar publicar y corregir reactivación de vendido (F19).

**Aceptación:** el inventario conocido aparece en todas sus rutas; no se muestran claves de traducción ni métodos/prestaciones que no pueden comprarse.

### Bloque D — SEO, accesibilidad y rendimiento

1. Canonicals, títulos, noindex, sitemap, idioma (F20–F23).
2. Medición real y optimización por presupuesto, sin inventar puntuaciones (F24).
3. Navegación por teclado/lectores de pantalla y móviles reales (F25).

**Aceptación:** metadata correcta por ruta/idioma, cero páginas privadas indexables por configuración, rutas públicas sin soft-404 ocultos, y métricas registradas antes/después en condiciones comparables.

### Bloque E — Operación y mantenimiento

Retención y privacidad reales, scheduler de correo, observabilidad, backups y CI/E2E (F26–F29). Integrar pruebas de regresión en cada bloque anterior, no esperar a este bloque para empezar a probar.

## 11. Comprobaciones que faltan antes de decir «lista para operar»

- [ ] Prueba autenticada de visitante/particular/profesional/agencia/admin, incluyendo cambio de cuenta en la misma pestaña.
- [ ] Pago real autorizado de importe pequeño, activación provisional, confirmación/rechazo y conciliación de saldo.
- [ ] Cambios/renovaciones/bajadas/vencimientos con reloj controlado y sin pérdida de datos.
- [ ] Publicación simultánea en el último cupo; edición de 8/20/30 imágenes; pausa/reactivación/vendido.
- [ ] Chat/realtime/push/correo con dos usuarios y preferencias de avisos.
- [ ] SMTP y dominio: entrega, SPF/DKIM/DMARC, límites y manejo de rebotes.
- [ ] Android/iOS, Chrome/Safari/Firefox, teclado y lector de pantalla.
- [ ] Lighthouse/axe y Core Web Vitals reales; no hay puntuación inventada en este informe.
- [ ] Search Console: cobertura, canonical elegido, sitemap y datos estructurados.
- [ ] Restauración de backup ensayada, acceso MFA y respuesta a incidentes.
- [ ] Política legal/retención coherente con la implementación y proveedores utilizados.

**Conclusión:** priorizar seguridad, cuentas, inventario y cumplimiento de las prestaciones de pago. Una mejora de diseño o de puntuación SEO no compensa que un cliente no vea propiedades existentes, no reciba los créditos incluidos o pierda fotos al editar. Las correcciones deben ir en bloques pequeños, con validación y PR independientes; esta revisión no ha desplegado cambios.

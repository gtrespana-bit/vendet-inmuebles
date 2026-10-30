# Hoja de ruta — siguiente sesión

## Estado al cerrar esta sesión

- Rama activa: `arena/72dc2704-vendet-inmuebles`.
- PR #5 ya está fusionada en `main`.
- Hay cambios locales sin commit en contacto, la página de planes, perfil público de vendedor, estilos globales y diccionarios ES/EN. No se han publicado.
- El perfil público ahora muestra **Identidad verificada / Identidad no verificada** en ambos idiomas, con una aclaración de que esto no verifica la propiedad. `npm run lint`, `npx tsc --noEmit`, validación JSON y `git diff --check` pasaron después de ese cambio.
- La página local de planes todavía es un borrador anterior a la decisión de las tres cuentas; debe actualizarse antes de considerarla lista.
- No se repitió el build. Si sigue activo el servidor standalone en el puerto 3000, detenerlo antes de ejecutar otro build.

## Modelo aprobado como base

| Cuenta | Precio inicial | Anuncios activos | Fotos por inmueble | Créditos incluidos |
|---|---:|---:|---:|---:|
| Gratuita | $0 | 1 | 8 | 0 |
| Profesional | $9,99/mes o $99/año | 5 | 20 | 5 al mes |
| Agencia | $39,99/mes o $399/año | Sin límite | 30 | 20 al mes, compartidos |

La hipótesis de créditos queda aceptada como dirección de producto. Los paquetes puntuales y sus precios actuales siguen centralizados de forma duplicada en el código y deben revisarse/centralizarse antes del lanzamiento.

### Funciones acordadas

- La verificación de identidad es gratuita e independiente del plan. El perfil debe indicar claramente si está verificado o no; no afirmar que se verificó el inmueble.
- Profesional: escaparate con URL personalizada dentro del dominio de Venezuela Inmuebles, métricas, enlace a vídeo, recorridos/planos y soporte prioritario.
- Agencia: escaparate de marca, métricas agregadas, publicación/edición masiva, recorridos/planos, soporte prioritario con devolución de llamada telefónica bajo solicitud y cinco usuarios incluidos.
- Privacidad de mensajería para agencia: cada agente ve sus conversaciones asignadas; la cuenta principal puede ver todas y reasignarlas. No compartir automáticamente las bandejas entre agentes.
- La prueba de los planes de pago será de un mes, comunicada como una iniciativa solidaria y sin mensajes que exploten la situación de los terremotos. No debe haber cobro automático ni pérdida de anuncios al terminar.

## Próxima sesión — orden de trabajo

1. **Retomar el estado local**: comprobar rama y diff; conservar los cambios sin commit. Actualizar la página `/planes` para reflejar la matriz aprobada y explicar con claridad precio, duración, límites, créditos y condiciones de la prueba.
2. **Cerrar las reglas de la prueba antes de activarla**: definir si son 30 días desde la activación de cada cuenta y una sola vez; confirmar cómo se elige Profesional o Agencia. Regla recomendada: sin cobro automático, vuelta a Gratuita, anuncios por encima del límite pausados (no borrados) y aviso antes del vencimiento.
3. **Diseñar el modelo técnico de planes y organizaciones**: plan, estado de pago/prueba, fechas, créditos incluidos y membresías de agencia con roles. Separar saldo de créditos comprados del saldo mensual incluido.
4. **Resolver la estrategia del historial de Supabase antes de tocar migraciones**. El proyecto nuevo parte vacío; no asumir tablas/datos anteriores. No reescribir ni aplicar migraciones hasta decidir cómo preservar coherentemente el historial.
5. **Implementar enforcement en servidor**: límite de anuncios activos, límite de fotos por plan, trial/vencimiento y compras de créditos. Unificar los límites actuales: el formulario inmobiliario acepta 8 fotos, el formulario genérico 10 y las APIs admiten hasta 20, sin enforcement por plan.
6. **Construir capacidades de Agencia**: membresías y permisos de inbox, reasignación por titular, métricas por agente/cartera y carga/edición masiva.
7. **Completar premium media y escaparates**: URL personalizada dentro del dominio, enlace de vídeo (primera versión externa; R2 actualmente acepta imágenes), recorrido virtual y planos; después decidir si se alojan vídeos/planos directamente.
8. **Operativizar soporte y verificación**: solicitud de devolución de llamada telefónica para Agencia; verificación gratuita con estados visibles y criterios para particulares, profesionales y representantes de agencias.
9. **Validación progresiva**: lint, TypeScript y pruebas de límites/permisos/trial en cada bloque. Al final, build, revisión visual móvil ES/EN y SEO/PWA. Las pruebas integrales deben usar cuentas y publicaciones nuevas en un entorno adecuado, nunca importar datos antiguos.

## Criterios de transparencia

- Mostrar el precio y el límite de cada plan antes del registro/contratación.
- Explicar qué pasa al acabar la prueba y al cancelar: nada se borra; lo que exceda el plan se pausa.
- Las insignias certifican identidad, no titularidad ni estado del inmueble.
- Las promociones por créditos deben indicar coste, duración y efecto; no prometer ventas ni contactos.
- No describir funciones como disponibles hasta que estén implementadas y probadas.

# Pagos con validación provisional gratuita

## Puesta en producción

1. Aplicar `supabase/migrations/010_ordenes_pago_verificacion.sql` **antes de desplegar** el código. Crea tablas nuevas, funciones restringidas a service-role y el bucket privado `justificantes-pagos`; añade únicamente un indicador a las suscripciones existentes.
2. Desplegar el código con `npm ci` (se instala el modelo OCR y el WASM desde npm). No hay una clave/API de OCR ni llamadas a CDN. Next incluye los modelos y workers en el artefacto standalone.
3. Conservar las variables Supabase existentes. Opcionalmente configurar `PAGO_MOVIL_TELEFONO`, `PAGO_MOVIL_CEDULA`, `PAGO_MOVIL_BANCO`, `BINANCE_PAY_ID`; en su ausencia se usan los datos públicos que ya utilizaba la compra de créditos.
4. Entrar en **Administración → Pagos** para revisar ingresos. Los enlaces a imágenes son privados y vencen a los cinco minutos; el botón Actualizar los renueva.
5. Hacer una prueba controlada con un ingreso real de importe pequeño antes de anunciar el sistema. Las pruebas automatizadas usan comprobantes sintéticos y PostgreSQL local en WASM, no cobran ni crean usuarios reales.

## Corrección de rutas y prueba gratuita (migración 011)

- Aplicar `011_cambio_plan_durante_prueba.sql` antes de desplegar la corrección de prueba. No modifica suscripciones existentes al instalarse.
- `/pagos` está en la lista de páginas permitidas del middleware de **producción**. Las pruebas comparan esa lista con todas las páginas públicas de un segmento para detectar futuras omisiones.
- Durante una prueba vigente, Planes muestra días restantes y fecha final. Permite cambiar al instante entre planes sin pagar, manteniendo inicio, fin y fecha original de prueba; no crea otra suscripción ni suma créditos al saldo por cambiar repetidamente.
- Los planes de pago no pueden comprarse ni activarse por una orden antigua durante la prueba (protección en API y RPC). Los paquetes de créditos adicionales sí pueden comprarse, con el coste indicado. Pagos dirige a Planes a quien intenta contratar un plan durante su prueba.
- Al finalizar la prueba, sin contratar un plan, se aplican los límites de Gratuita. No hay cobros automáticos. La UI reconsulta al volver a la pestaña y cada minuto; el servidor decide según su propia fecha.
- Las tarjetas ya no ofrecen una prueba nueva a cuentas existentes, ni un precio anual que el checkout no soporta. Las bajadas programadas muestran fecha y el botón de cancelar solo se ofrece cuando hay una bajada gratuita pendiente.

## Flujo

- `/creditos` y `/planes` conducen a `/pagos`. El servidor calcula el precio de cada orden; los valores enviados por el navegador no fijan importes.
- Pago Móvil congela la tasa BCV obtenida para la orden; si el servicio no entrega una tasa actual, se impide crear órdenes en bolívares. Nunca se valida automáticamente usando el fallback antiguo. Binance utiliza USDT.
- Planes: Profesional USD 9,99 y Agencia USD 39,99 por 30 días. Sin renovación/cargo automático y **sin prorrateo**. El usuario ve esta condición antes de pagar. Una subida comienza en la activación; una renovación del mismo plan o bajada pagada comienza al terminar el período anterior. Una bajada a Gratuita se programa sin aprobación y puede cancelarse desde Planes. No se eliminan anuncios por exceder el límite inferior; se impiden nuevas publicaciones mientras se exceda.
- Órdenes válidas 24 horas. Una orden vencida acepta justificantes, pero solo puede activarla un administrador tras comprobar el ingreso.
- Archivos JPG/PNG/WebP, máximo 4 MB para respetar el límite de petición de Vercel. Se decodifican, se limita la resolución a 16 millones de píxeles y se reescriben como PNG antes de almacenarlos.
- Tesseract.js ejecuta OCR en el servidor con modelo inglés (lee caracteres latinos y números; normalizamos acentos). No se confía en texto/confianza enviado desde el cliente. Tiempo máximo de OCR: 25 segundos; si falla, pasa a revisión.
- Validación conservadora: confianza >=85, referencia completa y única, estado completado, importe/moneda, datos del receptor y fecha numérica `DD/MM/YYYY` y hora de 24 horas (zona Venezuela) dentro del período de la orden. Formatos no reconocidos no activan beneficios: se ofrece resubir o esperar revisión. Un comprobante puede ser legítimo y requerir revisión por formato, datos ocultos o lectura imperfecta.
- Una orden con datos coincidentes activa **provisionalmente**. Las dudosas quedan en revisión. Referencias/imágenes ya usadas en otra orden quedan bloqueadas. Ambas permiten resubir en la misma orden conservando los intentos.
- Bloqueos y reservas de evidencia en PostgreSQL evitan reutilización entre cuentas y otorgamiento doble por reintentos concurrentes. Las claves de referencia están separadas por método de pago. También se comprueban referencias existentes en transacciones antiguas.
- Máximo un beneficio provisional sin revisar por cuenta; importes superiores a USD 40 y cuentas con pagos rechazados requieren revisión. Se limita el OCR a seis intentos por hora por usuario y doce por IP, con reserva atómica y fallo cerrado y diez intentos por orden.

## Revisión y reversión

- **Confirmar ingreso**: convierte en definitivo; si aún no se concedió el beneficio, lo concede una sola vez. Comprobar en la cuenta receptora, no únicamente en la imagen.
- **Rechazar y revocar**: exige motivo. Resta créditos no consumidos; registra expresamente los créditos ya consumidos que no se pudieron recuperar. Para planes cancela la suscripción otorgada y restaura la anterior si sigue vigente y no existe una posterior válida.
- Servicios ya disfrutados (visibilidad, destacados, etc.) no pueden deshacerse retroactivamente. El panel señala la deuda de créditos no recuperada para que el administrador revise servicios/cuenta y tome medidas. No se borran anuncios automáticamente ni se bloquea una cuenta sin intervención humana.
- Referencia duplicada: no se permite aprobar desde el panel hasta recibir un justificante no duplicado. Una orden rechazada definitivamente no admite más intentos; se crea otra y se conserva el historial.
- Las compras antiguas siguen revisándose mediante su flujo anterior de Telegram. Las nuevas envían un aviso a Telegram (si está configurado) y se revisan en la pestaña Pagos y no usan los botones antiguos (evita dobles aprobaciones).

## Límites de seguridad y coste

El OCR no consulta al banco ni a Binance, no autentica un comprobante y no garantiza detectar falsificaciones. Las heurísticas no son un detector forense. Una captura falsificada con todos los datos coherentes puede activar provisionalmente: es el riesgo aceptado de este flujo. La verificación definitiva es humana.

No se contratan servicios ni hay costes por análisis. CPU, memoria y almacenamiento consumen las cuotas del alojamiento/Supabase existentes. El sistema no garantiza infraestructura ilimitada gratis; monitorizar cuotas, volumen de imágenes y latencia serverless. Mantener evidencias con acceso privado y aplicar una política de retención compatible con el historial de revisión.

## Validación local

```sh
npx tsc --noEmit
npx next lint
node --test tests/*.mjs
node tests/edit-listing-translations.cjs
```

Las pruebas SQL ejecutan la migración real en PGlite (PostgreSQL WASM), sin conectarse a producción. Cubren idempotencia, reutilización, resubida, límites, revocación, restauración del plan, bajada diferida y permisos.

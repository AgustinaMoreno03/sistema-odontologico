# Open Dental

- **URL**: https://www.opendental.com/site/fees.html (lista de precios oficial); home: https://www.opendental.com/
- **Fecha de investigación**: 2026-11-17

## Problema que resuelve

"Practice management software comprehensible, highly customizable dental practice
management software at an affordable price for practices of any size": gestión
integral del consultorio dental (agenda, historia clínica, billing/seguros, imagenología)
altamente personalizable a un precio accesible.

## Usuarios objetivo

Consultorios dentales de cualquier tamaño en EE.UU. y Canadá (solo, grupos, DSO) y
"Other Countries" con soporte por email/teléfono; también escuelas de odontología (sin
cargo). Modelo on-premise: el cliente corre el programa en su propio servidor
(Windows + MySQL), con opción Open Dental Cloud aparte.

## Features detectadas

- Agenda/scheduling, charting y periodontograma, planes de tratamiento
- Billing y seguro dental: verificación de elegibilidad, claims, ledger, cobros
- Imagenología nativa (radiografías) con add-on de IA para análisis de imágenes
- eServices: Web Sched (reserva online), eConfirmations, eReminders, Patient Portal,
  Payment Portal, Web Forms, eClipboard (check-in digital con OCR de credencial)
- SMS/integrated texting (con fee por mensaje), eRx electrónico (DoseSpot / Ensora)
- Móvil: ODMobile y ODTouch; multi-location con reglas de precios por sede
- Base de datos MySQL abierta + API y "program bridges" con múltiples terceros
- Training (webinars gratis, online $80/h, on-site $4.325/día), conversión de datos
  desde otro software (con cargo)

## Pricing (publicado en la página oficial de fees, USD)

- **Licencia + soporte (EE.UU., self-hosted)**: US$ 199/mes por ubicación, contrato
  inicial de 12 meses, cubre hasta 3 providers; luego "Current Reduced Rate" de
  US$ 149/mes, mes a mes
- **Canadá**: US$ 164/mes → US$ 137/mes después de 12 meses
- **Other Countries**: US$ 89/mes por ubicación; Developing Countries: gratis
- **Providers extra** (>3 por ubicación, sin higienistas): +US$ 20/mes por provider
- **eServices Bundle**: US$ 165/mes por ubicación; Web Sched US$ 75/mes; eConfirmations
  US$ 25/mes; texting US$ 5/mes + US$ 0,04/mensaje (EE.UU.); ODMobile US$ 35/mes
- **Open Dental Cloud**: se cobra aparte sobre la fee base (página propia)
- **AI Image Analysis** (Better Diagnostics): US$ 149/mes por ubicación
- Descuentos: volumen (4-9 oficinas US$ 169/mes) y prepago (10% por 1 año, 15% por
  2-3 años). Conversión de datos y capacitación on-site se cobran aparte.
- Escuelas de odontología y "developing countries": sin cargo.

## Posicionamiento

"Comprehensive, highly customizable dental practice management software at an
affordable price" — y en la práctica, el único PMS mayor que publica su lista de
precios completa (dato de reseñas de terceros consistente con su página de fees).

## Diferenciadores

Según su discurso: transparencia total de precios, base de datos abierta (MySQL) y API
con muchos integradores, control total del dato (self-hosted), updates + soporte
incluidos en la fee, y estructura de precios por ubicación (no por usuario) predecible
para grupos.

## Notas del investigador

- No es cloud por defecto: requiere servidor propio y su mantenimiento; la nube es un
  producto aparte. Relevante como benchmark de monolito + personalización, no como
  modelo de despliegue para nuestro MVP.
- Su foco "insurance/claims" es del sistema de salud de EE.UU.; no aplica directo a
  Argentina (obras sociales/APRA). Los precios en USD de sus páginas no son
  comparables 1:1 con planes argentinos en pesos.
- Los datos provienen de la página oficial de fees (fees.html) leída el 2026-11-17;
  ellos mismos advierten que las fees cambian cada pocos años.

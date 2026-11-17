# OCLÜ

- **URL**: https://oclucrm.com/
- **Fecha de investigación**: 2026-11-17

## Problema que resuelve

"OCLÜ es la infraestructura de tu clínica": junta en un solo lugar lo que hoy está
repartido entre varios sistemas, el celular y el grupo de WhatsApp, y devuelve tiempo,
concentración y control. Su FAQ lo dice textual: resuelve la diferencia entre eso y
"usar Excel más el WhatsApp personal".

## Usuarios objetivo

Clínicas y consultorios odontológicos de Argentina, España y LatAm. Los planes se
definen por tamaño de consultorio (1 box / 2 boxes / 3 boxes / multi-sede), no por
funcionalidades: consultorio chico, clínica mediana y clínica grande. Roles internos:
recepción, odontólogo y administración.

## Features detectadas

- Agenda por profesional + Autoagenda (reserva online por link) y portal del paciente
- Odontograma, periodontograma, evoluciones, evaluaciones clínicas, consentimientos,
  recetas digitales, multimedia y 3D (visualizador DICOM como add-on)
- Facturación electrónica ARCA/AFIP (Argentina) y España; presupuestos, listas de
  precios, tesorería, cuentas de paciente, seguros médicos, honorarios, laboratorio,
  stock y reportes
- Usuarios y permisos por puesto con registro de quién hizo cada cambio (auditoría)
- Recordatorios, automatizaciones, campañas, chat/mensajería interna del equipo
  (para no depender de grupos de WhatsApp) y WhatsApp como add-on
- App iOS/Android complementaria, consultas virtuales (link de videollamada), multi-sede
- IA (add-on OCLÜ IA): dicta la evolución y se escribe sola; carga periodontograma y
  presupuestos por voz; API pública (add-on) para n8n/Make/Zapier/CRMs
- Migración asistida desde el sistema actual (pacientes, historias, turnos, multimedia)

## Pricing

- **CORE · Consultorio**: ARS 35.000 + IVA/mes (1 box, hasta 3 profesionales con
  agenda, hasta 500 pacientes)
- **STUDIO · Clínica**: ARS 55.000 + IVA/mes (2 boxes, hasta 6 profesionales, pacientes
  ilimitados)
- **SIGNATURE · Clínica grande**: ARS 80.000 + IVA/mes (3 boxes, hasta 9 profesionales)
- **CUSTOM**: a cotizar (más de 9 profesionales / varias sedes)
- También publica "desde USD 25/mes"; plan anual con 10% de descuento. No cobran por
  cita; los add-ons (IA, facturación electrónica, WhatsApp, autoagenda, DICOM, API) se
  contratan aparte. Registro/prova gratis.

## Posicionamiento

"Que el centro vuelva a ser el paciente" / "Más que un software de gestión, OCLÜ es la
infraestructura de tu clínica" / "software de gestión odontológica ALL IN ONE para
clínicas y consultorios dentales de Argentina, España y LATAM".

## Diferenciadores

Según su discurso: un plan por tamaño de clínica (misma base funcional para todos),
permisos por rol con trazabilidad de cambios, chat interno en vez de WhatsApp grupal,
IA incluida en todos los planes, migración asistida y soporte humano por WhatsApp.
Soporta facturación argentina (ARCA) y española según país.

## Notas del investigador

- Es el competidor directo más parecido al alcance de nuestro proyecto: agenda,
  turnos, pacientes, historia clínica, cobros y RBAC con permisos por rol y auditoría.
  Nuestra diferenciación tendría que venir de simplicidad/alcance estudiantil, no de
  features.
- Atención con la moneda: precios en pesos + IVA para Argentina publicados al
  2026-11-17; el valor real se devalúa rápido, conviene verificar antes de comparar.
- Los límites por plan (500 pacientes, N boxes) son el tipo de restricción que nuestro
  monolito de prueba podría no necesitar.

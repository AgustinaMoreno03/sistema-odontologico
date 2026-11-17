# Discovery — Sistema de Gestión Odontológica (C:\Odontologia)

**Fecha**: 2026-11-16
**Fuentes investigadas**: 10 fuentes (fecha 2026-11-17, investigación por búsqueda web;
notas de competidores en `discovery/sources/`)

## 1. Problema que resuelve

El consultorio odontológico no tiene un sistema único que resuelva a la vez la
**gestión del consultorio** (agenda, pacientes, historia clínica, cobros) y los
**turnos para los pacientes**. Hoy eso se resuelve —aunque sea a medias— con
planillas, cuadernos, WhatsApp y la memoria del odontólogo, lo que genera
doble reserva, tiempo perdido confirmando turnos y historia clínica dispersa.

Para: odontólogos, recepción/administración y pacientes del consultorio.

## 2. Usuarios / roles

- **Odontólogo/a**: atiende, carga la historia clínica, gestiona sus turnos.
- **Paciente**: reserva/cancela turnos, ve sus datos y evoluciones.
- **Recepción/Administración**: administra la agenda general, cobros y recordatorios.
- **Administrador del sistema**: configura usuarios, permisos, consultorios y reportes.

## 3. Casos de uso

1. Como **paciente**, quiero reservar o cancelar un turno para no depender de
   llamadas o mensajes de WhatsApp.
2. Como **odontólogo**, quiero ver mi agenda del día y registrar la atención
   con su cobro para tener el control al día.
3. Como **recepción**, quiero administrar la agenda general y los cobros para
   coordinar al equipo.
4. Como **administrador**, quiero gestionar usuarios y permisos para que cada
   rol vea solo lo que le corresponde.

*(Detalle fino de historias de usuario: se refina en la Knowledge Base.)*

## 4. Competidores / soluciones existentes

Investigación por búsqueda web — 2026-11-17. Cada fila enlaza a su nota con el esquema
fijo en `discovery/sources/<slug>.md`.

| Competidor | Problema que resuelve | Pricing | Diferenciadores |
|---|---|---|---|
| [Dentalink](sources/dentalink.md) (Chile/LatAm, +15.000 clientes) | Digitalizar agenda, registro clínico y cobros del consultorio dental "para que el profesional dedique su tiempo a los pacientes" | Desde USD 35/50/75 por mes (Esencial/Pro/Titanium, Argentina, 1 profesional; con equipo: a cotizar). Chile: desde $35.000 CLP IVA incl. | Líder auto-declarado en LatAm; odontograma + obras sociales en todos los planes, IA incluida, sin contratos; financiación de pacientes y multicentro en planes superiores |
| [OCLÜ](sources/oclu.md) (Argentina/España/LatAm) | "La infraestructura de tu clínica": junca lo que hoy vive repartido en varios sistemas, el celular y el grupo de WhatsApp (y explicita el "Excel + WhatsApp personal") | ARS 35.000 / 55.000 / 80.000 + IVA por mes (CORE/STUDIO/SIGNATURE) o desde USD 25/mes; add-ons aparte; anual 10% off | Todos los planes con la misma base (se paga por tamaño de clínica); permisos por rol con auditoría, chat interno vs. WhatsApp grupal, facturación ARCA, migración asistida |
| [Dentaly](sources/dentaly.md) (Argentina) | Termina con "Excel, Calendar y papel": agenda, fichas, odontograma y recordatorios por WhatsApp en un solo lugar | ARS 35.000/mes (Pro, 1 profesional), ARS 100.000/mes (Clínica), Multisede a cotizar; prueba 14 días sin tarjeta | Simplicidad ("sin funciones de relleno"), precio transparente en pesos, soporte por WhatsApp con los fundadores, sin créditos por mensaje |
| [Clinic Cloud](sources/clinic-cloud.md) (España, grupo Doctoralia) | Software clínico todo-en-uno: agenda, comunicaciones, historia clínica con IA y facturación; migración gratis desde papel/Excel | 29 / 49 / 79 € + IVA por mes (Mini/Pro/Max); Enterprise a convenir; odontograma solo en Max | Ecosistema Doctoralia (visibilidad + reserva online), IA clínica (suite Noa), RGPD/ISO 27001; facturación española (no ARCA) |
| [Open Dental](sources/open-dental.md) (EE.UU./internacional) | PMS dental altamente personalizable "at an affordable price" para consultorios de cualquier tamaño | Publicado: US$ 199/mes por ubicación (12 meses, hasta 3 providers) → US$ 149/mes; +US$ 20 por provider extra; eServices US$ 165/mes; nube y conversión aparte | Único PMS mayor con lista de precios completa; DB MySQL abierta + API; self-hosted (control del dato); foco en insurance claims (modelo EE.UU.) |
| [Dentrix](sources/dentrix.md) (EE.UU., Henry Schein One) | "All-in-one dental practice management platform": scheduling + imagenología + billing + analytics + patient engagement | **(no público)** — pide demo/"Request Info"; paquetes y suites a cotizar | 30+ años de estándar del sector, 35.000+ prácticas, ecosistema partners (API Exchange), opción on-premise vs. cloud (Ascend), servicios IT |

**Notas**:

- **Status quo — el competidor real**: planilla/Excel, cuaderno y WhatsApp siguen siendo
  con lo que compite cualquier solución. Varias fuentes lo confirman y lo usan como
  gancho de venta: Dentaly abre con "¿Tu consultorio todavía vive entre Excel, Calendar
  y papel?" (https://www.dentaly.com.ar/), Clinic Cloud ofrece "migración gratuita desde
  papel, Excel u otro software" (https://clinic-cloud.com/) y OCLÜ vende contra "usar
  Excel más el WhatsApp personal" (https://oclucrm.com/). Nuestra ventaja de adopción
  tiene que medirse contra esa alternativa gratis, no solo contra otros software.
- **Verificación de nombres sugeridos**: "ClinicCloud" existe como **Clinic Cloud**
  (Doctoralia). **Dentix** no es software: es una red de +100 clínicas dentales propias
  (DSO, España/Italia/Colombia) que contrató Clinic Cloud (https://clinic-cloud.com/blog/dentix-elige-clinic-cloud-como-software-gestion-clinicas).
  **Programa Dental** no se pudo verificar como producto independiente — se descarta.
- **Mercado argentino fragmentado**: además de los de arriba, la comparativa independiente
  de Odonthia lista ~8 competidores locales con precios publicados (Odonthia gratis/ARS
  20.900/46.900, Bilog freemium, DentalCore USD 50, Odonto.ar USD 29-99, DentalSoft ARS
  30.000/60.000, etc.) — fuente: https://odonthia.com/blog/mejores-software-odontologicos-argentina-2026
  (relevamiento propio del 09/10/2026). La categoría ya es densa y barata: un MVP
  estudiantil no compite en features ni en precio, sino en simplicidad y alcance.
- **Benchmark de features mínimo esperado en LatAm**: agenda por profesional, odontograma,
  historia clínica, presupuestos/cobros, confirmación/recordatorio por WhatsApp y
  control de obras sociales (según Dentalink y OCLÜ). Nuestro MVP (agenda, turnos,
  pacientes, RBAC, cobros) es un subconjunto deliberado de ese estándar.

## 5. Funcionalidades necesarias (MVP — innegociables)

- Pacientes + historia clínica (alta, búsqueda, datos de contacto, evolución).
- Agenda y turnos (agenda por odontólogo, reservar/cancelar, sin solapamientos).
- Atención y cobros (registrar sesión, cobrar, ver deudas/pagos).
- Usuarios y permisos (login por rol: odontólogo, recepción, admin, paciente).

## 6. Funcionalidades opcionales (post-lanzamiento)

- Recordatorios automáticos (WhatsApp/Email).
- Facturación y reportes.
- Portal del paciente (reserva y consulta auto-servicio).

## 7. Reglas de negocio

Respuesta inicial del usuario: "no hay". En el gate final se registraron las
siguientes reglas básicas de sentido común (propuestas por el orquestador y
**confirmadas al aprobar el resumen**):

- Un paciente no puede tener dos turnos solapados.
- Solo el odontólogo dueño de la agenda edita su historia clínica.
- La historia clínica es confidencial (dato de salud sensible).
- Los cobros son un registro interno de pagos/deudas, **no** facturación
  fiscal (eso queda en opcionales).

## 8. Integraciones

- WhatsApp Business API y/o Email — para confirmaciones y recordatorios.
- Pagos (Mercado Pago / transferencias / tarjetas) — para cobrar sesiones.

## 9. Restricciones

- **Stack fijo (dado de arriba, no negociable)**: Frontend **TypeScript
  vanilla + diseño responsivo**; Backend **Spring Boot + Gradle**.
- Plazo o presupuesto acotado — condiciona el alcance del MVP.
- Datos sensibles / compliance: historias clínica = datos de salud con
  requisitos de confidencialidad, backups y auditoría.

## 10. Riesgos

El usuario marcó "todo" como preocupación. Traducido en supuestos sin probar:

- **Adopción**: que odontólogo y paciente lo usen de verdad — si no es más
  rápido que el cuaderno/WhatsApp, no lo adoptan (riesgo #1).
- **Datos y privacidad**: manejar historia clínica desde el día 1 sin
  experiencia previa en compliance.
- **Integraciones**: WhatsApp Business API y pagos pueden ser caros o lentos
  de implementar.
- **Scope**: 4 features "innegociables" en el MVP es un alcance grande para
  stack fijo y presupuesto acotado — riesgo de que crezca.

## 11. Preguntas abiertas

1. ¿Un solo consultorio o preparado para multi-sede/multi-odontólogo desde ya?
2. ¿Cloud o local (on-premise)? Condiciona backups de datos sensibles.
3. ¿Los cobros emiten comprobante fiscal real o solo registro interno?
4. Recordatorios: ¿WhatsApp Business API (tiene costo) o primero email?
5. ¿Portal del paciente entra en el MVP o post-lanzamiento?
6. ¿Auditoría/backups de historias clínicas: qué nivel mínimo exigir?

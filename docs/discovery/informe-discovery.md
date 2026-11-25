# Informe de Discovery — Sistema de Gestión Odontológica

| Campo | Valor |
|---|---|
| **Proyecto** | Sistema de Gestión Odontológica (repo `C:\Odontologia`) — consultorios odontológicos, SaaS multi-tenant |
| **Fecha del informe** | 2026-11-17 |
| **Correcciones aplicadas** | 2026-11-25 — 3 ajustes de `docs/discovery/hallazgos-discovery.md` + estructura nueva Secciones A–D (revisión previa a la entrega del jueves 2026-11-26) |
| **Equipo** | Agustina (líder), Lucia, Kevin, Lea, Gero |
| **Fuente del informe** | Fase `discovery-research` (Discovery de 11 puntos + investigación de competidores) |
| **Insumos primarios** | `discovery/discovery.md` (2026-11-16), notas en `discovery/sources/` (investigación 2026-11-17), `docs/plan-ejecucion.md` (2026-11-17), `knowledge-base/`, `docs/discovery/hallazgos-discovery.md` (2026-11-25) |

---

## 1. Resumen ejecutivo

El consultorio odontológico no tiene un sistema único que resuelva a la vez la gestión del consultorio (agenda, pacientes, turnos) y los turnos para los pacientes: hoy eso se hace —aunque sea a medias— con planillas, cuadernos, WhatsApp y la memoria del odontólogo, lo que produce doble reserva, tiempo perdido confirmando turnos e historia clínica dispersa. Los usuarios son odontólogos, recepción/administración y pacientes. El MVP vigente (según el Q&A posterior al Discovery y el plan de ejecución 2026-11-17) es un subconjunto deliberado: agenda por odontólogo, turnos sin solapamientos por profesional y por sillón/box, pacientes con datos básicos y usuarios/permisos (RBAC) — **sin** historia clínica ni cobros, que quedaron post-lanzamiento. Frente a un mercado argentino fragmentado y barato — OCLÜ desde USD 25/mes; Dentaly en pesos (ARS 35.000 / 100.000 por mes, precio **no verificable en vivo**, su web es una SPA); Dentalink con precios **a cotizar al 2026-11-25** (declara +15.000 clientes); y Dentrix, estándar de EE.UU. con precio no público —, un MVP estudiantil no compite en features ni en precio sino en **simplicidad y alcance**; el competidor real sigue siendo el status quo gratis (Excel, cuaderno y WhatsApp), tal como lo reconocen los propios competidores en sus páginas de venta. Detalle en las **Sección A** (tabla comparativa), **Sección B** (matriz de puntuación), **Sección C** (análisis de mercado) y **Sección D** (demo, UX y MVP).

---

## 2. Los 11 puntos del Discovery

Consolidados de `discovery/discovery.md`. Donde el plan de ejecución (`docs/plan-ejecucion.md`, 2026-11-17) o el Q&A posterior cambiaron lo decidido, se indica **[CAMBIO posterior]** con el estado vigente.

### 2.1 Problema

El consultorio odontológico no tiene un sistema único que resuelva la gestión del consultorio (agenda, pacientes, historia clínica, cobros) y los turnos de los pacientes. Hoy: planillas, cuadernos, WhatsApp y la memoria del odontólogo → doble reserva, tiempo perdido confirmando turnos, historia clínica dispersa. Para: odontólogos, recepción/administración y pacientes.

### 2.2 Usuarios / roles

- **Odontólogo/a**: atiende, carga la historia clínica, gestiona sus turnos.
- **Paciente**: reserva/cancela turnos, ve sus datos y evoluciones.
- **Recepción/Administración**: administra la agenda general, cobros y recordatorios.
- **Administrador del sistema**: configura usuarios, permisos, consultorios y reportes.

**[CAMBIO posterior]** El plan §5.2 define roles del sistema: `ADMIN_CONSULTORIO`, `ODONTOLOGO`, `RECEPCION` + `SUPERADMIN` interno (alta de consultorios, seed/script en MVP). **No figura el rol `PACIENTE`** → ver IN-03 (sección 5): la auto-reserva del paciente está cuestionada hasta confirmarlo con la líder.

### 2.3 Casos de uso

1. Como **paciente**, quiero reservar o cancelar un turno para no depender de llamadas o mensajes de WhatsApp. *(cuestionado por IN-03 — ver sección 5)*
2. Como **odontólogo**, quiero ver mi agenda del día y registrar la atención con su cobro para tener el control al día. *(cobros: post-lanzamiento)*
3. Como **recepción**, quiero administrar la agenda general y los cobros para coordinar al equipo. *(cobros: post-lanzamiento)*
4. Como **administrador**, quiero gestionar usuarios y permisos para que cada rol vea solo lo que le corresponde.

### 2.4 Competidores

Quince soluciones investigadas: 6 por búsqueda web directa (2026-11-17), documentadas en `discovery/sources/` (**Dentalink, OCLÜ, Dentaly, Clinic Cloud, Open Dental, Dentrix**), y 9 agregadas el 2026-11-22 desde la fuente #8 (**Odonthia, Bilog, DentalCore, Odonto.ar, DentalSoft, DentalTec, Órbita, Doctocliq, Dentidesk**). Ver análisis completo en las **Secciones A–D** de este informe. Dos verificaciones de nombres: "ClinicCloud" existe como **Clinic Cloud** (Doctoralia) y **Dentix** no es software sino una red DSO de +100 clínicas que contrató Clinic Cloud; "Programa Dental" no se pudo verificar y se descartó.

### 2.5 Funcionalidades necesarias (MVP — innegociables en el Discovery original)

- Pacientes + historia clínica (alta, búsqueda, datos de contacto, evolución).
- Agenda y turnos (agenda por odontólogo, reservar/cancelar, sin solapamientos).
- Atención y cobros (registrar sesión, cobrar, ver deudas/pagos).
- Usuarios y permisos (login por rol: odontólogo, recepción, admin, paciente).

**[CAMBIO posterior — IN-02]** Dos de las cuatro "innegociables" salieron del MVP por decisión del Q&A, **confirmada sin cambios en el plan §2**: el alcance vigente es agenda + turnos + pacientes (registro mínimo, ficticios) + usuarios/permisos. Historia clínica y cobros son **post-lanzamiento**. Cualquier reintento al MVP requiere una decisión explícita nueva. *(Reorganización vigente en tres listas: **Sección D.3**.)*

### 2.6 Funcionalidades opcionales (post-lanzamiento)

- Recordatorios automáticos (WhatsApp/Email).
- Facturación y reportes.
- Portal del paciente (reserva y consulta auto-servicio).

*(Sin cambios respecto al Discovery.)*

### 2.7 Reglas de negocio

Respuesta inicial del usuario: "no hay". En el gate final se registraron y confirmaron al aprobar el resumen:

- Un paciente no puede tener dos turnos solapados.
- Solo el odontólogo dueño de la agenda edita su historia clínica.
- La historia clínica es confidencial (dato de salud sensible).
- Los cobros son un registro interno de pagos/deudas, **no** facturación fiscal.

**[CAMBIO posterior]** El plan §10 y la regla dura del proyecto endurecen la primera: **ningún turno puede solaparse por profesional ni por sillón/box dentro de un mismo tenant** (los turnos contiguos son válidos). La historia clínica y los cobros quedaron fuera del MVP, así que sus reglas se aplican en la fase post-lanzamiento.

**[CAMBIO posterior — reglas de agenda de la KB]** Texto oficial de `knowledge-base/05_reglas_de_negocio.md`, junto a lo anterior:

- **RN-AG-02 (sillones/boxes y solapamiento)** — "Se impide transaccionalmente el solapamiento por profesional o por sillón/box dentro del mismo consultorio, también ante solicitudes simultáneas."
- **RN-AG-06 (turnos contiguos)** — "Los intervalos son `[inicio, fin)`; los turnos contiguos son válidos. Guardar instantes en UTC con `timestamptz` y presentar hora argentina."
- **RN-AG-07 (duración variable de prestaciones)** — "La duración positiva de la prestación determina el fin del turno." Es decir: el fin del turno **no está fijo** — lo define la duración de la prestación elegida en el catálogo (el MVP incluye "prestaciones con duración", ver `CHANGES.md`). Esta regla es la que permite turnos de distinta duración dentro de la misma agenda sin romper RN-AG-02/RN-AG-06.

### 2.8 Integraciones

- WhatsApp Business API y/o Email — confirmaciones y recordatorios.
- Pagos (Mercado Pago / transferencias / tarjetas) — cobrar sesiones.

**[CAMBIO posterior]** Todas **fuera del alcance del MVP** (KB, "Fuera de alcance"). Siguen como épicas post-lanzamiento, condicionadas por la pregunta abierta WhatsApp vs. email.

### 2.9 Restricciones

- **Stack fijo (no negociable)**: frontend TypeScript vanilla + diseño responsivo; backend Spring Boot + Gradle.
- Plazo o presupuesto acotado — condiciona el alcance del MVP.
- Datos sensibles / compliance: historia clínica = datos de salud (Ley 25.326) con requisitos de confidencialidad, backups y auditoría.

**[CAMBIO posterior]** Se suman restricciones de ejecución: todo **local hasta terminar el MVP**; despliegue posterior **Vercel (frontend) / Render (backend) / Neon (BD)** en planes gratuitos (plan §2 y §9); **PostgreSQL siempre** (Docker en local, Neon en la nube); monolito modular con módulos `tenancy`, `identidad`, `catalogo`, `pacientes`, `turnos`; `tenant_id` resuelto del token, nunca del cliente; mientras esté en planes gratuitos, sin datos reales de pacientes.

### 2.10 Riesgos

- **Adopción**: si no es más rápido que el cuaderno/WhatsApp, odontólogo y paciente no lo adoptan (riesgo #1).
- **Datos y privacidad**: historia clínica desde el día 1 sin experiencia previa en compliance.
- **Integraciones**: WhatsApp Business API y pagos pueden ser caros o lentos.
- **Scope**: 4 features innegociables en el MVP con stack fijo y presupuesto acotado.

**[CAMBIO posterior]** El scope se redujo (2 de 4 features fuera), lo que **baja el riesgo #4**, pero se agrega el riesgo de **multi-tenant** (plan §13: agranda el alcance; mitigación = tenant mínimo con `tenant_id` + aislamiento + tests). Mitigaciones adicionales del plan §13: contratos en los specs con stubs (riesgo de bloqueo entre changes), un dueño por archivo compartido (conflictos entre 5 personas), PostgreSQL igual en local y nube (diferencias local/nube).

### 2.11 Preguntas abiertas (originales del Discovery)

| # | Pregunta | Estado vigente (2026-11-17) |
|---|---|---|
| 1 | ¿Un solo consultorio o multi-sede/multi-odontólogo desde ya? | **Resuelta**: SaaS multi-tenant desde el inicio con `tenant_id` (plan §2, DD-09). Queda abierta la variante de la sección 5: alcance del multi-tenant dentro de la nota de la cátedra. |
| 2 | ¿Cloud o local (on-premise)? | **Parcialmente resuelta**: local hasta terminar el MVP; después Vercel/Render/Neon (plan §2, DD-10). Quedan: límites reales de los planes gratuitos y backups de datos sensibles. |
| 3 | ¿Cobros con comprobante fiscal real o registro interno? | Abierta — hoy solo registro interno (RN-COB-01); los cobros están fuera del MVP. |
| 4 | ¿WhatsApp Business API o primero email? | Abierta — recordatorios fuera del MVP. |
| 5 | ¿Portal del paciente en MVP o post-lanzamiento? | Decidido: **post**; reabrir si se pide auto-servicio completo. |
| 6 | ¿Auditoría/backups de historias clínicas: qué nivel mínimo? | Abierta — sin audit trail por decisión DD-06; aplica al entrar historia clínica. |

---

## 3. Decisiones posteriores que cambiaron el Discovery (resumen)

| Tema | En el Discovery | Estado VIGENTE |
|---|---|---|
| Escala | Pregunta abierta (¿un consultorio o multi-sede?) | **SaaS multi-tenant**, `tenant_id` en todas las tablas de negocio, filtrado desde el token (plan §2, DD-09) |
| Base de datos | No definida | **PostgreSQL** — Docker en local y **Neon** en la nube (DD-12) |
| Despliegue | No definido | **Vercel / Render / Neon** en planes gratuitos, solo después del MVP local (DD-10) |
| Ejecución | No definido | Local hasta terminar el MVP |
| Arquitectura | Monolito que sirve el frontend | Monolito **modular** en backend + frontend estático separado con CORS (DD-13, DD-11) |
| Alcance MVP | 4 "innegociables" (incluía historia clínica y cobros) | **Recortado**: agenda + turnos + pacientes mínimos + usuarios/permisos (IN-02) |
| Roles | Incluía rol paciente y admin genérico | §5.2 sin rol `PACIENTE` — **IN-03 abierta** |
| Reglas de negocio | Solapamiento de paciente | Solapamiento **por profesional y por sillón/box dentro del tenant** (regla dura 4) + **duración de prestaciones = fin del turno** (RN-AG-07) |

---

## Sección A — Tabla comparativa

Columnas: **Producto / Proveedor · País / Segmento · Reserva Online · Recordatorios · Pricing · Fuente (URL y fecha)**. El estado de verificación («Comprobado», «Afirmación comercial», «No evidenciado») se indica en la celda de Pricing y en la columna Fuente, según la apertura de fuentes del **2026-11-25** (detalle en `hallazgos-discovery.md` y §7).

| Producto / Proveedor | País / Segmento | Reserva Online | Recordatorios | Pricing | Fuente (URL y fecha) |
|---|---|---|---|---|---|
| **Dentalink** | Chile / LatAm (+15.000 clientes declarados, +20 países) | **No evidenciado** | Sí — confirmación/recordatorio por WhatsApp (**afirmación comercial**: páginas de Dentalink, fetch 2026-11-17, sin re-verificación) | **No evidenciado en el sitio oficial (fecha 2026-11-25, requiere cotización)** — la cifra previa del informe (USD 35 / 50 / 75; CL $35.000) fue una **afirmación comercial / relevamiento previo (2026-11-17)**, hoy no publicada en la página de planes | https://www.softwaredentalink.com/ar/planes (variante CL: https://www.softwaredentalink.com/cl/planes) — **Afirmación comercial** (fetch 2026-11-17; re-abierto 2026-11-25 sin precios) |
| **OCLÜ** | Argentina / España / LatAm | **No evidenciado** | **No evidenciado** (el chat interno vs. WhatsApp grupal no es un recordatorio) | ARS 35.000 / 55.000 / 80.000 + IVA por mes (CORE/STUDIO/SIGNATURE) o desde USD 25/mes; anual 10% off — **Comprobado (2026-11-25)** | https://oclucrm.com/ — **Comprobado** (fetch 2026-11-17; audit 2026-11-25) |
| **Dentaly** | Argentina | **No evidenciado** | **No evidenciado** (el soporte por WhatsApp con los fundadores es soporte, no recordatorio) | ARS 35.000/mes (Pro, 1 profesional), ARS 100.000/mes (Clínica), Multisede a cotizar; prueba 14 días sin tarjeta — **No evidenciado en verificación en vivo (SPA)**: el fetch devolvió contenido vacío (Vite+React); datos solo del contenido indexado (2026-11-17) | https://www.dentaly.com.ar/ — **No evidenciado** (SPA; fetch 2026-11-17 sin contenido) |
| **Clinic Cloud** | España (grupo Doctoralia) | Sí — reserva online vía ecosistema Doctoralia | **No evidenciado** | 29 / 49 / 79 € + IVA por mes (Mini/Pro/Max); Enterprise a convenir; odontograma solo en Max — **Comprobado (2026-11-25)** | https://clinic-cloud.com/tarifas (home: https://clinic-cloud.com/) — **Comprobado** (fetch 2026-11-17; audit 2026-11-25) |
| **Open Dental** | EE.UU. / internacional | **No evidenciado** | **No evidenciado** | Publicado: US$ 199/mes por ubicación (12 meses, hasta 3 providers) → US$ 149/mes; +US$ 20 por provider extra; eServices US$ 165/mes; nube y conversión aparte — **Comprobado (2026-11-25)** | https://www.opendental.com/site/fees.html (home: https://www.opendental.com/) — **Comprobado** (fetch 2026-11-17; audit 2026-11-25) |
| **Dentrix** | EE.UU. (Henry Schein One) | **No evidenciado** | **No evidenciado** | **No evidenciado** — el sitio oficial no publica precios (pide demo; paquetes y suites a cotizar), **comprobado el 2026-11-25**. Montos de terceros (~USD 75-110/mes) descartados: anécdotas de foros, no precio oficial | https://www.dentrix.com/ — **Comprobado** (fetch 2026-11-17; audit 2026-11-25; precio: **No evidenciado**) |
| **Odonthia** | Argentina | Sí — agenda con reserva online (incluso en el plan gratis) | Sí — WhatsApp automático (plan pago) | **Gratis / ARS 157.300/mes con IVA (US$ 97 en el resto de LATAM)** — **un solo plan pago** — **Comprobado vía blog (2026-11-25)**. La cifra previa del informe (ARS 74.500 / 153.700; US$ 47) **no coincide con la fuente citada** y se reemplaza por la que esa fuente publica (Ajuste 2) | https://odonthia.com/blog/mejores-software-odontologicos-argentina-2026 — **Comprobado vía blog** (relevamiento 09/10/2026; re-abierto 2026-11-25; sin página directa de precios verificada) |
| **Bilog** | Argentina | **No evidenciado** | **No evidenciado** | **No evidenciado** para planes de pago — el sitio no publica precios (Freemium sin costo hasta 50 pacientes y 1 profesional; Lite y Premium a cotizar) | Blog fuente #8 (https://odonthia.com/blog/mejores-software-odontologicos-argentina-2026) — **Afirmación comercial** (fuente tercera, relevamiento 09/10/2026) |
| **DentalCore** | Argentina (La Plata) | **No evidenciado** | **No evidenciado** | USD 50/mes con 2 usuarios + USD 10 por usuario extra; sin plan gratis (garantía de devolución de 14 días) — **Afirmación comercial** (sin sitio directo re-verificado) | Blog fuente #8 (URL arriba) — **Afirmación comercial** (relevamiento 09/10/2026) |
| **Odonto.ar** | Argentina | Sí — turnos online | WhatsApp (mención genérica, sin detallar recordatorio) — **Afirmación comercial** | USD 29 / 49 / 99 por mes; prueba de 30 días — **Afirmación comercial** | Blog fuente #8 (URL arriba) — **Afirmación comercial** (relevamiento 09/10/2026) |
| **DentalSoft** | Argentina (La Plata y Rosario) | **No evidenciado** (gestión de turnos: gratis 3 meses hasta 50 turnos por mes) | **No evidenciado** | ARS 30.000/mes (1 profesional) / ARS 60.000/mes; gratis 3 meses hasta 50 turnos por mes — **Afirmación comercial** | Blog fuente #8 (URL arriba) — **Afirmación comercial** (relevamiento 09/10/2026) |
| **DentalTec** | Argentina (San Juan) | **No evidenciado** | **No evidenciado** (vende packs de WhatsApp de USD 9 a 48, sin detallar recordatorios) | **No evidenciado** — el sitio no publica el precio del software (demo a pedido); solo packs de WhatsApp | Blog fuente #8 (URL arriba) — **No evidenciado** (relevamiento 09/10/2026) |
| **Órbita** | Argentina (La Plata) | Sí — el bot de IA agenda turnos por WhatsApp | **No evidenciado** | **No evidenciado** — el sitio no publica precios (demo de 30 minutos); migración sin costo desde otros sistemas | Blog fuente #8 (URL arriba) — **No evidenciado** (relevamiento 09/10/2026) |
| **Doctocliq** | Perú (facturación para Perú, México, Colombia, Ecuador y Rep. Dominicana; sin obras sociales ni facturación argentina) | **No evidenciado** (plan gratis: 30 pacientes o citas por mes, 1 doctor) | **No evidenciado** | USD 0 / 19 / 29 / 49 por mes (plan gratis incluido) — **Afirmación comercial** | Blog fuente #8 (URL arriba) — **Afirmación comercial** (relevamiento 09/10/2026) |
| **Dentidesk** | Chile | **No evidenciado** | Sí — recordatorios por correo electrónico — **Afirmación comercial** | **No evidenciado** — el sitio no publica precios (prueba de 15 días) | Blog fuente #8 (URL arriba) — **No evidenciado** (precio; relevamiento 09/10/2026) |

> **Nota sobre la tabla:** filas 1–6 relevadas por fetch directo de los sitios oficiales el **2026-11-17**; filas 7–15 agregadas el **2026-11-22** a partir del relevamiento del **09/10/2026** de la fuente #8 (blog de Odonthia — comparativa autorreferencial que incluye su propio producto). **Verificación externa del 2026-11-25** (9 URLs; detalle en `hallazgos-discovery.md`): **«Comprobado (…)»** = OCLÜ, Clinic Cloud, Open Dental, Dentrix (y la verificación de "Dentix" vía blog de Clinic Cloud), más el precio de Odonthia según el blog fuente #8; **«Afirmación comercial (…)»** = reclamos del proveedor sin prueba pública actual (los precios previos de Dentalink, las cifras "declaradas" como +15.000 clientes o +1.500 clínicas, y los precios de las filas 7–15 según el blog de terceros); **«No evidenciado»** = sin evidencia pública verificable (precios de Dentalink, Dentaly —SPA—, Bilog, DentalTec, Órbita, Dentidesk y Dentrix). Toda celda sin dato verificable dice literal **«No evidenciado»** y computa **0** en la Sección B. Precios y funciones cambian: re-verificar en el sitio oficial antes de citarlos fuera de este informe.

---

## Sección B — Matriz de puntuación 0–5

**15 sistemas × 7 criterios**, con pesos. Puntajes derivados **solo** de lo que el informe ya declara por competidor (Sección A, Sección C y §7).

| Criterio | Peso |
|---|---|
| Turnos | 25% |
| Clínica | 20% |
| Integraciones / WhatsApp | 15% |
| Cobros / Admin | 15% |
| UX Paciente | 10% |
| Seguridad | 10% |
| Precio / Adopción | 5% |

> **Nota metodológica:**
> - **Escala 0–5**: `0` = **No evidenciado** en el informe (computa **0**); `1` = mención indirecta o genérica (p. ej. "producto completo"); `2` = evidencia parcial; `3` = evidencia funcional clara (dato publicado o registrado en el informe); `4` = evidencia clara con una limitación; `5` = evidencia fuerte y detallada.
> - **«No evidenciado» = 0**: todo criterio sin evidencia en el informe puntúa 0; ningún vacío se completó con supuestos.
> - **Origen de los puntajes**: derivados exclusivamente de la evidencia ya contenida en este informe (Sección A, Sección C y §7) — **sin investigación nueva** en esta corrección.
> - **Total ponderado** = Σ(puntaje × peso), escala 0–5. Los pesos suman 100%.
> - **Alcance de cada criterio**: *Turnos* = agenda, turnos y reserva online · *Clínica* = historia clínica, odontograma y funciones clínicas · *Integraciones/WhatsApp* = WhatsApp, IA, API e integraciones · *Cobros/Admin* = cobros, obras sociales, facturación/ARCA · *UX Paciente* = reserva, portal o app del paciente · *Seguridad* = permisos, auditoría de acceso, certificaciones y control del dato · *Precio/Adopción* = precios publicados, planes gratuitos/pruebas e incentivos de adopción.
> - **Advertencia**: un puntaje bajo puede reflejar **falta de evidencia en el informe**, no falta de la función en el producto (p. ej. Dentaly puntúa bajo porque su evidencia es solo "No evidenciado"). Las filas 7–15 se basan en el blog fuente #8 (fuente tercera, autorreferencial).

| Sistema | Turnos (25%) | Clínica (20%) | Integraciones / WhatsApp (15%) | Cobros / Admin (15%) | UX Paciente (10%) | Seguridad (10%) | Precio / Adopción (5%) | **Total ponderado** |
|---|---|---|---|---|---|---|---|---|
| **Dentalink** | 3 | 4 | 4 | 4 | 0 | 0 | 1 | **2,80** |
| **OCLÜ** | 4 | 4 | 4 | 5 | 0 | 5 | 3 | **3,80** |
| **Dentaly** | 0 | 0 | 1 | 0 | 0 | 0 | 4 | **0,35** |
| **Clinic Cloud** | 4 | 3 | 2 | 3 | 4 | 5 | 3 | **3,40** |
| **Open Dental** | 1 | 1 | 4 | 4 | 0 | 3 | 5 | **2,20** |
| **Dentrix** | 1 | 1 | 4 | 0 | 0 | 1 | 0 | **1,15** |
| **Odonthia** | 4 | 3 | 3 | 0 | 4 | 0 | 5 | **2,70** |
| **Bilog** | 0 | 3 | 0 | 4 | 1 | 1 | 3 | **1,55** |
| **DentalCore** | 0 | 3 | 0 | 5 | 0 | 0 | 3 | **1,50** |
| **Odonto.ar** | 4 | 0 | 3 | 4 | 3 | 0 | 3 | **2,50** |
| **DentalSoft** | 3 | 0 | 0 | 4 | 0 | 0 | 4 | **1,55** |
| **DentalTec** | 0 | 0 | 3 | 4 | 0 | 0 | 0 | **1,05** |
| **Órbita** | 3 | 0 | 4 | 0 | 3 | 0 | 1 | **1,70** |
| **Doctocliq** | 3 | 4 | 0 | 0 | 1 | 0 | 4 | **1,85** |
| **Dentidesk** | 0 | 3 | 3 | 0 | 0 | 0 | 1 | **1,10** |

*(Ejemplos de cómo se leyó la evidencia: **Dentalink** en Clínica = 4 por "odontograma + obras sociales en todos los planes" e IA (§A/§C), pero Seguridad = 0 porque el informe no registra permisos/auditoría/certificaciones de Dentalink; **OCLÜ** en Cobros/Admin = 5 por cobros + facturación ARCA y en Seguridad = 5 por "permisos por rol con auditoría", pero UX Paciente = 0 porque el informe no registra portal/reserva online de paciente para OCLÜ.)*

---

## Sección C — Análisis de mercado

### C.1 Estándar de mercado

- **El status quo es el competidor real**: planilla/Excel, cuaderno y WhatsApp siguen siendo con lo que compite cualquier solución, y los competidores lo usan como gancho de venta — Dentaly abre con "¿Tu consultorio todavía vive entre Excel, Calendar y papel?" (https://www.dentaly.com.ar/), Clinic Cloud ofrece migración gratuita desde papel/Excel (https://clinic-cloud.com/) y OCLÜ vende contra "usar Excel más el WhatsApp personal" (https://oclucrm.com/). Nuestra ventaja de adopción debe medirse contra esa alternativa gratis, no solo contra otros software.
- **Benchmark mínimo esperado en LatAm**: agenda por profesional, odontograma, historia clínica, presupuestos/cobros, confirmación/recordatorio por WhatsApp y control de obras sociales (según Dentalink y OCLÜ). Nuestro MVP es un **subconjunto deliberado** de ese estándar: no es una suite completa y no pretende serlo — el informe lo declara explícitamente para evitar expectativas de feature parity.
- **OCLÜ es el competidor de alcance más parecido** (agenda, turnos, pacientes, historia clínica, cobros y RBAC con auditoría) — nuestra diferenciación no puede venir de features.
- **Dentrix y Open Dental** definen el "producto completo" de la categoría, pero sus modelos (insurance claims, on-premise, managed IT) no se trasladan a Argentina; se usan como referentes, no como benchmark de precio.
- **La categoría es densa y barata**: 15 sistemas comparados en la Sección A, con precios que en el relevamiento local van de planes gratuitos (Odonthia, Bilog, Doctocliq) a ARS 60.000/mes (DentalSoft) y USD 50/mes (DentalCore), según el blog fuente #8.

### C.2 Diferenciadores reales

Diferenciadores registrados por producto (columna "Diferenciadores" de la tabla comparativa original, ahora en la Sección A; se conservan tal cual):

| Producto | Diferenciadores registrados |
|---|---|
| **Dentalink** | Líder auto-declarado en LatAm; odontograma + obras sociales en todos los planes; IA incluida; sin contratos; financiación de pacientes y multicentro en planes superiores |
| **OCLÜ** | Mismo plan-base para todos (se paga por tamaño de clínica); permisos por rol con auditoría; chat interno vs. WhatsApp grupal; facturación ARCA; migración asistida |
| **Dentaly** | Simplicidad ("sin funciones de relleno"), precio transparente en pesos, soporte por WhatsApp con los fundadores, sin créditos por mensaje |
| **Clinic Cloud** | Ecosistema Doctoralia (visibilidad + reserva online), IA clínica (suite Noa), RGPD/ISO 27001; facturación española (no ARCA) |
| **Open Dental** | Único PMS mayor con lista de precios completa; DB MySQL abierta + API; self-hosted (control del dato); foco en insurance claims (modelo EE.UU.) |
| **Dentrix** | 30+ años de estándar del sector, 35.000+ prácticas, ecosistema partners (API Exchange), on-premise vs. cloud (Ascend), servicios IT |
| **Odonthia** | Gestión gratis sin límite de pacientes; odontograma FDI y agenda con reserva online incluso en el plan gratis; sin liquidación de obras sociales ni facturación ARCA |
| **Bilog** | Más de 20 años en el mercado y +1.500 clínicas/consultorios **declarados** (afirmación comercial); fuerte en liquidación de obras sociales y auditoría para gerenciadoras; Freemium hasta 50 pacientes y 1 profesional con odontograma; apps iOS/Android |
| **DentalCore** | Apoyo a la decisión clínica ("17 motores clínicos" según su sitio); obras sociales con liquidación por período y facturación ARCA |
| **Odonto.ar** | Cálculo de obras sociales, turnos online y WhatsApp |
| **DentalSoft** | +300 clínicas **declaradas** (afirmación comercial); obras sociales con liquidación. Ojo: hay homónimos en Chile y México — este es el de dentalsoft.com.ar |
| **DentalTec** | Validación de prácticas en tiempo real con 15 obras sociales (OSDE, Swiss Medical, Sancor); facturación ARCA; foco en círculos e instituciones odontológicas |
| **Órbita** | Bot de IA para WhatsApp que agenda turnos combinado con la gestión del consultorio; migración sin costo desde otros sistemas |
| **Doctocliq** | Freemium regional con odontograma y periodontograma en el plan gratis; app móvil; todos los planes, para 1 doctor |
| **Dentidesk** | Fichas por especialidad y gestión multisucursal; recordatorios por correo electrónico; el sitio no menciona Argentina |

*(Las cifras "declaradas" por los proveedores — +15.000 clientes de Dentalink, +1.500 clínicas de Bilog, +300 de DentalSoft — son **afirmaciones comerciales**, no verificadas de forma independiente.)*

### C.3 Vacíos del mercado argentino

**No evidenciado** — el informe original no identificó vacíos explícitos del mercado argentino, y esta corrección no agrega análisis nuevo (regla de la revisión: sin datos nuevos = sin inventar).

Constataciones existentes relacionadas (datos ya registrados en el informe, sin interpretación nueva):

- **Doctocliq** (Perú) no ofrece obras sociales ni facturación argentina (Sección A, fila 14).
- **Dentidesk** (Chile) no menciona Argentina en su sitio (Sección A, fila 15).
- Los modelos de **Dentrix** y **Open Dental** (insurance claims, on-premise, managed IT) "no se trasladan a Argentina" (C.1).

### C.4 Oportunidades de innovación

- **Un MVP estudiantil no compite en features ni en precio, sino en simplicidad y alcance**: la categoría es densa y barata. La comparativa del blog de Odonthia (fuente #8; autorreferencial, porque lista su propio producto; relevamiento del 09/10/2026, https://odonthia.com/blog/mejores-software-odontologicos-argentina-2026) lista 13 sistemas y alimenta las filas 7–15 de la Sección A: incluye planes gratuitos o freemium (Odonthia, Bilog), con precios que llegan a ARS 60.000/mes (DentalSoft) y USD 50/mes (DentalCore); la suite regional **Dentalink cuyo precio hoy es a cotizar (no evidenciado al 2026-11-25)**. Contra ese piso de precio, nuestro diferenciador es la promesa de simplicidad (el mismo ángulo que Dentaly) y un alcance acotado y verificable.
- **La ventaja de adopción se mide contra el status quo gratis**, no solo contra otros software (ver C.1): la simplicidad es el ángulo ya elegido y el alcance acotado y verificable es lo que un MVP estudiantil puede prometer sin feature parity.
- *(Sin otras oportunidades documentadas en el informe original → **No evidenciado** para análisis adicionales.)*

---

## Sección D — Demo, referentes de UX y MVP

### D.1 Cinco competidores para demo

1. **Dentalink** — suite regional; líder auto-declarado en LatAm (+15.000 clientes, +20 países; *afirmación comercial*); odontograma + obras sociales en todos los planes. Precio actual: a cotizar (no evidenciado al 2026-11-25).
2. **OCLÜ** — competidor argentino de alcance más parecido al MVP (agenda, turnos, pacientes, historia clínica, cobros, RBAC con auditoría); precios publicados y comprobados.
3. **Dentaly** — referente del ángulo de simplicidad que adoptamos ("sin funciones de relleno"), precio transparente en pesos (no verificable en vivo, SPA).
4. **Odonthia** — plan gratis permanente con agenda y reserva online; es además la fuente #8 de la comparativa local.
5. **DentalCore** — referente local (La Plata): apoyo a la decisión clínica ("17 motores clínicos") y facturación ARCA.

### D.2 Tres referentes de UX

1. **Dentaly** — simplicidad y precio transparente en pesos (el ángulo que adoptamos).
2. **Clinic Cloud** — ecosistema Doctoralia con reserva online y migración desde papel/Excel; RGPD/ISO 27001.
3. **Open Dental** — único PMS mayor con lista de precios completa; DB MySQL abierta + API; self-hosted (control del dato).

### D.3 MVP en tres listas

Reorganización del contenido vigente de §2.5–2.7 en tres listas explícitas:

**① Imprescindibles (alcance vigente del MVP)**

- Agenda por odontólogo.
- Turnos **sin solapamientos por profesional ni por sillón/box** dentro del mismo tenant (regla dura 4; **RN-AG-02**), turnos contiguos válidos (**RN-AG-06**).
- **Duración de prestaciones**: la duración positiva de la prestación determina el fin del turno (**RN-AG-07**) — catálogo de prestaciones con duración.
- Pacientes con datos básicos (alta, búsqueda, datos de contacto; **RN-PAC-01/02**), siempre con **datos ficticios** (RN-EX-02).
- Usuarios y permisos (RBAC): roles `ADMIN_CONSULTORIO`, `ODONTOLOGO`, `RECEPCION` + `SUPERADMIN` (plan §5.2; sin rol `PACIENTE` — IN-03 abierta).
- Catálogo: profesionales, sillones/boxes y prestaciones (CHANGES.md, ola 0).
- Tenancy mínimo: `consultorio_id` desde el token, nunca desde el cliente (RN-TEN-01/02).

**② Diferenciadores (opcionales con peso en adopción; hoy post-lanzamiento)**

- **Simplicidad y alcance acotado y verificable** (promesa diferenciadora frente a suites densas — C.4).
- **Recordatorios automáticos (WhatsApp/Email)** (§2.6; benchmark de mercado en C.1; WhatsApp vs. email sigue abierto).
- **Portal del paciente** — reserva y consulta auto-servicio (§2.6; decisión actual **post**, §2.11; reabrir si se pide auto-servicio completo).
- Reserva/cancelación de turno por el paciente sin depender de llamadas o WhatsApp (US-001; sujeta a IN-03).

**③ Etapas posteriores (fuera del MVP — RN-EX-01: "Historia clínica, cobros, contabilidad y sucursales quedan fuera del MVP")**

- **Historia clínica** (alta, búsqueda, evolución; RN-HC-01/02; confidencial, Ley 25.326; auditoría/backups pendientes DD-06).
- **Cobros** (RN-COB-01: registro interno de pagos/deudas con centavos enteros o `NUMERIC` e idempotencia).
- **Facturación fiscal y contabilidad** (los cobros del MVP **no** son facturación fiscal — RN-COB-01/RN-EX-01; pregunta abierta §2.11.3) y **sucursales**.
- Integraciones de pago (Mercado Pago / transferencias / tarjetas) y auditoría/backups de historia clínica.

---

## 5. Riesgos y preguntas abiertas (consolidado)

### 5.1 Riesgos

| # | Riesgo | Origen | Mitigación actual |
|---|---|---|---|
| R1 | **Adopción**: si no es más rápido que cuaderno/WhatsApp, no lo adoptan | Discovery §10 (riesgo #1) | Hipótesis de simplicidad; validar con flujo de punta a punta (fase F del plan) |
| R2 | **Datos y privacidad**: historia clínica desde el día 1 sin experiencia en compliance | Discovery §10 | Historia clínica **fuera del MVP** (IN-02); mientras haya planes gratuitos, sin datos reales de pacientes (Ley 25.326, regla dura 7) |
| R3 | **Integraciones**: WhatsApp API y pagos caros o lentos | Discovery §10 | Integraciones fuera del MVP |
| R4 | **Scope**: features "innegociables" con stack fijo y presupuesto acotado | Discovery §10 | **Reducido**: 2 de 4 features salieron; specs con ≥3 escenarios y contratos entre changes |
| R5 | **Multi-tenant agranda el alcance** y compromete el change principal (C05) | Plan §13 | Tenant mínimo: `tenant_id` + aislamiento + tests; lo demás, etapa posterior |
| R6 | Un change bloquea a los demás / conflictos entre 5 personas | Plan §13 | Contratos y stubs en specs, ola 0 corta, módulos separados, un dueño por archivo compartido |
| R7 | Diferencias local/nube; arranque en frío de planes gratuitos | Plan §13 | PostgreSQL en ambos + Flyway versionado; arranque en frío aceptado para validación, documentado en README |
| R8 | **Riesgo de datos sensibles** (auditoría/backups de historia clínica) aún sin definir | Discovery §11.6 | Sin audit trail por DD-06; definir el mínimo antes de entrar historia clínica |

### 5.2 Preguntas abiertas

**De la KB / plan §12 (prioridad alta):**

1. **IN-03 — rol `PACIENTE` no definido en el plan §5.2**: ¿el MVP incluye auto-reserva de turnos por paciente (US-001) o solo creación por recepción/odontólogo? → **no inventar; preguntar a la líder antes de cerrar specs de turnos.**
2. **Estrategia final de autenticación**: token propio vs. proveedor externo (plan §12).
3. **Alcance exacto del multi-tenant dentro de la nota del trabajo**: ¿es requisito de la cátedra o decisión propia del equipo? (plan §12).
4. **Cumplimiento para datos reales de pacientes** antes de salir de la etapa de validación (plan §12; Ley 25.326).
5. **Límites reales de los planes gratuitos de Vercel, Render y Neon** al momento del despliegue — verificar en las páginas oficiales (plan §9 y §12).
6. **¿La cátedra espera un solo change por el ciclo OPSX completo o uno por integrante?** (plan §12).
7. **¿Cuándo entra la historia clínica al alcance?** (post-lanzamiento, sin fecha) y **¿qué nivel mínimo de auditoría/backups exigir?** (KB prioridad Alta).
8. **Cobros**: ¿comprobante fiscal real o solo registro interno? (hoy: solo registro interno).
9. **Recordatorios**: ¿WhatsApp Business API (con costo) o primero email?
10. **Portal del paciente**: decidido post-lanzamiento; reabrir si se pide auto-servicio completo.
11. **Adopción de Docker**: si complica el entorno del equipo, ¿se cae a PostgreSQL directo? (siempre PostgreSQL, igual en local y nube).
12. **Cuándo entra la historia clínica al MVP/post** y **auditoría** (ver 7).

---

## 6. Anexos

- **Discovery completo (11 puntos):** [`discovery/discovery.md`](../discovery/discovery.md)
- **Hallazgos de verificación externa (2026-11-25):** [`discovery/hallazgos-discovery.md`](hallazgos-discovery.md) — evidencia de los 3 ajustes aplicados en este informe
- **Notas de competidores:**
  - [`discovery/sources/dentalink.md`](../discovery/sources/dentalink.md)
  - [`discovery/sources/oclu.md`](../discovery/sources/oclu.md)
  - [`discovery/sources/dentaly.md`](../discovery/sources/dentaly.md)
  - [`discovery/sources/clinic-cloud.md`](../discovery/sources/clinic-cloud.md)
  - [`discovery/sources/open-dental.md`](../discovery/sources/open-dental.md)
  - [`discovery/sources/dentrix.md`](../discovery/sources/dentrix.md)
- **Decisiones vigentes y plan:** [`docs/plan-ejecucion.md`](plan-ejecucion.md) (§2 decisiones, §11 entregables, §12 preguntas abiertas)
- **Knowledge base:** [`knowledge-base/`](../knowledge-base/README.md) — en particular [`10_preguntas_abiertas.md`](../knowledge-base/10_preguntas_abiertas.md) (IN-01, IN-02, IN-03) y [`01_vision_y_objetivos.md`](../knowledge-base/01_vision_y_objetivos.md)

---

## 7. Verificación de fuentes

Fecha de consulta de todas las fuentes externas: **2026-11-17** (investigación de la fase `discovery-research`), salvo la ampliación de la Sección A, hecha el **2026-11-22** con datos de la fuente #8 (relevamiento propio de esa fuente del 09/10/2026). **Revisión externa del 2026-11-25**: 9 URLs abiertas antes de la entrega del jueves 2026-11-26; los 3 ajustos resultantes están aplicados en este informe (detalle y textos originales en `docs/discovery/hallazgos-discovery.md`).

### 7.1 Fuentes externas (competidores)

| # | Fuente | URL | Qué afirmación respalda | Estado de verificación |
|---|---|---|---|---|
| 1 | Nota Dentalink | https://www.softwaredentalink.com/ar/planes (variante CL: https://www.softwaredentalink.com/cl/planes) | Pricing Esencial/Pro/Titanium USD 35/50/75 (AR) y $35.000 CLP (CL); +15.000 clientes; odontograma + obras sociales en todos los planes; IA incluida | **Verificada en la nota** (fetch de la página de planes, 2026-11-17). Precios "desde" para 1 profesional; con equipo: **(no público)**. **Re-abierto el 2026-11-25**: la página **no publica ningún precio** (los tres planes muestran "Solicitá tu cotización"; la FAQ dice que los precios varían según las necesidades) y el blog fuente #8 sostiene que Dentalink no publica precios → la cifra queda como **afirmación comercial / relevamiento previo (2026-11-17)**; ver Ajuste 1 (Sección A) |
| 2 | Nota OCLÜ | https://oclucrm.com/ | Pricing ARS 35.000/55.000/80.000 + IVA; "desde USD 25/mes"; planes por tamaño de clínica; permisos con auditoría; discurso contra "Excel + WhatsApp personal" | **Verificada en la nota** (fetch del home, 2026-11-17); **Comprobada en la revisión externa del 2026-11-25**. Ojo moneda: pesos + IVA, valor a re-verificar por devaluación |
| 3 | Nota Dentaly | https://www.dentaly.com.ar/ | Pricing ARS 35.000 (Pro) / 100.000 (Clínica); gancho "Excel, Calendar y papel"; prueba 14 días; simplicidad como diferenciador | **Verificada parcialmente**: el fetch devolvió contenido vacío (SPA Vite+React); los datos salen del contenido indexado por búsqueda web (2026-11-17). El fetch **no pudo verificar el precio en vivo (SPA)** → en la Sección A queda como **No evidenciado en verificación en vivo**, estrictamente en ARS (Ajuste 3). Re-verificar precios en la página antes de citarlos fuera de la nota |
| 4 | Nota Clinic Cloud | https://clinic-cloud.com/tarifas (home: https://clinic-cloud.com/) | Pricing 29/49/79 € + IVA; odontograma solo en Max; migración gratuita desde papel/Excel; ecosistema Doctoralia; RGPD/ISO 27001 | **Verificada en la nota** (fetch de tarifas, 2026-11-17); **Comprobada en la revisión externa del 2026-11-25**. Al 2026-11-17 promo Black Friday 50% 3 meses |
| 5 | Nota Open Dental | https://www.opendental.com/site/fees.html (home: https://www.opendental.com/) | US$ 199 → 149/mes por ubicación; +US$ 20/provider; eServices US$ 165/mes; DB MySQL abierta + API; self-hosted | **Verificada en la nota** (fetch de la lista oficial de fees, 2026-11-17); **Comprobada en la revisión externa del 2026-11-25**. Ellos mismos advierten que las fees cambian cada pocos años |
| 6 | Nota Dentrix | https://www.dentrix.com/ | "All-in-one platform", 35.000+ prácticas, 30+ años de estándar, API Exchange, on-premise vs. Ascend (nube) | **Verificada en la nota**; **Comprobado en la revisión externa del 2026-11-25** que el pricing **no está público** en el sitio oficial → en la Sección A se registra como **No evidenciado**. Montos de terceros (~USD 75-110/mes) descartados: anécdotas de foros, no precio oficial |
| 7 | Blog Clinic Cloud (verificación de nombre) | https://clinic-cloud.com/blog/dentix-elige-clinic-cloud-como-software-gestion-clinicas | "Dentix" no es software: es una red DSO de +100 clínicas (España/Italia/Colombia) que contrató Clinic Cloud | **Verificada en la nota** (2026-11-17); **Comprobada en la revisión externa del 2026-11-25** |
| 8 | Comparativa Odonthia | https://odonthia.com/blog/mejores-software-odontologicos-argentina-2026 | Base de las filas 7–15 de la Sección A: 9 sistemas (Odonthia, Bilog, DentalTec, DentalCore, Odonto.ar, DentalSoft, Órbita, Doctocliq, Dentidesk) dentro de su relevamiento de 13 (suma además Dentalink, Clinic Cloud, AgendaPro y Dendoo) | **Verificada en la nota**; relevamiento propio de la fuente del **09/10/2026** (fecha de la fuente, no de nuestra consulta); re-consultada el **2026-11-22** para ampliar la Sección A. **Re-abierta el 2026-11-25**: publica "**Gratis / ARS 157.300 por mes, con IVA (US$ 97 en el resto de LATAM)**" — un solo plan pago —, cifra dista de la que traía el informe (ARS 74.500 / 153.700) → **Ajuste 2 aplicado** en la Sección A. Fuente autorreferencial: es el blog de Odonthia e incluye su propio producto |

### 7.2 Fuentes primarias internas

| # | Fuente | Qué afirmación respalda | Estado |
|---|---|---|---|
| 9 | **Entrevista con la líder (Q&A de la fase Discovery / Mode B de la KB)** — fuente primaria | Problema, usuarios, casos de uso, reglas de negocio confirmadas al aprobar el resumen, riesgos ("todo" como preocupación), stack fijo, alcance del MVP, decisión de recorte de historia clínica y cobros (IN-02) | **Fuente primaria: entrevista con la líder** (respuestas registradas en `discovery/discovery.md` y `knowledge-base/`); no es una fuente pública, es el relato autoritativo del requisito |
| 10 | `discovery/discovery.md` (2026-11-16) | Los 11 puntos tal como se cerraron en la fase | Documento interno del repo, sin URL pública |
| 11 | `docs/plan-ejecucion.md` (2026-11-17) | Decisiones vigentes: multi-tenant, PostgreSQL, Vercel/Render/Neon, monolito modular, roles §5.2, reglas §10, preguntas §12, riesgos §13 | Documento interno del repo, sin URL pública |
| 12 | `knowledge-base/` (01, 03, 04, 09, 10) | Consistencias y contradicciones IN-01/IN-02/IN-03, alcance v1.0, DD-06/09/10/11/12/13 | Documentos internos del repo |

### 7.3 Afirmaciones SIN respaldo de fuente — **"No evidenciado"**

| Afirmación | Estado |
|---|---|
| Magnitud del problema (cuánto tiempo se pierde, cuántas doble reservas hay por semana en consultorios reales) | **No evidenciado** — no hay métricas de campo ni fuentes citadas; es el relato del Q&A, cualitativo |
| Tamaño del mercado odontológico argentino (cantidad de consultorios, ticket promedio) | **No evidenciado** — no se investigó; no usar para proyecciones |
| Que un MVP "más simple" efectivamente logre adopción sobre Excel/cuaderno/WhatsApp | **No evidenciado** — es la hipótesis central de la adopción, sin validar con usuarios reales |
| "Programa Dental" como competidor | **No evidenciado** — no se pudo verificar como producto independiente; **descartado** |
| Montos de Dentrix citados en foros (~USD 75-110/mes) | **No evidenciado** — anecdóticos, no precio oficial; no usar |
| Precio actual de Dentalink (USD 35/50/75; CL $35.000) | **No evidenciado** — la página de planes no publica precios al 2026-11-25 (Ajuste 1); cifra solo como afirmación comercial del relevamiento 2026-11-17 |
| Precio de Dentaly verificado en su sitio oficial | **No evidenciado** — SPA sin contenido en el fetch; solo contenido indexado en ARS (Ajuste 3) |
| Vacíos explícitos del mercado argentino | **No evidenciado** — el informe no identificó vacíos (Sección C.3) |
| Límites vigentes de los planes gratuitos de Vercel/Render/Neon | **No evidenciado** — el plan §9 exige verificarlos en las páginas oficiales antes de desplegar |
| Requisitos de la cátedra sobre alcance (multi-tenant como requisito propio o del trabajo) | **No evidenciado** — pendiente de confirmación (plan §12) |

---

*Informe generado el 2026-11-17 a partir de la fase `discovery-research`; corregido y ampliado el 2026-11-22 (tabla comparativa a 15 sistemas y «Verificación de fuentes» movida al final); **corregido el 2026-11-25** (3 ajustes de `hallazgos-discovery.md` aplicados — precios de Dentalink, precio de Odonthia y rango del resumen — y estructura en Secciones A/B/C/D). El PDF `docs/discovery/informe-discovery.pdf` **queda desincronizado** respecto de esta versión y debe regenerarse. Sin datos reales de pacientes (los ejemplos de pacientes son ficticios por regla del proyecto).*

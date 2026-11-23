# Design

## Context

Ver `proposal.md` (Why). Contexto acotado a lo necesario:

- El módulo `turnos` ya existe con C05 (`POST /api/turnos`) en capas rutas → servicios → dominio → repositorio (DD-13); el router está montado en `src/app.js` bajo `/api/turnos`, así que C07 solo agrega un handler (sin tocar el montaje). La interfaz reutilizable está publicada en `src/modules/turnos/README.md`: **una única transacción** con pre-check SELECT, traducción `23P01`/`40P01` → 409 y reintento de deadlock (máximo 2 intentos).
- `db/migrations/` hoy tiene `001`…`050` mergeadas más `070_reprogramar_turno.sql`, **ya creada** para este change (rango reservado 070–079; solo columnas de auditoría). Ninguna migración mergeada se edita (regla dura 9).
- El token de C00 aporta `{ usuarioId, consultorioId, rol }` (`src/modules/auth/rutas.js:61`): `consultorioId` y ahora también el operador (`usuarioId`) salen **solo del token** (regla dura 2).
- Errores: `ApiError(statusCode, code, message)` + manejador central (`src/errores.js`); `traducirViolacionExclusion` (`23P01`/`40P01` → 409) y `errorSolapamiento` ya viven en `src/modules/turnos/dominio.js`.
- Apply **bloqueado hasta que C05 esté archivado/mergeado** (proposal.md §Capabilities): la capability `turnos`, la tabla `turno` (migración 050) y la interfaz de validación reutilizable salen de C05. La planificación (este artefacto) se hace ahora.
- Change **no visual** (solo API): no aplica el gate de mockups ni hay sección de UI en este artefacto.

## Goals / Non-Goals

**Goals:**

- `PATCH /api/turnos/:id/reprogramar` con las **mismas garantías de disponibilidad** que la creación (RN-AG-09): revalidación transaccional de todas las reglas de solapamiento sobre el nuevo rango —excluyendo el turno actual— y **horario anterior conservado** ante cualquier fallo.
- Contrato de errores estable: 200 · 400 `VALIDACION` · 403 `SIN_PERMISO` · 404 `TURNO_NO_ENCONTRADO` · 409 `ESTADO_INVALIDO` · 409 `SOLAPAMIENTO`.
- Auditoría de cada reprogramación exitosa (`reprogramadoEn`, `reprogramadoPor`) sobre las columnas de la 070.
- Consumir la interfaz de C05 **sin duplicar** SQL de solapamiento (`CHANGES.md:172`).

**Non-Goals:**

- Cancelación y transiciones de estado (C06); cambio de paciente/profesional/sillón/prestación de un turno existente; bloqueos, `AgendaSlot` y listado de agenda (C08); flag "operar sin recepción"; frontend (C09).
- Ningún endpoint además del PATCH y ningún cambio en `src/app.js` (el router ya está montado).

## Decisions

### D1. Reutilizar la comprobación de solapamiento de C05 extrayéndola — no copiarla

El pre-check SELECT de `crearTurno` (`repositorio.js`) se extrae a un **helper interno del mismo archivo** `src/modules/turnos/repositorio.js` —una sola copia del SQL— parametrizado por `excluirTurnoId` opcional que agrega `AND id <> $n` al predicado existente (`consultorio_id = $1`, `estado <> 'CANCELADO'`, solape `[)` `inicio < $n AND fin > $m`). Lo consumen `crearTurno` (sin exclusión, comportamiento idéntico al actual) y el nuevo `reprogramarTurno` (excluyendo el turno que se mueve). Además se reusan sin tocar: `validarUuid`, `validarInicio`, `calcularFin`, `errorSolapamiento`, `traducirViolacionExclusion` (dominio) y el patrón de reintento `40P01` máx. 2 intentos (repositorio).

- **Alternativas descartadas:** (a) copiar el SELECT al método nuevo — es exactamente el riesgo de duplicación que `CHANGES.md:172` prohíbe; (b) crear un módulo compartido `solapamientos.js` — excesivo para un helper y agrega un archivo más que coordinar con C06/C08.
- La extracción se hace **después** de que C05 esté mergeado (tarea 1.1), con la suite de C05 en verde como red de regresión (tarea 4.1).

### D2. Transacción: `SELECT … FOR UPDATE` + callback del servicio + pre-check + `UPDATE` en un solo `BEGIN`

Secuencia de `repositorio.reprogramarTurno({ turnoId, consultorioId, inicio, reprogramadoPor }, bajoBloqueo)`:

1. `BEGIN` (con reintento de la transacción COMPLETA máx. 2 intentos ante `40P01`, mismo patrón que `crearTurno`).
2. `SELECT … FROM turno WHERE id = $1 AND consultorio_id = $2 FOR UPDATE` → sin fila → `ROLLBACK` + `errorTurnoNoEncontrado()` (404; el `consultorio_id` en el `WHERE` da el aislamiento RN-TEN-01/RN-TEN-02).
3. Callback del servicio **bajo el lock**: `estado !== 'PENDIENTE'` → `errorEstadoInvalido()` (409, RN-AG-10) + `ROLLBACK`; si pasa, devuelve `{ inicio, fin }` (ver D3). El callback es **puro** (valida y calcula, sin I/O) para que el reintento lo re-ejecute sin efectos secundarios.
4. Pre-check de solapamiento con `excluirTurnoId = turnoId` por paciente, profesional y sillón/box → 409 `SOLAPAMIENTO` con mensaje detallado por recurso + `ROLLBACK`.
5. `UPDATE turno SET inicio, fin, reprogramado_en = now(), reprogramado_por = $… WHERE id = $ AND consultorio_id = $` → `COMMIT` (bajo el lock el estado no cambió: no hace falta filtrar por `estado` en el `UPDATE`).
6. Manejo de errores: cualquier `ApiError` → `ROLLBACK` y se propaga tal cual; `23P01` (índice de exclusión de la 050, carrera real) o `40P01` del último intento → 409 vía `traducirViolacionExclusion` — nunca 500 por estas causas.

**Por qué `FOR UPDATE`:** el chequeo de estado y el `UPDATE` quedan atómicos sobre la fila — si una cancelación de C06 o un segundo `PATCH` concurrente commitea primero, este transaction espera, releo la última versión y decide con datos frescos (→ 409 `ESTADO_INVALIDO` si ya no es `PENDIENTE`); además distingue 404 vs. 409 en una sola ida y serializa el pre-check contra la fila que se mueve. Si la operación falla en cualquier paso, el `ROLLBACK` **conserva el horario anterior** (RN-AG-09).

- **Alternativas descartadas:** (a) `UPDATE … WHERE estado = 'PENDIENTE'` sin lock + relectura para distinguir 404/estado — dos round-trips, mensajes pobres y el servicio necesita la fila de todas formas (recursos y `duracion_min` para el pre-check y el `fin`); (b) `SELECT` sin lock + `UPDATE` posterior — deja una ventana entre el chequeo de estado y el `UPDATE` (carrera con cancelación/reprogramación concurrente); (c) mover el chequeo de estado al repositorio — descartado: el repositorio no contiene reglas de negocio (D6/DD-13), el callback las mantiene en el servicio sin romper la transacción única.

### D3. `fin` se recalcula en el servicio, bajo el bloqueo, con la duración congelada

Dentro del callback (fila bloqueada a mano): `fin = calcularFin(nuevoInicio, turno.duracionMin)` — la **misma función del dominio** que usa C05, con la duración **guardada al crearse** el turno (RN-AG-07: editar la prestación después no altera este cálculo), e intervalo `[inicio, fin)` en `timestamptz` UTC (RN-AG-06). La fila bloqueada aporta `duracion_min` y los tres recursos que el pre-check necesita.

- **Alternativa descartada:** recalcular con la duración actual de la prestación — rompe RN-AG-07.

### D4. Orden de validación y mapeo de errores

| Code | HTTP | Dónde se decide |
|---|---|---|
| `VALIDACION` | 400 | Ruta: `:id` UUID bien formado e `inicio` ISO 8601 con zona horaria explícita (`validarUuid`/`validarInicio`, reusados). Defensivamente también en el servicio (precedente C05). |
| `SIN_PERMISO` | 403 | Ruta: guardia de rol —solo `RECEPCION`/`ADMIN_CONSULTORIO` (RN-AG-03), `ODONTOLOGO` rechazado—, **después de la forma y antes de tocar la base** (DD-13: la ruta decide permisos; sin acceso a datos, un rol no permitido no puede sondear existencia de turnos). |
| `TURNO_NO_ENCONTRADO` | 404 | Servicio/repositorio: `SELECT … FOR UPDATE` sin fila (inexistente o de otro consultorio) → `ROLLBACK`, ningún turno modificado. |
| `ESTADO_INVALIDO` | 409 | Servicio, bajo el lock: `estado !== 'PENDIENTE'` (RN-AG-10) → `ROLLBACK`, conserva horario y estado originales. |
| `SOLAPAMIENTO` | 409 | Repositorio: pre-check (excluyendo `id != turnoId`) o `23P01`/`40P01` tras agotar el reintento → `ROLLBACK`, horario anterior intacto. |

**Orden efectivo: 400 → 403 (ruta) → 404 → 409 `ESTADO_INVALIDO` → 409 `SOLAPAMIENTO` (servicio/transacción).** Nota sobre la secuencia sugerida `400 → 404 → 403 → …`: el 403 vive en la ruta por DD-13 y la decisión 1 (la ruta es la única que decide permisos), por lo que —al no haber acceso a datos— necesariamente precede al 404; se valida primero la forma (400) para que los errores de formato no dependan del estado de la base. Los seis escenarios S1–S6 del spec quedan satisfechos con este orden.

### D5. Auditoría en el `UPDATE` y en el DTO

`reprogramado_en = now()` (timestamp de la transacción) y `reprogramado_por = usuarioId` **del token**, seteados **solo** en el `UPDATE` exitoso (un fallo hace `ROLLBACK` y no audita). `mapearTurno` suma `reprogramadoEn`/`reprogramadoPor` (`NULL` hasta la primera reprogramación) y el 200 devuelve el mismo DTO que el POST (sin `consultorioId`) más esos dos campos — es lo que S1 verifica.

- La FK `reprogramado_por → usuario(id)` de la 070 exige que el `usuarioId` del token exista en la base: en producción lo garantiza el login (C01); **en los tests el fixture debe INSERTAR un usuario ficticio** y firmar el token con ese id (tarea 1.2), si no, `23503`.

### D6. Capas (DD-13) y contrato HTTP

- `rutas.js`: handler `PATCH /:id/reprogramar` con parseo/validación de forma + guardia de rol **únicamente** (reusando `ROLES_QUE_CREAN`, mismos roles que crean); `consultorioId` y `usuarioId` SOLO de `req.auth`; responde 200 con el DTO. Sin SQL ni reglas de negocio.
- `servicios.js`: `reprogramarTurno({ turnoId, inicio, consultorioId, usuarioId })` — 400 defensivo → delega al repositorio con el callback (409 `ESTADO_INVALIDO` → `calcularFin`).
- `dominio.js`: constructores nuevos `errorTurnoNoEncontrado()` y `errorEstadoInvalido()` junto a `errorSolapamiento()`; validadores y traductor ya existentes se reusan.
- `repositorio.js`: SQL, transacción, pre-check compartido (D1). Sin cambios de montaje en `src/app.js`.

### D7. Estrategia de pruebas (Apply; no se escriben ahora)

- Gate `npm test` (vitest contra PostgreSQL real). **Siempre** `node --env-file=.env ./node_modules/vitest/vitest.mjs run …` — `npx vitest run` a secas falla sin `DATABASE_URL`.
- S1–S6 como tests de integración HTTP con `tests/helpers/turnos-fixtures.js` extendido (usuario ficticio para la FK + helper de turnos de partida con overrides), tokens ficticios y **datos siempre ficticios** (regla dura 1). ≥3 escenarios por spec (feliz / error de negocio / borde) sumando los bordes de R2 (contiguidad `[)`, turno `CANCELADO` no bloquea) y una carrera de dos `PATCH` paralelos.
- Unitarios de dominio para los constructores nuevos y tests de repositorio contra la base real (ROLLBACK conserva el horario, 404, exclusión del turno actual); **no se mockea la capa SQL**.
- Vigilar `tests/esquema.test.js` y `tests/turnos-migracion.test.js` con la 070 presente (leen `db/migrations` por `readdir` dinámico: verificar que la traza del runner incluye `070_reprogramar_turno`).

## Risks / Trade-offs

- [Apply bloqueado por C05] → tarea 1.1 detiene el apply si C05 no está archivado/mergeado; la planificación se hace ahora.
- [Modificar `repositorio.js`/`servicios.js` recién mergeados de C05 → conflictos con C06/C08 en archivos compartidos] → extraer el helper solo tras el merge con la suite de C05 en verde; separar responsabilidades por archivo (C06: cancelación/estado · C07: reprogramación · C08: lectura de agenda) y coordinar con los responsables antes de aplicar.
- [Carrera C07 vs C06 (cancelación concurrente)] → el `FOR UPDATE` serializa: si el cancel commitea primero, el reprogram ve `CANCELADO` → 409 `ESTADO_INVALIDO`; si no, el cancelador verá el turno ya reprogramado. Coordinar que C06 condicione su `UPDATE` por `estado = 'PENDIENTE'`.
- [FK `reprogramado_por` rompe tests que firmen tokens con UUIDs aleatorios (`23503`)] → tarea 1.2: el fixture inserta el usuario ficticio y el token lo referencia.
- [Duplicar la lógica de solapamiento (riesgo de `CHANGES.md:172`)] → D1: extracción y consumo de un único helper, con regresión de C05.
- [Concurrencia en reprogramación (`40P01`/`23P01`)] → mismo contrato de C05: máximo 2 intentos y 409 final, nunca 500 (tarea 4.2).
- [Tests que enumeran migraciones] → `esquema.test.js`/`turnos-migracion.test.js` leen el directorio dinámicamente; verificar con la 070 presente (tarea 2.2).
- [Overhead de `FOR UPDATE`] → despreciable a volumen MVP: solo se bloquea el turno que se mueve.

## Migration Plan

1. Apply condicionado a C05 archivado/mergeado (050 + interfaz publicada).
2. `070_reprogramar_turno.sql` ya existe (solo columnas de auditoría): verificarla con el runner sobre base vacía y sobre base existente (`npm run migrate`), sin editar migraciones mergeadas.
3. Rollback forward-only (regla dura 9): cualquier corrección va en una migración nueva del rango 070–079, nunca editando la 070 una vez mergeada.
4. Merge a `main` solo con `npm test` en verde y revisión con ≥1 aprobación (regla dura 6).

## Open Questions

- Ninguna: la ruta, los códigos de error, la migración, la reutilización de la interfaz de C05 y el alcance no visual están fijados en la propuesta y el spec aprobados; no hay incógnitas que cambien specs, enfoque ni el desglose de tareas.

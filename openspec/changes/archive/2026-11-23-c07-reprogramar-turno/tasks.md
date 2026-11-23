# Tasks

## 1. Precondiciones y fixtures de prueba

- [x] 1.1 Confirmar que C05 está archivado/mergeado a `main` (migración `050` aplicada con la tabla `turno` y sus tres restricciones de exclusión, e interfaz de validación publicada en `src/modules/turnos/README.md`); si no está, detener el apply aquí (bloqueo registrado en proposal.md y design.md) — verificación: `git log --oneline main` muestra el merge/archivo de C05, existe `db/migrations/050_turno.sql` y el README documenta la comprobación de solapamiento reutilizable.
- [x] 1.2 Extender `tests/helpers/turnos-fixtures.js` (patrón de C05, datos **ficticios** siempre — regla dura 1): crear un `usuario` ficticio por fixture y firmar el token de `conFixtureTurnos` con ESE id (la FK `reprogramado_por` de la 070 lo exige, design D5), más un helper para crear turnos de partida con overrides (estado `CANCELADO`/`ATENDIDO` vía SQL directa solo en tests; otro profesional/sillón/paciente para aislar el conflicto de S2) — verificación: `node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/turnos-fixtures.test.js` en verde con aserciones nuevas (el usuario existe y es referenciable por el token; el turno `PENDIENTE` de partida se crea y la limpieza por FK sigue funcionando).

## 2. Migración 070 (auditoría de reprogramación)

- [x] 2.1 Verificar `db/migrations/070_reprogramar_turno.sql` (ya creada: `reprogramado_en TIMESTAMPTZ` y `reprogramado_por UUID REFERENCES usuario(id)` declarada SOLO desde la 070 — precedente de la 050, regla dura 10; sin DDL de solapamiento) aplicada por el runner sobre base vacía y sobre base existente, sin editar ninguna migración mergeada (regla dura 9) — verificación: `npm run migrate` aplica pendientes y una re-ejecución sin pendientes sale con código 0; en la base, `SELECT column_name FROM information_schema.columns WHERE table_name = 'turno' AND column_name IN ('reprogramado_en','reprogramado_por')` devuelve ambas columnas y `git diff db/migrations/` no muestra cambios en `001`–`050`.
- [x] 2.2 Revisar los tests que enumeran migraciones con la 070 presente (`tests/esquema.test.js`, `tests/turnos-migracion.test.js` — esperan por `readdir` dinámico, design D7) — verificación: `node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/esquema.test.js tests/turnos-migracion.test.js` en verde y la traza del runner incluye `070_reprogramar_turno` ordenada después de `050_turno`.

## 3. Dominio de reprogramación

- [x] 3.1 Reusar en `src/modules/turnos/dominio.js` los helpers ya existentes (`validarUuid`, `validarInicio`, `calcularFin`, `errorSolapamiento`, `traducirViolacionExclusion`) y agregar SOLO lo nuevo: constructores `errorTurnoNoEncontrado()` → `ApiError(404, 'TURNO_NO_ENCONTRADO', …)` y `errorEstadoInvalido()` → `ApiError(409, 'ESTADO_INVALIDO', …)` con mensajes seguros (sin exponer datos de otros consultorios) — verificación: `node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/turnos-dominio.test.js` en verde, con casos nuevos que comprueban code/status de ambos errores y que los validadores de forma siguen respondiendo 400 `VALIDACION` (UUID malformado e `inicio` sin timezone).

## 4. Repositorio transaccional

- [x] 4.1 Extraer el pre-check SELECT de `crearTurno` en un helper interno dentro de `src/modules/turnos/repositorio.js` (una sola copia del SQL: mismo predicado `[)` `inicio < $n AND fin > $m`, `estado <> 'CANCELADO'` y `consultorio_id = $1`, más `excluirTurnoId` opcional que agrega `AND id <> $n`) y hacerlo consumir por `crearTurno` sin exclusión — diseño D1, sin cambiar su comportamiento — verificación: `node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/turnos-repositorio.test.js tests/turnos-servicio.test.js tests/turnos-api.test.js` en verde (sin regresión de C05: conflicto, contigüdad y aislamiento siguen pasando).
- [x] 4.2 Implementar `reprogramarTurno({ turnoId, consultorioId, inicio, reprogramadoPor }, bajoBloqueo)` en `crearRepositorioTurnos()`: ÚNICA transacción con reintento máx. 2 ante `40P01` (mismo patrón que `crearTurno`) → `BEGIN` → `SELECT … FOR UPDATE` por `id + consultorio_id` (sin fila → `ROLLBACK` + `errorTurnoNoEncontrado()`) → ejecuta `bajoBloqueo(turnoBloqueado)` (si lanza ApiError → `ROLLBACK` y la propaga; callback puro, re-ejecutable en el reintento) → pre-check con `excluirTurnoId = turnoId` por paciente/profesional/sillón-box → `UPDATE turno SET inicio, fin, reprogramado_en = now(), reprogramado_por = $… WHERE id = $ AND consultorio_id = $` → `COMMIT`; `23P01`/`40P01` del último intento → 409 vía `traducirViolacionExclusion` (nunca 500); SQL parametrizado con lista explícita de columnas (sin `SELECT *`, sin concatenar) — verificación: tests nuevos en `tests/turnos-repositorio.test.js` contra PostgreSQL real: (a) callback que lanza 409 deja el turno con su horario anterior (ROLLBACK), (b) id inexistente o de otro consultorio → 404 sin ninguna fila modificada, (c) reprogramar al mismo horario del propio turno no se auto-conflicta (exclusión `id != turnoId`).
- [x] 4.3 Sumar `reprogramadoEn`/`reprogramadoPor` al mapper de turnos (`mapearTurno`), `NULL` hasta la primera reprogramación — verificación: test en `tests/turnos-repositorio.test.js` que crea un turno y verifica ambos campos en `null`, y con valores después de un `reprogramarTurno` exitoso.

## 5. Servicio `reprogramarTurno` e interfaz pública

- [x] 5.1 Implementar `reprogramarTurno({ turnoId, inicio, consultorioId, usuarioId })` en `src/modules/turnos/servicios.js`: validación de forma defensiva (`validarUuid` + `validarInicio` → 400) y luego la transacción del repositorio con callback que, **bajo el lock**, verifica `estado === 'PENDIENTE'` (si no → `errorEstadoInvalido()` 409, RN-AG-10) y devuelve `{ inicio, fin }` con `fin = calcularFin(inicio, turno.duracionMin)` (duración congelada al crearse, RN-AG-07; `[)` UTC, RN-AG-06) pasando `reprogramadoPor: usuarioId` — verificación: tests en `tests/turnos-servicio.test.js` contra PostgreSQL real: éxito con `fin = inicio + 30 min` y auditoría; estado `CANCELADO` → 409 `ESTADO_INVALIDO` sin cambios; solape → 409 `SOLAPAMIENTO` y el turno conserva su horario anterior (RN-AG-09).
- [x] 5.2 Documentar la nueva interfaz en `src/modules/turnos/README.md`: firma de `reprogramarTurno`, orden de errores (400 → 403 → 404 → 409 `ESTADO_INVALIDO` → 409 `SOLAPAMIENTO`), columnas de auditoría y el requisito del fixture (usuario real para la FK `reprogramado_por`) — verificación: el README documenta firma, códigos y ejemplo de uso, y los comandos citados se ejecutan tal cual.

## 6. Rutas HTTP

- [x] 6.1 Agregar `router.patch('/:id/reprogramar', …)` en `src/modules/turnos/rutas.js` con SOLO forma y guardia (DD-13, design D4/D6): `validarUuid(req.params.id)` e `validarInicio(body.inicio)` → 400 `VALIDACION`; guardia de rol reusando `ROLES_QUE_CREAN` (`RECEPCION`/`ADMIN_CONSULTORIO`, RN-AG-03; `ODONTOLOGO` → 403 `SIN_PERMISO`); `consultorioId` y `usuarioId` SOLO de `req.auth` (regla dura 2); llamada al servicio y 200 con el DTO del turno sin `consultorioId` (mismo shape que el POST + `reprogramadoEn`/`reprogramadoPor`); sin tocar `src/app.js` (el router ya está montado) — verificación: `node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/turnos-api.test.js` en verde con los tests de ruta nuevos (401 sin token, 400 con UUID malformado o `inicio` sin timezone, 403 con token `ODONTOLOGO`) y `git diff src/app.js` vacío.

## 7. Tests de integración de los escenarios del spec (S1–S6)

- [x] 7.1 Escenario S1 (reprogramación exitosa): 200 con el mismo turno y sus recursos, `inicio` 15:00 UTC, `fin` 15:30 UTC (misma duración) y `reprogramadoEn`/`reprogramadoPor` registrados — verificación: `node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/turnos-api.test.js` en verde contra PostgreSQL real.
- [x] 7.2 Escenario S2 (conflicto): 409 con code `SOLAPAMIENTO` y el turno reprogramado conserva inicio 10:00 / fin 10:30 UTC — verificación: mismo comando en verde.
- [x] 7.3 Escenario S3 (404): id inexistente y turno de otro consultorio → 404 `TURNO_NO_ENCONTRADO` en ambos casos y ningún turno modificado (aislamiento RN-TEN-01/RN-TEN-02) — verificación: mismo comando en verde.
- [x] 7.4 Escenario S4 (estado): turnos `CANCELADO` y `ATENDIDO` → 409 `ESTADO_INVALIDO` con horario y estado originales — verificación: mismo comando en verde.
- [x] 7.5 Escenario S5 (forma): `inicio` "2026-12-01T15:00:00" sin timezone → 400 `VALIDACION` y el turno conserva su horario anterior (agregar también `:id` malformado → 400) — verificación: mismo comando en verde.
- [x] 7.6 Escenario S6 (permisos): token con rol `ODONTOLOGO` → 403 `SIN_PERMISO` y el turno no se modifica — verificación: mismo comando en verde.
- [x] 7.7 Bordes de la R2: un turno que empieza exactamente cuando termina el reprogramado es válido (`[)`, RN-AG-06) y un turno `CANCELADO` en el nuevo rango no bloquea — verificación: mismo comando en verde.
- [x] 7.8 Carrera: dos `PATCH /api/turnos/:id/reprogramar` idénticos en paralelo (`Promise.all`) → sin 500, dos respuestas 2xx y un solo horario final en la base (el `FOR UPDATE` serializa, design D2) — verificación: test determinista que pasa 3 veces seguidas.

## 8. Verificación final

- [x] 8.1 Correr el gate completo `npm test` (vitest contra PostgreSQL real; ≥3 escenarios por spec; aislamiento obligatorio) — verificación: salida en verde.
- [x] 8.2 Revisar reglas duras aplicables: datos SIEMPRE ficticios (1), `consultorioId`/`usuarioId` solo del token (2), sin secretos en el repo (5), sin editar migraciones mergeadas (9), sin tocar tablas de otros módulos (10), commit convencional sin coautoría solo cuando el usuario lo pida (8/11) — verificación: `git diff --stat` limitado a `src/modules/turnos/`, `db/migrations/070_*`, `tests/turnos-*`, `tests/helpers/turnos-fixtures.js` y `openspec/changes/c07-reprogramar-turno/`; checklist marcada en el PR.

## Workflow follow-up

- El apply arranca solo cuando C05 esté archivado/mergeado (bloqueo en proposal.md; lo confirma la tarea 1.1).
- Tras implementar, `npm test` en verde y revisión: commit/push únicamente si el usuario lo pide explícitamente (regla dura 8).
- Archivar con `/opsx:archive c07-reprogramar-turno` (sincronizando el delta a `openspec/specs/turnos/spec.md`) y marcar la entrada C07 en `CHANGES.md`.

# Tasks

## 1. Precondiciones y fixtures de prueba

- [x] 1.1 Confirmar que C03 está mergeado a `main` (migración `030` aplicada, tabla `paciente` existente y `existePaciente` exportado desde `src/modules/pacientes/index.js`); si no está, detener el apply aquí (bloqueo registrado en proposal.md y design.md D2/D3) — verificación: `git log --oneline main` muestra el merge de C03 y el archivo `src/modules/pacientes/index.js` existe y exporta `existePaciente`.
- [x] 1.2 Crear helper de fixtures de turnos con datos **ficticios** (`randomUUID()` por test, consultorio propio por test, limpieza por FK ordenada y filtrada, sin DELETE globales) siguiendo el patrón de `tests/helpers/catalogo-fixtures.js` — verificación: el helper se importa desde un test de humo que pasa con `npx vitest run <archivo>`.

## 2. Migración 050 (esquema de turnos)

- [x] 2.1 Crear `db/migrations/050_turno.sql` con `CREATE EXTENSION IF NOT EXISTS btree_gist`, la tabla `turno` (columnas de design.md D2: recursos, `inicio`/`fin` `timestamptz`, `duracion_min`, `estado` con `CHECK` de los cinco valores de RN-AG-10 y default `PENDIENTE`), `CHECK (fin > inicio)`, las cinco FKs declaradas solo desde 050 y los índices de `knowledge-base/04_modelo_de_datos.md:112` — verificación: el runner aplica la 050 sobre base vacía y sobre base existente sin errores (`npm run migrate` o el comando documentado en el README).
- [x] 2.2 Agregar las tres restricciones de exclusión parciales (`EXCLUDE USING gist` sobre `consultorio_id WITH =`, el recurso `WITH =` y `tstzrange(inicio, fin) WITH &&`, todas con `WHERE (estado <> 'CANCELADO')`) para paciente, profesional y sillón/box — verificación: en base de test, un INSERT solapado por cada recurso falla con SQLSTATE `23P01` (confirma la opclass `uuid` de `btree_gist`, design.md D1) y dos turnos contiguos insertan sin error.
- [ ] 2.3 Verificar la 050 en ambas cadenas de conexión (Docker local y Neon) sin editar ninguna migración mergeada — verificación: la misma secuencia `001 → 010 → 020 → 030 → 040 → 050` aplica en ambas; una re-ejecución sin pendientes sale con código 0 (spec schema-migrations). **Estado:** local verificado (base vacía y base existente, re-ejecución con código 0); Neon pendiente de comprobar en el primer deploy. Btree_gist 1.8 figura como soportado en la documentación de Neon, pero no se ejecutó.

## 3. Dominio y repositorio de turnos

- [x] 3.1 Implementar el dominio de `src/modules/turnos/`: cálculo de `fin = inicio + duracionMin` con la duración guardada al crearse (RN-AG-07), validadores de UUID y de `inicio` ISO 8601 con timezone explícito o UTC y traductor de `23P01` → `ApiError(409, 'SOLAPAMIENTO', mensaje seguro)` (precedente `traducirViolacionUnica`) — verificación: tests unitarios rojos→verdes con `npx vitest run tests/turnos-dominio.test.js`, incluyendo un caso `fin = inicio` rechazado.
- [x] 3.2 Implementar el repositorio de `src/modules/turnos/`: INSERT parametrizado y pre-check SELECT de solapamiento, ambos dentro de una única transacción y filtrando siempre por `consultorio_id`, con SQL sargable e índices existentes — verificación: tests contra PostgreSQL real en `tests/turnos-repositorio.test.js` que insertan turnos ficticios y comprueban conflicto, contigüedad (`[)`) y filtro por consultorio.

## 4. Servicio `crearTurno` e integración de interfaces

- [x] 4.1 Implementar `crearTurno(deps)` en `src/modules/turnos/servicios.js` con deps inyectables (`existePaciente`, `existeProfesional`, `existeSillonBox`, `obtenerCatalogo`, `obtenerPrestacionParaTurno`) y orden de validación: UUID malformado o `inicio` sin timezone ISO 8601 → 400 `VALIDACION`; recurso inexistente, ajeno o inactivo → 422 `REFERENCIA_INVALIDA` indicando el campo fallido (`pacienteId`, `profesionalId`, `sillonBoxId`, `prestacionId`), un mensaje por campo (mismo para inexistente/ajeno/inactivo); transacción + INSERT → 409 `SOLAPAMIENTO` — verificación: tests del servicio con fakes inyectados por `deps` (incluido `existePaciente` devolviendo `false` y lanzando `ApiError(400, 'VALIDACION', ...)`) en `tests/turnos-servicio.test.js`.
- [x] 4.2 Concretar los imports estáticos sin tocar `catalogo/index.js`: `obtenerCatalogo`, `existeProfesional`, `existeSillonBox` desde `../catalogo/index.js` y `obtenerPrestacionParaTurno` desde `../catalogo/prestaciones/servicios.js` (design.md D4) — verificación: `npm test` en verde y `git diff src/modules/catalogo/index.js` sin cambios.
- [x] 4.3 Documentar la interfaz pública de turnos (`crearTurno` y la comprobación de solapamiento reutilizable por C07) en el README del módulo `src/modules/turnos/README.md` — verificación: el README documenta la firma, los códigos de error y el ejemplo de inyección de `deps`, y los comandos citados se ejecutan tal cual.

## 5. Rutas HTTP y montaje

- [x] 5.1 Implementar `src/modules/turnos/rutas.js` con `middlewareAutenticacion` de C00 montado en el router, guardia de rol que permite `RECEPCION` y `ADMIN_CONSULTORIO` y responde 403 `SIN_PERMISO` a `ODONTOLOGO`, y parseo/validación HTTP de `POST /api/turnos` sin lógica de negocio (DD-13) — verificación: tests HTTP que firman tokens con `tests/helpers/tokens.js` y comprueban 401 sin token, 403 para odontólogo y 400 `VALIDACION` con UUID malformado o `inicio` sin timezone en `tests/turnos-api.test.js`.
- [x] 5.2 Montar el router de turnos en `src/app.js` bajo `/api/turnos` (siguiendo el precedente de `rutasPrestaciones`) y devolver 201 con el DTO del turno (`id`, recursos, `inicio`, `fin`, `duracionMin`, `estado: 'PENDIENTE'`, `creadoEn`) — verificación: test de escenario S1 responde 201 con `fin = inicio + 30 min` y estado `PENDIENTE`.

## 6. Tests de integración de los escenarios del spec

- [ ] 6.1 Escenarios S1, S2, S3 y S5 (reserva válida, conflicto por profesional, por sillón/box y por paciente): 409 `SOLAPAMIENTO` sin registro creado — verificación: `npx vitest run tests/turnos-api.test.js` en verde contra PostgreSQL real.
- [ ] 6.2 Escenarios S4 y S9 (turno contiguo válido y duración fijada al crearse: editar la prestación a 60 min no altera el turno existente de 30 min) — verificación: `npx vitest run tests/turnos-api.test.js` en verde.
- [ ] 6.3 Escenario S6 (concurrencia): dos `POST /api/turnos` idénticos en paralelo con `Promise.all`, exactamente un 201 y un 409 `SOLAPAMIENTO`, un solo turno creado — verificación: el test pasa de rojo a verde con la restricción de exclusión activa y es determinista al repetirlo 3 veces.
- [ ] 6.4 Escenario S7 (aislamiento): turnos solapados idénticos en dos consultorios distintos, cada uno con su token, ambos 201 y cada turno en su consultorio; además, identificador de otro consultorio tratado como inexistente — verificación: test en verde y sin filas cruzadas al filtrar por `consultorio_id`.
- [ ] 6.5 Escenario S8 y errores (422 `REFERENCIA_INVALIDA` indicando el campo fallido — `profesionalId` para el profesional inactivo, `pacienteId` para el paciente de otro consultorio y `prestacionId` para la prestación inactiva, con un mensaje por campo; 400 `VALIDACION` con UUID malformado) — verificación: `npx vitest run tests/turnos-api.test.js` en verde.
- [ ] 6.6 Escenario S10 (permiso): token con rol `ODONTOLOGO` → 403 `SIN_PERMISO` y turno no creado — verificación: `npx vitest run tests/turnos-api.test.js` en verde.

## 7. Verificación final

- [ ] 7.1 Correr el gate completo `npm test` (vitest contra PostgreSQL real, escenarios ≥3 por spec cubiertos y aislamiento obligatorio) — verificación: salida en verde.
- [ ] 7.2 Revisar reglas duras aplicables: sin datos reales de pacientes en tests/capturas (ficticios siempre), `consultorio_id` solo del token en toda query, sin secretos en el repo, sin editar migraciones mergeadas y sin tocar tablas de otros módulos — verificación: `git diff` limitado a `src/modules/turnos/`, `src/app.js`, `db/migrations/050_*` y archivos de test de turnos; checklist marcada en el PR.

## Workflow follow-up

- Presentar los artefactos a la usuaria para aprobación del spec antes de cualquier apply (apply bloqueado hasta que C03 esté en `main`).
- Tras apply y `npm test` en verde con revisión: `/opsx:archive c05-crear-turno-sin-solapamientos` y marcar la entrada C05 en `CHANGES.md`.

# Proposal

- **Change ID:** `c07-reprogramar-turno`

## Why

El flujo base de la prioridad de seis días es "crear, consultar, **reprogramar** y cancelar" (`knowledge-base/09_decisiones_y_supuestos.md`) y US-004 (`knowledge-base/06_funcionalidades.md`) pide que recepción reprograme un turno **con las mismas garantías de disponibilidad** que al crearlo. Sin C07, la única salida ante un cambio de horario sería cancelar y recrear el turno: se pierde el registro del turno original y no se cumplen las mismas reglas de solapamiento sobre el nuevo rango. RN-AG-09 (`knowledge-base/05_reglas_de_negocio.md`) exige reutilizar la validación de disponibilidad de C05 y **conservar el horario anterior si la operación falla**.

## What Changes

- Nuevo endpoint **`PATCH /api/turnos/:id/reprogramar`** (único endpoint de este change) con body `{ inicio }`:
  - Roles `RECEPCION` y `ADMIN_CONSULTORIO` (RN-AG-03); `ODONTOLOGO` → 403 `SIN_PERMISO`. El `consultorioId` sale **solo del token** (regla dura 2), nunca del body ni de headers.
  - `inicio` en ISO 8601 con zona horaria explícita o UTC; sin timezone o UUID malformado → 400 `VALIDACION`.
  - Solo turnos en estado `PENDIENTE`; un turno en otro estado → 409 `ESTADO_INVALIDO`.
  - Turno inexistente o perteneciente a otro consultorio → 404 `TURNO_NO_ENCONTRADO` (convención `<recurso>_NO_ENCONTRADO` de `catalogo`).
  - `fin` se recalcula como `nuevo inicio + duracion_min` del turno, la duración fijada al crearse (RN-AG-07); intervalos `[inicio, fin)` en `timestamptz` UTC (RN-AG-06).
- **Reprogramación transaccional sin solapamientos** (RN-AG-01, RN-AG-02): en una sola transacción, `SELECT … FOR UPDATE` del turno por `id + consultorio_id`, pre-check de solapamiento sobre el nuevo rango **excluyendo el turno actual (`id != turnoId`)** por paciente, profesional y sillón/box, y `UPDATE` de `inicio`/`fin`. La violación de exclusión (SQLSTATE `23P01`) → 409 `SOLAPAMIENTO`; el reintento ante deadlock (`40P01`, máximo 2 intentos) sigue el precedente de C05. Si la operación falla, el turno **conserva su horario anterior** (RN-AG-09).
- **Reutilización de la interfaz de C05, no una copia** (`CHANGES.md:172`): la comprobación de solapamiento documentada en `src/modules/turnos/README.md` (pre-check + índice de exclusión + traducción `23P01`/`40P01`) se consume desde el servicio de reprogramación.
- **Migración `070_reprogramar_turno.sql`** (rango reservado 070–079): agrega a `turno` las columnas de auditoría `reprogramado_en TIMESTAMPTZ` y `reprogramado_por UUID REFERENCES usuario(id)` (FK declarada **solo** desde la 070, precedente de la 050; regla dura 10). Ninguna migración mergeada se edita (regla dura 9). Sin DDL de solapamiento: las tres restricciones de exclusión de la 050 ya protegen el `UPDATE`.

Fuera de alcance (se declara en el spec): cancelación y transiciones de estado (C06), cambio de paciente/profesional/sillón/prestación de un turno existente, bloqueos, `AgendaSlot`, listado de agenda (C08), el flag "operar sin recepción" y el frontend (C09).

## Capabilities

### New Capabilities

<!-- Ninguna: la capability `turnos` nace en C05. -->

### Modified Capabilities

- `turnos`: se suman la reprogramación de turnos `PENDIENTE` con las mismas garantías de disponibilidad, los nuevos errores (`TURNO_NO_ENCONTRADO`, `ESTADO_INVALIDO`) y la auditoría de reprogramación.

**Bloqueo**: el apply de este change espera a que C05 (`c05-crear-turno-sin-solapamientos`) esté archivado/mergeado a `main` — la capability `turnos`, la tabla `turno` (migración 050) y la interfaz de validación reutilizable salen de C05. La propuesta puede crearse ahora.

## Impact

- **Código nuevo**: `src/modules/turnos/` (rutas, servicios, dominio, repositorio) — archivos compartidos con C06 y C08, se coordinan responsabilidades por archivo; el router sigue montado en `src/app.js` sin cambios de montaje.
- **Base de datos**: nueva migración `db/migrations/070_reprogramar_turno.sql` (rango 070–079); no se edita `050_turno.sql` ni ninguna otra mergeada (regla dura 9).
- **Dependencias**: C05 (bloqueante para apply), C00 (middleware de auth); consume interfaces de `auth` solo para el guardia de rol (RN-AG-03).
- **Tests**: `npm test` (vitest contra PostgreSQL real con `--env-file=.env`); escenarios nuevos S1–S6 de reprogramación, conflicto por exclusión, estado inválido, validación de forma, permisos y 404. Datos siempre ficticios (regla dura 1 / RN-EX-02).
- **Tests existentes a vigilar**: los que enumeran migraciones (`tests/esquema.test.js`, `tests/turnos-migracion.test.js`) con la aparición de la 070.

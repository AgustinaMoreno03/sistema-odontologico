# Proposal

## Why

Sin turnos no hay agenda: C05 es la primera pieza del flujo de reserva y bloquea C06 (cancelar) y C07 (reprogramar). Sin la validación transaccional de solapamientos, dos reservas simultáneas podrían confirmar ambas sobre el mismo profesional o sillón/box (RN-AG-01, RN-AG-02), violando la regla dura 4 del proyecto.

## What Changes

- Nueva tabla `turno` (migración `050`, rango 050–059) con `inicio`/`fin` en `timestamptz`, `estado` (`PENDIENTE` inicial; CHECK con los cinco valores de RN-AG-10), `CHECK (fin > inicio)`, FK a `paciente` y tres restricciones de exclusión parciales (`WHERE estado <> 'CANCELADO'`) por paciente, profesional y sillón/box, sobre `EXCLUDE USING gist` con extensión `btree_gist`.
- Nuevo endpoint `POST /api/turnos` (único endpoint de este change): valida el formato de `inicio` (ISO 8601 con timezone explícito o UTC; sin timezone → 400 `VALIDACION`) y, en una sola transacción, la pertenencia/activitud de paciente, profesional, sillón/box y prestación (inexistente/ajeno/inactivo → 422 `REFERENCIA_INVALIDA` indicando el campo fallido), calcula `fin = inicio + duración` de la prestación (RN-AG-07) e inserta el turno; violación SQLSTATE `23P01` → 409 `SOLAPAMIENTO`.
- Consumo de interfaces de otros módulos sin modificarlos: `existeProfesional`, `existeSillonBox`, `obtenerCatalogo` (C02), `obtenerPrestacionParaTurno` (C04, import directo de `catalogo/prestaciones/servicios.js`) y `existePaciente` (C03, inyectada por `deps` en tests).
- **Bloqueo**: el apply de este change espera a que C03 (`c03-pacientes`) esté mergeado a `main` (la FK de la 050 exige la tabla `paciente` de la 030 y el orden ascendente del runner); la propuesta puede crearse ahora.

Fuera de alcance (se declara en el spec): flag "habilitado para operar sin recepción" (hoy solo `RECEPCION` y `ADMIN_CONSULTORIO` crean turnos; `ODONTOLOGO` no), bloqueos, `AgendaSlot`, listado, cancelación y reprogramación (C06/C07).

## Capabilities

### New Capabilities

- `turnos`: creación de turnos sin solapamientos por paciente, profesional y sillón/box dentro del consultorio autenticado; contrato de `POST /api/turnos`, cálculo de duración, errores y aislamiento entre consultorios.

### Modified Capabilities

<!-- Ninguna: C05 consume interfaces ya especificadas en catalogo/prestaciones/auth/schema-migrations sin cambiar sus requisitos. -->

## Impact

- **Código nuevo**: `src/modules/turnos/` (rutas, servicios, dominio, repositorio), router montado en `src/app.js`.
- **Base de datos**: nueva migración `050_turno.sql` + `CREATE EXTENSION IF NOT EXISTS btree_gist`; nada de migraciones existentes editadas (regla dura 9).
- **Dependencias**: C00 (middleware de auth), C02 (`catalogo`), C04 (`prestaciones`), **C03 (`pacientes`, bloqueante para apply)**; C01 (login) no es requerido.
- **Tests**: `npm test` (vitest contra PostgreSQL real); escenarios nuevos de reserva, conflictos, contigüedad, concurrencia, aislamiento, recurso inválido, permisos (403 `SIN_PERMISO`) y validación de `inicio`.

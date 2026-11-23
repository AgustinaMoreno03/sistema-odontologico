# turnos Specification

## Purpose

Este capability permite crear y reprogramar turnos dentro del consultorio autenticado, conservando las garantías transaccionales de disponibilidad y aislamiento por tenant, y cancelar turnos futuros `PENDIENTE` o `CONFIRMADO` con auditoría. Reprogramar conserva el horario anterior si falla (RN-AG-09); cancelar conserva el registro y libera el horario. Cubre creación, reprogramación y cancelación (`POST /api/turnos`, `PATCH /api/turnos/:id/reprogramar` y `PATCH /api/turnos/:id/cancelar`). El cambio de recursos y el flag de operar sin recepción quedan fuera de alcance; bloqueos y listado de agenda siguen reservados para C08.

## Requirements

### Requirement: Reprogramación de turno mediante PATCH /api/turnos/:id/reprogramar (RN-AG-09, RN-AG-03)

El sistema SHALL permitir a `RECEPCION` y `ADMIN_CONSULTORIO` cambiar el `inicio` de un turno con `PATCH /api/turnos/:id/reprogramar` (body `{ inicio }`), recalculando `fin = inicio + duracion_min` con la duración fijada al crearse el turno (RN-AG-07) y respondiendo 200 con el turno actualizado; el `consultorioId` SHALL salir solo del token. El turno SHALL quedar auditado con `reprogramadoEn` y `reprogramadoPor`. El turno SHALL ser del consultorio autenticado; si no existe o es de otro consultorio, el sistema SHALL responder 404 con code `TURNO_NO_ENCONTRADO`.

#### Scenario: S1 - Reprogramación exitosa
- **GIVEN** el consultorio A tiene un turno `PENDIENTE` ficticio del paciente X con profesional P, sillón S y prestación de 30 minutos, creado a las 10:00 UTC, y un usuario de recepción autenticado en el consultorio A
- **WHEN** envía `PATCH /api/turnos/<id>/reprogramar` con `inicio` 2026-12-01T15:00:00Z, un horario sin conflictos
- **THEN** responde 200 con el mismo turno y sus recursos, `inicio` 15:00 UTC, `fin` 15:30 UTC (misma duración) y `reprogramadoEn`/`reprogramadoPor` registrados

#### Scenario: S3 - Turno inexistente o ajeno devuelve 404 TURNO_NO_ENCONTRADO
- **GIVEN** el consultorio A con su usuario de recepción autenticado y un turno ficticio del consultorio B en el mismo intervalo
- **WHEN** envía `PATCH /api/turnos/<id inexistente>/reprogramar` con un `inicio` válido, o `PATCH` sobre el turno del consultorio B
- **THEN** responde 404 con code `TURNO_NO_ENCONTRADO` en ambos casos y ningún turno se modifica (aislamiento RN-TEN-01, RN-TEN-02)

### Requirement: Sin turnos solapados al reprogramar, excluyendo el turno actual (RN-AG-01, RN-AG-02, RN-AG-06)

El sistema SHALL revalidar en una única transacción todas las reglas de solapamiento sobre el nuevo rango —paciente, profesional y sillón/box dentro del mismo consultorio— **excluyendo el turno que se reprograma (`id != turnoId`)**; ante conflicto SHALL responder 409 con code `SOLAPAMIENTO` y el turno SHALL conservar su horario anterior (RN-AG-09). Los turnos `CANCELADO` no bloquean y los turnos contiguos son válidos (`[inicio, fin)`, RN-AG-06); la violación de exclusión concurrente (SQLSTATE `23P01`) SHALL traducirse al mismo 409.

#### Scenario: S2 - Conflicto de horario devuelve 409 SOLAPAMIENTO
- **GIVEN** el consultorio A tiene un turno `PENDIENTE` ficticio a reprogramar (paciente X, profesional P, sillón S, 10:00–10:30 UTC) y otro turno del mismo profesional P en 15:00–16:00 UTC
- **WHEN** la recepción envía `PATCH /api/turnos/<id>/reprogramar` con `inicio` 2026-12-01T15:15:00Z
- **THEN** responde 409 con code `SOLAPAMIENTO` y el turno reprogramado conserva su horario anterior (inicio 10:00 UTC, fin 10:30 UTC)

### Requirement: Solo turnos en estado PENDIENTE se reprograman (RN-AG-10)

El sistema SHALL permitir reprogramar únicamente turnos en estado `PENDIENTE`; ante cualquier otro estado (`CONFIRMADO`, `ATENDIDO`, `AUSENTE`, `CANCELADO`) SHALL responder 409 con code `ESTADO_INVALIDO` sin modificar el turno.

#### Scenario: S4 - Turno no PENDIENTE devuelve 409 ESTADO_INVALIDO
- **GIVEN** el consultorio A tiene un turno ficticio en estado `CANCELADO` y otro en estado `ATENDIDO`, ambos con horarios libres
- **WHEN** la recepción envía `PATCH` sobre uno de ellos con un `inicio` válido y sin conflictos
- **THEN** responde 409 con code `ESTADO_INVALIDO` y el turno conserva su horario y estado originales

### Requirement: Validación de forma y permisos en la reprogramación (RN-AG-03)

El sistema SHALL validar la forma antes que el negocio: `inicio` SHALL ser ISO 8601 con zona horaria explícita o UTC y `:id` un UUID bien formado; sin timezone o con UUID malformado SHALL responder 400 con code `VALIDACION`. Solo `RECEPCION` y `ADMIN_CONSULTORIO` SHALL reprogramar; cualquier otro rol (hoy `ODONTOLOGO`) SHALL recibir 403 con code `SIN_PERMISO` y el turno no SHALL modificarse.

#### Scenario: S5 - inicio sin zona horaria devuelve 400 VALIDACION
- **GIVEN** el consultorio A con un turno `PENDIENTE` ficticio reprogramable y su usuario de recepción autenticado
- **WHEN** envía `PATCH /api/turnos/<id>/reprogramar` con `inicio` "2026-12-01T15:00:00" (sin timezone)
- **THEN** responde 400 con code `VALIDACION` y el turno conserva su horario anterior

#### Scenario: S6 - ODONTOLOGO recibe 403 SIN_PERMISO
- **GIVEN** el consultorio A con un turno `PENDIENTE` ficticio reprogramable y un token con rol `ODONTOLOGO`
- **WHEN** envía `PATCH /api/turnos/<id>/reprogramar` con un `inicio` válido y sin conflictos
- **THEN** responde 403 con code `SIN_PERMISO` y el turno no se modifica

### Requirement: Cancelar un turno con auditoría y autorización (C06)

El sistema SHALL permitir a `RECEPCION` y `ADMIN_CONSULTORIO` cancelar turnos futuros `PENDIENTE` o `CONFIRMADO` mediante `PATCH /api/turnos/:id/cancelar`, con `solicitadoPor` igual a `PACIENTE` o `CONSULTORIO`. La cancelación SHALL conservar la fila, cambiar su estado a `CANCELADO` y registrar `canceladoEn`, `canceladoPor` y `solicitadoPor`; el consultorio y operador SHALL derivarse del token. `CANCELADO` SHALL responder 409 `TURNO_YA_CANCELADO`; `ATENDIDO`/`AUSENTE`, 409 `ESTADO_INVALIDO`; e inicio ocurrido, 409 `TURNO_PASADO`. Un turno inexistente o de otro consultorio SHALL responder 404 `TURNO_NO_ENCONTRADO`. Los errores SHALL conservar estado y auditoría.

#### Scenario: Cancelar y reservar el intervalo liberado
- **GIVEN** un turno ficticio futuro en estado `PENDIENTE` con paciente, profesional y sillón/box del consultorio autenticado
- **WHEN** recepción lo cancela y crea otro turno con los mismos recursos e intervalo
- **THEN** la cancelación responde 200, la nueva reserva responde 201 y ambos registros se conservan; el primero queda `CANCELADO`

#### Scenario: ODONTOLOGO no puede cancelar
- **GIVEN** un turno futuro y un usuario autenticado con rol `ODONTOLOGO`
- **WHEN** solicita cancelar con `solicitadoPor` válido
- **THEN** responde 403 `SIN_PERMISO` y no modifica el turno

#### Scenario: Solicitud repetida o estado no cancelable
- **GIVEN** un turno cancelado, atendido o ausente
- **WHEN** recepción solicita cancelarlo
- **THEN** responde respectivamente 409 `TURNO_YA_CANCELADO` o 409 `ESTADO_INVALIDO`, sin alterar estado ni auditoría original

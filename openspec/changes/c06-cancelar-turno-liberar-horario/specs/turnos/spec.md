# Spec Delta

## ADDED Requirements

### Requirement: Cancelar un turno por PATCH /api/turnos/:id/cancelar

El sistema SHALL permitir a `RECEPCION` y `ADMIN_CONSULTORIO` cancelar turnos `PENDIENTE` o `CONFIRMADO` mediante `PATCH /api/turnos/:id/cancelar`, usando `solicitadoPor` (`PACIENTE` o `CONSULTORIO`) y el consultorio y usuario operador autenticados. `ATENDIDO` y `AUSENTE` SHALL responder 409 `ESTADO_INVALIDO`; `CANCELADO` SHALL responder 409 `TURNO_YA_CANCELADO`.

#### Scenario: Cancelación exitosa con auditoría
- **GIVEN** un turno ficticio futuro del consultorio A y un usuario `RECEPCION` autenticado en A
- **WHEN** envía `PATCH /api/turnos/<id>/cancelar` con `solicitadoPor: "PACIENTE"`
- **THEN** responde 200 con el mismo turno en estado `CANCELADO`, conservado en el sistema, y con fecha UTC de cancelación, usuario operador y solicitante registrados

#### Scenario: ODONTOLOGO no puede cancelar
- **GIVEN** un turno futuro del consultorio A y un usuario autenticado con rol `ODONTOLOGO`
- **WHEN** envía una solicitud de cancelación con `solicitadoPor` válido
- **THEN** responde 403 con código `SIN_PERMISO` y el turno no se modifica

#### Scenario: Turnos atendidos o ausentes no se cancelan
- **GIVEN** un turno futuro del consultorio A en estado `ATENDIDO` o `AUSENTE`
- **WHEN** recepción solicita cancelarlo con `solicitadoPor` válido
- **THEN** responde 409 con código `ESTADO_INVALIDO` y conserva el estado y la auditoría existentes

### Requirement: La cancelación libera el horario

Un turno en estado `CANCELADO` SHALL dejar de bloquear el intervalo para las reglas de solapamiento por paciente, profesional y sillón/box.

#### Scenario: Crear otro turno en el horario liberado
- **GIVEN** un turno ficticio del consultorio A que ocupa un intervalo futuro con paciente X, profesional P y sillón S
- **WHEN** recepción cancela ese turno y luego crea otro turno para el mismo paciente, profesional, sillón e intervalo
- **THEN** la cancelación responde 200 y la creación responde 201; ambos registros se conservan y el primero permanece `CANCELADO`

### Requirement: Rechazar cancelaciones inválidas o repetidas

El sistema SHALL validar el formato de `solicitadoPor`, aislar el turno por consultorio y preservar la auditoría de la primera cancelación ante una repetición.

#### Scenario: solicitadoPor ausente o inválido
- **GIVEN** un turno futuro del consultorio A y un usuario autorizado autenticado
- **WHEN** envía una solicitud con `solicitadoPor` ausente o distinto de `PACIENTE` y `CONSULTORIO`
- **THEN** responde 400 con código `VALIDACION` y no modifica el turno ni su auditoría

#### Scenario: Turno de otro consultorio
- **GIVEN** un usuario autenticado en el consultorio A y un turno ficticio perteneciente al consultorio B
- **WHEN** solicita cancelar el turno de B con un `solicitadoPor` válido
- **THEN** responde 404 con código `TURNO_NO_ENCONTRADO` y el turno de B no se modifica

#### Scenario: Turno inexistente
- **GIVEN** un usuario autorizado autenticado en el consultorio A y un UUID que no corresponde a ningún turno
- **WHEN** solicita cancelar ese identificador con un `solicitadoPor` válido
- **THEN** responde 404 con código `TURNO_NO_ENCONTRADO` y no modifica ningún turno

#### Scenario: Turno ya cancelado
- **GIVEN** un turno ficticio del consultorio A ya cancelado con auditoría original
- **WHEN** recepción vuelve a solicitar su cancelación con un `solicitadoPor` válido
- **THEN** responde 409 con código `TURNO_YA_CANCELADO` y conserva sin cambios el estado y todos los datos de auditoría de la primera cancelación

#### Scenario: Turno pasado
- **GIVEN** un turno ficticio del consultorio A cuyo inicio ya ocurrió
- **WHEN** recepción solicita cancelarlo con un `solicitadoPor` válido
- **THEN** responde 409 con código `TURNO_PASADO` y no modifica el turno ni su auditoría

# turnos Specification

## Purpose

Este capability gestiona los turnos del consultorio autenticado. Cubre dos operaciones con las mismas garantías de disponibilidad:

- **Creación** (`POST /api/turnos`, C05): crea turnos `PENDIENTE` sin solapamientos por profesional, sillón/box y paciente, validados transaccionalmente con restricciones de exclusión en PostgreSQL. Los intervalos son `[inicio, fin)`, de modo que los turnos contiguos son válidos. La duración se fija al crearse y no cambia si luego se edita la prestación.
- **Reprogramación** (`PATCH /api/turnos/:id/reprogramar`, C07): mueve el `inicio` de un turno `PENDIENTE` reutilizando la misma validación de solapamientos, excluyendo el propio turno, dentro del consultorio autenticado. Conserva el horario anterior si la operación falla (RN-AG-09).

Quedan fuera de este capability: cancelación y transiciones de estado (C06), cambio de recursos del turno, bloqueos de agenda, listado y consulta de agenda (C08), y el flag de operar sin recepción.
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

### Requirement: Alta de turno mediante POST /api/turnos
El sistema SHALL permitir a `RECEPCION` y `ADMIN_CONSULTORIO` crear turnos con `POST /api/turnos` (`pacienteId`, `profesionalId`, `sillonBoxId` obligatorio, `prestacionId`, `inicio`); el `consultorioId` SHALL salir solo del token y el turno SHALL nacer `PENDIENTE`. `ODONTOLOGO` SHALL recibir 403 `SIN_PERMISO`. `inicio` SHALL ser ISO 8601 con timezone explícito o UTC; sin timezone o UUID malformado SHALL responder 400 `VALIDACION`. C05 no implementa cancelación ni transiciones de estado (C06).

#### Scenario: S1 - Reserva válida
- **GIVEN** un usuario de recepción autenticado en el consultorio A con paciente, profesional, sillón/box y prestación ficticios y activos, la prestación con 30 minutos de duración
- **WHEN** envía `POST /api/turnos` con `pacienteId`, `profesionalId`, `sillonBoxId`, `prestacionId` e `inicio` en UTC
- **THEN** responde 201 con el turno del consultorio A, `fin` igual a `inicio` más 30 minutos y estado `PENDIENTE`

#### Scenario: S10 - ODONTOLOGO recibe 403 SIN_PERMISO
- **GIVEN** un usuario con rol `ODONTOLOGO` autenticado en el consultorio A con datos ficticios válidos y activos (paciente, profesional, sillón/box y prestación)
- **WHEN** envía `POST /api/turnos` con esos recursos e `inicio` en UTC
- **THEN** responde 403 con code `SIN_PERMISO` y no se crea ningún turno

### Requirement: Sin turnos solapados por paciente (RN-AG-01)
El sistema SHALL rechazar con 409 y code `SOLAPAMIENTO` la creación de un turno cuyo intervalo se solape con otro turno del mismo paciente dentro del mismo consultorio, salvo que el turno existente tenga estado `CANCELADO`, y no SHALL crear ningún registro.

#### Scenario: S5 - Conflicto por paciente
- **GIVEN** el consultorio A ya tiene un turno del paciente ficticio X con otro profesional y otro sillón/box en un intervalo
- **WHEN** se envía una reserva para el mismo paciente X cuyo intervalo se solape con un profesional y un sillón distintos
- **THEN** responde 409 con code `SOLAPAMIENTO` y no se crea el segundo turno

### Requirement: Sin turnos solapados por profesional ni sillón/box, también ante solicitudes simultáneas (RN-AG-02)
El sistema SHALL impedir en una única transacción la creación de turnos solapados por profesional o por sillón/box dentro del mismo consultorio, también ante solicitudes simultáneas, respondiendo 409 con code `SOLAPAMIENTO` ante la violación de exclusión (SQLSTATE `23P01`); los turnos en estado `CANCELADO` no bloquean reservas.

#### Scenario: S2 - Conflicto por profesional
- **GIVEN** el consultorio A tiene un turno existente con el profesional P en un intervalo
- **WHEN** se envía una reserva que empieza durante ese intervalo con el mismo profesional P y otro sillón/box
- **THEN** responde 409 con code `SOLAPAMIENTO` y no se crea el turno

#### Scenario: S3 - Conflicto por sillón/box
- **GIVEN** el consultorio A tiene un turno existente con el sillón/box S en un intervalo
- **WHEN** se envía una reserva que empieza durante ese intervalo con el mismo sillón S y un profesional distinto
- **THEN** responde 409 con code `SOLAPAMIENTO` y no se crea el turno

#### Scenario: S6 - Concurrencia con un solo ganador
- **GIVEN** dos solicitudes `POST /api/turnos` idénticas compiten por el mismo profesional, sillón/box, paciente e `inicio` en el consultorio A
- **WHEN** se procesan en paralelo
- **THEN** exactamente una responde 201, la otra responde 409 con code `SOLAPAMIENTO` y queda un solo turno creado

### Requirement: Disponibilidad de recursos activos del consultorio (RN-AG-05)
El sistema SHALL exigir que paciente, profesional, sillón/box y prestación existan, pertenezcan al consultorio autenticado y estén activos antes de reservar; si alguno está inexistente, es ajeno al consultorio o inactivo, SHALL responder 422 con code `REFERENCIA_INVALIDA` indicando el campo fallido (`pacienteId`, `profesionalId`, `sillonBoxId`, `prestacionId`), con un mensaje por campo (el mismo para inexistente, ajeno e inactivo). Bloqueos y `AgendaSlot` quedan fuera de alcance.

#### Scenario: S8 - Recurso inactivo o ajeno
- **GIVEN** el consultorio A tiene un profesional inactivo y el consultorio B tiene un paciente propio, todos ficticios
- **WHEN** A envía una reserva con ese profesional inactivo, o con el paciente de B, o con una prestación inactiva
- **THEN** responde 422 con code `REFERENCIA_INVALIDA` indicando el campo fallido (`profesionalId`, `pacienteId` o `prestacionId` según el caso, un mensaje por campo) y no se crea ningún turno

### Requirement: Intervalos [inicio, fin) en UTC y turnos contiguos válidos (RN-AG-06)
El sistema SHALL guardar `inicio` y `fin` como `timestamptz` en UTC con semántica `[inicio, fin)`; dos turnos donde uno empieza exactamente cuando termina el otro SHALL considerarse válidos, sin solapamiento.

#### Scenario: S4 - Turno contiguo válido
- **GIVEN** el consultorio A tiene un turno existente de 10:00 a 10:30 UTC con el profesional P y el sillón S
- **WHEN** se envía una reserva para el mismo profesional P y sillón S que empieza exactamente a 10:30 UTC
- **THEN** responde 201 y coexisten los dos turnos sin conflicto

### Requirement: La duración de la prestación determina el fin del turno (RN-AG-07)
El sistema SHALL calcular `fin` como `inicio` más `duracionMin` de la prestación activa al crear el turno y SHALL conservar la duración usada al crearse; editar la prestación después no SHALL alterar los turnos ya agendados.

#### Scenario: S9 - Duración fijada al crearse el turno
- **GIVEN** una prestación activa ficticia de 30 minutos y un turno creado a las 10:00 UTC con esa prestación
- **WHEN** la duración de la prestación se edita a 60 minutos
- **THEN** el turno existente conserva `fin` 10:30 UTC y una nueva reserva posterior se calcula con 60 minutos

### Requirement: Aislamiento de turnos entre consultorios (RN-TEN-01, RN-TEN-02)
El sistema SHALL resolver el consultorio exclusivamente del token y SHALL acotar por él la validación y la creación; un identificador de otro consultorio SHALL tratarse como inexistente y ningún valor enviado por el cliente SHALL cambiar el consultorio de operación.

#### Scenario: S7 - Aislamiento entre consultorios
- **GIVEN** los consultorios A y B, con datos ficticios, cada uno con un turno en el mismo intervalo horario
- **WHEN** cada consultorio envía su reserva con su propio token
- **THEN** ambas responden 201 porque la validación de solapamiento está acotada al consultorio del token y cada turno queda en su consultorio

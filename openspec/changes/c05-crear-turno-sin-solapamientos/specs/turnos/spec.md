# Spec Delta

## Purpose

Este capability crea turnos en el consultorio autenticado sin solapamientos por paciente, profesional ni sillón/box, con la duración de la prestación y aislamiento por tenant. Cubre únicamente `POST /api/turnos`: bloqueos, `AgendaSlot`, listado, cancelación, reprogramación y el flag de operar sin recepción quedan fuera de alcance (C06/C07).

## ADDED Requirements

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

# Spec Delta

## Purpose

Gestionar los turnos de la agenda del consultorio — reserva, reprogramación y cancelación — con la disponibilidad validada siempre en el servidor, intervalos `[inicio, fin)` en UTC y aislamiento estricto por consultorio autenticado. Este delta aporta la reprogramación de fecha y hora (C07); la reserva la define C05 y la cancelación C06.

## ADDED Requirements

### Requirement: Reprogramación de fecha y hora de un turno existente

El sistema SHALL permitir a recepción y administración cambiar la fecha y hora de un turno existente de su consultorio, recalculando el fin a partir de la duración de la prestación (RN-AG-07). El sistema SHALL confirmar el nuevo intervalo y SHALL rechazar el fin enviado por el cliente.

#### Scenario: Reprogramación válida a un horario libre

- **GIVEN** un turno del consultorio A de 10:00 a 10:30 y un rango futuro sin turnos del mismo profesional ni del mismo sillón/box
- **WHEN** recepción solicita reprogramar ese turno a las 15:00 del mismo día
- **THEN** el sistema mueve el turno a 15:00, recalcula el fin como 15:00 más la duración de la prestación y devuelve el turno actualizado

#### Scenario: Reprogramación por administración

- **WHEN** un usuario con rol ADMIN_CONSULTORIO reprograma un turno de su consultorio a un horario disponible
- **THEN** el sistema aplica el cambio y conserva profesional, sillón/box, paciente y prestación originales

#### Scenario: Reprogramación con fin provisto por el cliente

- **WHEN** la solicitud incluye un valor de fin distinto del derivado de la duración de la prestación
- **THEN** el sistema ignora el fin del cliente y usa el calculado con la duración de la prestación

### Requirement: Revalidación de todas las reglas de solapamiento sobre el nuevo rango

El sistema SHALL revalidar sobre el nuevo intervalo las reglas RN-AG-01 (paciente sin dos turnos solapados), RN-AG-02 (sin solapamiento por profesional ni por sillón/box dentro del consultorio) y RN-AG-06 (intervalos `[inicio, fin)`), **excluyendo el turno que se está moviendo**. La comprobación SHALL ejecutarse dentro de la misma transacción que aplica el movimiento, también ante solicitudes simultáneas.

#### Scenario: Solapamiento por profesional en el nuevo rango

- **GIVEN** un turno del profesional P a las 15:00 y otro turno del profesional P a las 16:00
- **WHEN** recepción reprograma un tercer turno del profesional P a las 15:30 con duración 30 minutos
- **THEN** el sistema rechaza la reprogramación por solapamiento de profesional y el turno conserva su horario anterior

#### Scenario: Solapamiento por sillón/box en el nuevo rango

- **GIVEN** un turno en el sillón/box S a las 15:00 con duración 60 minutos
- **WHEN** recepción reprograma otro turno del sillón/box S a las 15:30
- **THEN** el sistema rechaza la reprogramación por solapamiento de sillón/box y el turno conserva su horario anterior

#### Scenario: Solapamiento del paciente en el nuevo rango

- **GIVEN** un turno del paciente Q a las 15:00 con duración 60 minutos
- **WHEN** recepción reprograma otro turno del paciente Q a las 15:30
- **THEN** el sistema rechaza la reprogramación por solapamiento del paciente y el turno conserva su horario anterior

#### Scenario: Dos reprogramaciones simultáneas compiten por el mismo rango

- **GIVEN** dos turnos distintos del consultorio A
- **WHEN** dos solicitudes de reprogramación simultáneas mueven ambos turnos al mismo rango del mismo profesional
- **THEN** exactamente una solicitud tiene éxito y la otra se rechaza, sin dejar dos turnos solapados

#### Scenario: El turno que se mueve no se compara consigo mismo

- **GIVEN** un turno existente del consultorio A
- **WHEN** se revalida su nuevo rango
- **THEN** ese turno queda excluido de la comprobación y los turnos de otros pacientes, profesionales o boxes que no intersectan el nuevo rango no impiden el movimiento

### Requirement: Conservación del horario anterior ante cualquier fallo

El sistema SHALL conservar el horario anterior del turno cuando la reprogramación falle por validación, conflicto o error; el registro del turno SHALL permanecer intacto con su intervalo previo (RN-AG-09).

#### Scenario: Reprogramación rechazada conserva el intervalo original

- **GIVEN** un turno del consultorio A a las 10:00 con duración 30 minutos
- **WHEN** recepción intenta reprogramarlo a un rango en conflicto y la operación es rechazada
- **THEN** el turno sigue registrado a las 10:00 con su duración original

#### Scenario: Fallo de base durante la reprogramación

- **WHEN** la operación falla por un problema de base de datos
- **THEN** la transacción se revierte, el turno conserva su horario anterior y el manejador central responde 500 con code ERROR_INTERNO y mensaje seguro

### Requirement: Intervalos contiguos y reprogramación al horario actual

El sistema SHALL tratar los intervalos como `[inicio, fin)`: un turno que empieza exactamente cuando termina otro SHALL ser válido. Reprogramar un turno a su propio horario actual SHALL ser una operación válida sin conflicto (RN-AG-06).

#### Scenario: Reprogramación a un rango contiguo

- **GIVEN** un turno de 15:00 a 16:00 del profesional P en el sillón S
- **WHEN** recepción reprograma otro turno del profesional P y del sillón S a las 16:00 con duración 30 minutos
- **THEN** el sistema permite la reprogramación porque los intervalos son contiguos

#### Scenario: Reprogramación al mismo horario actual

- **GIVEN** un turno a las 10:00 con duración 30 minutos
- **WHEN** recepción solicita reprogramarlo a las 10:00 del mismo día
- **THEN** el sistema aplica la operación sin rechazo por solapamiento consigo mismo y el turno conserva su intervalo

### Requirement: Acceso autorizado a reprogramar (RN-AG-03)

Según knowledge-base/03_actores_y_roles.md, el sistema SHALL permitir reprogramar turnos a `RECEPCION` y `ADMIN_CONSULTORIO`, y SHALL rechazar con 403 a `ODONTOLOGO` y a cualquier otro rol. Las solicitudes sin token válido SHALL recibir 401 con el contrato de C00.

#### Scenario: Reprogramación solicitada por un odontólogo

- **WHEN** un usuario con rol ODONTOLOGO intenta reprogramar un turno
- **THEN** el sistema responde 403 y el turno conserva su horario anterior

#### Scenario: Solicitud sin autenticación

- **WHEN** una solicitud de reprogramación carece de token válido
- **THEN** el sistema responde 401 con el mensaje seguro de C00 y no modifica el turno

### Requirement: Aislamiento por consultorio (RN-TEN-01/02)

El sistema SHALL resolver `consultorioId` únicamente desde el token autenticado y filtrar por él toda lectura y escritura del turno. Un turno inexistente o perteneciente a otro consultorio SHALL responder 404 sin revelar su existencia, y cualquier identificador de consultorio enviado por el cliente SHALL descartarse.

#### Scenario: Reprogramación de un turno de otro consultorio

- **GIVEN** un turno existente únicamente en el consultorio B
- **WHEN** recepción del consultorio A intenta reprogramarlo
- **THEN** el sistema responde 404 y el turno de B conserva su horario anterior

#### Scenario: Turno inexistente

- **WHEN** recepción intenta reprogramar un identificador de turno inexistente en su consultorio
- **THEN** el sistema responde 404 sin modificar ningún registro

#### Scenario: Intento de indicar el consultorio desde el cliente

- **GIVEN** recepción autenticada en el consultorio A
- **WHEN** envía en el cuerpo o la query un consultorio B junto con la reprogramación
- **THEN** el sistema descarta ese valor y opera exclusivamente sobre el consultorio A

### Requirement: Contrato de reprogramación

El sistema SHALL exponer la reprogramación como una operación sobre un turno identificado por su id, cuyo cuerpo de solicitud acepta únicamente el nuevo inicio en UTC. Las respuestas SHALL ser: 200 con el turno actualizado; 404 para turno inexistente o ajeno al consultorio; 409 por solapamiento en el nuevo rango; 403 sin permiso; 401 sin identidad válida; 422 por datos ausentes o con formato inválido; 500 con mensaje seguro ante error interno.

#### Scenario: Reprogramación exitosa

- **WHEN** una solicitud válida de recepción llega al endpoint de reprogramación
- **THEN** el sistema responde 200 con el turno actualizado, incluido el nuevo inicio y el fin recalculado

#### Scenario: Nuevo inicio ausente o malformado

- **WHEN** la solicitud no incluye el nuevo inicio o lo envía con formato inválido
- **THEN** el sistema responde 422 sin modificar el turno

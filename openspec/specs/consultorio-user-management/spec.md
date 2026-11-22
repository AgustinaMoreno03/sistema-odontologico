# consultorio-user-management Specification

## Purpose

Define el aprovisionamiento interno de consultorios y la administración de usuarios dentro de cada tenant, asegurando que solo la administración autorizada gestione usuarios de su propio consultorio.

## Requirements

### Requirement: Alta interna de consultorios
El sistema MUST permitir aprovisionar consultorios por un mecanismo operativo interno y MUST NOT ofrecer un endpoint público de registro de consultorios.

#### Scenario: Aprovisionamiento operativo
- **GIVEN** una operación interna autorizada de seed o script
- **WHEN** se aprovisiona un consultorio
- **THEN** el consultorio queda disponible para asociar usuarios dentro de su tenant

#### Scenario: Registro público no disponible
- **GIVEN** un cliente sin autenticación
- **WHEN** envía un POST a /consultorios
- **THEN** la respuesta es HTTP 404

### Requirement: Alta de usuarios autorizada y aislada por consultorio
El sistema MUST permitir a `ADMIN_CONSULTORIO` crear usuarios con cualquiera de los tres roles, limitar operaciones al consultorio de `req.auth` e ignorar cualquier `consultorioId` del body. El email MUST ser único; un duplicado responde HTTP 409.

#### Scenario: Administrador crea usuario en su consultorio
- **GIVEN** un administrador autenticado
- **WHEN** crea un usuario con email no usado y cualquiera de los roles `ADMIN_CONSULTORIO`, `ODONTOLOGO` o `RECEPCION`
- **THEN** el usuario queda asociado al consultorio de `req.auth` y su contraseña se almacena como hash
- **AND** si el body incluye un `consultorioId` distinto, ese valor se ignora

#### Scenario: Rol sin permiso intenta crear usuario
- **GIVEN** un usuario autenticado con rol `ODONTOLOGO` o `RECEPCION`
- **WHEN** intenta crear otro usuario
- **THEN** la respuesta es HTTP 403

#### Scenario: Listado limitado al consultorio autenticado
- **GIVEN** un usuario autenticado del consultorio A
- **WHEN** lista usuarios
- **THEN** recibe únicamente usuarios asociados al consultorio A

#### Scenario: Consultar por ID un usuario de otro consultorio
- **GIVEN** un usuario autenticado del consultorio A y un usuario existente del consultorio B
- **WHEN** consulta por ID al usuario del consultorio B
- **THEN** la respuesta es HTTP 404

#### Scenario: Email ya registrado
- **GIVEN** que ya existe un usuario con el email indicado
- **WHEN** un administrador intenta crear otro usuario con ese email
- **THEN** la respuesta es HTTP 409

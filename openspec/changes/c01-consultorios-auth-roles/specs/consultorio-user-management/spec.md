# Spec Delta

## Purpose

Define el aprovisionamiento interno de consultorios y la administración de usuarios dentro de cada tenant, asegurando que solo la administración autorizada gestione usuarios de su propio consultorio.

## ADDED Requirements

### Requirement: Alta interna de consultorios
El sistema MUST permitir aprovisionar consultorios por un mecanismo operativo interno y MUST NOT ofrecer un endpoint público de registro de consultorios.

#### Scenario: Aprovisionamiento operativo
- **GIVEN** una operación interna autorizada de seed o script
- **WHEN** se aprovisiona un consultorio
- **THEN** el consultorio queda disponible para asociar usuarios dentro de su tenant

#### Scenario: Registro público no disponible
- **GIVEN** un cliente sin acceso operativo interno
- **WHEN** intenta registrar un consultorio mediante la API pública
- **THEN** no existe una operación pública que permita crear el consultorio

### Requirement: Alta de usuarios autorizada y aislada por consultorio
El sistema MUST permitir crear usuarios únicamente a `ADMIN_CONSULTORIO`, limitar cada operación al consultorio de `req.auth` y almacenar contraseñas como hashes no reversibles.

#### Scenario: Administrador crea usuario en su consultorio
- **GIVEN** un administrador autenticado con `req.auth.consultorioId` igual al consultorio destino
- **WHEN** crea un usuario con un rol permitido
- **THEN** el usuario queda asociado exclusivamente a ese consultorio y su contraseña se almacena como hash

#### Scenario: Recepción intenta crear usuario
- **GIVEN** un usuario autenticado con rol `RECEPCION`
- **WHEN** intenta crear otro usuario
- **THEN** la respuesta es HTTP 403

#### Scenario: Usuario del consultorio A no puede ver ni crear usuarios del consultorio B
- **GIVEN** un usuario autenticado del consultorio A
- **WHEN** intenta listar, consultar o crear usuarios del consultorio B
- **THEN** no puede ver ni crear usuarios asociados al consultorio B
- **AND** el ámbito de la operación se deriva de `req.auth`, no de un identificador de consultorio enviado por el cliente

#### Scenario: Rol válido sin permiso intenta crear usuario
- **GIVEN** un usuario autenticado que no tiene rol `ADMIN_CONSULTORIO`
- **WHEN** intenta crear un usuario de su consultorio
- **THEN** la respuesta es HTTP 403

# Spec Delta

## Purpose

Permitir al personal autorizado registrar y buscar fichas básicas de pacientes de su consultorio, y proporcionar al módulo de turnos una comprobación de pertenencia del paciente.

## ADDED Requirements

### Requirement: Alta de ficha básica

El sistema SHALL permitir a recepción y administración registrar un paciente con nombre y al menos un contacto, teléfono o email, dentro del consultorio autenticado.

#### Scenario: Alta con nombre y teléfono
- **GIVEN** una persona de recepción autenticada en el consultorio A
- **WHEN** registra a un paciente ficticio llamado Ana Pérez con teléfono y sin email
- **THEN** el sistema crea la ficha en el consultorio A y devuelve su identificador y datos básicos

#### Scenario: Alta con nombre y email
- **GIVEN** una persona administradora autenticada en el consultorio A
- **WHEN** registra a un paciente ficticio con nombre y email, sin teléfono
- **THEN** el sistema crea la ficha en el consultorio A

### Requirement: Validación de datos obligatorios

El sistema SHALL rechazar el alta cuando falte el nombre o ambos medios de contacto. Un valor vacío o compuesto únicamente por espacios SHALL considerarse ausente.

#### Scenario: Alta sin contacto
- **WHEN** recepción intenta registrar un paciente con nombre y sin teléfono ni email
- **THEN** el sistema rechaza el alta, informa que falta un contacto y conserva la base sin esa ficha

#### Scenario: Nombre vacío
- **WHEN** recepción intenta registrar un paciente cuyo nombre contiene solo espacios y que tiene teléfono
- **THEN** el sistema rechaza el alta e informa que falta el nombre

### Requirement: Email único por consultorio

El sistema SHALL impedir que dos pacientes del mismo consultorio compartan un email informado. Un mismo email SHALL poder existir en consultorios diferentes.

#### Scenario: Email repetido en el mismo consultorio
- **GIVEN** un paciente del consultorio A con email ana@example.com
- **WHEN** recepción del consultorio A intenta crear otro paciente con ese mismo email
- **THEN** el sistema rechaza el alta e informa el conflicto

#### Scenario: Email existente en otro consultorio
- **GIVEN** un paciente del consultorio A con email ana@example.com
- **WHEN** recepción del consultorio B registra un paciente con ese email
- **THEN** el sistema permite el alta dentro del consultorio B

### Requirement: Búsqueda por nombre y apellido

El sistema SHALL permitir buscar pacientes del consultorio autenticado por coincidencia parcial en su nombre o apellido, sin distinguir mayúsculas ni tildes. La respuesta SHALL conservar la escritura original de los datos.

#### Scenario: Búsqueda parcial sin distinguir mayúsculas ni tildes
- **GIVEN** una ficha ficticia de José Álvarez en el consultorio A
- **WHEN** recepción del consultorio A busca ALVAR
- **THEN** la respuesta incluye esa ficha y muestra José Álvarez con su escritura original

#### Scenario: Búsqueda sin coincidencias
- **WHEN** una persona autorizada busca un nombre que no coincide con pacientes de su consultorio
- **THEN** el sistema devuelve una lista vacía

### Requirement: Búsqueda por contacto

El sistema SHALL permitir a las personas autorizadas encontrar pacientes de su consultorio por el teléfono o email registrados.

#### Scenario: Búsqueda por teléfono
- **GIVEN** un paciente ficticio del consultorio A con teléfono 1100000000
- **WHEN** recepción del consultorio A busca 1100000000
- **THEN** la respuesta incluye la ficha de ese paciente

#### Scenario: Búsqueda por email
- **GIVEN** un paciente ficticio del consultorio A con email ana@example.com
- **WHEN** recepción del consultorio A busca ana@example.com
- **THEN** la respuesta incluye la ficha de ese paciente

### Requirement: Aislamiento de fichas entre consultorios

El sistema SHALL resolver el consultorio desde la identidad autenticada y limitar a ese consultorio las altas, búsquedas y comprobaciones de pacientes. El sistema SHALL impedir que un identificador de consultorio enviado por el cliente cambie el consultorio resuelto desde la identidad autenticada.

#### Scenario: Búsqueda de un paciente de otro consultorio
- **GIVEN** un paciente ficticio existente únicamente en el consultorio B
- **WHEN** recepción del consultorio A busca el nombre, teléfono o email de ese paciente
- **THEN** la respuesta excluye su ficha y sus datos

#### Scenario: Intento de elegir el consultorio de alta
- **GIVEN** recepción autenticada en el consultorio A
- **WHEN** solicita un alta e intenta indicar el consultorio B
- **THEN** el sistema impide el alta en B y conserva el aislamiento de los datos

### Requirement: Acceso autorizado a fichas básicas

El sistema SHALL permitir el alta a recepción y administración, y la consulta de fichas básicas a recepción, administración y odontólogos del consultorio. El sistema SHALL rechazar solicitudes sin identidad válida y altas solicitadas únicamente con permiso de odontólogo.

#### Scenario: Consulta de un odontólogo
- **WHEN** un odontólogo autenticado busca un paciente de su consultorio
- **THEN** el sistema permite consultar sus datos básicos

#### Scenario: Alta solicitada por un odontólogo sin permiso administrativo
- **WHEN** un usuario con permiso únicamente de odontólogo intenta registrar un paciente
- **THEN** el sistema rechaza el alta por falta de permiso

#### Scenario: Solicitud sin autenticación
- **WHEN** una solicitud de alta o búsqueda carece de identidad autenticada válida
- **THEN** el sistema rechaza el acceso

### Requirement: Comprobación de paciente para turnos

El módulo de pacientes SHALL ofrecer a los módulos consumidores una comprobación de existencia del paciente dentro del consultorio autenticado, preservando el aislamiento entre consultorios.

#### Scenario: Paciente del consultorio autenticado
- **GIVEN** un paciente existente en el consultorio A
- **WHEN** el módulo de turnos comprueba su existencia en el contexto autenticado de A
- **THEN** pacientes confirma que pertenece a ese consultorio

#### Scenario: Identificador de otro consultorio
- **GIVEN** un paciente existente únicamente en el consultorio B
- **WHEN** el módulo de turnos comprueba ese identificador en el contexto autenticado de A
- **THEN** pacientes devuelve el mismo resultado que para un paciente inexistente en A

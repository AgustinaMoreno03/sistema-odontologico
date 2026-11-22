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

El sistema SHALL recortar los espacios exteriores del email y guardarlo en minúsculas. SHALL impedir emails repetidos dentro del consultorio sin distinguir mayúsculas. PostgreSQL SHALL garantizar esa unicidad. El mismo email SHALL poder existir en consultorios diferentes.

#### Scenario: Email con espacios y mayúsculas
- **WHEN** recepción registra un paciente con email " ANA@EXAMPLE.COM "
- **THEN** el sistema guarda ana@example.com

#### Scenario: Email repetido con distintas mayúsculas
- **GIVEN** un paciente del consultorio A con email ana@example.com
- **WHEN** recepción de A registra otro paciente con ANA@EXAMPLE.COM
- **THEN** el sistema rechaza el alta por email duplicado

#### Scenario: Email existente en otro consultorio
- **GIVEN** un paciente del consultorio A con email ana@example.com
- **WHEN** recepción del consultorio B registra otro paciente con ANA@EXAMPLE.COM
- **THEN** el sistema permite el alta en B y guarda ana@example.com

### Requirement: Búsqueda por nombre y apellido

El sistema SHALL permitir buscar pacientes del consultorio autenticado por coincidencia parcial en su nombre o apellido, sin distinguir mayúsculas ni tildes. La respuesta SHALL conservar la escritura original de los datos.

#### Scenario: Búsqueda parcial sin distinguir mayúsculas ni tildes
- **GIVEN** una ficha ficticia de José Álvarez en el consultorio A
- **WHEN** recepción del consultorio A busca ALVAR
- **THEN** la respuesta incluye esa ficha y muestra José Álvarez con su escritura original

#### Scenario: Búsqueda sin coincidencias
- **WHEN** una persona autorizada busca un nombre que no coincide con pacientes de su consultorio
- **THEN** el sistema devuelve una lista vacía

### Requirement: Normalización del teléfono

El sistema SHALL quitar espacios, guiones y paréntesis del teléfono, conservar un único signo + inicial cuando esté informado y conservar los dígitos y el código de país recibido. SHALL aplicar la misma normalización al buscar por teléfono. SHALL tratar como ausente un teléfono compuesto solo por separadores permitidos y rechazar caracteres ajenos al formato.

#### Scenario: Teléfono internacional con separadores
- **WHEN** recepción registra el teléfono ficticio "+54 (11) 0000-0000"
- **THEN** el sistema guarda +541100000000

#### Scenario: Teléfono local
- **WHEN** recepción registra el teléfono ficticio "11 0000-0000"
- **THEN** el sistema guarda 1100000000 sin agregar un código de país

#### Scenario: Teléfono inválido
- **WHEN** recepción intenta registrar un teléfono con letras
- **THEN** el sistema rechaza el alta e informa que el teléfono es inválido

#### Scenario: Teléfono sin dígitos con email válido
- **WHEN** recepción registra un paciente con nombre, teléfono "()" y email ana@example.com
- **THEN** el sistema trata el teléfono como ausente, guarda NULL y permite el alta con el email

#### Scenario: Teléfono sin dígitos como único contacto
- **WHEN** recepción registra un paciente con nombre, teléfono "()" y sin email
- **THEN** el sistema rechaza el alta porque falta un contacto

### Requirement: Búsqueda por contacto

El sistema SHALL buscar por coincidencia completa del teléfono normalizado o del email recortado y convertido a minúsculas, dentro del consultorio autenticado.

#### Scenario: Búsqueda por teléfono con separadores
- **GIVEN** un paciente de A con teléfono +541100000000
- **WHEN** recepción de A busca "+54 (11) 0000-0000"
- **THEN** la respuesta incluye su ficha

#### Scenario: Búsqueda por email con mayúsculas
- **GIVEN** un paciente de A con email ana@example.com
- **WHEN** recepción de A busca " ANA@EXAMPLE.COM "
- **THEN** la respuesta incluye su ficha

#### Scenario: Teléfono local y teléfono internacional diferentes
- **GIVEN** un paciente del consultorio A con teléfono +541100000000
- **WHEN** recepción de A busca 1100000000 y ningún otro campo de la ficha coincide
- **THEN** la búsqueda excluye esa ficha porque no se infieren códigos de país o área

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

Según knowledge-base/03_actores_y_roles.md, el sistema SHALL permitir el alta a ADMIN_CONSULTORIO y RECEPCION, y la búsqueda a ADMIN_CONSULTORIO, RECEPCION y ODONTOLOGO del consultorio. El sistema SHALL rechazar solicitudes sin identidad válida y altas solicitadas únicamente con permiso de odontólogo.

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

#### Scenario: Identificador malformado en la comprobación
- **WHEN** un módulo consumidor comprueba un paciente con pacienteId o consultorioId que no tiene formato UUID válido
- **THEN** la operación lanza ApiError con statusCode 400 y code VALIDACION

#### Scenario: Fallo de base durante la comprobación
- **WHEN** la consulta de existencia falla por un problema de base de datos
- **THEN** la operación propaga el error al consumidor y el manejador HTTP central responde 500 con code ERROR_INTERNO y mensaje seguro

### Requirement: Campos de la ficha básica

La ficha SHALL contener id UUID, consultorio_id UUID referido a consultorio(id), nombre obligatorio, apellido opcional, telefono opcional, email opcional y creado_en como instante UTC. El sistema SHALL asignar id, consultorio_id y creado_en. Se requiere al menos un contacto.

#### Scenario: Campos asignados al crear la ficha
- **WHEN** recepción registra un paciente válido con nombre y teléfono
- **THEN** el sistema asigna un UUID, el consultorio autenticado y la fecha de creación UTC, conservando los datos básicos recibidos

### Requirement: Límite de búsqueda

Cada búsqueda SHALL devolver como máximo 50 fichas del consultorio autenticado, ordenadas por apellido, nombre e id. La petición SHALL proporcionar un texto de búsqueda no vacío.

#### Scenario: Más de cincuenta coincidencias
- **GIVEN** 51 pacientes del consultorio A que coinciden con la búsqueda
- **WHEN** recepción de A realiza la búsqueda
- **THEN** el sistema devuelve los primeros 50 según el orden definido

#### Scenario: Búsqueda vacía
- **WHEN** una persona autorizada busca con texto vacío o compuesto solo por espacios
- **THEN** el sistema rechaza la solicitud e informa que falta el texto de búsqueda

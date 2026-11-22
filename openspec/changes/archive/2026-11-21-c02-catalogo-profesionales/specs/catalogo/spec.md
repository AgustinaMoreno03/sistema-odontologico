# Spec Delta

## Purpose

Permitir al consultorio gestionar su catálogo de profesionales y sillones/boxes con aislamiento por tenant, y publicar la interfaz pública que C05 consume para resolver recursos válidos al crear turnos.

## ADDED Requirements

### Requirement: Alta de profesional en el consultorio autenticado

El sistema SHALL permitir a `ADMIN_CONSULTORIO` crear un profesional con nombre obligatorio, matrícula opcional y email opcional dentro del consultorio resuelto desde el token, y SHALL responder 201 con el recurso creado, `activo` verdadero, `usuarioId` nulo y `creadoEn` en UTC.

#### Scenario: Alta válida con nombre y matrícula
- **GIVEN** un administrador autenticado en el consultorio A
- **WHEN** crea un profesional ficticio "Dra. María López" con matrícula "MN-1234"
- **THEN** responde 201 con un identificador propio, el consultorio A, `activo` verdadero, `usuarioId` nulo y `creadoEn` informado

#### Scenario: Nombre con espacios y email con mayúsculas
- **WHEN** el administrador crea un profesional con nombre "  Dra. Ana Ruiz  " y email " ANA@EXAMPLE.COM "
- **THEN** el sistema guarda el nombre recortado "Dra. Ana Ruiz" y el email "ana@example.com"

#### Scenario: Nombre ausente o vacío
- **WHEN** el administrador intenta crear un profesional con nombre vacío o compuesto solo por espacios
- **THEN** responde 422 con code `DATOS_INVALIDOS` y no se crea ningún registro

### Requirement: Unicidad de nombre y email por consultorio (RN-TEN-03)

El sistema SHALL impedir que dos profesionales del mismo consultorio compartan el mismo nombre completo o el mismo email, sin distinguir mayúsculas ni espacios exteriores, y SHALL permitir valores repetidos en consultorios distintos. El email ausente o vacío SHALL guardarse como nulo y no participar de la unicidad.

#### Scenario: Nombre repetido con distinta caja en el mismo consultorio
- **GIVEN** el consultorio A ya tiene al profesional "Dr. Juan Pérez"
- **WHEN** su administrador crea otro profesional "dr. juan perez"
- **THEN** responde 409 con code `RECURSO_DUPLICADO` y no se crea el segundo registro

#### Scenario: Mismo nombre y email en otro consultorio
- **GIVEN** el consultorio A tiene "Dr. Juan Pérez" con email juan@example.com
- **WHEN** el administrador del consultorio B crea un profesional con ese mismo nombre y email
- **THEN** responde 201 y el registro queda en B

#### Scenario: Profesionales sin email en el mismo consultorio
- **WHEN** el administrador del consultorio A crea dos profesionales sin email
- **THEN** ambos registros se crean, porque el email nulo no participa de la unicidad

#### Scenario: Email repetido con distintas mayúsculas
- **GIVEN** el consultorio A tiene al profesional juan@example.com
- **WHEN** su administrador crea otro profesional con " JUAN@EXAMPLE.COM "
- **THEN** responde 409 con code `RECURSO_DUPLICADO`

### Requirement: Alta de sillón o box y unicidad por consultorio

El sistema SHALL permitir a `ADMIN_CONSULTORIO` crear un sillón o box con nombre obligatorio y descripción opcional en su consultorio, y SHALL impedir nombres repetidos dentro del mismo consultorio sin distinguir mayúsculas ni espacios exteriores, permitiéndolos en consultorios distintos.

#### Scenario: Alta válida de sillón
- **GIVEN** un administrador autenticado en el consultorio A
- **WHEN** crea el sillón "Sillón 1" con la descripción "Box de ortodoncia"
- **THEN** responde 201 con `activo` verdadero y los datos enviados

#### Scenario: Nombre de sillón vacío
- **WHEN** el administrador intenta crear un sillón con nombre vacío o compuesto solo por espacios
- **THEN** responde 422 con code `DATOS_INVALIDOS` y no se crea ningún registro

#### Scenario: Nombre de sillón repetido en el mismo consultorio
- **GIVEN** el consultorio A ya tiene el sillón "Sillón 1"
- **WHEN** su administrador crea otro sillón "SILLÓN 1"
- **THEN** responde 409 con code `RECURSO_DUPLICADO`

#### Scenario: Mismo nombre de sillón en otro consultorio
- **WHEN** el administrador del consultorio B crea el sillón "Sillón 1", que ya existe en A
- **THEN** responde 201 y el registro queda en B

### Requirement: Actualización y baja lógica del catálogo

El sistema SHALL permitir a `ADMIN_CONSULTORIO` actualizar mediante PUT los campos de un profesional o sillón/box de su consultorio, incluyendo `activo` para la baja lógica. Un registro desactivado SHALL conservarse con sus datos y excluirse del catálogo activo, y reactivarlo SHALL devolverlo al catálogo. Un identificador inexistente o perteneciente a otro consultorio SHALL responder 404.

#### Scenario: Actualización de datos
- **GIVEN** un administrador autenticado en el consultorio A con un sillón creado
- **WHEN** actualiza su descripción mediante PUT
- **THEN** responde 200 con la descripción nueva y conserva el resto de los campos

#### Scenario: Identificador malformado o inexistente
- **WHEN** el administrador envía PUT con un identificador que no tiene formato UUID válido
- **THEN** responde 400 con code `DATOS_INVALIDOS`; si el identificador es válido pero no existe en su consultorio, responde 404 con code `RECURSO_NO_ENCONTRADO`

#### Scenario: Baja lógica y reactivación
- **GIVEN** un administrador tiene un profesional activo en su catálogo
- **WHEN** lo marca `activo` falso mediante PUT
- **THEN** el registro permanece con sus datos, desaparece de `GET /api/catalogo` y sigue visible como inactivo en el listado de gestión; al marcarlo `activo` verdadero vuelve al catálogo

#### Scenario: Actualización hacia un nombre ya usado en el consultorio
- **GIVEN** el consultorio A tiene a los profesionales "Dra. Ana Ruiz" y "Dra. Zoe Díaz"
- **WHEN** su administrador actualiza el segundo con el nombre "Dra. Ana Ruiz"
- **THEN** responde 409 con code `RECURSO_DUPLICADO` y el registro queda sin cambios

### Requirement: Contrato de entrada de los cuerpos HTTP

Los cuerpos HTTP SHALL admitir únicamente los campos documentados de cada recurso. El sistema SHALL rechazar con 422 la presencia de `consultorioId` (regla dura 2), de `usuarioId` o de valores de tipo inválido, sin modificar datos.

#### Scenario: Cuerpo con los campos documentados
- **WHEN** el administrador envía un alta con `nombre` y `email`
- **THEN** el sistema procesa la solicitud y responde 201

#### Scenario: Consultorio indicado por el cliente en el cuerpo
- **GIVEN** un administrador autenticado en el consultorio A
- **WHEN** envía un alta con `consultorioId` apuntando al consultorio B
- **THEN** responde 422 con code `DATOS_INVALIDOS` y no se crea el registro en ningún consultorio

#### Scenario: Vínculo de usuario intentado por el cuerpo
- **WHEN** el administrador envía un alta de profesional con `usuarioId` en el cuerpo
- **THEN** responde 422 con code `DATOS_INVALIDOS` y el profesional queda sin vínculo, porque el vínculo se realiza mediante la interfaz de módulo definida en este spec

### Requirement: Catálogo activo del consultorio para turnos

El sistema SHALL publicar el catálogo del consultorio —profesionales y sillones/boxes activos— mediante `GET /api/catalogo` y mediante la función de módulo `obtenerCatalogo({ consultorioId })`, con la proyección mínima de identificador, nombre y matrícula o descripción. Los tres roles autenticados SHALL poder leerlo.

#### Scenario: Recepción consulta el catálogo
- **GIVEN** el consultorio A tiene un profesional activo "Dra. María López" y el sillón "Sillón 1"
- **WHEN** una persona de recepción autenticada en A solicita `GET /api/catalogo`
- **THEN** responde 200 con ambos registros en sus respectivos arrays, incluyendo identificador y nombre

#### Scenario: Registros inactivos excluidos
- **GIVEN** el consultorio A tiene un profesional desactivado
- **WHEN** su personal consulta el catálogo por HTTP o mediante `obtenerCatalogo`
- **THEN** ese profesional no aparece en ninguna de las dos respuestas

#### Scenario: Aislamiento entre consultorios
- **GIVEN** el consultorio B tiene profesionales y sillones propios
- **WHEN** una persona autenticada en A consulta el catálogo
- **THEN** la respuesta no contiene ningún registro del consultorio B

#### Scenario: Catálogo vacío
- **WHEN** un consultorio sin recursos autenticado consulta su catálogo
- **THEN** responde 200 con arrays vacíos

#### Scenario: Solicitud sin identidad válida
- **WHEN** se solicita `GET /api/catalogo` sin encabezado de autorización
- **THEN** responde 401 con code `TOKEN_INVALIDO` y el mensaje uniforme de C00

### Requirement: Listados de gestión del catálogo

El sistema SHALL permitir a `ADMIN_CONSULTORIO` listar todos los profesionales y sillones/boxes de su consultorio, incluidos los inactivos, con su estado y su vínculo de usuario. Otros roles SHALL recibir 403 en estos listados.

#### Scenario: Administrador lista con inactivos y vínculo
- **GIVEN** el consultorio A tiene un profesional activo vinculado a un usuario y otro inactivo sin vínculo
- **WHEN** su administrador solicita `GET /api/profesionales`
- **THEN** responde 200 con ambos, indicando `activo` y `usuarioId` de cada uno

#### Scenario: Recepción intenta el listado de gestión
- **WHEN** una persona de recepción autenticada solicita `GET /api/profesionales`
- **THEN** responde 403 con code `SIN_PERMISO`

#### Scenario: Listado de un consultorio sin registros
- **WHEN** el administrador de un consultorio sin catálogo solicita `GET /api/sillon-boxes`
- **THEN** responde 200 con una lista vacía

### Requirement: Autorización por rol en las operaciones del catálogo

El sistema SHALL reservar las altas y las actualizaciones del catálogo a `ADMIN_CONSULTORIO` y SHALL rechazar con 403 las solicitudes de `RECEPCION` u `ODONTOLOGO`. Sin identidad válida SHALL responder 401 con el contrato uniforme de C00.

#### Scenario: Administrador opera el catálogo
- **WHEN** un administrador autenticado crea y actualiza recursos de su catálogo
- **THEN** el sistema permite ambas operaciones

#### Scenario: Escritura solicitada por otros roles
- **WHEN** una persona de recepción intenta crear un sillón y un odontólogo intenta actualizar un profesional
- **THEN** ambas solicitudes responden 403 con code `SIN_PERMISO` y el catálogo queda intacto

#### Scenario: Solicitud sin autenticación
- **WHEN** una solicitud de alta, actualización o listado carece de encabezado de autorización válido
- **THEN** responde 401 con code `TOKEN_INVALIDO` y el mismo mensaje genérico del resto de la API

### Requirement: Aislamiento de datos entre consultorios (RN-TEN-01, RN-TEN-02)

El sistema SHALL resolver el consultorio exclusivamente del token y filtrar por él toda lectura y mutación. Un identificador perteneciente a otro consultorio SHALL tratarse como inexistente y ningún valor enviado por el cliente SHALL cambiar el consultorio de operación.

#### Scenario: Operaciones propias del consultorio
- **GIVEN** un administrador autenticado en el consultorio A
- **WHEN** crea, actualiza y lista recursos
- **THEN** todas las respuestas pertenecen únicamente a A

#### Scenario: Identificador de otro consultorio en una actualización
- **GIVEN** un profesional existente únicamente en el consultorio B
- **WHEN** el administrador de A envía PUT hacia ese identificador
- **THEN** responde 404 con code `RECURSO_NO_ENCONTRADO` y el registro de B queda intacto

#### Scenario: Consultorio intentado desde query, cuerpo o encabezados
- **GIVEN** un token firmado del consultorio A
- **WHEN** la request incluye `?consultorioId=B`, un encabezado `x-tenant-*` apuntando a B o un cuerpo con `consultorioId`
- **THEN** los valores del cliente no determinan el consultorio de operación: la query y los encabezados se descartan y el cuerpo responde 422, operando siempre sobre A

### Requirement: Comprobaciones de existencia para turnos

El módulo `catalogo` SHALL ofrecer `existeProfesional({ profesionalId, consultorioId })` e `existeSillonBox({ sillonBoxId, consultorioId })` con resultado `Promise<boolean>`, acotados al consultorio indicado. Los identificadores malformados SHALL lanzar `ApiError` 400 con code `DATOS_INVALIDOS` y los fallos de base SHALL propagarse al manejador central.

#### Scenario: Recursos del consultorio indicado
- **GIVEN** un profesional y un sillón existentes en el consultorio A
- **WHEN** un consumidor ejecuta ambas comprobaciones con `consultorioId` de A
- **THEN** ambas devuelven `true`

#### Scenario: Recurso de otro consultorio
- **GIVEN** un profesional existente únicamente en el consultorio B
- **WHEN** un consumidor ejecuta `existeProfesional` con ese identificador y el `consultorioId` de A
- **THEN** devuelve `false`, igual que para un profesional inexistente

#### Scenario: Identificador malformado
- **WHEN** un consumidor invoca alguna comprobación con un identificador que no tiene formato UUID válido
- **THEN** la operación lanza `ApiError` con statusCode 400 y code `DATOS_INVALIDOS`

#### Scenario: Fallo de base durante la comprobación
- **WHEN** la consulta de existencia falla por un problema de base de datos
- **THEN** el error se propaga al consumidor y el manejador HTTP central responde 500 con code `ERROR_INTERNO` y mensaje seguro

### Requirement: Vinculación identidad y ficha profesional (1:1 opcional)

El módulo `catalogo` SHALL exponer `vincularUsuario({ profesionalId, usuarioId, consultorioId })`, `desvincularUsuario({ profesionalId, consultorioId })` y `profesionalDeUsuario({ usuarioId, consultorioId })`, acotados al consultorio. El vínculo SHALL ser 1:1 opcional dentro del consultorio, SHALL permitirse sin restringirse por rol (RN-AU-02) y `catalogo` SHALL operar sin leer la tabla `usuario` (DD-13): el consumidor dueño de los usuarios garantiza la pertenencia del usuario al consultorio.

#### Scenario: Vinculación y resolución inversa
- **GIVEN** el módulo de usuarios verificó que un usuario pertenece al consultorio A
- **WHEN** invoca `vincularUsuario` con ese usuario y un profesional de A
- **THEN** el vínculo queda guardado y `profesionalDeUsuario` devuelve ese profesional dentro de A

#### Scenario: Vínculo sin restricción de rol
- **GIVEN** un usuario del consultorio A con rol `ADMIN_CONSULTORIO`
- **WHEN** se lo vincula a una ficha profesional de A
- **THEN** el vínculo se realiza, porque la condición profesional es independiente del rol administrativo (RN-AU-02)

#### Scenario: Profesional de otro consultorio
- **WHEN** se invoca `vincularUsuario` con un profesional que pertenece al consultorio B pero con el `consultorioId` de A
- **THEN** la operación devuelve `false` y ningún vínculo cambia

#### Scenario: Usuario ya vinculado a otra ficha del consultorio
- **GIVEN** un usuario del consultorio A ya vinculado a un profesional de A
- **WHEN** se lo vincula a otro profesional del mismo consultorio
- **THEN** la operación lanza `ApiError` con statusCode 409 y code `RECURSO_DUPLICADO`, y la primera vinculación se conserva

#### Scenario: Desvinculación
- **GIVEN** un profesional de A vinculado a un usuario
- **WHEN** su consumidor invoca `desvincularUsuario` para ese profesional dentro de A
- **THEN** el vínculo queda nulo, `profesionalDeUsuario` devuelve `null` y el profesional sigue publicado en el catálogo

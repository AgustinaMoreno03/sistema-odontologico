# Spec Delta

## Purpose

Define el catálogo multi-tenant de prestaciones con duración variable y el contrato estable que C05 utilizará al crear turnos.

## ADDED Requirements

### Requirement: Crear prestaciones válidas dentro del consultorio
El sistema SHALL permitir crear una prestación con nombre de hasta 100 caracteres y `duracionMin` entero entre 1 y 480 inclusive, asociándola exclusivamente al consultorio autenticado.

#### Scenario: Alta válida
- **GIVEN** un usuario `ADMIN_CONSULTORIO` autenticado y un nombre no usado en su consultorio
- **WHEN** envía `POST /api/prestaciones` con `nombre`, `duracionMin` y opcionalmente `descripcion`
- **THEN** responde `201` con un DTO que contiene `id`, `nombre`, `duracionMin`, `descripcion`, `activo` y `creadoEn`, y `activo` es `true`

#### Scenario: Duración fuera del rango permitido
- **GIVEN** un usuario `ADMIN_CONSULTORIO` autenticado
- **WHEN** envía una prestación con `duracionMin` igual a 0, negativa o mayor que 480
- **THEN** responde `400` con la forma `{ "error": { "code": "...", "message": "..." } }` y no crea la prestación

#### Scenario: Duración no entera
- **GIVEN** un usuario `ADMIN_CONSULTORIO` autenticado
- **WHEN** envía una prestación con `duracionMin` decimal o no numérico
- **THEN** responde `400` y no crea la prestación

#### Scenario: Nombre demasiado largo
- **GIVEN** un usuario `ADMIN_CONSULTORIO` autenticado
- **WHEN** envía un nombre de más de 100 caracteres
- **THEN** responde `400` y no crea la prestación

### Requirement: Mantener nombres únicos por consultorio
El sistema SHALL rechazar nombres duplicados dentro del mismo consultorio y SHALL permitir el mismo nombre en consultorios diferentes.

#### Scenario: Nombre duplicado en el mismo consultorio
- **GIVEN** que el consultorio autenticado ya tiene una prestación con el mismo `nombre`
- **WHEN** se intenta crear otra prestación con ese nombre
- **THEN** responde `409` con la forma de error JSON consistente y conserva un único registro

#### Scenario: Mismo nombre en otro consultorio
- **GIVEN** que el consultorio A y el consultorio B están aislados y ambos necesitan una prestación con el mismo nombre
- **WHEN** cada consultorio crea su prestación
- **THEN** ambas altas son aceptadas y cada registro queda asociado únicamente a su consultorio

### Requirement: Consultar prestaciones aisladas y ordenadas
El sistema SHALL exponer `GET /api/prestaciones`, resolver el consultorio desde el token, devolver todas sus prestaciones con el campo `activo`, ordenar los resultados por `nombre` y aceptar el filtro opcional `?activo=true` para devolver solo las activas.

#### Scenario: Listado ordenado del consultorio autenticado
- **GIVEN** un usuario autenticado con varias prestaciones de su consultorio
- **WHEN** solicita `GET /api/prestaciones`
- **THEN** responde `200` con una lista de DTOs ordenada ascendentemente por `nombre`

#### Scenario: Aislamiento entre consultorios
- **GIVEN** que una prestación pertenece al consultorio B
- **WHEN** un usuario autenticado del consultorio A solicita `GET /api/prestaciones`
- **THEN** la respuesta `200` no incluye la prestación del consultorio B

#### Scenario: Filtro de prestaciones activas
- **GIVEN** que el consultorio autenticado tiene prestaciones activas e inactivas
- **WHEN** solicita `GET /api/prestaciones?activo=true`
- **THEN** responde `200` únicamente con las prestaciones activas, cada una con `activo=true`

### Requirement: Editar prestaciones y aplicar borrado lógico
El sistema SHALL exponer `PUT /api/prestaciones/{id}` para actualizar una prestación existente o marcarla inactiva mediante `activo=false`; no SHALL existir hard-delete.

Según `knowledge-base/03_actores_y_roles.md`, solo `ADMIN_CONSULTORIO` administra el catálogo. Que `RECEPCION` y `ODONTOLOGO` puedan leer prestaciones es un supuesto de C04, no una afirmación explícita de esa fuente.

#### Scenario: Edición por el administrador
- **GIVEN** una prestación activa del consultorio autenticado y un usuario `ADMIN_CONSULTORIO`
- **WHEN** envía `PUT /api/prestaciones/{id}` con un `duracionMin` válido o cambios de los campos editables
- **THEN** responde `200` con el DTO actualizado y la prestación permanece asociada al mismo consultorio

#### Scenario: Roles no administrativos no editan
- **GIVEN** una prestación del consultorio autenticado y un usuario `RECEPCION` u `ODONTOLOGO`
- **WHEN** intenta crear o editar una prestación
- **THEN** responde `403` y no modifica el catálogo

#### Scenario: Borrado lógico
- **GIVEN** una prestación existente y un usuario `ADMIN_CONSULTORIO`
- **WHEN** envía `PUT /api/prestaciones/{id}` con `activo=false`
- **THEN** responde `200`, conserva el registro con `activo=false` y no lo elimina físicamente

#### Scenario: PUT con nombre duplicado
- **GIVEN** que existe otra prestación con el mismo nombre en el consultorio autenticado
- **WHEN** un `ADMIN_CONSULTORIO` intenta actualizar la prestación con ese nombre
- **THEN** responde `409` y no modifica la prestación

#### Scenario: PUT con id de otro consultorio
- **GIVEN** que el `id` pertenece a una prestación de otro consultorio
- **WHEN** un `ADMIN_CONSULTORIO` envía `PUT /api/prestaciones/{id}`
- **THEN** responde `404` y no modifica datos del otro consultorio

#### Scenario: PUT con duración fuera de rango
- **GIVEN** una prestación del consultorio autenticado
- **WHEN** un `ADMIN_CONSULTORIO` actualiza `duracionMin` con 0, un valor negativo o un valor mayor que 480
- **THEN** responde `400` y conserva la prestación sin cambios

### Requirement: Publicar el contrato de duración para C05
El módulo `catalogo` SHALL exponer `obtenerPrestacionParaTurno({ prestacionId, consultorioId })`, siguiendo la convención de interfaz de C03, con ambos identificadores string y resultado `Promise<{ id, nombre, duracionMin, activo } | null>`. SHALL retornar `null` si la prestación no existe, pertenece a otro consultorio o está inactiva.

#### Scenario: C05 obtiene una prestación activa
- **GIVEN** una prestación activa perteneciente al consultorio autenticado
- **WHEN** agenda/turnos invoca `obtenerPrestacionParaTurno({ prestacionId, consultorioId })` mediante el contrato de catálogo
- **THEN** recibe `duracionMin` positivo y los datos de la prestación del mismo consultorio

#### Scenario: Prestación inexistente o de otro consultorio
- **GIVEN** un `id` que no existe en el consultorio autenticado o pertenece a otro consultorio
- **WHEN** C05 invoca `obtenerPrestacionParaTurno({ prestacionId: id, consultorioId })`
- **THEN** recibe `null` y no obtiene ninguna duración del otro consultorio

#### Scenario: Prestación inactiva no utilizable para nuevos turnos
- **GIVEN** que existe una prestación inactiva con ese `prestacionId` en el consultorio autenticado
- **WHEN** C05 invoca `obtenerPrestacionParaTurno({ prestacionId, consultorioId })` para crear un turno nuevo
- **THEN** recibe `null`, rechaza la creación por ese resultado y no utiliza ninguna `duracionMin`

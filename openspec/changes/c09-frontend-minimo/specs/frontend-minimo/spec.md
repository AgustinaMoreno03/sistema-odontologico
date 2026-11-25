# Spec Delta

## Purpose

Esta capability ofrece una interfaz web minima para autenticarse, crear un turno con recursos seleccionados, cancelar unicamente el turno recien creado y consultar la agenda real del consultorio.

## ADDED Requirements

### Requirement: Login y contexto autenticado
El frontend SHALL enviar `POST /auth/login` con `{ email, password }`, conservar el `token` recibido y enviar `Authorization: Bearer <token>` en cada endpoint protegido. Nunca SHALL enviar `consultorioId` desde la interfaz.

#### Scenario: Login exitoso
- **GIVEN** un usuario ficticio con credenciales validas
- **WHEN** completa `/login` y envia el formulario
- **THEN** se envia el payload exacto, se recibe `200 { token }` y se habilitan las pantallas protegidas con Bearer JWT

#### Scenario: Credenciales invalidas o sesion ausente
- **GIVEN** credenciales incorrectas o ausencia de token
- **WHEN** se envia `/login` o se intenta abrir una pantalla protegida
- **THEN** se conserva login, se muestra `401 CREDENCIALES_INVALIDAS` cuando corresponde, o se redirige a `/login` sin ejecutar una llamada protegida

### Requirement: Seleccion de recursos para alta
En `/turnos/nuevo`, el frontend SHALL buscar pacientes con `GET /api/pacientes?q=...` y exigir al menos 2 caracteres antes de consultar como decision de UX. SHALL mostrar resultados seleccionables, no pedir UUID manual ni intentar listar todos los pacientes. SHALL cargar profesionales y sillones/boxes desde `GET /api/catalogo`, y prestaciones activas desde `GET /api/prestaciones?activo=true`; cada uno SHALL elegirse mediante una lista desplegable.

#### Scenario: Busqueda y seleccion
- **GIVEN** un usuario autenticado que escribe al menos dos caracteres
- **WHEN** busca un paciente y abre las listas de catalogo
- **THEN** se consulta `GET /api/pacientes?q=...` codificando `q`, se muestran resultados seleccionables y se cargan profesionales, sillones/boxes y prestaciones activas desde las rutas exactas

#### Scenario: Busqueda demasiado corta
- **GIVEN** un texto de cero o un caracter
- **WHEN** el usuario intenta buscar paciente
- **THEN** la UI no llama al backend y solicita al menos 2 caracteres; no intenta un listado completo

### Requirement: Alta de turno mediante la API
El frontend SHALL enviar `POST /api/turnos` con `pacienteId`, `profesionalId`, `sillonBoxId`, `prestacionId` e `inicio` ISO con zona explicita o UTC, sin `consultorioId`, y SHALL mostrar el DTO recibido en `201` sin recalcular reglas. Solo `RECEPCION` y `ADMIN_CONSULTORIO` pueden crear; un `ODONTOLOGO` probablemente recibe `403 SIN_PERMISO`. El frontend SHALL conservar y mostrar el `code` y `message` reales.

#### Scenario: Creacion exitosa
- **GIVEN** un token de recepcion o administracion y recursos ficticios activos seleccionados
- **WHEN** confirma un inicio UTC valido
- **THEN** recibe `201`, muestra el turno `PENDIENTE` y presenta `inicio`/`fin` en `America/Argentina/Buenos_Aires`

#### Scenario: Solapamiento o referencia invalida
- **GIVEN** que la API responde `409 SOLAPAMIENTO` o `422 REFERENCIA_INVALIDA` con campo
- **WHEN** el alta encuentra conflicto o recurso inexistente, ajeno o inactivo
- **THEN** conserva el formulario, muestra el codigo/mensaje real y asocia `REFERENCIA_INVALIDA` al campo indicado

#### Scenario: Validacion o rol sin permiso
- **GIVEN** que la API responde `400 VALIDACION` o `403 SIN_PERMISO`
- **WHEN** la fecha es invalida/sin zona o el rol es `ODONTOLOGO`
- **THEN** muestra el codigo y mensaje reales, no reintenta y no crea un turno local

### Requirement: Cancelacion solo del turno recien creado
Despues de un `201`, la pantalla `/turnos/nuevo` SHALL conservar el `id` recibido y ofrecer cancelacion unicamente para ese turno. SHALL enviar `PATCH /api/turnos/:id/cancelar` con `{ solicitadoPor: "PACIENTE" | "CONSULTORIO" }`. `/agenda` SHALL no ofrecer cancelacion.

#### Scenario: Cancelacion exitosa desde alta
- **GIVEN** un turno recien creado, futuro y `PENDIENTE` o `CONFIRMADO`
- **WHEN** el usuario confirma la cancelacion en `/turnos/nuevo`
- **THEN** se usa el `id` del `201`, se recibe `200`, se muestra `CANCELADO` y se presentan las fechas de auditoria en `America/Argentina/Buenos_Aires`

#### Scenario: Cancelacion invalida, no autorizada o no encontrada
- **GIVEN** que la API responde `400 VALIDACION`, `403 SIN_PERMISO`, `404 TURNO_NO_ENCONTRADO`, `409 TURNO_YA_CANCELADO`, `409 ESTADO_INVALIDO` o `409 TURNO_PASADO`
- **WHEN** el cuerpo es invalido, el rol es `ODONTOLOGO`, el turno no existe/no pertenece o no es cancelable
- **THEN** se muestra el codigo y mensaje reales y no se marca localmente como cancelado

### Requirement: Agenda real diaria y semanal
La ruta `/agenda` SHALL consultar `GET /api/agenda` con `desde` y `hasta` obligatorios ISO 8601 con zona, `profesionalId` opcional, `limite=200` y `offset`. SHALL construir la URL con `URLSearchParams`, sin parametros repetidos ni arrays. No SHALL usar datos mock ni mostrar un cartel de endpoint no disponible.

#### Scenario: Agenda diaria o semanal
- **GIVEN** un usuario autenticado y un rango diario o semanal
- **WHEN** abre `/agenda`
- **THEN** usa limites con desplazamiento `-03:00`, recibe turnos reales y presenta sus instantes UTC en `America/Argentina/Buenos_Aires`

#### Scenario: Datos y estados de agenda
- **GIVEN** una respuesta que contiene turnos, incluidos `CANCELADO`
- **WHEN** se renderiza la agenda
- **THEN** muestra todos los estados; usa nombres de paciente de la respuesta y resuelve profesional, sillon/box y prestacion mediante catalogo

#### Scenario: Paginacion y reset
- **GIVEN** paginas sucesivas o una mutacion/cambio de filtro
- **WHEN** hay `hayMas`, se crea/cancela un turno, cambia rango/profesional o se pulsa Recargar
- **THEN** continua con `siguienteOffset` mientras corresponda, o descarta paginas y vuelve a `offset=0`; deduplicar IDs no reemplaza el reset

#### Scenario: Errores de agenda
- **GIVEN** parametros invalidos, token invalido, falta de permiso o profesional no encontrado
- **WHEN** `GET /api/agenda` responde
- **THEN** se muestran respectivamente `400 VALIDACION`, `401 TOKEN_INVALIDO`, `403 SIN_PERMISO` o `404 PROFESIONAL_NO_ENCONTRADO`, conservando codigo y mensaje reales

### Requirement: Datos ficticios de integracion
La documentacion de prueba SHALL requerir datos ficticios: consultorio, usuario `RECEPCION` o `ADMIN_CONSULTORIO`, paciente, profesional, sillon/box y prestacion activa.

#### Scenario: Preparacion con datos ficticios
- **GIVEN** una prueba de integracion del frontend
- **WHEN** se prepara su entorno
- **THEN** se disponen unicamente el consultorio, usuario, paciente, profesional, sillon/box y prestacion activa indicados, todos ficticios

#### Scenario: Flujo de integracion con datos ficticios
- **GIVEN** un consultorio creado por `scripts/crear-consultorio.js` y recursos creados por APIs existentes
- **WHEN** se ejecuta login, busqueda, alta, cancelacion y consulta de agenda
- **THEN** el recorrido usa unicamente datos ficticios, no inventa scripts y no expone secretos ni `consultorioId` desde la UI

### Requirement: Creacion del consultorio de prueba
La documentacion SHALL indicar que `scripts/crear-consultorio.js` solo crea el consultorio.

#### Scenario: Ejecucion del script de consultorio
- **GIVEN** que se ejecuta `scripts/crear-consultorio.js`
- **WHEN** termina su preparacion
- **THEN** solo se crea el consultorio

### Requirement: Creacion de recursos de prueba
La documentacion SHALL indicar que los demas recursos se crean mediante las rutas existentes.

#### Scenario: Creacion de recursos restantes
- **GIVEN** un consultorio creado por `scripts/crear-consultorio.js`
- **WHEN** se preparan usuario, paciente, profesional, sillon/box y prestacion
- **THEN** se usan las rutas existentes, sin inventar scripts adicionales

### Requirement: Alcance de reprogramacion
La reprogramacion SHALL quedar fuera de alcance.

#### Scenario: Solicitud de reprogramacion
- **GIVEN** una necesidad de cambiar el horario de un turno
- **WHEN** se revisa el alcance del frontend minimo
- **THEN** la reprogramacion no forma parte de esta capability

### Requirement: Estado archivado de C08
C08 SHALL tratarse como archivado.

#### Scenario: Consulta de C08
- **GIVEN** la preparacion de la implementacion
- **WHEN** se consulta C08
- **THEN** se trata como archivado

### Requirement: Contrato de C06
Si C06 figura in-progress, su contrato existente SHALL usarse como fuente.

#### Scenario: Consulta de C06
- **GIVEN** que C06 figura in-progress
- **WHEN** se consultan sus contratos
- **THEN** se usa el contrato existente como fuente

### Requirement: Documentacion faltante de auth
La ausencia de `src/modules/auth/README.md` SHALL quedar visible como documentacion faltante.

#### Scenario: Verificacion de documentacion de auth
- **GIVEN** que no existe `src/modules/auth/README.md`
- **WHEN** se revisa la documentacion del modulo auth
- **THEN** se deja constancia visible de esa documentacion faltante

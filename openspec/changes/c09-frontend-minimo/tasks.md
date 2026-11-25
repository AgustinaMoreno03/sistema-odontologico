
# Tasks

## 1. Preparacion y contratos

- [x] 1.1 Crear el scaffold React 19 + Vite en `frontend/` sin modificar `src/`, `tests/`, `db/` ni otros changes.
  - Evidencia: implementacion en `frontend/`, con `package.json`, `vite.config.js` y componentes React. El change C09 mantiene su implementacion dentro de `frontend/` y la documentacion OpenSpec.

- [x] 1.2 Confirmar `POST /auth/login` `{email,password}` -> `{token}`, Bearer JWT y formato real `{error:{code,message}}` contra rutas, servicios y `src/errores.js`; dejar explicita la ausencia de `src/modules/auth/README.md`.
  - Evidencia: `frontend/src/auth.test.jsx`, test `envia exactamente email y password, guarda el token y habilita la ruta protegida`; `frontend/src/api/http.test.jsx`, tests de Bearer y normalizacion de errores.
  - Contrato contrastado con la implementacion de autenticacion del backend. No existe `src/modules/auth/README.md` como documento de contrato.

- [x] 1.3 Confirmar que `.gitignore` ya cubre `frontend/node_modules` y `frontend/dist` por `node_modules/` y `dist/`, sin editarlo.
  - Evidencia: reglas existentes `node_modules/` y `dist/` de `.gitignore`. No se requirio modificar el archivo.

- [x] 1.4 Preparar solo datos ficticios: crear consultorio y administrador inicial mediante el script oficial `scripts/crear-consultorio.js`; crear paciente mediante `POST /api/pacientes`, profesional mediante `POST /api/profesionales`, sillon/box mediante `POST /api/sillon-boxes` y prestacion mediante `POST /api/prestaciones`. No inventar scripts ni persistir credenciales.
  - Evidencia: `npm.cmd run crear-consultorio`, comando definido en `package.json` como `node --env-file=.env scripts/crear-consultorio.js`.
  - El script utiliza `crearConsultorio` y `crearUsuarioEnConsultorio` con rol `ADMIN_CONSULTORIO`, dentro de una transaccion PostgreSQL (`BEGIN` / `COMMIT`, con `ROLLBACK` ante errores).
  - El administrador inicial de C01 utilizado para las pruebas fue aprovisionado mediante este script oficial, no mediante SQL manual ni `POST /usuarios`.
  - Se crearon recursos ficticios mediante API real, con respuestas HTTP 201: paciente Juan Prueba, profesional Dra. Ana Prueba, sillon/box Box C09 y prestacion Consulta C09.
  - Las credenciales y los tokens JWT no se incluyen en este documento.

## 2. Cliente, autenticacion y seleccion

- [x] 2.1 Implementar cliente HTTP y `frontend/vite.config.js` con proxy futuro para `/auth` y `/api`; agregar Bearer solo a requests protegidas y nunca `consultorioId` ni headers de tenant creados por UI.
  - Evidencia: `frontend/src/api/http.test.jsx`.
  - Test `envia JSON y Bearer unicamente cuando la request es protegida`.
  - Test `no envia Authorization en peticiones publicas aunque haya un token guardado`.
  - Configuracion de proxy en `frontend/vite.config.js`.

- [x] 2.2 Implementar `/login`, guardia de sesion y presentacion de `200 {token}` y `401 CREDENCIALES_INVALIDAS`.
  - Evidencia: `frontend/src/auth.test.jsx`.
  - Test `envia exactamente email y password, guarda el token y habilita la ruta protegida`.
  - Test `conserva el formulario y muestra el error real de credenciales`.
  - Test `redirige una ruta protegida a login sin llamar al backend cuando no hay sesion`.
  - Tests de `TOKEN_INVALIDO` cuando la respuesta no incluye un token valido.
  - Prueba manual: inicio de sesion exitoso desde React con administrador de consultorio.

- [x] 2.3 Implementar busqueda de paciente con `GET /api/pacientes?q=...`, minimo UX de 2 caracteres, lista seleccionable, sin UUID manual ni listado completo.
  - Evidencia: `frontend/src/pages/NuevoTurno.test.jsx`.
  - Test `no llama al backend con menos de 2 caracteres y pide minimo 2`.
  - Test `busca con q codificado y muestra resultados seleccionables`.
  - Test `codifica caracteres especiales en q y muestra el error real de busqueda`.
  - Prueba manual: busqueda y seleccion del paciente Juan Prueba desde React.

- [x] 2.4 Implementar listas desplegables desde `GET /api/catalogo` para profesionales/sillones-boxes y `GET /api/prestaciones?activo=true` para prestaciones activas.
  - Evidencia: `frontend/src/pages/NuevoTurno.test.jsx`.
  - Test `carga profesionales, sillones/boxes y prestaciones activas en las rutas exactas`.
  - Test `muestra el error real de catalogo sin reintentar`.
  - Prueba manual: seleccion de profesional, sillon/box y prestacion creados mediante API real.

- [x] 2.5 Preservar y mostrar `status`, `code`, `message` y `field` cuando exista, incluyendo errores `400`, `401`, `403`, `404`, `409` y `422`, sin reintentos ni traducciones inventadas.
  - Evidencia: `frontend/src/api/http.test.jsx`.
  - Test `normaliza el error conservando status, code, message y field`.
  - Test `normaliza un fallo de conexion sin exponer el mensaje nativo`.
  - Test `devuelve null ante un 2xx con body vacio`.
  - Test `rechaza con RESPUESTA_INVALIDA ante un 2xx con body no-JSON`.
  - Evidencia complementaria: tests de errores HTTP en `NuevoTurno.test.jsx` y `Agenda.test.jsx`.

## 3. Turnos y agenda real

- [x] 3.1 Implementar `/turnos/nuevo` y el POST exacto a `/api/turnos`; verificar `201`, `409 SOLAPAMIENTO`, `422 REFERENCIA_INVALIDA` por campo, `400 VALIDACION` y `403 SIN_PERMISO` para `ODONTOLOGO`, manteniendo el formulario ante errores.
  - Evidencia: `frontend/src/pages/NuevoTurno.test.jsx`.
  - Linea 235: `envia el payload exacto y muestra el DTO 201 con fechas en Buenos Aires`.
  - Linea 258: `conserva el formulario y muestra 409 SOLAPAMIENTO real sin crear turno`.
  - Linea 275: `asocia 422 REFERENCIA_INVALIDA al campo indicado en el mensaje`.
  - Linea 299: `muestra 400 VALIDACION real sin reintentar ni crear turno local`.
  - Linea 320: `muestra 403 SIN_PERMISO real para ODONTOLOGO sin crear turno`.
  - Prueba manual con API y PostgreSQL reales: creacion de turno desde React para Juan Prueba, con respuesta exitosa y posterior visualizacion en agenda.

- [x] 3.2 Tras `201`, guardar el `id` devuelto y ofrecer cancelacion unicamente en `/turnos/nuevo` sobre ese turno; usar `PATCH /api/turnos/:id/cancelar` con `solicitadoPor`, sin control de cancelacion en agenda. Verificar `200 CANCELADO`, `400 VALIDACION`, `403 SIN_PERMISO`, `404 TURNO_NO_ENCONTRADO`, `409 TURNO_YA_CANCELADO`, `409 ESTADO_INVALIDO` y `409 TURNO_PASADO`.
  - Evidencia: `frontend/src/pages/NuevoTurno.test.jsx`.
  - Linea 88: `cancela el turno del 201 con PATCH y solicitadoPor, mostrando auditoria en BA`.
  - Linea 103: `muestra 409 TURNO_YA_CANCELADO real y no marca el turno como cancelado`.
  - Linea 122: `muestra 404 TURNO_NO_ENCONTRADO real sin reintentar`.
  - Linea 137: `muestra 403 SIN_PERMISO real para ODONTOLOGO al cancelar`.
  - Linea 153: `muestra 400 VALIDACION, 409 ESTADO_INVALIDO y 409 TURNO_PASADO reales sin marcar cancelado`.
  - Prueba manual: creacion y cancelacion de un turno desde `/turnos/nuevo`, seguida de verificacion del estado `CANCELADO` en agenda.

- [x] 3.3 Implementar `/agenda` contra `GET /api/agenda` real, sin datos mock ni cartel ficticio; usar `desde`, `hasta`, `profesionalId` opcional, `limite=200`, `offset` y `URLSearchParams` sin repetidos.
  - Evidencia: `frontend/src/pages/Agenda.test.jsx`.
  - Linea 82: `consulta con rango -03:00, limite=200 y offset=0 sin parametros repetidos`.
  - Linea 104: `usa rango semanal de lunes a lunes+7 con -03:00`.
  - Linea 188: `resetea a offset=0 al cambiar profesional y filtra por profesionalId`.
  - Prueba manual: consulta de agenda desde React con backend real y turnos persistidos en PostgreSQL.

- [x] 3.4 Mostrar nombres de paciente de la agenda y resolver profesional/sillon/box/prestacion desde catalogo; incluir todos los estados, incluido `CANCELADO`, y presentar UTC en `America/Argentina/Buenos_Aires`.
  - Evidencia: `frontend/src/pages/Agenda.test.jsx`.
  - Linea 122: `muestra todos los estados incluido CANCELADO, nombres y catalogo resuelto, en BA`.
  - Evidencia complementaria: `frontend/src/fechas.test.jsx`.
  - Test `presenta instantes UTC en America/Argentina/Buenos_Aires`.
  - Prueba manual: agenda con turnos `PENDIENTE` y `CANCELADO`, nombres de recursos y horarios correspondientes.

- [x] 3.5 Resetear paginas a `offset=0` tras alta, cancelacion, cambio de rango/profesional y Recargar; seguir `siguienteOffset` con `hayMas`, entendiendo que deduplicar IDs no reemplaza el reset. Verificar errores `400 VALIDACION`, `401 TOKEN_INVALIDO`, `403 SIN_PERMISO` y `404 PROFESIONAL_NO_ENCONTRADO`.
  - Evidencia: `frontend/src/pages/Agenda.test.jsx`.
  - Linea 150: `pagina con siguienteOffset, deduplica IDs y resetea a offset=0 en Recargar`.
  - Linea 188: `resetea a offset=0 al cambiar profesional y filtra por profesionalId`.
  - Evidencia complementaria: `frontend/src/navegacion.test.jsx`, linea 92: `la primera consulta de agenda tras crear un turno en /turnos/nuevo usa offset=0 (reset por remontaje)`.
  - `Agenda.test.jsx`, test parametrizado `muestra el error real %i %s de la agenda`:
    - `400 VALIDACION`.
    - `401 TOKEN_INVALIDO`.
    - `403 SIN_PERMISO`.
    - `404 PROFESIONAL_NO_ENCONTRADO`.
  - El test comprueba la visualizacion del error y la ausencia de reintentos.

- [x] 3.6 Mantener reprogramacion fuera de alcance y usar rangos diarios/semanales con desplazamiento `-03:00`.
  - Evidencia: `frontend/src/fechas.test.jsx`.
  - Test `construye el rango diario con desplazamiento -03:00`.
  - Test `construye la semana desde el lunes hasta lunes+7 con -03:00`.
  - Test `devuelve la fecha de hoy segun la zona de Buenos Aires`.
  - Reprogramacion excluida del alcance funcional de C09.

## 4. Integracion y cierre

- [ ] 4.1 Aplicar presentacion responsiva para login, alta/cancelacion y agenda, condicionada a resolver la politica visual `deferred` sin inventar aprobacion.
  - Estado: pendiente.
  - Motivo: la politica visual `deferred` indicada en `design-system/README.md` no esta resuelta.
  - No se declara aprobacion visual ni cierre de esta tarea.

- [x] 4.2 Ejecutar la verificacion coordinada contra API local con datos ficticios, comprobando consola, requests, aislamiento y que no salgan modificaciones de `frontend/`.
  - Evidencia automatizada:
    - Frontend: `npm.cmd test -- --run`, ejecutado desde `frontend/`.
    - Resultado: `Test Files 6 passed (6)` y `Tests 42 passed (42)`.
    - Backend: `npm test -- tests/`, 505/505 tests aprobados en la ejecucion previa.
    - OpenSpec: `npx.cmd openspec validate c09-frontend-minimo`, validacion exitosa.
  - Evidencia de integracion manual:
    - Backend local conectado a PostgreSQL.
    - Inicio de sesion desde React con administrador de C01.
    - Creacion mediante API real de paciente, profesional, sillon/box y prestacion ficticios, con respuestas HTTP 201.
    - Creacion de turnos desde React.
    - Visualizacion de turnos `PENDIENTE` y `CANCELADO` en agenda.
    - Cancelacion desde la pantalla Nuevo turno.
    - Prueba de aislamiento utilizando un segundo administrador perteneciente a otro consultorio.
    - En la sesion del segundo administrador no aparecieron los pacientes, catalogos ni turnos del primero.
    - Evidencia visual del aislamiento: `openspec/changes/c09-frontend-minimo/evidencias/C09-aislamiento.jpg`, disponible en el repositorio para revision y para el video de entrega.
  - Alcance de la evidencia: los tests automatizados utilizan respuestas HTTP simuladas para comprobar el comportamiento del frontend; las pruebas manuales verificaron el recorrido funcional contra la API y PostgreSQL reales.
  - No se incorporaron scripts de seed ni modificaciones al backend como parte de C09.

- [ ] 4.3 Ejecutar la validacion del change y comprobar escenarios GIVEN/WHEN/THEN antes de Archive. Esta tarea sera ejecutada por el coordinador, no durante esta revision documental.
  - Estado: pendiente de revision y aprobacion por coordinacion.
  - La validacion automatica de OpenSpec ya fue ejecutada satisfactoriamente; no implica el cierre de la verificacion final ni autoriza Archive.

## Workflow follow-up

- Revisar y aprobar los cuatro artefactos antes de iniciar `openspec-apply-change`.
- Resolver la politica visual del primer change frontend segun `design-system/README.md` antes de aplicar decisiones visuales.
- Archivar solo despues de Apply, Verify, revision y aprobacion del change.
- El PR de C09 permanece sin merge hasta la revision y aprobacion de Agustina.

## Evidencia de integracion C09

### Pruebas automatizadas

- Frontend: `npm.cmd test -- --run` desde `frontend/`.
- Resultado: 6 archivos de tests aprobados, 42 tests aprobados.
- Backend: 505/505 tests aprobados mediante `npm test -- tests/` en la ejecucion previa.
- OpenSpec: `npx.cmd openspec validate c09-frontend-minimo`, exitoso.

### Administrador inicial y datos ficticios

- El primer administrador utilizado para la integracion fue el administrador de C01.
- Se creo mediante `npm.cmd run crear-consultorio`, utilizando el script oficial `scripts/crear-consultorio.js`.
- El script crea el consultorio mediante `crearConsultorio` y el usuario inicial mediante `crearUsuarioEnConsultorio`, con rol `ADMIN_CONSULTORIO`.
- La operacion se realiza dentro de una transaccion PostgreSQL.
- No se utilizo SQL manual ni `POST /usuarios` para crear ese administrador.
- El script se ejecuto desde el entorno de trabajo de C01, cuya funcionalidad fue posteriormente integrada a `upstream/main`.
- Se crearon recursos ficticios mediante las rutas reales de la API:
  - `POST /api/pacientes`: HTTP 201.
  - `POST /api/profesionales`: HTTP 201.
  - `POST /api/sillon-boxes`: HTTP 201.
  - `POST /api/prestaciones`: HTTP 201.
- No se almacenaron contrasenas ni tokens JWT en este documento.

### Pruebas funcionales

- Login de administrador desde React: correcto.
- Alta de turno desde React: correcta.
- Agenda: visualizacion de turnos `PENDIENTE` y `CANCELADO`.
- Cancelacion desde la pantalla Nuevo turno: correcta.
- Se utilizaron datos persistidos en PostgreSQL local.

### Aislamiento entre consultorios

- Se utilizo un segundo consultorio con un administrador diferente, aprovisionado mediante el script oficial de C01.
- Se inicio sesion desde React con el segundo administrador en una sesion independiente.
- Se verifico que la busqueda de pacientes no mostrara al paciente del primer consultorio.
- Se verifico que los catalogos no mostraran los recursos del primer consultorio.
- Se verifico que la agenda no mostrara los turnos del primer consultorio.
- Resultado: aislamiento funcional verificado en el recorrido manual realizado.
- Evidencia visual: `openspec/changes/c09-frontend-minimo/evidencias/C09-aislamiento.jpg`.
- Esta prueba manual no constituye una auditoria integral de seguridad.

### Alcance y pendientes

- Datos semilla adicionales: fuera del alcance de C09.
- Politica visual `deferred`: pendiente; tarea 4.1 sin marcar.
- Verificacion final de coordinacion: pendiente; tarea 4.3 sin marcar.
- PR de C09: pendiente de revision, sin merge.

# Design

## Context

El backend separado expone `/auth` y `/api`. Login esta definido por `src/modules/auth/rutas.js` y `servicios.js`; `src/modules/auth/README.md` no existe y esa ausencia se conserva como documentacion faltante. Turnos define alta y cancelacion en sus rutas, README y specs; C08 esta archivado y `src/modules/turnos/AGENDA.md` es la fuente del contrato real de agenda.

La propuesta y la spec fijan el comportamiento. Este documento define la integracion sin implementar todavia.

## Goals / Non-Goals

**Goals:**

- Usar un cliente HTTP centralizado que agregue Bearer y preserve `status`, `code`, `message` y `field` cuando exista.
- Separar `auth`, `pacientes`, `catalogo`, `turnos` y `agenda`, con `/login`, `/agenda` y `/turnos/nuevo`.
- Buscar pacientes por texto y elegir profesional, sillon/box y prestacion desde listas, sin pedir UUID manual.
- Cancelar solo el turno recien creado en `/turnos/nuevo`, usando el `id` del `201`.
- Consultar la agenda real, paginar con reset completo a offset cero y mostrar todos sus estados.
- Formatear UTC con `America/Argentina/Buenos_Aires` y usar proxy futuro de Vite para `/auth` y `/api`.

**Non-Goals:**

- No modificar backend, migraciones, auth, contratos ni C08.
- No implementar reprogramacion, cancelacion desde agenda, historia clinica, cobros, portal de paciente ni administracion de catalogo.
- No usar datos reales, enviar `consultorioId` desde UI ni crear datos mediante SQL o scripts nuevos.

## Decisions

### Cliente HTTP y autenticacion

El modulo compartido construira la URL base desde configuracion y anadira `Authorization: Bearer <token>` solo con sesion. `POST /auth/login` recibe `{email,password}` y devuelve `{token}`. La autorizacion definitiva es del servidor: el frontend no usara la decodificacion del JWT para conceder permisos. Los errores se conservaran sin traducciones inventadas.

### Alta, seleccion y cancelacion

`/turnos/nuevo` ejecutara `GET /api/pacientes?q=...` unicamente desde 2 caracteres como decision de UX; el backend exige `q` no vacio. La respuesta se muestra como lista desplegable seleccionable. Profesionales y sillones/boxes se cargan desde `GET /api/catalogo`; prestaciones activas desde `GET /api/prestaciones?activo=true`; ambos campos se eligen en listas.

El POST de alta usa solo los IDs seleccionados y `inicio` ISO con zona o UTC. Solo `RECEPCION` y `ADMIN_CONSULTORIO` pueden crear. El frontend conserva y muestra el error real, incluido `403 SIN_PERMISO` para `ODONTOLOGO`. Luego de `201`, guarda el DTO y ofrece un unico control de cancelacion en esta pantalla, con `PATCH /api/turnos/:id/cancelar` y el `id` devuelto. Agenda nunca cancela.

### Agenda real y paginacion

`/agenda` llamara `GET /api/agenda` con `URLSearchParams`, sin arrays ni parametros repetidos. `desde` y `hasta` son obligatorios ISO 8601 con desplazamiento `-03:00` para rangos diarios/semanales; `profesionalId` es opcional, `limite` sera 200 y `offset` inicia en 0. Se seguira `siguienteOffset` mientras `hayMas` sea true.

Despues de alta, cancelacion, cambio de rango o profesional, y al pulsar Recargar, se descartan paginas y se consulta desde `offset=0`. Deduplicar por ID solo evita duplicados visuales y no sustituye el reset. Se muestran todos los estados, incluido `CANCELADO`. `pacienteNombre` y `pacienteApellido` vienen en agenda; profesional, sillon/box y prestacion se resuelven desde catalogo. Los errores de agenda son `400 VALIDACION`, `401 TOKEN_INVALIDO`, `403 SIN_PERMISO` y `404 PROFESIONAL_NO_ENCONTRADO`, conservando mensajes reales.

### Datos de integracion

La preparacion usa `scripts/crear-consultorio.js`, que crea solo el consultorio y muestra su ID. Con un administrador autenticado se crea el usuario de prueba por `POST /usuarios`; luego se crean paciente por `POST /api/pacientes`, profesional por `POST /api/profesionales`, sillon/box por `POST /api/sillon-boxes` y prestacion por `POST /api/prestaciones`. El flujo requiere consultorio, usuario `RECEPCION` o `ADMIN_CONSULTORIO`, paciente, profesional, sillon/box y prestacion activa. No se inventan scripts, fixtures de produccion ni credenciales persistidas.

### Proxy y archivos ignorados

La configuracion futura de `frontend/vite.config.js` cubrira `/auth` y `/api`. `.gitignore` ya cubre `frontend/node_modules` y `frontend/dist` mediante `node_modules/` y `dist/`; no se modifica.

## Risks / Trade-offs

- La ausencia de README de auth obliga a usar solo rutas y servicios verificables, sin afirmar otro contrato.
- C06 puede figurar in-progress en OpenSpec; su contrato existente y el codigo de rutas son la fuente de cancelacion.
- La paginacion de agenda no ofrece snapshot; el reset tras mutaciones y recarga reduce inconsistencias, pero no promete snapshot.
- La autorizacion y las referencias validas se verifican en backend; el frontend solo guia la seleccion y presenta errores reales.

## Migration Plan

No hay migracion de base ni cambio backend. Apply crea solo `frontend/` y su configuracion. Rollback elimina unicamente esos archivos.

## Open Questions

- La politica visual `deferred` debe resolverse por el flujo de diseno antes de Apply; este documento no inventa aprobacion.
- La respuesta central de errores debera conectarse en Apply al formato `{ error: { code, message } }` sin alterar los codigos documentados.

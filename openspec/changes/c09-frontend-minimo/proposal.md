# Proposal

## Why

El backend del MVP ya expone autenticacion, catalogo, pacientes, turnos y agenda. Este change entrega el recorrido minimo en React 19 + Vite para que recepcion o administracion inicien sesion, creen un turno, puedan cancelarlo inmediatamente y consulten la agenda real, sin duplicar reglas de negocio en el navegador.

## What Changes

- Crear el frontend separado bajo `frontend/` en Apply, con `/login`, `/agenda` y `/turnos/nuevo`.
- Consumir `POST /auth/login` con `{ email, password }`; guardar el JWT en la sesion y usar `Authorization: Bearer <token>`.
- En `/turnos/nuevo`, buscar pacientes con `GET /api/pacientes?q=...`; la UI exige al menos 2 caracteres, aunque el backend solo exige que `q` no sea vacio. Mostrar resultados seleccionables y nunca pedir UUID manual ni listar todos los pacientes.
- Cargar profesionales y sillones/boxes desde `GET /api/catalogo`, y prestaciones activas desde `GET /api/prestaciones?activo=true`; los tres recursos se eligen en listas desplegables.
- Crear turnos con `POST /api/turnos` y `{ pacienteId, profesionalId, sillonBoxId, prestacionId, inicio }`. Solo `RECEPCION` y `ADMIN_CONSULTORIO` pueden hacerlo; el frontend conserva y muestra el `code` y `message` reales, incluido el probable `403 SIN_PERMISO` de `ODONTOLOGO`.
- Cancelar unicamente en `/turnos/nuevo`, sobre el turno recien creado y usando el `id` recibido en `201`; no ofrecer cancelacion desde `/agenda`.
- Consultar la agenda real mediante `GET /api/agenda`, con rangos y paginacion segun `src/modules/turnos/AGENDA.md`; no usar datos mock ni cartel de agenda ficticia.
- Presentar instantes UTC en `America/Argentina/Buenos_Aires`, mantener reprogramacion fuera de alcance y usar un proxy futuro de Vite para `/auth` y `/api`.
- Mantener los datos de prueba ficticios y documentar su preparacion sin agregar scripts ni modificar `.gitignore`.

## Capabilities

### New Capabilities

- `frontend-minimo`: Interfaz web minima para autenticarse, crear/cancelar el turno recien creado y consultar la agenda real.

### Modified Capabilities

Ninguna. Los endpoints de backend son consumidos, no modificados.

## Impact

- Apply agregara unicamente `frontend/` y su configuracion; no modifica `src/`, `tests/`, `db/`, `.gitignore` ni otros changes.
- Dependencias: C01 (`POST /auth/login` y usuarios), C02/C04 (catalogo), C03 (pacientes), C05 (alta), C06 (cancelacion), C07 (reprogramacion fuera de alcance) y C08 (agenda real).
- C08 esta archivado y su contrato real se toma de `src/modules/turnos/AGENDA.md`. C06 puede figurar in-progress en OpenSpec, pero su contrato existente es la fuente para cancelacion.
- `src/modules/auth/README.md` no existe. Esta ausencia queda documentada; el contrato de login se deriva de `src/modules/auth/rutas.js` y `servicios.js`.
- `.gitignore` ya cubre `frontend/node_modules` y `frontend/dist` mediante `node_modules/` y `dist/`; no se modifica.

## Resumen para la lider (una pagina)

### Alcance y rutas frontend

`/login` autentica. `/turnos/nuevo` busca paciente, carga listas de catalogo, crea un turno y, solo si el POST devuelve `201`, ofrece cancelar ese turno mediante su `id`. `/agenda` consulta la agenda real. No se incluye reprogramacion ni cancelacion desde agenda.

### Contratos y permisos

Login: `POST /auth/login` con `{email,password}` devuelve `{token}`; las llamadas protegidas usan Bearer JWT. El alta usa `POST /api/turnos` sin `consultorioId`, y requiere `RECEPCION` o `ADMIN_CONSULTORIO`; `ODONTOLOGO` probablemente recibe `403 SIN_PERMISO`. El frontend muestra el codigo y mensaje reales.

Paciente: `GET /api/pacientes?q=...`, con minimo UX de 2 caracteres. Profesionales y sillones/boxes: `GET /api/catalogo`. Prestaciones activas: `GET /api/prestaciones?activo=true`. Los resultados se seleccionan en listas, sin UUID manual ni listado completo de pacientes.

### Agenda y fechas

`GET /api/agenda` exige `desde` y `hasta` ISO 8601 con zona, acepta `profesionalId`, `limite=200` y `offset`, y se construye con `URLSearchParams` sin repetidos. Se muestran todos los estados, incluido `CANCELADO`; los nombres de pacientes vienen en la respuesta y los nombres de profesional, sillón/box y prestacion se resuelven con catalogo. Tras alta, cancelacion, cambio de rango/profesional o Recargar se descartan paginas y se vuelve a `offset=0`; deduplicar IDs no reemplaza ese reset.

Los rangos diarios/semanales usan desplazamiento `-03:00`; las fechas UTC de respuesta se presentan en `America/Argentina/Buenos_Aires`. Se muestran errores de agenda `400 VALIDACION`, `401 TOKEN_INVALIDO`, `403 SIN_PERMISO` y `404 PROFESIONAL_NO_ENCONTRADO` con su codigo y mensaje reales.

### Datos ficticios y faltantes

Para una prueba real se prepara un consultorio ficticio con `scripts/crear-consultorio.js`, que solo crea el consultorio y muestra su ID. El usuario `RECEPCION` o `ADMIN_CONSULTORIO` se crea por `POST /usuarios` autenticado como administrador; paciente por `POST /api/pacientes`; profesional por `POST /api/profesionales`; sillón/box por `POST /api/sillon-boxes`; prestacion por `POST /api/prestaciones`. No se inventan scripts ni se guardan credenciales. C08 esta archivado; C06 puede figurar in-progress, pero el contrato existente se usa. Falta `src/modules/auth/README.md` y debe permanecer como documentacion faltante.

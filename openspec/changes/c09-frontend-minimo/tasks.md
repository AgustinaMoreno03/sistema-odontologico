# Tasks

## 1. Preparacion y contratos

- [ ] 1.1 Crear el scaffold React 19 + Vite en `frontend/` sin modificar `src/`, `tests/`, `db/` ni otros changes.
- [ ] 1.2 Confirmar `POST /auth/login` `{email,password}` -> `{token}`, Bearer JWT y formato real `{error:{code,message}}` contra rutas, servicios y `src/errores.js`; dejar explicita la ausencia de `src/modules/auth/README.md`.
- [ ] 1.3 Confirmar que `.gitignore` ya cubre `frontend/node_modules` y `frontend/dist` por `node_modules/` y `dist/`, sin editarlo.
- [ ] 1.4 Preparar solo datos ficticios: ejecutar `scripts/crear-consultorio.js` para crear el consultorio; crear el usuario `RECEPCION` o `ADMIN_CONSULTORIO` mediante `POST /usuarios`, paciente mediante `POST /api/pacientes`, profesional mediante `POST /api/profesionales`, sillon/box mediante `POST /api/sillon-boxes` y prestacion mediante `POST /api/prestaciones`. No inventar scripts ni persistir credenciales.

## 2. Cliente, autenticacion y seleccion

- [ ] 2.1 Implementar cliente HTTP y `frontend/vite.config.js` con proxy futuro para `/auth` y `/api`; agregar Bearer solo a requests protegidas y nunca `consultorioId` ni headers de tenant creados por UI.
- [ ] 2.2 Implementar `/login`, guardia de sesion y presentacion de `200 {token}` y `401 CREDENCIALES_INVALIDAS`.
- [ ] 2.3 Implementar busqueda de paciente con `GET /api/pacientes?q=...`, minimo UX de 2 caracteres, lista seleccionable, sin UUID manual ni listado completo.
- [ ] 2.4 Implementar listas desplegables desde `GET /api/catalogo` para profesionales/sillones-boxes y `GET /api/prestaciones?activo=true` para prestaciones activas.
- [ ] 2.5 Preservar y mostrar `status`, `code`, `message` y `field` cuando exista, incluyendo errores `400`, `401`, `403`, `404`, `409` y `422`, sin reintentos ni traducciones inventadas.

## 3. Turnos y agenda real

- [ ] 3.1 Implementar `/turnos/nuevo` y el POST exacto a `/api/turnos`; verificar `201`, `409 SOLAPAMIENTO`, `422 REFERENCIA_INVALIDA` por campo, `400 VALIDACION` y `403 SIN_PERMISO` para `ODONTOLOGO`, manteniendo el formulario ante errores.
- [ ] 3.2 Tras `201`, guardar el `id` devuelto y ofrecer cancelacion unicamente en `/turnos/nuevo` sobre ese turno; usar `PATCH /api/turnos/:id/cancelar` con `solicitadoPor`, sin control de cancelacion en agenda. Verificar `200 CANCELADO`, `400 VALIDACION`, `403 SIN_PERMISO`, `404 TURNO_NO_ENCONTRADO`, `409 TURNO_YA_CANCELADO`, `409 ESTADO_INVALIDO` y `409 TURNO_PASADO`.
- [ ] 3.3 Implementar `/agenda` contra `GET /api/agenda` real, sin datos mock ni cartel ficticio; usar `desde`, `hasta`, `profesionalId` opcional, `limite=200`, `offset` y `URLSearchParams` sin repetidos.
- [ ] 3.4 Mostrar nombres de paciente de la agenda y resolver profesional/sillon/box/prestacion desde catalogo; incluir todos los estados, incluido `CANCELADO`, y presentar UTC en `America/Argentina/Buenos_Aires`.
- [ ] 3.5 Resetear paginas a `offset=0` tras alta, cancelacion, cambio de rango/profesional y Recargar; seguir `siguienteOffset` con `hayMas`, entendiendo que deduplicar IDs no reemplaza el reset. Verificar errores `400 VALIDACION`, `401 TOKEN_INVALIDO`, `403 SIN_PERMISO` y `404 PROFESIONAL_NO_ENCONTRADO`.
- [ ] 3.6 Mantener reprogramacion fuera de alcance y usar rangos diarios/semanales con desplazamiento `-03:00`.

## 4. Integracion y cierre

- [ ] 4.1 Aplicar presentacion responsiva para login, alta/cancelacion y agenda, condicionada a resolver la politica visual `deferred` sin inventar aprobacion.
- [ ] 4.2 Ejecutar la verificacion coordinada contra API local con datos ficticios, comprobando consola, requests, aislamiento y que no salgan modificaciones de `frontend/`.
- [ ] 4.3 Ejecutar la validacion del change y comprobar escenarios GIVEN/WHEN/THEN antes de Archive. Esta tarea sera ejecutada por el coordinador, no durante esta revision documental.

## Workflow follow-up

- Revisar y aprobar los cuatro artefactos antes de iniciar `openspec-apply-change`.
- Resolver la politica visual del primer change frontend segun `design-system/README.md` antes de aplicar decisiones visuales.
- Archivar solo despues de Apply, Verify, revision y aprobacion del change.

# Tasks

## 1. Contrato y migración de prestaciones

- [ ] 1.1 Crear primero el test de integración del escenario "Alta válida"; verificar que falla antes de implementar.
- [ ] 1.2 Crear primero los tests de integración de "Duración fuera del rango permitido" y "Duración no entera"; verificar que fallan antes de implementar.
- [ ] 1.3 Crear primero el test de integración de "Nombre demasiado largo"; verificar que falla antes de implementar.
- [ ] 1.4 Crear primero los tests de integración de "Nombre duplicado en el mismo consultorio" y "Mismo nombre en otro consultorio"; verificar que fallan antes de implementar.
- [ ] 1.5 Crear primero la migración y sus tests de aplicación desde cero y reejecución; verificar que fallan antes de implementar.
- [ ] 1.6 Crear `db/migrations/040_prestaciones.sql` dentro del rango `040–049`, con tabla `prestacion`, FK a `consultorio`, unicidad `(consultorio_id, nombre)`, `duracion_min` entre 1 y 480, `activo` y timestamps; verificar aplicación desde cero y reejecución sin duplicados.
- [ ] 1.7 Implementar el repositorio de prestaciones con SQL parametrizado y filtro obligatorio por `consultorio_id`; verificar con los tests de aislamiento que un consultorio no lee ni modifica registros de otro.

## 2. Dominio, servicios y autorización

- [ ] 2.1 Implementar las validaciones de dominio para nombre de hasta 100 caracteres y `duracionMin` entero entre 1 y 480; ejecutar los tests de los escenarios de validación y confirmar respuestas 400 sin persistencia parcial.
- [ ] 2.2 Implementar servicios para crear, listar, editar, consultar por id y marcar `activo=false`, autorizando escritura solo para `ADMIN_CONSULTORIO` y lectura para los roles autenticados definidos por el contrato; verificar con tests los escenarios de roles no administrativos.
- [ ] 2.3 Implementar `obtenerPrestacionParaTurno(consultorioId, id)` con retorno `{ id, nombre, duracionMin, activo }` o `null`; verificar con tests los escenarios de prestación activa, inexistente/de otro consultorio e inactiva.

## 3. API pública y pruebas de escenarios

- [ ] 3.1 Implementar `GET /api/prestaciones`, `POST /api/prestaciones` y `PUT /api/prestaciones/{id}` respetando la forma de errores `{ error: { code, message } }`; verificar el escenario de alta válida y los DTOs.
- [ ] 3.2 Implementar y testear el listado ordenado, la inclusión de inactivas y el filtro `?activo=true`; cubrir los escenarios de listado ordenado, aislamiento y filtro de activas.
- [ ] 3.3 Implementar y testear el borrado lógico; cubrir que `activo=false` conserva la fila y no hace hard-delete.
- [ ] 3.4 Implementar y testear los escenarios de PUT con nombre duplicado (`409`), id de otro consultorio (`404`) y duración fuera de rango (`400`), además de edición válida (`200`).
- [ ] 3.5 Documentar y testear el contrato `obtenerPrestacionParaTurno(consultorioId, id)`, incluyendo que C05 no usa prestaciones inactivas para turnos nuevos.

## 4. Integración de la ola 1

- [ ] 4.1 Coordinar y montar las rutas de prestaciones en `src/app.js` sin sobrescribir rutas de C01/C02/C03; verificar que la app expone los tres endpoints bajo `/api/prestaciones`.
- [ ] 4.2 Actualizar coordinadamente `tests/esquema.test.js`, que pertenece a C00, para reflejar la migración 040 y la tabla `prestacion`; verificar `npm test` contra PostgreSQL real desde cero.
- [ ] 4.3 Ejecutar la verificación integrada `npm test` y comprobar cada escenario del spec —feliz, error de negocio y borde—, aislamiento tenant y contrato de C05, usando únicamente datos ficticios.

## Workflow follow-up

- Presentar los artifacts para aprobación del usuario antes de iniciar apply.
- No ejecutar apply, commit ni push hasta recibir aprobación explícita.
- Tras apply y verify, archivar el change mediante OPSX y comprobar el estado final.

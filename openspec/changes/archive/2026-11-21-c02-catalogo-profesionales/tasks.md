# Tasks

El comportamiento está definido en `specs/catalogo/spec.md` y las decisiones técnicas en `design.md`. Orden TDD: cada tarea empieza con su test en rojo, implementa lo mínimo y verifica en verde con `npm test -- <archivo>` (la suite completa corre con `npm test` contra PostgreSQL real). Todos los datos son ficticios (regla dura 1).

## 1. Migración y esquema (rango 020–029)

- [x] 1.1 Escribir en rojo `tests/catalogo-migracion.test.js` que afirme la existencia de `profesional` y `sillon_box` con sus columnas, las FKs a `consultorio(id)` y `usuario(id)`, el índice único parcial de `usuario_id` y los índices únicos de RN-TEN-03 (`consultorio_id`, `clave_unicidad(nombre)` y `clave_unicidad(email)` con `WHERE email IS NOT NULL`); crear `db/migrations/020_catalogo.sql` (autocontenida, forward-only, con la función `clave_unicidad()`, `DEFAULT gen_random_uuid()` y `creado_en timestamptz`) y verificar el test en verde, con `001_esquema_inicial.sql` intacto (`git diff` sin cambios en migraciones previas).
- [x] 1.2 Escribir en rojo los tests de comportamiento de unicidad contra la base real: "dr. juan perez" tras "Dr. Juan Pérez" y " JUAN@EXAMPLE.COM " tras `juan@example.com` violan la restricción; dos profesionales sin email y el mismo nombre en otro consultorio se insertan sin error; verificar en verde tras la migración (garantía del índice, sin pre-check en la aplicación).
- [x] 1.3 Verificar la migración aplicando el runner sobre una base vacía con todas las migraciones y sobre una base existente solo con la `001`, y que una segunda ejecución del runner es no-op sin perder datos.

## 2. Dominio compartido

- [x] 2.1 Escribir en rojo tests unitarios de `dominio.js` (sin I/O): `nombre`, `matricula` y `descripcion` recortados y vacíos → `NULL`; email recortado, en minúsculas y vacío → `NULL`; validación de UUID que lanza `ApiError` 400 `DATOS_INVALIDOS` ante identificadores malformados; implementar los helpers puros compartidos y verificar en verde.

## 3. Profesional: persistencia y alta

- [x] 3.1 Crear `tests/helpers/catalogo-fixtures.js` con consultorios y usuarios ficticios propios (UUIDs distintos por test) y limpieza ordenada y filtrada — primero `profesional`/`sillon_box`, luego `usuario` y `consultorio` — y verificar con un test de humo que crea y limpia sus fixtures sin tocar datos de otros consultorios.
- [x] 3.2 Escribir en rojo tests de repositorio de `profesional` contra PostgreSQL real (insertar y leer con `consultorio_id`, `activo` true, `usuario_id` nulo y `creado_en`; nunca devolver filas de otro consultorio); implementar `conexion.js` (pool perezoso sobre `DATABASE_URL`) y `profesional-repositorios.js` con SQL parametrizado y verificar en verde.
- [x] 3.3 Escribir en rojo tests del servicio de alta (nombre recortado, `activo` true, `usuarioId` nulo, `creadoEn` en UTC; nombre vacío o de espacios → `ApiError` 422 `DATOS_INVALIDOS` sin crear registro; matrícula y email vacíos → `NULL`); implementar `profesional-dominio.js` y `profesional-servicios.js` y verificar en verde.
- [x] 3.4 Escribir en rojo tests HTTP de `POST /api/profesionales` con supertest y `crearToken` (201 con la ficha completa; 403 `SIN_PERMISO` para `RECEPCION` y `ODONTOLOGO`; 401 `TOKEN_INVALIDO` sin token); implementar `profesional-rutas.js`, `rutas.js` e `index.js` con bloque de extensión marcado para C04, montar `app.use('/api', crearRouterCatalogo())` en `src/app.js` y verificar en verde.

## 4. Unicidad RN-TEN-03 de profesionales

- [x] 4.1 Escribir en rojo tests de duplicados en el alta: nombre repetido con distinta caja y tilde y email repetido con mayúsculas → 409 `RECURSO_DUPLICADO` sin crear registro; dos profesionales sin email → ambos 201; mismo nombre y email en otro consultorio → 201; implementar la traducción de la violación de restricción (`23505`) a `ApiError` 409 en los servicios y verificar en verde.

## 5. Sillones/boxes: persistencia y alta

- [x] 5.1 Escribir en rojo tests de repositorio y servicio de `sillon_box` (alta con nombre recortado y descripción opcional; descripción vacía → `NULL`; nombre vacío → 422 sin registro; aislamiento por consultorio); implementar `sillon-box-dominio.js`, `sillon-box-servicios.js` y `sillon-box-repositorios.js` y verificar en verde.
- [x] 5.2 Escribir en rojo tests HTTP de `POST /api/sillon-boxes` (201 con la ficha; 422 `DATOS_INVALIDOS` con nombre vacío; 409 `RECURSO_DUPLICADO` con "SILLÓN 1" tras "Sillón 1"; 201 con el mismo nombre en otro consultorio; 403 y 401 uniformes); implementar `sillon-box-rutas.js` y registrarlo en `rutas.js` y verificar en verde.

## 6. Catálogo activo y comprobaciones de existencia

- [x] 6.1 Escribir en rojo tests de `GET /api/catalogo` y de `obtenerCatalogo` (los tres roles autenticados acceden; solo activos, con la proyección mínima `id`+`nombre`+`matricula`/`descripcion`; consultorio vacío → arrays vacíos; sin token → 401 `TOKEN_INVALIDO`); implementar `catalogo-servicios.js` y la ruta en `rutas.js` y verificar en verde.
- [x] 6.2 Escribir en rojo tests de `existeProfesional` e `existeSillonBox` (recurso propio → `true` incluyendo inactivos; de otro consultorio o inexistente → `false`; UUID malformado → `ApiError` 400 `DATOS_INVALIDOS`; fallo de base inyectado → propagación al manejador central con 500 `ERROR_INTERNO`); implementar las comprobaciones e inyectar los repositorios siguiendo el patrón `crearApp({ chequearBase })` de C00 y verificar en verde.
- [x] 6.3 Documentar el contrato de `obtenerCatalogo`, `existeProfesional` e `existeSillonBox` (firmas, proyecciones, semántica de `existe*` sobre inactivos y ejemplos ficticios) en `src/modules/catalogo/README.md` y verificar que los ejemplos coinciden con los tests.

## 7. Actualización y baja lógica

- [x] 7.1 Escribir en rojo tests de `PUT /api/profesionales/:id` (200 con campos actualizados conservando los no enviados; `:id` malformado → 400 `DATOS_INVALIDOS`; inexistente o de otro consultorio → 404 `RECURSO_NO_ENCONTRADO` con el registro ajeno intacto; renombrar a nombre ocupado → 409 `RECURSO_DUPLICADO` con el registro sin cambios; 403 y 401 uniformes); implementar la actualización en `profesional-servicios.js`, `profesional-repositorios.js` y `profesional-rutas.js` y verificar en verde.
- [x] 7.2 Escribir en rojo tests de `PUT /api/sillon-boxes/:id` (mismos casos que 7.1, más baja lógica: `activo` false conserva el registro, lo excluye de `GET /api/catalogo`, sigue visible en el listado de gestión, y `activo` true lo devuelve al catálogo); implementar la actualización en `sillon-box-*` y verificar en verde.

## 8. Contrato de entrada de los cuerpos HTTP

- [x] 8.1 Escribir en rojo los tests de rechazo del contrato: `consultorioId` o `usuarioId` en el cuerpo → 422 `DATOS_INVALIDOS` sin escribir nada; tipos inválidos y campos desconocidos → 422; `PUT` sin campos → 422; email con mayúsculas y espacios se guarda recortado y en minúsculas; verificar los mismos rechazos en ambas entidades y en alta y actualización; implementar la validación estricta hecha a mano en la capa de rutas (sin dependencias nuevas en `package.json`) y verificar en verde.

## 9. Listados de gestión y autorización por rol

- [x] 9.1 Escribir en rojo tests de `GET /api/profesionales` y `GET /api/sillon-boxes` (admin ve activos e inactivos con `activo` y `usuarioId`; listado vacío → 200; `RECEPCION` y `ODONTOLOGO` → 403 `SIN_PERMISO`; sin token → 401 `TOKEN_INVALIDO`); implementar los listados en los servicios y rutas de cada entidad y verificar en verde.

## 10. Vinculación identidad–ficha (interfaz de módulo, para C01)

- [x] 10.1 Escribir en rojo tests de `vincularUsuario`, `desvincularUsuario` y `profesionalDeUsuario` según los escenarios del spec (vinculación y resolución inversa; vínculo permitido sin restricción de rol —RN-AU-02—; profesional de otro consultorio → `false` sin cambios; usuario ya vinculado a otra ficha → `ApiError` 409 `RECURSO_DUPLICADO` conservando el primer vínculo; desvinculación → `null` y el profesional sigue publicado; revinculación idempotente y profesional ya vinculado a otro usuario → 409); implementar en `profesional-servicios.js`/`profesional-repositorios.js` con el `UPDATE` condicional sin carrera y exportar desde `index.js`, y verificar en verde.
- [x] 10.2 Verificar que la vinculación no expone endpoints HTTP (solo interfaz de módulo) y que `catalogo` no consulta la tabla `usuario` (sin JOINs sobre ella en el código ni en el SQL); documentar el contrato para C01 en `src/modules/catalogo/README.md` y verificar que los ejemplos coinciden con los tests.

## 11. Aislamiento entre consultorios (RN-TEN-01, RN-TEN-02)

- [x] 11.1 Escribir en rojo los tests de aislamiento extremo a extremo con dos consultorios ficticios: operaciones de A solo devuelven datos de A; `PUT` con `:id` de B → 404 sin modificar B; `?consultorioId=B` y headers `x-tenant-*` se descartan operando siempre sobre A; `consultorioId` en el cuerpo → 422; catálogo y listados de A sin ningún dato de B; verificar en verde con `npm test -- tests/catalogo`.

## 12. Verificación integrada

- [x] 12.1 Ejecutar `npm test` completo y comprobar que todos los escenarios del spec pasan junto con los tests de C00 (`tests/esquema.test.js` incluido) contra PostgreSQL real y solo con datos ficticios.
- [x] 12.2 Verificar las migraciones en base vacía y en base con el esquema compartido ya aplicado, que los fixtures de C02 se limpian en orden (`profesional`/`sillon_box` → `usuario` → `consultorio`) sin `DELETE` globales, y que una segunda ejecución de la suite es estable.
- [x] 12.3 Revisar el diff completo: sin secretos (solo `.env.example`), sin cambios en `package.json`, `migrations.config.js`, `tests/setup/` ni en migraciones previas a `020`, y con las reglas duras del proyecto aplicadas; registrar la evidencia de verificación para el PR.

## Workflow follow-up

- Publicar el contrato de la interfaz pública a los equipos de C05 (`obtenerCatalogo`, `existeProfesional`, `existeSillonBox`) y de C01 (`vincularUsuario`, `desvincularUsuario`, `profesionalDeUsuario`) al cerrar los grupos 6 y 10, y confirmar con el líder de C05 la semántica de `existe*` sobre recursos inactivos (design.md, decisión 8).
- Solicitar revisión del PR con `npm test` en verde y al menos una aprobación (regla dura 6). No commitear ni push sin pedido explícito del usuario (regla dura 8).
- Archivar el change con `openspec-archive-change` cuando se cumplan los requisitos de revisión del proyecto.

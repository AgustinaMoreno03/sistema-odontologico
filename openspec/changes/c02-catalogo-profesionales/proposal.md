# Proposal

## Why

El consultorio necesita registrar y consultar sus recursos —profesionales y sillones/boxes— para que C05 pueda crear turnos sin solapamientos: antes de reservar, el sistema debe resolver un profesional y un sillón/box válidos dentro del tenant (US-005, knowledge-base/06). Sin este catálogo, la ola 1 no puede entregar la reserva de turnos.

## What Changes

- Módulo `catalogo` con alta, consulta, actualización y baja lógica de las entidades `Profesional` y `SillonBox`, siempre dentro del consultorio autenticado (RN-TEN-01, RN-TEN-02).
- Migración SQL propia en el rango reservado 020–029 que crea las tablas `profesional` y `sillon_box`, con `consultorio_id` como clave foránea a `consultorio(id)` y unicidades acotadas al consultorio (RN-TEN-03): nombre único por consultorio en ambas entidades y email único por consultorio en `profesional`.
- Interfaz pública del módulo para C05: catálogo activo del consultorio (`obtenerCatalogo`) y comprobaciones `existeProfesional` / `existeSillonBox`, acotadas al consultorio del contexto autenticado.
- Vinculación 1:1 opcional entre `Profesional` y `Usuario` mediante `vincularUsuario`, `desvincularUsuario` y `profesionalDeUsuario`: la columna vive en la tabla propia, `catalogo` no lee la tabla `usuario` (DD-13) y la validación de pertenencia del usuario queda en el módulo dueño de `usuario` (C01). Resuelve así el riesgo de acoplamiento con C01 y el acuerdo pedido en C01 sobre "cómo se vincula una identidad con una ficha profesional".
- Permisos según knowledge-base/03: altas y actualizaciones solo para `ADMIN_CONSULTORIO`; listados de gestión solo admin; lectura del catálogo activo para los tres roles.
- Endpoints nuevos: `GET /api/catalogo`, `GET|POST /api/profesionales`, `PUT /api/profesionales/{id}`, `GET|POST /api/sillon-boxes`, `PUT /api/sillon-boxes/{id}`.
- Pruebas de integración contra PostgreSQL real con datos ficticios, incluyendo aislamiento entre consultorios.

## Capabilities

### New Capabilities

- `catalogo`: gestión del catálogo de recursos del consultorio (profesionales y sillones/boxes) con aislamiento por tenant, y la interfaz pública que consumen turnos (C05), usuarios (C01) y la agenda.

### Modified Capabilities

## Impact

- **Código**: `src/modules/catalogo/` (rutas, servicios, dominio, repositorios e `index.js` con la interfaz pública) y el montaje del router en `src/app.js` — archivo compartido con C03, se coordina el bloque de montaje.
- **Esquema**: `db/migrations/020_*.sql` (rango 020–029 de C02). Tablas propias; referencias a `consultorio(id)` y `usuario(id)` sin leer ni modificar esas tablas. No se edita `001_esquema_inicial.sql` (regla dura 9).
- **API**: endpoints nuevos bajo `/api/` con la forma de error única `{ error: { code, message } }` y el middleware de autenticación de C00. Sin cambios en `auth`, `consultorios`, `pacientes` ni `turnos`.
- **Configuración**: sin cambios en `package.json`, `migrations.config.js` ni `tests/setup/` (responsabilidad de C00). `tests/esquema.test.js` ya tolera migraciones de C01–C08 (verificado por lectura).
- **Consumidores**: C05 recibe las comprobaciones y el catálogo activo; C01 recibe el contrato de vinculación; C09 (frontend) consume `GET /api/catalogo`.
- **Tests**: nuevos `tests/catalogo*.test.js` con fixtures ficticios propios y limpieza ordenada (primero `profesional`/`sillon_box`, luego `usuario` y `consultorio` del fixture).

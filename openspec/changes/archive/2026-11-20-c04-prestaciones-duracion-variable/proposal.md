# Proposal

## Why

C04 incorpora al catálogo del consultorio las prestaciones que determinan la duración de los turnos. C05 necesita una interfaz estable para consultar esa duración y calcular `horaFin` sin duplicar reglas ni aceptar datos de otro consultorio.

## What Changes

- Crear la capacidad de catálogo de prestaciones multi-tenant.
- Crear la entidad `Prestacion` con `duracionMin` positiva, límite máximo de 480 minutos y nombre de hasta 100 caracteres.
- Crear la migración SQL de C04 dentro del rango reservado `040–049`.
- Exponer `GET /api/prestaciones`, `POST /api/prestaciones` y `PUT /api/prestaciones/{id}`.
- Permitir crear y editar únicamente a `ADMIN_CONSULTORIO`; `RECEPCION` y `ODONTOLOGO` solo pueden leer.
- Implementar borrado lógico mediante `activo=false`, sin hard-delete.
- Ordenar el listado por nombre.
- Publicar el contrato de lectura que C05 usará para obtener `duracionMin` dentro del consultorio autenticado.
- Mantener fuera de alcance el seed de prestaciones de ejemplo.

## Capabilities

### New Capabilities

- `prestaciones`: catálogo multi-tenant de prestaciones con duración variable, CRUD controlado por rol y contrato de consulta para agenda/turnos.

### Modified Capabilities

- _(Ninguna.)_

## Impact

- Código nuevo en `src/modules/catalogo/` para rutas, servicios, dominio y repositorios de prestaciones.
- Nueva migración en `db/migrations/040_*.sql`; no se usarán prefijos fuera de `040–049`.
- Tests de integración con PostgreSQL real y fixtures ficticios.
- Posible coordinación para montar rutas en `src/app.js`, archivo compartido de la ola 1.
- `tests/esquema.test.js` pertenece a C00 y actualmente asume solo las tablas iniciales y la migración `001`; el apply deberá actualizarlo o coordinar explícitamente ese cambio al incorporar `040`.
- El módulo `catalogo` es compartido con C02; C04 no debe modificar archivos de profesionales ni sillones/boxes.
- No se prevén dependencias nuevas: el proyecto ya cuenta con Express, `pg`, Vitest y Supertest.

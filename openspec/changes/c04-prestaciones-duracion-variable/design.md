# Design

## Context

C04 agrega prestaciones al módulo `catalogo` existente como carpeta vacía. El backend usa Express 5 en JavaScript, PostgreSQL 18 y capas `rutas → servicios → dominio → repositorios`. C00 ya publica autenticación, errores centralizados y migraciones SQL forward-only. El contrato detallado está en `specs/prestaciones/spec.md`.

## Goals / Non-Goals

**Goals:**

- Crear la tabla `prestacion` en una migración del rango `040–049`; no se usarán migraciones fuera de ese rango.
- Mantener aislamiento por `consultorio_id`, unicidad compuesta por consultorio y validaciones de duración/nombre.
- Exponer el CRUD acordado y el contrato de lectura consumible por C05.
- Mantener la duración materializada en los turnos futuros sin reescribir turnos existentes.

**Non-Goals:**

- Seed de prestaciones de ejemplo.
- Implementación de profesionales, sillones/boxes o turnos.
- Hard-delete de prestaciones.
- Historia clínica, cobros o integraciones externas.

## Decisions

### D1 — Separación del módulo compartido

C04 agregará archivos exclusivos de prestaciones dentro de `src/modules/catalogo/prestaciones/`, sin editar archivos de profesionales ni sillones/boxes de C02. La ruta pública será `/api/prestaciones`. En `src/app.js` solo se agregará una línea de import y una línea de `app.use`, ambas en orden alfabético y antes del manejador de errores. No se modificarán `tests/setup` ni `tests/helpers`.

### D2 — Modelo y migración

La migración `040_prestaciones.sql` creará `prestacion` con `id`, `consultorio_id`, `nombre`, `duracion_min`, `descripcion`, `activo` y `creado_en`, FK a `consultorio`, restricción de `duracion_min` entero `BETWEEN 1 AND 480` inclusive y unicidad `(consultorio_id, nombre)`. Será forward-only y no modificará `001` ni migraciones de otros changes.

### D3 — Contrato HTTP y de módulo

La API expondrá `GET /api/prestaciones`, `POST /api/prestaciones` y `PUT /api/prestaciones/{id}`. Las rutas solo parsearán/validarán HTTP; servicios autorizarán el rol y coordinarán casos de uso; dominio aplicará invariantes; repositorios usarán SQL parametrizado y siempre filtrarán por `consultorio_id`.

El contrato de catálogo que C05 consumirá seguirá la convención de C03: `obtenerPrestacionParaTurno({ prestacionId, consultorioId })` devuelve `Promise<{ id, nombre, duracionMin, activo } | null>`. Devuelve `null` para una prestación inexistente, ajena al consultorio o inactiva; C05 solo debe chequear `null`. El fin del turno se calculará al crear el turno; cambiar luego la prestación no actualizará turnos existentes.

### D4 — Supuestos funcionales explicitados

Los siguientes son **supuestos de C04**, no reglas tomadas de la KB, salvo donde se cita expresamente:

- `knowledge-base/03_actores_y_roles.md` establece que `ADMIN_CONSULTORIO` administra el catálogo; por eso solo ese rol crea y edita prestaciones.
- `RECEPCION` y `ODONTOLOGO` solo leen prestaciones; la KB no lo declara explícitamente y se mantiene como supuesto de C04.
- El borrado es lógico mediante `activo=false`; no existe hard-delete.
- `nombre` admite como máximo 100 caracteres y `duracionMin` es un entero entre 1 y 480 minutos inclusive.
- El listado se ordena ascendentemente por `nombre`.
- El seed de prestaciones de ejemplo queda fuera de C04.

La nota sobre la duración histórica forma parte del contrato de C05, no de los requisitos verificables de C04: cambiar `duracionMin` no reescribe turnos ya creados; el nuevo valor se utiliza únicamente al crear turnos posteriores.

### D5 — Compatibilidad con tests y archivos compartidos

La migración nueva puede requerir coordinar la actualización del assertion histórico de `tests/esquema.test.js` de C00. Durante apply se deberá coordinarlo junto con el montaje acotado en `src/app.js`, sin modificar `tests/setup` ni `tests/helpers`.

## Risks / Trade-offs

- **[Riesgo]** C02 también trabaja en `catalogo` → **Mitigación:** archivos separados por entidad y coordinación antes de tocar archivos compartidos.
- **[Riesgo]** `tests/esquema.test.js` espera solo C00 → **Mitigación:** ajustar el test de forma coordinada para aceptar el esquema acumulado.
- **[Riesgo]** Un `PUT` que marque `activo=false` podría ser confundido con eliminación física → **Mitigación:** conservar siempre la fila y verificarlo en integración.
- **[Riesgo]** El contrato de duración se desacople de C05 → **Mitigación:** congelar en el spec los campos, aislamiento y comportamiento de no encontrado antes de apply.

## Migration Plan

Aplicar una migración `040–049` de prestaciones después del esquema compartido de C00 y sobre una base vacía y una base con el último esquema integrado. Verificar la secuencia con `npm test` durante apply/verify. No habrá rollback destructivo ni edición de migraciones aplicadas; cualquier corrección será una nueva migración dentro del rango `040–049`.

## Open Questions

- La coordinación de quién es dueño de editar `src/app.js` y `tests/esquema.test.js` durante la ola 1 debe resolverse antes de apply.

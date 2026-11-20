# Design

## Context

C04 agrega prestaciones al módulo `catalogo` existente como carpeta vacía. El backend usa Express 5 en JavaScript, PostgreSQL 18 y capas `rutas → servicios → dominio → repositorios`. C00 ya publica autenticación, errores centralizados y migraciones SQL forward-only. El contrato detallado está en `specs/prestaciones/spec.md`.

## Goals / Non-Goals

**Goals:**

- Crear la tabla `prestacion` en una migración del rango `040–049`.
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

C04 agregará archivos exclusivos de prestaciones dentro de `src/modules/catalogo/`, sin editar archivos de profesionales ni sillones/boxes de C02. La ruta pública será `/api/prestaciones`. Si el montaje de routers requiere editar `src/app.js`, se coordinará porque es un archivo compartido de la ola 1.

### D2 — Modelo y migración

La migración `040_prestaciones.sql` creará `prestacion` con `id`, `consultorio_id`, `nombre`, `duracion_min`, `descripcion`, `activo` y `creado_en`, FK a `consultorio`, restricción `duracion_min BETWEEN 1 AND 480` y unicidad `(consultorio_id, nombre)`. Será forward-only y no modificará `001` ni migraciones de otros changes.

### D3 — Contrato HTTP y de módulo

La API expondrá `GET /api/prestaciones`, `POST /api/prestaciones` y `PUT /api/prestaciones/{id}`. Las rutas solo parsearán/validarán HTTP; servicios autorizarán el rol y coordinarán casos de uso; dominio aplicará invariantes; repositorios usarán SQL parametrizado y siempre filtrarán por `consultorio_id`.

El contrato de catálogo que C05 consumirá será una consulta por `(consultorioId, prestacionId)` que devuelve la prestación del tenant y su `duracionMin`, o no encontrado. El fin del turno se calculará al crear el turno; cambiar luego la prestación no actualizará turnos existentes.

### D4 — Supuestos funcionales explicitados

Los siguientes son **supuestos de C04**, no reglas tomadas de la KB:

- Solo `ADMIN_CONSULTORIO` crea y edita prestaciones; `RECEPCION` y `ODONTOLOGO` solo leen.
- El borrado es lógico mediante `activo=false`; no existe hard-delete.
- `nombre` admite como máximo 100 caracteres y `duracionMin` como máximo 480 minutos.
- El listado se ordena ascendentemente por `nombre`.
- El seed de prestaciones de ejemplo queda fuera de C04.

La nota sobre la duración histórica forma parte del contrato de C05, no de los requisitos verificables de C04: cambiar `duracionMin` no reescribe turnos ya creados; el nuevo valor se utiliza únicamente al crear turnos posteriores.

### D5 — Compatibilidad con tests y archivos compartidos

La migración nueva hará que el assertion histórico de `tests/esquema.test.js` de C00 quede desactualizado. Durante apply se deberá coordinar su actualización, junto con el montaje en `src/app.js`, sin ocultar que son archivos de otro change.

## Risks / Trade-offs

- **[Riesgo]** C02 también trabaja en `catalogo` → **Mitigación:** archivos separados por entidad y coordinación antes de tocar archivos compartidos.
- **[Riesgo]** `tests/esquema.test.js` espera solo C00 → **Mitigación:** ajustar el test de forma coordinada para aceptar el esquema acumulado.
- **[Riesgo]** Un `PUT` que marque `activo=false` podría ser confundido con eliminación física → **Mitigación:** conservar siempre la fila y verificarlo en integración.
- **[Riesgo]** El contrato de duración se desacople de C05 → **Mitigación:** congelar en el spec los campos, aislamiento y comportamiento de no encontrado antes de apply.

## Migration Plan

Aplicar `040_prestaciones.sql` después del esquema compartido de C00 y sobre una base vacía y una base con el último esquema integrado. Verificar la secuencia con `npm test`. No habrá rollback destructivo ni edición de migraciones aplicadas; cualquier corrección será una nueva migración dentro del rango disponible.

## Open Questions

- La coordinación de quién es dueño de editar `src/app.js` y `tests/esquema.test.js` durante la ola 1 debe resolverse antes de apply.

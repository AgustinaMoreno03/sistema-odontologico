# Design

## Context

Ver `proposal.md` (Why). Contexto acotado a lo necesario:

- El router de turnos es nuevo; monta `middlewareAutenticacion` de C00 él mismo (precedente: `catalogo/rutas.js:36`, `prestaciones/rutas.js:66`). El consultorio sale de `req.auth.consultorioId`, nunca del cliente (regla dura 2). C01 (login) no es requerido: los tests firman sus JWT con `tests/helpers/tokens.js`.
- Interfaces consumidas sin tocar sus módulos (regla dura 10): `existeProfesional` (`catalogo/profesional-servicios.js:57`), `existeSillonBox` (`sillon-box-servicios.js:53`), `obtenerCatalogo` (`catalogo-servicios.js:19`) desde `catalogo/index.js`; `obtenerPrestacionParaTurno` (`catalogo/prestaciones/servicios.js:66`); `existePaciente` (C03, contrato en `c03-pacientes/design.md` §7).
- `existe*` devuelve `true`/`false` también para recursos inactivos y lanza `ApiError` 400 `DATOS_INVALIDOS` con UUID malformado; `obtenerCatalogo()` publica solo recursos **activos**; `obtenerPrestacionParaTurno` devuelve `null` si la prestación no existe, es ajena o inactiva.
- `db/migrations/` hoy tiene `001`, `020`, `040`; C03 reserva el rango 030 y creará la tabla `paciente`; C05 toma el rango **050–059**. El runner exige orden ascendente y prohíbe editar migraciones mergeadas (regla dura 9).
- Errores: `ApiError(statusCode, code, message)` + manejador central (`src/errores.js`); traducción de SQLSTATE a 409 ya tiene precedente (`traducirViolacionUnica`, `23505`).

## Goals / Non-Goals

**Goals:**

- Un único endpoint `POST /api/turnos` que cumpla RN-AG-01, RN-AG-02, RN-AG-05, RN-AG-06 y RN-AG-07 con garantía en la base ante concurrencia (regla dura 4).
- Contrato de errores estable: 409 `SOLAPAMIENTO`, 400 `VALIDACION`, 422 `REFERENCIA_INVALIDA` (indicando el campo fallido).
- Publicar desde el inicio la interfaz de validación que C07 reutilizará (`CHANGES.md:172`), sin copiarla.

**Non-Goals:**

- Cancelar turnos ni transiciones de estado (C06); reprogramar (C07); listar agenda; bloqueos y `AgendaSlot`; auto-reserva.
- Flag "profesional habilitado para operar sin recepción": hoy solo `RECEPCION` y `ADMIN_CONSULTORIO` crean turnos; `ODONTOLOGO` recibe 403.
- Login/usuarios (C01), ficha de paciente (C03), editar catálogo (C02/C04).

## Decisions

### D1. Restricciones de exclusión con `EXCLUDE USING gist` (elegido sobre FOR UPDATE / SERIALIZABLE / advisory locks)

Migración 050 ejecuta `CREATE EXTENSION IF NOT EXISTS btree_gist` y crea **tres** restricciones de exclusión parciales sobre la tabla nueva `turno`, todas con `WHERE (estado <> 'CANCELADO')`:

```sql
ALTER TABLE turno ADD CONSTRAINT turno_paciente_sin_solape
  EXCLUDE USING gist (consultorio_id WITH =, paciente_id WITH =, (tstzrange(inicio, fin)) WITH &&)
  WHERE (estado <> 'CANCELADO');
-- análogas: turno_profesional_sin_solape y turno_sillon_box_sin_solape
```

- `tstzrange(inicio, fin)` usa el default `[)` = RN-AG-06: los contiguos no solapan (escenario S4) sin lógica extra.
- El `WHERE` parcial permite que un turno `CANCELADO` no bloquee (RN-AG-08, ya previsto aunque C06 venga después).
- **Transacción única**: la verificación de pertenencia/activitud y el INSERT corren en una sola transacción; el pre-check SELECT dentro de esa transacción da mensajes detallados y el INSERT es la garantía final. Si el índice detecta conflicto, SQLSTATE **`23P01`** (`exclusion_violation`) → `ApiError(409, 'SOLAPAMIENTO', ...)` vía un traductor propio en el dominio de turnos (precedente: `traducirViolacionUnica` de `catalogo` para `23505`).
- Predicado del pre-check en `repositorio.js` (`inicio < finNuevo AND fin > inicioNuevo`; en SQL: `inicio < $4 AND fin > $3` con `$3 = inicio`, `$4 = fin`): **verificado por predicado y parámetros, no por texto literal** — origen del texto: commit `baa1ced` (2026-11-22, AgustinaMoreno03).
- **Reintento ante deadlock (S6, agregado en Apply)**: si el INSERT muere con `40P01` (`deadlock_detected`) por una carrera concurrente, se reintenta la transacción completa (**máximo 2 intentos**); tras el rollback, el pre-check del segundo intento ve al ganador y responde 409 con mensaje detallado, y si el segundo intento también diera `40P01` el traductor lo convierte en **409 `SOLAPAMIENTO`** — nunca 500 por esta causa.
- Alternativas descartadas: (a) check-then-insert en READ COMMITTED no sobrevive a la concurrencia (rompe S6); (b) SERIALIZABLE exige bucles de reintento con `40001`/`40P01` y comportamiento no determinístico; (c) `FOR UPDATE` necesita orden determinista de locks para evitar deadlock y serializa toda la agenda del recurso; (d) advisory locks no son garantía en la base. `EXCLUDE` es la única opción con garantía en PostgreSQL sin reintento ni riesgo de deadlock, y `CHANGES.md:152` pide evaluarla.
- **Verificar en Apply**: que la opclass `uuid` de `btree_gist` funcione en la base del proyecto (documentada, no ejecutada en Explore) — INSERT de prueba que choque debe fallar con `23P01`.

### D2. Contenido de la migración 050 (rango 050–059, orden 030 < 050)

- Tabla `turno`: `id uuid PK`, `consultorio_id NOT NULL` (FK → consultorio), `paciente_id NOT NULL` (FK → `paciente(id)`, **en la 050** y condicionada a que la 030 de C03 exista), `profesional_id NOT NULL` (FK → profesional), `sillon_box_id NOT NULL` (**obligatorio en el alta**, decisión de usuaria; FK → sillón/box), `prestacion_id NOT NULL` (FK → prestación), `inicio timestamptz NOT NULL`, `fin timestamptz NOT NULL`, `duracion_min INTEGER NOT NULL` (la duración usada al crearse: editar la prestación después no altera turnos agendados), `estado TEXT NOT NULL DEFAULT 'PENDIENTE'` con `CHECK (estado IN ('PENDIENTE','CONFIRMADO','ATENDIDO','AUSENTE','CANCELADO'))` (los cinco valores de RN-AG-10), `creado_en`/`cancelado_en` (las FKs a las tablas de otros módulos solo se declaran desde 050, sin modificar esas tablas — regla dura 10).
- `CHECK (fin > inicio)`: un rango vacío (`fin = inicio`) no solapa con nada y evadiría las restricciones de exclusión.
- **La FK a `paciente(id)` va en la 050** y C05 se implementa **después de que C03 esté en main** (la 030 debe existir antes: orden ascendente del runner y regla dura 10 — un módulo no crea tablas de otro). Sin stub de producción, sin import dinámico.
- Índices según `knowledge-base/04_modelo_de_datos.md:112`: (`consultorio_id`, `profesional_id`, `inicio`), (`consultorio_id`, `sillon_box_id`, `inicio`), (`consultorio_id`, `paciente_id`, `inicio`), `consultorio_id`; los GiST de exclusión cubren el conflicto.
- Nada de migraciones existentes editadas; `CREATE EXTENSION` con un solo responsable (precedente `unaccent`/C03) — se documenta en la cabecera de 050.

### D3. Consumo de `existePaciente` (C03) por inyección

- El servicio de turnos recibe `{ existePaciente }` entre sus `deps` inyectables (mismo patrón que `repoDe(deps)` en `profesional-servicios.js`); el default en producción es un import estático a `../pacientes/index.js` cuando C03 esté en main (condición previa al apply — ver D2).
- **En tests se inyecta `existePaciente` por `deps`**: fakes para `true`, `false` y el lanzamiento `ApiError(400, 'VALIDACION', ...)` del contrato §7; fixtures reales con datos ficticios cuando C03 aterrice. No se escribe `src/modules/pacientes/` desde C05 (esa ruta es de C03).

### D4. Import de `obtenerPrestacionParaTurno` directo del archivo de servicios

`import { obtenerPrestacionParaTurno } from '../catalogo/prestaciones/servicios.js'` — precedente: `src/app.js:3` importa rutas de `prestaciones` sin pasar por `index.js`. **No se toca `catalogo/index.js`** (el bloque comentado C04 sigue siendo responsabilidad de su dueño). `obtenerCatalogo`, `existeProfesional` y `existeSillonBox` sí se importan desde `catalogo/index.js` (ese export ya existe).

### D5. Contrato HTTP del endpoint y errores

- `POST /api/turnos`, body `{ pacienteId, profesionalId, sillonBoxId, prestacionId, inicio }` con `inicio` en ISO 8601 con timezone explícito o UTC; `consultorioId` jamás se acepta del cliente (regla dura 2). Respuesta 201 con el turno creado (DTO con `id`, recursos, `inicio`, `fin`, `duracionMin`, `estado`, `creadoEn`).
- Roles: `RECEPCION` y `ADMIN_CONSULTORIO` crean; `ODONTOLOGO` → 403 `SIN_PERMISO` (guardia local en el router, precedente `requerirAdmin` de `catalogo/rutas.js:19`; si C01 publica permisos centralizados, se reemplaza en un change posterior).
- Errores: solapamiento → **409 `SOLAPAMIENTO`**; UUID malformado o `inicio` sin timezone ISO 8601 → **400 `VALIDACION`**; paciente/profesional/sillón/prestación **inexistente, ajeno o inactivo → 422 `REFERENCIA_INVALIDA` indicando el campo fallido (`pacienteId`, `profesionalId`, `sillonBoxId`, `prestacionId`), con un mensaje por campo** (mismo mensaje para inexistente/ajeno/inactivo dentro de cada campo; **no** uno único para los cuatro recursos). Recursos activos exigidos vía `obtenerCatalogo()` (instrucción del README de catalogo), distinguiendo de `existe*` (solo pertenencia). *Esto RESUELVE el supuesto S1 registrado antes (mensaje único para los cuatro recursos): la usuaria dictó contrato por campo (2026-11-22).*
- Orden de validación en el servicio: formato UUID e `inicio` ISO 8601 con timezone explícito o UTC (400) → pertenencia/activitud de los cuatro recursos (422, indicando el campo fallido) → transacción con validación de solapamiento + INSERT (409 vía `23P01`).

### D6. Capas (DD-13) e interfaz reutilizable para C07

- Rutas (parseo/validación HTTP únicamente) → servicios (caso de uso, orquesta deps) → dominio (reglas: cálculo de `fin`, traducción `23P01`→409, validadores) → repositorio (SQL parametrizado, sargable, sin lógica de negocio). Sin SQL ni reglas en rutas.
- La validación de solapamiento vive en el servicio/dominio de `turnos` detrás de una función exportable (p. ej. `crearTurno(deps)` + la comprobación interna reutilizable), de modo que C07 (reprogramar) la consuma reusando la interfaz de C05, no una copia (`CHANGES.md:172`).

### D7. Estrategia de pruebas (Apply; no se escriben tests ahora)

- Gate `npm test` (vitest) contra PostgreSQL real; TDD rojo→verde→triangulación.
- Los 10 escenarios del spec como tests de integración HTTP con router montado con `middlewareAutenticacion` real y tokens de `tests/helpers/tokens.js`; fixtures ficticias con `randomUUID()` por test y limpieza por FK ordenada (patrón `tests/helpers/catalogo-fixtures.js`); aislamiento entre consultorios obligatorio (S7), concurrencia real con dos requests en paralelo (S6) y guardia de rol con 403 (S10).
- Pruebas de errores (400/403/409/422, incluido el 422 por campo) y del traductor `23P01` en dominio; inyección de `existePaciente` por `deps` (D3).

## Risks / Trade-offs

- [Opclass `uuid` de `btree_gist` documentada pero no ejecutada] → verificación en Apply con un INSERT que choque; si falla, se evalúa `int8`/`text` o Plan B `FOR UPDATE` antes de mergear.
- [`CREATE EXTENSION btree_gist` en Neon requiere privilegios] → verificar en Apply con la cadena Neon; local ya confirmado (`postgres:18`, extensión 1.8 disponible). Un solo dueño de la extensión (cabecera de 050).
- [Bloqueo por C03: sin tabla `paciente` no hay FK ni `existePaciente`] → apply condicionado a C03 en main; la propuesta se crea ahora (D2/D3).
- [Resuelto: el 422 ya no oculta el campo] → el contrato ahora indica el campo fallido (`pacienteId`/`profesionalId`/`sillonBoxId`/`prestacionId`) con un mensaje por campo; decisión de la usuaria (2026-11-22) que cierra el antiguo supuesto S1. Sin riesgo residual en este punto.
- [Primer import cruzado `turnos`→`catalogo` en producción] → los contratos ya están probados desde dentro de `catalogo`; S8 los ejercita de punta a punta.
- [Overhead de índice GiST por INSERT] → despreciable a volumen MVP; protege toda escritura porque toda pasa por el servicio.
- [Overlap de archivos con C06/C07 en `src/modules/turnos/`] → separar responsabilidades por archivo desde el inicio; coordinar con los responsables al momento de aplicar.

## Migration Plan

1. Merge de C03 a `main` (bloqueante: 030 antes que 050 y tabla `paciente` + `existePaciente` publicados).
2. Apply de C05: crear `db/migrations/050_turno.sql`, correr el runner sobre base vacía y sobre base existente, verificar la opclass `uuid` (D1) y la traducción `23P01` con un INSERT de prueba.
3. Rollback: forward-only (regla del proyecto); ante problema, corrección en una migración nueva del rango 050–059, nunca editando 050 mergeada.
4. Merge a `main` solo con `npm test` en verde y revisión (regla dura 6).

## Open Questions

- Ninguna abierta: el único punto pendiente (supuesto S1, mensaje único de 422 para los cuatro recursos) fue resuelto por la usuaria — ahora el 422 indica el campo fallido, un mensaje por campo (mismo para inexistente/ajeno/inactivo dentro de cada campo).

# Módulo turnos

Alta de turnos (`POST /api/turnos`) y reprogramación (`PATCH
/api/turnos/:id/reprogramar`) en el consultorio autenticado, sin
solapamientos por paciente, profesional ni sillón/box. Spec vigente:
`openspec/specs/turnos/spec.md` (changes `c05-crear-turno-sin-solapamientos`,
`c06-cancelar-turno-liberar-horario` y `c07-reprogramar-turno`).

## Interfaz pública

### `crearTurno(parametros, deps = {})` — `src/modules/turnos/servicios.js`

Caso de uso completo (R1–R7): valida formato → pertenencia/activitud de los
recursos → transacción de solapamiento. Es la interfaz que **C07
reutilizó** (reprogramar) en lugar de copiarla (`CHANGES.md:172`).

```js
crearTurno(
  { pacienteId, profesionalId, sillonBoxId, prestacionId, inicio, consultorioId },
  deps = {}
) → Promise<turno>
```

- `consultorioId` **siempre desde el token** (regla dura 2): nunca del
  body, la query ni un header del cliente.
- `inicio`: ISO 8601 con zona horaria explícita o UTC.
- `sillonBoxId` es **obligatorio** en el alta.
- Devuelve el turno creado mapeado:
  `{ id, consultorioId, pacienteId, profesionalId, sillonBoxId, prestacionId,
     inicio, fin, duracionMin, estado, creadoEn, reprogramadoEn, reprogramadoPor }`
  con `estado: 'PENDIENTE'` y la auditoría en `null` hasta la primera
  reprogramación. La capa HTTP responde 201 con el DTO **sin**
  `consultorioId` (design D5).
- `fin = inicio + duracionMin` con la duración usada al crearse (RN-AG-07);
  intervalos `[inicio, fin)` en `timestamptz` UTC (RN-AG-06).

### `reprogramarTurno(parametros)` — `src/modules/turnos/servicios.js` (C07)

Caso de uso de reprogramación (RN-AG-09): cambia el `inicio` de un turno
`PENDIENTE` revalidando TODAS las reglas de solapamiento sobre el nuevo
rango, excluyendo el turno que se mueve.

```js
reprogramarTurno(
  { turnoId, inicio, consultorioId, usuarioId }
) → Promise<turno>   // el turno actualizado, con la auditoría seteada
```

- `consultorioId` y `usuarioId` **siempre desde el token** (regla dura 2);
  `usuarioId` es el que queda en `reprogramado_por` (FK de la 070).
- `inicio`: ISO 8601 con zona horaria explícita o UTC; `turnoId`: UUID.
- `fin = inicio + duracion_min` con la duración **congelada al crearse** el
  turno (RN-AG-07), `[)` UTC (RN-AG-06).
- Orden de errores: **400 `VALIDACION` → 403 `SIN_PERMISO` (guardia de la
  ruta) → 404 `TURNO_NO_ENCONTRADO` → 409 `ESTADO_INVALIDO` → 409
  `SOLAPAMIENTO`** (design D4).
- Si la operación falla en cualquier paso, el `ROLLBACK` **conserva el
  horario anterior** y no audita (RN-AG-09): solo el `UPDATE` exitoso
  setea `reprogramado_en = now()` y `reprogramado_por`.

```js
// Ejemplo (producción: la ruta resuelve los ids del token)
const turno = await reprogramarTurno({
  turnoId: req.params.id,
  inicio: req.body.inicio,
  consultorioId: req.auth.consultorioId,
  usuarioId: req.auth.usuarioId,
});
```

> **Fixture de tests (design D5):** `reprogramado_por` tiene FK a
> `usuario(id)`; en producción lo garantiza el login (C01), pero en los
> tests el fixture DEBE insertar un `usuario` ficticio y firmar el token
> con ese id — `tests/helpers/turnos-fixtures.js` ya lo hace
> (`fixture.usuarioId`), si no la operación falla con `23503`.

### Comprobación de solapamiento (reutilizable por C07)

Vive en el servicio + repositorio (`crearRepositorioTurnos().crearTurno` y
`.reprogramarTurno`): **una única transacción** con pre-check SELECT
(mensajes detallados por recurso) e INSERT/UPDATE; una **sola copia del
SQL** del pre-check, en el helper interno `precheckSolapamiento` de
`repositorio.js`, parametrizado por `excluirTurnoId` (la reprogramación
agrega `AND id <> $turnoId` para no auto-conflictar — D1). El índice de
exclusión de la migración 050 es la garantía final ante concurrencia
(`23P01` → 409 traducido en el repositorio, Decisión 1).

**Reintento ante deadlock (`40P01`)**: si dos operaciones concurrentes se
bloquean mutuamente, se reintenta la transacción completa (**máximo 2
intentos**) y, si el segundo intento también diera `40P01`, se traduce a
**409 `SOLAPAMIENTO`** — nunca 500 por esta causa.

**Reprogramación con `FOR UPDATE` (design D2):** `BEGIN` → `SELECT … FROM
turno WHERE id = $1 AND consultorio_id = $2 FOR UPDATE` (sin fila → 404) →
callback del servicio bajo el lock (estado `PENDIENTE` → si no, 409
`ESTADO_INVALIDO`) → pre-check con `excluirTurnoId` → `UPDATE` con
auditoría → `COMMIT`. Un `ApiError` del callback hace `ROLLBACK` y se
propaga tal cual.

### `cancelarTurno(parametros)` — `src/modules/turnos/servicios.js` (C06)

```js
cancelarTurno({ turnoId, consultorioId, usuarioId, solicitadoPor }) → Promise<turno>
```

- `consultorioId` y `usuarioId` se derivan exclusivamente del token;
  `solicitadoPor` acepta `PACIENTE` o `CONSULTORIO`.
- Solo cancela turnos futuros `PENDIENTE` o `CONFIRMADO`. La operación toma
  `FOR UPDATE`, evalúa estado e inicio usando el reloj UTC de PostgreSQL y
  actualiza estado y auditoría (`cancelado_en`, `cancelado_por`,
  `solicitado_por`) en una transacción.
- Errores: 400 `VALIDACION`, 404 `TURNO_NO_ENCONTRADO`, 409
  `TURNO_YA_CANCELADO`, `ESTADO_INVALIDO` o `TURNO_PASADO`. Un error revierte
  la transacción y conserva la auditoría previa.

## Códigos de error

| Code | HTTP | Significado |
|---|---|---|
| `TOKEN_INVALIDO` | 401 | Sin token válido — middleware de C00 (además borra cualquier `x-tenant-*`). |
| `VALIDACION` | 400 | Formato: UUID malformado en cualquier campo, o `inicio` sin zona horaria explícita. |
| `SIN_PERMISO` | 403 | `ODONTOLOGO`. |
| `TURNO_NO_ENCONTRADO` | 404 | Reprogramación (C07): turno inexistente o de OTRO consultorio — una sola señal, mensaje sin datos ajenos (RN-TEN-01/RN-TEN-02). |
| `TURNO_YA_CANCELADO` | 409 | Cancelación (C06): el turno ya fue cancelado; se conserva la auditoría original. |
| `TURNO_PASADO` | 409 | Cancelación (C06): el inicio del turno ya ocurrió. |
| `SOLAPAMIENTO` | 409 | Conflicto por paciente, profesional o sillón/box dentro del consultorio (pre-check o violación `23P01` del índice). |
| `ESTADO_INVALIDO` | 409 | Reprogramación (C07): el turno no está en estado `PENDIENTE` (RN-AG-10); no se modifica nada. |
| `REFERENCIA_INVALIDA` | 422 | Recurso inexistente, ajeno al consultorio o inactivo — **indicando el campo** (`pacienteId`, `profesionalId`, `sillonBoxId`, `prestacionId`), un mensaje por campo (mismo para los tres estados). |

Orden de validación del servicio `crearTurno`: **400 → 422 → 409**
(design D5). Orden del flujo de **reprogramación** (design D4):
**400 → 403 (guardia de la ruta, después de la forma y antes de tocar la
base) → 404 → 409 `ESTADO_INVALIDO` → 409 `SOLAPAMIENTO`**.

> **Nota — hallazgo de integración (2026-11-22):** el middleware de auth de
> `catalogo` (`router.use(middlewareAutenticacion)` en
> `src/modules/catalogo/rutas.js:36`) está montado bajo **`/api` completo**
> en `src/app.js`, así que **cualquier ruta bajo `/api` responde 401
> `TOKEN_INVALIDO` sin token aunque la ruta no exista** (el 404
> `Cannot POST …` solo aparece con un token válido). Por eso el test de
> montaje de turnos usa token válido para demostrar la existencia de la
> ruta. No tocar ese middleware: pertenece a C02.

## Inyección de `deps`

Los cinco consumidores externos son inyectables (para tests); por defecto
resuelven por imports estáticos:

```js
import { crearTurno } from './servicios.js';

// Solo en tests: en producción se llama SIN deps (defaults estáticos).
const error = await crearTurno(
  { pacienteId, profesionalId, sillonBoxId, prestacionId, inicio, consultorioId },
  { existePaciente: async () => false }   // → 422 REFERENCIA_INVALIDA 'pacienteId'
);
```

Deps: `existePaciente` (C03), `existeProfesional`, `existeSillonBox`,
`obtenerCatalogo` (C02), `obtenerPrestacionParaTurno` (C04). El
repositorio **no** es una dep (Decisión 1).

## Decisiones de diseño (C05)

**Decisión 1 — Repositorio por defecto, no inyectado.**
El servicio recibe en `deps` las cinco interfaces de otros módulos, pero el
**repositorio NO forma parte de `deps`**: se resuelve por defecto a nivel de
módulo con `crearRepositorioTurnos()`. Los tests de servicio ejercitan la
transacción real contra PostgreSQL (la capa SQL no se mockea); solo se
inyectan los consumidores externos, que son las fronteras que sí varían por
contexto.

**Decisión 4 — "Inexistente" y "ajeno" son la misma señal a nivel servicio.**
`existePaciente`/`existeProfesional`/`existeSillonBox` devuelven `false`
tanto si el recurso no existe como si pertenece a otro consultorio, y
`obtenerPrestacionParaTurno` devuelve `null` en los tres casos (no existe,
ajena, inactiva). Por eso el servicio emite **un único mensaje por campo**
para esos estados (spec R4): distinguirlos con datos reales de dos
consultorios es responsabilidad del escenario **S8** (tests de integración),
no del servicio.

## Comandos

Todos verificados en este entorno (2026-11-22):

```bash
# Suite completa (gate del proyecto)
npm test

# Solo los tests del módulo turnos (6 archivos)
node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/turnos-dominio.test.js tests/turnos-repositorio.test.js tests/turnos-migracion.test.js tests/turnos-servicio.test.js tests/turnos-api.test.js tests/turnos-fixtures.test.js

# Migraciones pendientes (incluye 050_turno y 070_reprogramar_turno; sin pendientes: "No migrations to run")
npm run migrate
```

⚠️ `npx vitest run …` **no funciona a secas**: sin `--env-file=.env` el
setup no encuentra `DATABASE_URL` y falla con `Invalid URL` — usar
siempre la forma de arriba.

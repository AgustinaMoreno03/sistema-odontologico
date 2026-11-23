# Módulo turnos

Alta de turnos (`POST /api/turnos`) en el consultorio autenticado, sin
solapamientos por paciente, profesional ni sillón/box. Spec vigente:
`openspec/specs/turnos/spec.md` (change `c05-crear-turno-sin-solapamientos`).

## Interfaz pública

### `crearTurno(parametros, deps = {})` — `src/modules/turnos/servicios.js`

Caso de uso completo (R1–R7): valida formato → pertenencia/activitud de los
recursos → transacción de solapamiento. Es la interfaz que **C07
reutilizará** (reprogramar) en lugar de copiarla (`CHANGES.md:172`).

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
     inicio, fin, duracionMin, estado, creadoEn }` con `estado: 'PENDIENTE'`.
  La capa HTTP responde 201 con el DTO **sin** `consultorioId` (design D5).
- `fin = inicio + duracionMin` con la duración usada al crearse (RN-AG-07);
  intervalos `[inicio, fin)` en `timestamptz` UTC (RN-AG-06).

### Comprobación de solapamiento (reutilizable por C07)

Vive en el servicio + repositorio (`crearRepositorioTurnos().crearTurno`):
**una única transacción** con pre-check SELECT (mensajes detallados por
recurso) e INSERT; el índice de exclusión de la migración 050 es la
garantía final ante concurrencia (`23P01` → 409 traducido en el repositorio,
Decisión 1).

**Reintento ante deadlock (`40P01`)**: si dos inserciones concurrentes se
bloquean mutuamente, se reintenta la transacción completa (**máximo 2
intentos**) y, si el segundo intento también diera `40P01`, se traduce a
**409 `SOLAPAMIENTO`** — nunca 500 por esta causa.

## Códigos de error

| Code | HTTP | Significado |
|---|---|---|
| `TOKEN_INVALIDO` | 401 | Sin token válido — middleware de C00 (además borra cualquier `x-tenant-*`). |
| `VALIDACION` | 400 | Formato: UUID malformado en cualquier campo, o `inicio` sin zona horaria explícita. |
| `SIN_PERMISO` | 403 | Rol distinto de `RECEPCION`/`ADMIN_CONSULTORIO` (hoy: `ODONTOLOGO`; el flag "operar sin recepción" es fuera de alcance — C06/C07). |
| `SOLAPAMIENTO` | 409 | Conflicto por paciente, profesional o sillón/box dentro del consultorio (pre-check o violación `23P01` del índice). |
| `REFERENCIA_INVALIDA` | 422 | Recurso inexistente, ajeno al consultorio o inactivo — **indicando el campo** (`pacienteId`, `profesionalId`, `sillonBoxId`, `prestacionId`), un mensaje por campo (mismo para los tres estados). |

Orden de validación del servicio: **400 → 422 → 409** (design D5).

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

# Migraciones pendientes (incluye 050_turno; sin pendientes: "No migrations to run")
npm run migrate
```

⚠️ `npx vitest run …` **no funciona a secas**: sin `--env-file=.env` el
setup no encuentra `DATABASE_URL` y falla con `Invalid URL` — usar
siempre la forma de arriba.

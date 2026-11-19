# Design

## Context

El repo está greenfield: no existe `package.json`, `src/`, `db/` ni Compose (verificado antes de proponer). El stack es fijo (DD-14: Express 5 + JavaScript + PostgreSQL 18 + `npm test`), el monolito es modular por capas (DD-13: rutas → servicios → dominio → repositorios) y el tenancy es esquema compartido con `consultorio_id` desde el token (DD-09/DD-18). La motivación completa está en `proposal.md`; los requisitos observables, en los tres specs de este change (`development-environment`, `schema-migrations`, `auth`). Este documento registra las decisiones técnicas previas a codear. La gobernanza es ALTA (config/datos) y **CRÍTICA (auth)**.

## Goals / Non-Goals

**Goals:**

- Arranque reproducible en el primer task: `compose.yaml` + migración `001` + `npm test` en verde.
- Runner de migraciones verificado contra los cinco puntos de `knowledge-base/10_preguntas_abiertas.md` antes de adoptarlo.
- Frontera de auth de C00 exactamente según DD-18: middleware JWT (algoritmo HS256) + helper de tokens de test como **soporte de implementación** de la suite (sin requisito propio en el spec `auth`).
- Base mínima de capas y módulos para que C01–C04 arranquen en paralelo sin reestructurar nada.

**Non-Goals:**

- Login con contraseña, expiración (política de vida del token) y gestión de usuarios → **C01** (DD-18).
- CORS con el origen del frontend → cuando exista el frontend (C09/C10, DD-11).
- Rate limiting → se incorpora con el login en C01, con store compartido (nunca contador por proceso).
- Frontend, seeds de negocio, CI, migraciones `down` (forward-only, regla dura 9), datos reales de pacientes (reglas duras 1 y 7).

## Decisions

### D1 — Runner de migraciones: `node-pg-migrate` v9 con puerta de verificación y fallback propio

**Decisión:** adoptar `node-pg-migrate` v9 (verificado en docs: soporta archivos `.sql` puros — `001_init.sql` sin marcadores se toma como `up` completo, exige prefijo numérico en el nombre y usa tabla de historial propia) **solo si pasa la verificación de `10_preguntas_abiertas.md`**, mapeada 1:1 a los escenarios del spec `schema-migrations`:

| Punto a verificar (KB 10 + CHANGES.md) | Criterio | Escenario del spec |
|---|---|---|
| Numeración / orden | prefijo numérico obligatorio; aplica en orden ascendente; un rango inferior pendiente tras uno superior (`002` tras `010`) **falla visiblemente con exit ≠ 0** — no se ignora en silencio ni se aplica fuera de orden | `schema-migrations` R1 (4 escenarios) |
| Aplicación a base vacía | base nueva → `001` aplicada + registrada | R1 |
| Fallo | SQL inválido → transacción revocada, sin registro, exit ≠ 0 | R1 |
| Repetición | re-ejecución = no-op exit 0; historial sin duplicados | R1 |
| Conexión estilo Neon | `DATABASE_URL` con `sslmode=require` aceptada por runner y API | R2 (3 escenarios) |

**Proceso de rangos (README + este design):** las ramas se **integran y aplican siempre en orden ascendente**; el runner no repara por sí solo un rango fuera de orden — falla con exit ≠ 0 y el proceso humano reintegra el rango faltante antes de re-ejecutar (regla dura 9: nunca se edita una migración mergeada).

**Nota de operación (única referencia al lock):** el lock de migración de `node-pg-migrate` es *por instancia* de PostgreSQL, no por base — docs v9, `docs/src/api.md`: *"`advisoryLockMode` (fail or wait) — Controls behavior when the migration advisory lock is already held by another process. Use `fail` to throw immediately or `wait` to block until the lock becomes available (defaults to `fail`)"*. Con el default `fail`, un `npm test` (setup de la BD de test) solapado con `npm run migrate` (BD de dev) en la misma instancia falla confundentemente; por eso se configura `advisoryLockMode: 'wait'`. *(La opción es nueva en v9 — de ahí el pin de versión.)*

**Si algún punto falla → fallback:** runner propio mínimo (dependencia solo `pg`): lee `db/migrations/*.sql` ordenados por prefijo, cada archivo en una transacción y registra en tabla de historial. Las specs son agnósticas de herramienta; solo cambia la implementación. **Alternativas descartadas:** Knex (DSL JS — viola "SQL numerado en el repo, sin ORM auto-DDL"), Flyway/Liquibase (traen toolchain JVM, fuera del stack). El SQL vive siempre en `db/migrations/001_*.sql`; el comando queda documentado en el README y empaquetado como `npm run migrate`.

### D2 — Frontera de auth en C00 (DD-18)

**Decisión:** C00 entrega **solo** (a) el middleware de verificación JWT y (b) el helper de tests para emitir tokens ficticios — este último es **soporte de implementación de la suite** (task 4.5), sin requisito propio en el spec `auth`. Login, expiración como política y usuarios = C01. El contrato `{ usuarioId, consultorioId, rol }` (DD-14) es estable desde C00 y no cambia después.

- **Librería:** `jsonwebtoken` — madura, API `verify` directa, sin ESM forzado. Alternativa descartada: `jose` (válida pero ESM-first; agrega fricción de configuración sin beneficio para el MVP); HMAC casero descartado por seguridad.
- **Algoritmo (explícito):** **HS256** — `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })`; `alg: 'none'` o cualquier otro algoritmo → 401 (escenario del spec `auth` R1). HS256 es simétrico con el `JWT_SECRET` compartido; RS256 exigiría generar y distribuir pares de claves — complejidad innecesaria para el MVP.
- **Secreto:** `JWT_SECRET` solo desde `.env`; ausente, vacío o con **menos de 32 caracteres** → la API no arranca, con error claro que menciona el mínimo sin imprimir el valor (escenarios del spec `development-environment`); nunca default, nunca en el repo (regla dura 5).
- **Claims:** exactamente `usuarioId`, `consultorioId`, `rol`; la librería valida `exp` (escenario de token expirado en el spec `auth`). La vida útil del token la define C01 al hacer login.
- **Contexto:** el middleware deja `req.auth = { usuarioId, consultorioId, rol }` y **borra** cualquier header `x-tenant-*` entrante (multi-tenant: la capa de datos re-deriva el tenant; nada de headers de cliente).
- **Roles:** conjunto cerrado `['ADMIN_CONSULTORIO', 'ODONTOLOGO', 'RECEPCION']` como constante del módulo `auth` (DD-17); sin normalización de variantes. No existe rol de paciente (DD-16).
- **Errores:** cualquier fallo de verificación → 401 vía el manejador centralizado, mensaje genérico único (sin distinguir firma/estructura/caducidad ni filtrar stack).

### D3 — Migración `001`: esquema inicial mínimo (`consultorio` + `usuario`) — cerrada por DD-19

**Decisión (DD-19, `knowledge-base/09_decisiones_y_supuestos.md`):** `001_*.sql` crea **ambas** tablas raíz mínimas: `consultorio` (tenant) y `usuario` (con `consultorio_id` FK y `rol` con CHECK de los tres valores de DD-17 — refuerzo en base del conjunto cerrado). C01 extiende en su rango 010–019 (password, alta de usuarios, permisos) sin editar `001` (regla dura 9). **Justificación (DD-19):** CHANGES.md lista "migración `001`" en C00 y su fila de riesgo asume "acordar con C01 la propiedad de cada tabla inicial"; un `001` sin tablas dejaría la primera migración sin contenido observable verificable por `npm test`. **Alternativa descartada:** `001` solo-baseline sin tablas (la migración no produciría esquema verificable).

### D4 — Entorno: Compose canónico y respaldo directo

- **Un solo archivo `compose.yaml`** (nombre canónico, sin `compose.override.yaml` — decisión del usuario; desviación de la convención dev-override de la skill `docker-compose-patterns`, aceptada para minimizar la ola 0) con `postgres:18` fijo (nunca `latest`), healthcheck `pg_isready` (`interval: 5s, timeout: 3s, retries: 3, start_period: 10s`), `depends_on: condition: service_healthy`, volumen nombrado para datos. Credenciales vía `${VAR:-${VAR}}`/`env_file`, jamás en texto plano en el YAML; `.env` ya está en `.gitignore` (verificado). Validación: `docker compose config --quiet`.
- **Respaldo (fila de riesgos del roadmap):** si Docker falla, el README documenta PostgreSQL 18 directo con la misma versión y el mismo `DATABASE_URL` — sin degradar motor.
- **Base de test:** database separada (p. ej. `odontologia_test`) creada desde el arranque del Compose; la suite aplica migraciones en su setup. Aísla `npm test` del entorno de desarrollo.

### D5 — Stack de ejecución y tests

- **Node.js:** fijar la LTS vigente compatible con las dependencias en `package.json` `engines` y en el README (KB 11 exige que C00 fije la versión) — verificar la LTS actual al implementar (ver Open Questions).
- **Tests:** **Vitest + Supertest** — ESM-nativo (importante si el runner o JWT lo son), config mínima, rápido. Alternativa: Jest (descartado por fricción ESM y velocidad). Unitarios de dominio + integración ruta→base contra PostgreSQL real (**no se mockea la capa SQL**); mock solo de fronteras externas. Fixtures siempre ficticias (regla dura 1). `npm test` es la única puerta (regla dura 6).
- **Aislamiento de tenant:** en C00 se cubre en el nivel del middleware (escenarios R4 del spec `auth`: A no puede operar como B); los tests de aislamiento sobre datos de negocio llegan con C03/C05.

### D6 — Errores, logging y forma de respuesta

- Manejador de errores único con clase `ApiError(statusCode, code, message)`: errores operacionales → 4xx con mensaje seguro; inesperados → 500 + stack en log, jamás en la respuesta.
- Forma de error consistente en toda la API: `{ "error": { "code": "TOKEN_INVALIDO", "message": "No autorizado" } }` (asunción menor registrada aquí; los specs solo exigen "forma consistente y mensaje seguro").
- Logging mínimo (justificación en una línea): **`console.error` con el stack solo para 500 inesperados vía el manejador centralizado; nada más — MVP local sin tráfico real, un logger estructurado se agrega si/when haga falta.** `/health` es la única ruta pública.

## Risks / Trade-offs

- **C00 bloquea toda la ola 1** → priorizar arranque reproducible antes de ampliar la base; mantener el change lo más corto posible (mitigación del roadmap).
- **`node-pg-migrate` no pasa la verificación** → fallback runner propio ya delineado (D1); el spec no cambia. Costo: mantener ~100 líneas propias.
- **Gobernanza CRÍTICA en auth** → spec `auth` revisado con `security-review` antes de apply; cualquier cambio de alcance vuelve a Propose.
- **Secretos en el repo** → `.env` gitignored (verificado), `.env.example` sin valores, helper de tests usa secreto de prueba distinto del real.
- **Conflictos de archivos en la ola 1** (`package.json`, migraciones, config) → C00 define la base; un dueño por archivo por ola (CHANGES.md §puertas de paralelismo).

## Migration Plan

Aplicación = solo local durante el MVP (DD-10): `docker compose up` → `npm run migrate` → `npm test` en verde → comandos del README. **Rollback:** forward-only (regla dura 9) — no hay `down`; una migración mala se corrige con un archivo nuevo en el rango del change (fix-forward). Los datos son ficticios, por lo que la única destrucción real posible (`docker compose down -v`) exige confirmación explícita del usuario antes de ejecutarse.

## Open Questions

- **Versión exacta de Node LTS** a fijar en `engines` — verificar la LTS vigente en nodejs.org al implementar (requisito de la KB 11).

## UI Mockups

**Decision: no (no UI)** — C00 es backend puro (API, Compose, migraciones, tests); no hay pantallas ni interacción visual. Modo de diseño visual del proyecto: `deferred` (se consultará en el primer cambio visual, según la política global).

# Proposal

> **Change ID (roadmap):** C00 — Base del proyecto · **Ola:** 0 · **Camino crítico:** bloquea C01–C10.
> **Nota de nombre:** el CLI de OpenSpec exige kebab-case en minúsculas; el directorio es `c00-base-del-proyecto` y el ID del roadmap es `C00`.

## Why

C00 es la ola 0 del roadmap: hasta que no se mergea, nadie del equipo arranca (C01–C04 en paralelo, y todo el camino crítico depende de él). Hoy el repo no tiene `package.json`, ni `src/`, ni `db/`, ni Compose: no existe forma reproducible de levantar la API contra PostgreSQL 18 ni una puerta de integración (`npm test`) que el equipo pueda correr. Además, dos temas que este change debe cerrar siguen abiertos en `knowledge-base/10_preguntas_abiertas.md`: la estrategia de autenticación (resuelta el 2026-11-18 por DD-18, pero sin implementar) y el **runner de migraciones**, que C00 debe *verificar* antes de adoptarlo (numeración, base vacía, re-ejecución, fallo, conexión estilo Neon).

## What Changes

- **Proyecto Node.js + Express 5 en JavaScript** (sin TypeScript): árbol `src/modules/` con los cinco módulos (`auth`, `consultorios`, `catalogo`, `pacientes`, `turnos`) organizado por capas — rutas → servicios → dominio → repositorios (SQL parametrizado). C00 implementa **un único módulo completo de ejemplo (`auth`)**; los otros cuatro quedan como **carpetas vacías documentadas en el README** (con `.gitkeep`, sin archivos de relleno) para que cada módulo arranque en la ola 1.
- **Arranque reproducible**: `compose.yaml` con PostgreSQL 18 (tag fijo + healthcheck), `.env.example` sin valores → `.env` (gitignored), README con los comandos y puertos verificados, endpoint de salud (`/health`).
- **Runner de migraciones SQL** forward-only en `db/migrations/` (primera `001_*.sql`, rango reservado de C00: 001–009). Candidato: `node-pg-migrate`; se adopta solo si pasa la verificación exigida por `10_preguntas_abiertas.md`: orden de numeración (incluida la detección **visible** — exit ≠ 0 — de un rango inferior pendiente tras uno superior, sin aplicarlo fuera de orden), aplicación a base vacía, re-ejecución idempotente, fallo visible sin esquema parcial, y compatibilidad con una cadena de conexión estilo Neon (`postgresql://…?sslmode=require`).
- **Módulo `auth` mínimo (DD-18)**: (a) middleware que verifica un **JWT firmado con HS256** con el secreto en `.env` y deja `{ usuarioId, consultorioId, rol }` en la request; (b) **helper de tests** para emitir tokens ficticios (soporte de implementación de la suite, sin requisito propio en el spec `auth`). `consultorioId` y `rol` salen **siempre del token**, nunca del cliente (regla dura 2). **Login con contraseña, política de expiración y gestión de usuarios = C01** (fuera de C00).
- **Roles cerrados (DD-17)**: exactamente tres — `ADMIN_CONSULTORIO` (dueño == admin), `ODONTOLOGO`, `RECEPCION`. Sin rol de paciente y sin cuenta de paciente (DD-16): nada de login de paciente ni auto-reserva en C00.
- **`npm test` como única puerta de integración**: suite contra PostgreSQL real (BD de test), datos siempre ficticios (regla dura 1), ≥3 escenarios por spec (feliz / error de negocio / borde).

## Capabilities

### New Capabilities

- `development-environment`: arranque reproducible desde un checkout vacío (Compose + env + migraciones + API + `/health`), higiene de configuración (sin secretos en el repo, orígenes de configuración explícitos) y la puerta `npm test`.
- `schema-migrations`: comportamiento del runner de migraciones numeradas — orden, aplicación a base vacía, idempotencia de la re-ejecución, fallo transaccional visible y compatibilidad de la cadena de conexión.
- `auth`: verificación del token JWT (HS256) y el contexto estable `{ usuarioId, consultorioId, rol }` (alcance C00: middleware; el helper de tests es soporte de implementación sin requisito propio; login y usuarios los agrega C01 como modificación de esta capacidad).

### Modified Capabilities

- _(Ninguna — `openspec list --specs` no muestra capacidades existentes; todo es nuevo.)_

## Impact

- **Gobernanza (CHANGES.md):** ALTA para configuración y datos, **CRÍTICA para auth** — el spec de `auth` se revisa con especial cuidado antes de apply.
- **Código afectado:** todo es nuevo — `package.json`, `src/` (módulo `auth` completo + carpetas vacías `.gitkeep` de los otros cuatro), `db/migrations/001_*.sql`, `compose.yaml`, `.env.example`, `.gitignore` (verificado, ya cubre `.env`), README, suite de tests.
- **Dependencias a incorporar:** Express 5, `pg`, `jsonwebtoken` (design D2), `node-pg-migrate` v9 (design D1) y, solo en dev, `vitest` + `supertest` (design D5). Sin logger estructurado en C00 (design D6).
- **Bloquea:** C01–C04 (ola 1) y todo el camino crítico `C00 → … → C10`. Mitigación: ola 0 lo más corta posible — priorizar arranque reproducible antes que ampliar la base.
- **Fuera de alcance:** frontend (C09), login con contraseña / expiración / gestión de usuarios (C01), CORS con el dominio del frontend (se configura cuando exista frontend, C09/C10), turnos y catálogo (C02–C08), datos reales de pacientes (regla dura 1 y 7).

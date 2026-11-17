# Arquitectura Propuesta

> Actualizado 2026-11-17 con el **plan de ejecución** (`docs/plan-ejecucion.md` §4). Decisiones: DD-09 (multi-tenant), DD-10 (despliegue), DD-11 (frontend separado), DD-12 (PostgreSQL), DD-13 (monolito modular).

## Arquitectura objetivo (plan §4)

```
Navegador
   |
   +--> Vercel: frontend estático (TypeScript vanilla)
   |        |
   |        |  HTTPS + CORS (solo el dominio del frontend)
   |        v
   +--> Render: backend Spring Boot (Gradle, monolito modular, API REST)
            |
            v
         Neon: PostgreSQL (esquema compartido, tenant_id en cada tabla)
```

**Desarrollo local (mismas piezas):** frontend servido localmente + Spring Boot + PostgreSQL en Docker (`docker compose`). Si Docker genera errores, se puede usar PostgreSQL instalado directo en la máquina. Lo importante es que **siempre sea PostgreSQL** (DD-12).

## Patrones aplicados

| Patrón | Dónde se usa | Por qué |
|---|---|---|
| Monolito **modular** (DD-13) | Backend Spring Boot | Un solo proyecto y un solo deploy; paquetes por módulo con límites claros para que el equipo de 5 trabaje en paralelo sin pisarse |
| Multi-tenant shared schema (DD-09) | Modelo y persistencia | `tenant_id` en cada tabla de negocio; aislamiento por consultorio con el plan gratuito de Neon (una sola base) |
| Frontend estático separado (DD-11) | Servido | Vercel sirve el frontend; el backend solo expone la API REST. CORS únicamente para el dominio del frontend |
| Capas (controller → service → repository) | Backend | Mantenibilidad (prioridad P5) y división limpia del trabajo |
| Límites por módulo (paquetes con interfaz pública) | Modelo y servicios | Cada módulo expone una interfaz y **no toca las tablas de otro** → paralelismo sin acoplamiento |
| RBAC simple (rol → permisos) | Autorización | Roles fijos por consultorio; no se necesita motor de permisos complejo |
| API REST JSON | Comunicación frontend ↔ backend | Frontend TS vanilla consumiendo endpoints predecibles |

## Tenant en cada capa

| Capa | Cómo aplica el tenant |
|---|---|
| **Autenticación** (`identidad`) | El login resuelve el `tenant_id` del usuario y lo incluye en el **token/sesión**. El tenant **nunca** se acepta desde un parámetro del cliente (RN-TEN-01) |
| **API / servicios** | El service recibe el tenant del contexto de autenticación; ningún endpoint recibe `tenantId` en el body ni en la query como fuente de verdad |
| **Persistencia** | **Filtrado automático por tenant** (filtro Hibernate o repositorio base), no a mano en cada consulta |
| **Esquema (Flyway)** | `tenant_id` en **todas** las tablas de negocio; restricciones únicas e índices **incluyen** `tenant_id` |
| **Tests** | **Obligatorios**: un usuario del tenant A no puede ver ni modificar datos del tenant B |

**Estrategia**: esquema compartido con `tenant_id` (lo más simple y encaja con el plan gratuito de Neon). Migraciones con Flyway versionadas en el repo, para aplicarlas igual en local y en Neon. Fuera del MVP: planes de suscripción, cobros y facturación de los consultorios.

## Módulos del backend y sus límites (DD-13)

Un solo proyecto, un solo deploy, pero con paquetes por módulo:

| Módulo | Responsabilidad | Tablas propias (ninguna de otro módulo) | Expone interfaz |
|---|---|---|---|
| `tenancy` | Altas de consultorios (tenants) y su contexto | `consultorio` | Consultorio activo del contexto |
| `identidad` | Usuarios, autenticación, roles, tenant del token | `usuario`, `rol` | Usuario autenticado + rol + `tenantId` |
| `catalogo` | Profesionales, sillones/boxes, prestaciones (con duración) | `profesional`, `sillon_box`, `prestacion` | Catálogo del consultorio |
| `pacientes` | Ficha mínima del paciente | `paciente` | Pacientes del tenant |
| `turnos` | Agenda y turnos, prevención de solapamientos | `agenda_slot`, `turno` | Turnos/agenda del tenant |

Regla dura: **cada módulo expone una interfaz y no toca las tablas de otro**; la comunicación entre módulos es por interfaz, nunca por acceso directo a tablas ajenas.

## Estructura de directorios

```
C:\Odontologia\
├── backend/                  # Spring Boot + Gradle (monolito modular, DD-13)
│   └── src/main/
│       ├── java/.../
│       │   ├── tenancy/      # consultorios (tenants) y contexto de tenant
│       │   ├── identidad/    # usuarios, auth, roles, RBAC
│       │   ├── catalogo/     # profesionales, sillones/boxes, prestaciones
│       │   ├── pacientes/    # ficha mínima de pacientes
│       │   ├── turnos/       # agenda, turnos, validación de solapamiento
│       │   └── config/       # seguridad, CORS, seeds
│       └── resources/
│           ├── db/migration/ # migraciones Flyway (versionadas)
│           └── application.properties
├── frontend/                 # TypeScript vanilla + CSS responsivo (servido por separado, DD-11)
│   └── src/
│       ├── features/         # vista por funcionalidad (agenda, pacientes, auth)
│       ├── shared/           # fetch client, tipos, utilidades
│       └── pages/
├── knowledge-base/           # esta KB
├── discovery/                # Discovery previo
├── docs/plan-ejecucion.md    # plan de ejecución (autoridad de estas decisiones)
└── .active-orchestrator-state.json
```

## Política de despliegue (DD-10)

1. **Local hasta terminar el MVP** (fases B–F del plan §8): frontend servido localmente + Spring Boot + PostgreSQL en Docker.
2. **Después del MVP, fase G (C10)**: **Vercel** (frontend estático) / **Render** (backend) / **Neon** (PostgreSQL), todos en **plan gratuito**.
3. **Verificar en las páginas oficiales** los límites vigentes de los planes gratuitos antes de desplegar (cambian con frecuencia; no asumirlos).
4. **CORS**: permitir únicamente el dominio del frontend.
5. Migraciones Flyway aplicadas sobre Neon; cadena de conexión solo en variables de entorno; `.env` en `.gitignore` (solo `.env.example` sin valores).
6. Arranque en frío de los planes gratuitos: aceptable **para validar**, no para producción real.
7. Prueba de humo en la nube con **datos ficticios**.

## Desarrollo local

- **Mismas piezas que producción**: frontend local + Spring Boot + **PostgreSQL en Docker** (`docker compose`).
- Si Docker falla: **PostgreSQL instalado directo** en la máquina. **Siempre PostgreSQL** — sin H2 ni MySQL (DD-12).
- CORS en local apunta al origen del frontend local (p. ej. `http://localhost:<puerto-frontend>`).
- Detalle de arranque: ver `11_devops_local_docker.md`.

## Seguridad

- **Autenticación**: sesión/token estándar de Spring Security (sesión httpOnly o JWT — definir al implementar). El token/sesión **porta el `tenant_id`**; es la única fuente del tenant (RN-TEN-01).
- **Autorización**: RBAC simple — filtro por rol antes de cada endpoint; cada odontólogo solo accede a sus recursos (RN-AG-03, RN-AG-04). Roles del sistema según plan §5.2 (supuesto: confirmar con la líder).
- **Aislamiento de tenants**: filtro automático en persistencia + tests obligatorios de aislamiento (DD-09).
- **CORS**: solo el dominio del frontend (en local, el origen del frontend local).
- **Validación de input**: validación en controller (Bean Validation) + re-validación de reglas de negocio en service (los solapamientos se validan en servidor, nunca solo en frontend).
- **Passwords**: hash con BCrypt (o equivalente).
- **Secrets management**: sin secretos reales en el repo (`.env` en `.gitignore`, solo `.env.example`). En local, credenciales de admin inicial por variable de entorno. Ver `11_devops_local_docker.md`.
- **Sin auditoría en el MVP**: change-audit diferido (RN-EX-03).
- **Datos reales**: mientras se esté en planes gratuitos, **no se cargan datos reales de pacientes** (datos de salud, Ley 25.326); requiere revisión previa de seguridad y cumplimiento.

## Variables de entorno

| Variable | Descripción | Ejemplo | Sensible (Y/N) |
|---|---|---|---|
| `DB_URL` / `DATABASE_URL` | JDBC URL de la base (local o Neon) | `jdbc:postgresql://localhost:5432/odontologia` | N |
| `DB_USER` | Usuario de la base | `odontologia` | N |
| `DB_PASSWORD` | Password de la base | `devlocal` (local) / secreto de Neon (nube) | Y |
| `APP_PORT` | Puerto del backend (API) | `8080` | N |
| `CORS_ALLOWED_ORIGINS` | Origen permitido del frontend (dominio) | `http://localhost:5173` / `https://<app>.vercel.app` | N |
| `TOKEN_SECRET` | Secreto del token/sesión (Render) | — | Y |
| `ADMIN_INIT_PASSWORD` | Password inicial del admin (seeding) | `cambiar-en-primer-arranque` | Y |

Ninguna integración externa en el MVP → no hay API keys en el alcance actual.

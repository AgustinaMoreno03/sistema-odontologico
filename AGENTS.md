# Sistema de Gestión Odontológica — Instrucciones para Agentes

> Este archivo (y su copia `CLAUDE.md`) es lo PRIMERO que todo agente lee al entrar al repo.
> Generado a partir de `knowledge-base/` y `CHANGES.md`. No editar a mano sin re-sincronizar ambos archivos.

---

## Stack Tecnológico

| Capa | Tecnologías | Notas |
|---|---|---|
| Backend | Spring Boot (Java) | **Fijo, no negociable** |
| Build backend | Gradle | **Fijo, no negociable** |
| Frontend | TypeScript vanilla + diseño responsivo | **Fijo, no negociable**; sin frameworks |
| Arquitectura backend | Monolito **modular** (paquetes `tenancy`, `identidad`, `catalogo`, `pacientes`, `turnos`) | DD-13; un solo proyecto y deploy, límites claros por módulo |
| Servido | Frontend estático **servido por separado** (Vercel en nube; servidor estático local) — el backend solo expone API REST | DD-11; **CORS solo para el dominio del frontend** |
| Base de datos | **PostgreSQL** — Docker en local, **Neon** en la nube (siempre PostgreSQL) | DD-12; ver `11_devops_local_docker.md` |
| Ejecución | **Local hasta terminar el MVP**; después despliegue: **Vercel** (frontend) / **Render** (backend) / **Neon** (BD), planes gratuitos | DD-10; límites de planes a verificar al desplegar |

Detalle completo: [knowledge-base/02_descripcion_general.md](knowledge-base/02_descripcion_general.md)

---

## Base de Conocimiento

La fuente de verdad del dominio vive en `knowledge-base/`. **Leé el archivo relevante ANTES de implementar.**

| Archivo | Cuándo leerlo |
|---------|---------------|
| [README.md](knowledge-base/README.md) | Resumen ejecutivo y nombre del proyecto |
| [01_vision_y_objetivos.md](knowledge-base/01_vision_y_objetivos.md) | Entender propósito, objetivos por actor y alcance MVP |
| [02_descripcion_general.md](knowledge-base/02_descripcion_general.md) | Stack, arquitectura general, integraciones, resumen API |
| [03_actores_y_roles.md](knowledge-base/03_actores_y_roles.md) | Auth, RBAC, permisos por rol |
| [04_modelo_de_datos.md](knowledge-base/04_modelo_de_datos.md) | Entidades, ERD, `tenant_id`, migraciones |
| [05_reglas_de_negocio.md](knowledge-base/05_reglas_de_negocio.md) | Reglas codificadas (RN-XX) |
| [06_funcionalidades.md](knowledge-base/06_funcionalidades.md) | Historias de usuario por épica, marcado MVP / post-MVP |
| [07_flujos_principales.md](knowledge-base/07_flujos_principales.md) | Flujos extremo a extremo |
| [08_arquitectura_propuesta.md](knowledge-base/08_arquitectura_propuesta.md) | Arquitectura objetivo, tenant en cada capa, env vars |
| [09_decisiones_y_supuestos.md](knowledge-base/09_decisiones_y_supuestos.md) | Decisiones DD-01..13 y supuestos SU-01..04 |
| [10_preguntas_abiertas.md](knowledge-base/10_preguntas_abiertas.md) | ⚠️ Inconsistencias a resolver ANTES de codear |
| [11_devops_local_docker.md](knowledge-base/11_devops_local_docker.md) | Arranque local, Docker Compose, checklist de onboarding |

> ⚠️ Resolver las preguntas de prioridad **Alta** de `10_preguntas_abiertas.md` antes de arrancar el primer change. En particular: **IN-03 — rol `PACIENTE` no definido en el plan §5.2** (¿auto-reserva de turnos por paciente o solo creación por recepción? — no inventar, preguntar a la líder antes de cerrar specs de turnos) y la estrategia de autenticación (token propio vs proveedor externo, plan §12).

---

## Skills Disponibles

Fuente de verdad: `.atl/skill-registry.md`. Cargá la skill correspondiente al contexto ANTES de escribir código.

| Agente | Rol | Skills que carga |
|--------|-----|------------------|
| **Backend Core** | Spring Boot / JPA / TDD / migraciones | `springboot-patterns`, `jpa-patterns`, `springboot-tdd` |
| **Backend Seguridad** | Auth, aislamiento multi-tenant, auditoría | `springboot-security`, `security-review`, `multi-tenant-architecture` |
| **Infra** | Docker Compose y entorno local | `docker-compose-patterns` |
| **Frontend** | UI/UX en TypeScript vanilla (C09) | `emil-design-eng`, `design-taste-frontend-v1` (`frontend-design` no está instalado) |
| **Orquestación OPSX** | Ciclo de changes explore → propose → apply → verify → archive | `openspec-explore`, `openspec-propose`, `openspec-apply-change`, `openspec-archive-change`, `openspec-sync-specs`, `openspec-update-change` |
| **Orquestación fundación** | Flujo activo, KB, roadmap, skills, diseño | `active-orchestrator`, `kb-creator`, `roadmap-generator`, `discovery-research`, `web-scraper`, `find-skill`, `agent-instruction`, `skill-creator`, `design-system` |

> Los compact rules de cada skill los resuelve el orquestador desde `.atl/skill-registry.md` (generado por `skill-registry`; no versionado — no está en el repo).

---

## Roadmap de Changes

El plan de implementación completo está en [CHANGES.md](CHANGES.md). Resumen:

- **Total**: 11 changes (`C00`–`C10`) en **5 olas** (0–4).
- **Camino crítico**: `C00 → C01/C02/C03/C04 → C05 → C06..C09 → C10`.
- **Primer change**: `C00` — Base del proyecto (Spring Boot + Gradle + PostgreSQL Docker + Flyway + tenancy + modularidad); la ola 0 bloquea a todos.
- **C05** (turno sin solapamientos) es el change principal con ciclo OPSX completo obligatorio y ≥3 escenarios.

**Antes de cualquier `/opsx:propose`**: leé [CHANGES.md](CHANGES.md), identificá las dependencias del change y los archivos de "Leer antes".

---

## Reglas Duras (específicas del proyecto)

> Reglas **globales** ya definidas en `~/.claude/CLAUDE.md` (OPSX/openspec, governance, engram, design-mockups): el proyecto las **hereda**, no se repiten acá. Acá viven solo las reglas **específicas de este proyecto**.

Son contrato; romperlas es un defecto. Formato `NUNCA X → hacer Y`:

1. NUNCA datos reales de pacientes en el repo, ejemplos, tests ni capturas → usar siempre datos ficticios.
2. NUNCA aceptar `tenant_id` desde el cliente → resolverlo siempre del token autenticado y filtrar todo acceso por él.
3. NUNCA implementar un change sin spec aprobado con ≥3 escenarios (feliz, error de negocio, borde) → pasar por `/opsx:propose` y aprobar antes de apply.
4. NUNCA crear turnos solapados por profesional ni por sillón/box dentro del mismo tenant → validar transaccionalmente; turnos contiguos (uno empieza justo cuando termina otro) SÍ son válidos.
5. NUNCA dejar secretos ni credenciales en el repositorio → solo `.env.example` sin valores; `.env` en `.gitignore`.
6. NUNCA mergear a la rama principal sin tests en verde y revisión → PR con ≥1 aprobación y `./gradlew build` en verde.
7. NUNCA cargar datos reales de pacientes mientras el sistema esté en planes gratuitos (Ley 25.326) → requiere revisión previa de seguridad y cumplimiento.
8. NUNCA hacer commit ni push sin que el usuario lo pida explícitamente → correr el build y los tests sí es parte de Verify y no necesita pedido.
9. NUNCA editar una migración ya mergeada → siempre crear una nueva versión en Flyway.
10. NUNCA tocar las tablas de otro módulo → comunicarse solo vía la interfaz del módulo (`tenancy`, `identidad`, `catalogo`, `pacientes`, `turnos`).
11. NUNCA usar `any` en TypeScript → tipado estricto.
12. NUNCA commitear con mensajes fuera de la convención → usar commits convencionales (`feat:`, `fix:`, `test:`, `docs:`, `chore:`…) **sin co-autoría IA**.

---

## Flujo de Trabajo

```
1. Leer la KB relevante (knowledge-base/)        → entender el dominio
2. Identificar el change en CHANGES.md           → respetar dependencias
3. /opsx:propose C-NN-nombre                     → proposal + design + specs + tasks
4. Implementar las tasks (cargando skills)       → respetando las reglas duras
5. /opsx:archive C-NN-nombre + marcar [x]        → cerrar el change
```

Aplicar TODAS las reglas duras en cada paso. Ante conflicto entre la KB y este archivo, las reglas duras prevalecen.

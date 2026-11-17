# Decisiones y Supuestos

> **Actualización 2026-11-17**: nuevas decisiones DD-09..DD-13 del plan de ejecución (`docs/plan-ejecucion.md`); DD-01 y DD-03 quedan **SUPERSEDED**, DD-05 actualizado y DD-07 en revisión (roles §5.2).

## Decisiones documentadas

### DD-01 — Monolito con Spring Boot sirviendo el frontend (enfoque A)
**Estado**: **SUPERSEDED (2026-11-17)** — ver **DD-11** (frontend estático servido por separado, CORS solo para el dominio del frontend).
**Decisión**: un solo artefacto desplegable; Spring Boot sirve el frontend estático TypeScript vanilla. Sin CORS, un solo deploy.
**Contexto**: stack fijo (Spring Boot + Gradle / TS vanilla) y plazo acotado.
**Alternativas consideradas**: frontend y backend separados (dos servidores, CORS); BFF intermedio.
**Justificación**: elimina complejidad de CORS y despliegue doble; ideal para MVP local.
**Trade-offs aceptados**: escalado por componente separado no aplica (irrelevante a esta escala).

### DD-02 — Alcance del MVP recortado: agenda + turnos + pacientes (sin historia clínica ni cobros)
**Decisión**: el MVP incluye agenda y turnos, pacientes con ficha básica (nombre, contacto), y usuarios/permisos. Historia clínica y cobros son post-lanzamiento.
**Contexto**: el Discovery marcaba 4 features "innegociables"; el Q&A posterior recortó dos de ellas para hacer el MVP viable.
**Alternativas consideradas**: MVP completo con las 4 features; MVP aún más mínimo (solo turnos).
**Justificación**: control de scope con equipo de 5 y prioridad en mantenibilidad; las 4 features originales eran demasiado para el plazo.
**Trade-offs aceptados**: el sistema no registra atención/cobro ni evolución clínica en su primera versión.

### DD-03 — Monorepo único, sin noción de tenant (multi-sede-ready, no multi-sede)
**Estado**: **SUPERSEDED (2026-11-17)** — ver **DD-09** (SaaS multi-tenant con `tenant_id` desde el inicio).
**Decisión**: consultorio único ahora; sin columna de tenant/sede. Entidades y paquetes bien separados para permitir migración futura a multi-tenant/multi-sede.
**Contexto**: respuesta inicial "SaaS multi-tenant" fue superada por la respuesta posterior: un solo consultorio, sin tenant ahora.
**Alternativas consideradas**: modelar tenant desde el día 1; no pensar en ello.
**Justificación**: evitar complejidad innecesaria sin bloquear el futuro.
**Trade-offs aceptados**: la migración futura será un proyecto aparte (quedó como pregunta abierta post-fase).

### DD-04 — Prioridad P5: mantenibilidad
**Decisión**: entre las prioridades de calidad, la número 1 es mantenibilidad.
**Contexto**: equipo de 5 (Agustina, Lucia, Kevin, Lea, Gero) trabajando en paralelo; el sistema debe poder dividirse en 5 frentes.
**Alternativas consideradas**: priorizar velocidad de entrega o performance.
**Justificación**: 5 personas en paralelo necesitan un códigobase ordenado para no pisarse; el sistema debe sobrevivir a rotaciones.
**Trade-offs aceptados**: posiblemente más tiempo inicial en estructura que en features.

### DD-05 — Ejecución local con Docker opcional
**Estado**: **ACTUALIZADO (2026-11-17)** — el sistema corre local **hasta terminar el MVP**; después se despliega (Vercel/Render/Neon, ver **DD-10**). Docker sigue opcional.
**Decisión**: el sistema corre en local; Docker se usa solo si no complica. Cloud y backups de datos sensibles = decisión posterior.
**Contexto**: datos ficticios, proyecto de estudiantes.
**Alternativas consideradas**: cloud desde el inicio; local sin contenedores.
**Justificación**: cero costo operativo y cero fricción para el equipo.
**Trade-offs aceptados**: sin backups automatizados ni entorno de staging tipo prod (aceptable con datos ficticios).

### DD-06 — Sin auditoría (change-audit) en el MVP
**Decisión**: no se implementa trail de auditoría en el MVP; queda diferido.
**Contexto**: control de scope; los datos son ficticios.
**Alternativas**: auditoría mínima desde el día 1 (recomendable cuando entre la historia clínica).
**Trade-offs aceptados**: no se podrá reconstruir quién cambió qué durante el MVP.

### DD-07 — RBAC simple con 4 roles fijos
**Estado**: **EN REVISIÓN (2026-11-17)** — el plan de ejecución §5.2 redefine los roles del sistema (`ADMIN_CONSULTORIO`, `ODONTOLOGO`, `RECEPCION` + `SUPERADMIN` interno); **supuesto: confirmar con la líder** (ver `03_actores_y_roles.md`).
**Decisión**: modelo rol→permisos, sin jerarquías ni permisos por usuario; 4 roles: Odontólogo/a, Paciente, Recepción/Administración, Administrador del sistema.
**Justificación**: suficiente para un consultorio único y < 50 personas; fácil de mantener (P5).
**Trade-offs aceptados**: roles futuros requieren cambiar el enum/reglas.

### DD-08 — Frontend NO es parte del cambio del MVP
**Decisión**: el MVP se enfoca en API + lógica de dominio; el frontend queda mínimo (lo indispensable para probar).
**Contexto**: decisión explícita del Q&A.
**Trade-offs aceptados**: la experiencia de usuario final será básica hasta una fase posterior.

### DD-09 — SaaS multi-tenant (esquema compartido con `tenant_id`) — 2026-11-17
**Fecha**: 2026-11-17. **Motivo**: decisiones nuevas del plan de ejecución (`docs/plan-ejecucion.md` §2 — "CAMBIA"), registrado según §0.6.
**Decisión**: el sistema es **SaaS multi-tenant**: varios consultorios aislados entre sí. Estrategia:
- **Esquema compartido** con `tenant_id` en **todas** las tablas de negocio.
- El `tenant_id` sale **del usuario autenticado (token)**, **nunca** de un parámetro que mande el cliente.
- **Filtrado automático por tenant en la capa de persistencia** (filtro Hibernate o repositorio base), no a mano en cada consulta.
- Restricciones únicas e índices **siempre incluyen** `tenant_id`.
- Migraciones con **Flyway** versionadas en el repo (iguales en local y en Neon).
- **Tests obligatorios de aislamiento**: un usuario del tenant A no puede ver ni modificar datos del tenant B.
**Reemplaza**: DD-03 (consultorio único, sin tenant).
**Fuera del MVP**: planes de suscripción, cobros y facturación de los consultorios.

### DD-10 — Despliegue: Vercel (frontend) / Render (backend) / Neon (BD), planes gratuitos — 2026-11-17
**Fecha**: 2026-11-17. **Motivo**: plan de ejecución §2 ("CAMBIA") y §9.
**Decisión**: **todo local hasta terminar el MVP**; recién después se despliega:
- **Vercel** → frontend estático (TypeScript vanilla).
- **Render** → backend Spring Boot (API REST).
- **Neon** → base de datos PostgreSQL.
- Todos en **plan gratuito**; **verificar los límites vigentes en las páginas oficiales al momento de desplegar** (cambian con frecuencia). Los **arranques en frío** de los planes gratuitos son aceptables **solo para validar**, no para producción real.
**Reemplaza**: "despliegue no definido / cloud = decisión futura" (DD-05 queda extendido por esta decisión).
**Pendiente**: backups y datos reales siguen siendo decisión posterior (Ley 25.326 — ver §10 del plan).

### DD-11 — Frontend estático separado del backend (CORS solo para el dominio del frontend) — 2026-11-17
**Fecha**: 2026-11-17. **Motivo**: plan de ejecución §2 ("CAMBIA") y §4.
**Decisión**: el frontend **no** lo sirve Spring Boot: es un **frontend estático separado** (TypeScript vanilla) con su propio deploy (Vercel en la nube; servidor estático local en desarrollo). El backend expone solo la API REST y permite **CORS únicamente para el dominio del frontend** (en local, para el origen del frontend local).
**Reemplaza**: DD-01 (monolito que sirve el frontend, sin CORS).
**Trade-offs aceptados**: hay CORS y dos artefactos desplegables; se acepta por separación de responsabilidades y despliegue independiente.

### DD-12 — Base de datos: PostgreSQL siempre (Docker local, Neon en la nube) — 2026-11-17
**Fecha**: 2026-11-17. **Motivo**: plan de ejecución §2 ("CAMBIA") y §4.
**Decisión**: **siempre PostgreSQL**: en local corre en **Docker** (`docker compose`) — si Docker genera errores, PostgreSQL instalado directo en la máquina — y en la nube en **Neon** (también PostgreSQL), para que local y nube sean iguales. Sin H2 ni MySQL.
**Reemplaza**: "base de datos a definida" (antes: H2 en dev / PostgreSQL o MySQL — ver `02_descripcion_general.md`).

### DD-13 — Monolito modular en el backend — 2026-11-17
**Fecha**: 2026-11-17. **Motivo**: plan de ejecución §2 ("CAMBIA") y §4.
**Decisión**: el backend es un **monolito modular**: un solo proyecto, un solo deploy, con **paquetes por módulo y límites claros**: `tenancy`, `identidad`, `catalogo` (profesionales, sillones/boxes, prestaciones), `pacientes`, `turnos`. **Cada módulo expone una interfaz y nunca toca las tablas de otro.**
**Combina con**: DD-09 (tenant en cada capa) y DD-11 (frontend separado) — la arquitectura completa está en `08_arquitectura_propuesta.md`.
**Justificación**: módulos separados permiten el trabajo en paralelo del equipo de 5 (DD-04, mantenibilidad) con un solo deploy.

## Supuestos inferidos

### SU-01 — Datos 100% ficticios
**Supuesto**: no se cargan datos reales de pacientes; no aplica compliance legal real.
**Origen**: Q&A completada (proyecto de estudiantes/grupo).
**Riesgo si es falso**: obligaciones de confidencialidad/auditoría reales desde el día 1.
**Cómo validar**: confirmar que el sistema nunca se usará con pacientes reales en esta fase.

### SU-02 — Equipo de 5 dividirá el trabajo en paralelo
**Supuesto**: las 5 personas (Agustina, Lucia, Kevin, Lea, Gero) desarrollan en paralelo sobre el mismo repo.
**Origen**: Q&A (P5, escala equipo pequeño).
**Riesgo si es falso**: la estructura por dominios puede sobre-diseñarse.
**Cómo validar**: al iniciar el primer sprint, revisar el plan de asignación por épicas.

### SU-03 — La base de datos local es suficiente para el MVP
**Supuesto**: una BD relacional **PostgreSQL** local (Docker o instalado directo — ver `11_devops_local_docker.md`) cubre agenda/turnos/pacientes sin problemas de concurrencia (pocos usuarios simultáneos, `< 50` por tenant).
**Origen**: escala "equipo pequeño (< 50)" + ejecución local.
**Riesgo si es falso**: bloqueos por solapamiento en reservas concurrentes → mitigar con validación transaccional.
**Cómo validar**: probar reservas simultáneas en la validación de solapamiento.

### SU-04 — Un odontólogo atiende de a un turno por vez
**Supuesto**: la agenda de un odontólogo no admite solapamientos entre sus propios turnos.
**Origen**: reglas de negocio del Discovery (sentido común confirmado).
**Riesgo si es falso**: consultorios con dos sillas por odontólogo requerirían modelo de "recursos/sillas".
**Cómo validar**: preguntar al usuario si algún odontólogo trabaja en paralelo en dos sillas.

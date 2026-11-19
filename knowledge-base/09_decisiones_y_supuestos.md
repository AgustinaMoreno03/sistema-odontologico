# Decisiones y Supuestos

> Las decisiones históricas reemplazadas se conservan para trazabilidad.

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
**Estado**: **ACTUALIZADO (2026-11-17)** — el sistema corre local **hasta terminar el MVP**; después se despliega (Vercel/Render/Neon, ver **DD-10**). Compose es la ruta documentada y PostgreSQL directo es el respaldo.
**Decisión**: el sistema corre en local; Docker se usa solo si no complica. Cloud y backups de datos sensibles = decisión posterior.
**Contexto**: datos ficticios, proyecto de estudiantes.
**Alternativas consideradas**: cloud desde el inicio; local sin contenedores.
**Justificación**: cero costo operativo y cero fricción para el equipo.
**Trade-offs aceptados**: sin backups automatizados ni entorno de staging tipo prod (aceptable con datos ficticios).

### DD-06 — Sin auditoría (change-audit) en el MVP
**Decisión**: no se implementa trail de auditoría en el MVP; queda diferido.
**Contexto**: control de scope; los datos son ficticios.
**Alternativas**: auditoría mínima desde el día 1 (recomendable cuando entre la historia clínica).
**Trade-offs aceptados**: El MVP registra los datos de cancelación del turno. La auditoría general queda para una etapa posterior.

### DD-07 — Permisos de consultorio y condición profesional
**Decisión vigente**. Admin y dueño son el mismo rol. Administración y recepción gestionan agendas del consultorio. El profesional opera su agenda con permisos específicos y puede dar turnos cuando se le habilita por operar sin recepción. La condición profesional es independiente del acceso administrativo.

### DD-08 — Frontend mínimo en C09
**Decisión**: el MVP se enfoca en API + lógica de dominio; el frontend queda mínimo (lo indispensable para probar).
**Contexto**: decisión explícita del Q&A.
**Trade-offs aceptados**: la experiencia de usuario final será básica hasta una fase posterior.

### DD-09 — SaaS multi-tenant (esquema compartido con `consultorio_id`) — 2026-11-17
**Fecha**: 2026-11-17. **Motivo**: decisiones nuevas del plan de ejecución (`docs/plan-ejecucion.md` §2 — "CAMBIA"), registrado según §0.6.
**Decisión**: el sistema es **SaaS multi-tenant**: varios consultorios aislados entre sí. Estrategia:
- **Esquema compartido** con `consultorio_id` en **todas** las tablas de negocio.
- El `consultorio_id` sale **del usuario autenticado (token)**, **nunca** de un parámetro que mande el cliente.
- Cada consulta de los repositorios filtra por el `consultorio_id` del contexto autenticado.
- Restricciones únicas e índices **siempre incluyen** `consultorio_id`.
- Migraciones SQL numeradas en `db/migrations/` (iguales en local y en Neon).
- **Tests obligatorios de aislamiento**: un usuario del tenant A no puede ver ni modificar datos del tenant B.
**Reemplaza**: DD-03 (consultorio único, sin tenant).
**Fuera del MVP**: planes de suscripción, cobros y facturación de los consultorios.

### DD-10 — Despliegue: Vercel (frontend) / Render (backend) / Neon (BD), planes gratuitos — 2026-11-17
**Fecha**: 2026-11-17. **Motivo**: plan de ejecución §2 ("CAMBIA") y §9.
**Decisión**: **todo local hasta terminar el MVP**; recién después se despliega:
- **Vercel** → frontend estático (React 19 con Vite y JavaScript).
- **Render** → backend Express 5 (API REST).
- **Neon** → base de datos PostgreSQL 18.
- Todos en **plan gratuito**; **verificar los límites vigentes en las páginas oficiales al momento de desplegar** (cambian con frecuencia). Los **arranques en frío** de los planes gratuitos son aceptables **solo para validar**, no para producción real.
**Reemplaza**: "despliegue no definido / cloud = decisión futura" (DD-05 queda extendido por esta decisión).
**Pendiente**: backups y datos reales siguen siendo decisión posterior (Ley 25.326 — ver §10 del plan).

### DD-11 — Frontend estático separado del backend (CORS solo para el dominio del frontend) — 2026-11-17
**Fecha**: 2026-11-17. **Motivo**: plan de ejecución §2 ("CAMBIA") y §4.
**Decisión**: el frontend se sirve de forma estática por separado (React 19 con Vite y JavaScript) con su propio deploy (Vercel en la nube; servidor estático local en desarrollo). El backend expone solo la API REST y permite **CORS únicamente para el dominio del frontend** (en local, para el origen del frontend local).
**Reemplaza**: DD-01 (monolito que sirve el frontend, sin CORS).
**Trade-offs aceptados**: hay CORS y dos artefactos desplegables; se acepta por separación de responsabilidades y despliegue independiente.

### DD-12 — Base de datos: PostgreSQL siempre (Docker local, Neon en la nube) — 2026-11-17
**Fecha**: 2026-11-17. **Motivo**: plan de ejecución §2 ("CAMBIA") y §4.
**Decisión**: **PostgreSQL 18**: en local corre en **Docker** (`docker compose`) — si Docker genera errores, PostgreSQL instalado directo en la máquina — y en la nube en **Neon** (también PostgreSQL), para que local y nube sean iguales. Sin H2 ni MySQL.
**Reemplaza**: "base de datos a definida" (antes: H2 en dev / PostgreSQL o MySQL — ver `02_descripcion_general.md`).

### DD-13 — Monolito modular en el backend — 2026-11-17
**Fecha**: 2026-11-17. **Motivo**: plan de ejecución §2 ("CAMBIA") y §4.
**Decisión**: el backend es un **monolito modular**: un solo proyecto, un solo deploy, con **paquetes por módulo y límites claros**: `consultorios`, `auth`, `catalogo` (profesionales, sillones/boxes, prestaciones), `pacientes`, `turnos`. **Cada módulo expone una interfaz y nunca toca las tablas de otro.**
**Combina con**: DD-09 (tenant en cada capa) y DD-11 (frontend separado) — la arquitectura completa está en `08_arquitectura_propuesta.md`.
**Justificación**: módulos separados permiten el trabajo en paralelo del equipo de 5 (DD-04, mantenibilidad) con un solo deploy.

### DD-14 — Stack aprobado y entrega de seis días

- Node.js con Express 5 y JavaScript. Monolito modular por capas HTTP, servicios, dominio y repositorios SQL. React 19 con Vite y JavaScript en C09.
- PostgreSQL 18 local y en Neon. El equipo informó que verificó la compatibilidad. Conexión con `DATABASE_URL` y migraciones SQL numeradas que solo avanzan.
- Autenticación simple y aislada en `src/modules/auth/`. Interfaz estable `{ usuarioId, consultorioId, rol }`. Tests con `npm test` por escenario del spec.
- La cátedra confirmó el stack y un máximo de seis integrantes, según el equipo. La asignación actual sigue siendo de cinco.

### DD-15 — Alcance de agenda y datos clínicos

- Prioridad de seis días: crear, consultar, reprogramar y cancelar turnos. Estados de confirmación y asistencia, y bloqueos, después de verificar ese recorrido. El paciente solicita cancelación al consultorio. La auto-reserva queda fuera de la entrega base.
- La cancelación conserva el turno, libera el horario y registra fecha, operador y origen.
- Historia clínica posterior al MVP. Acceso clínico por condición profesional, separado del rol administrativo. Las correcciones agregan registros fechados y con autor. Se parte del caso de un solo profesional para el módulo clínico.
- Historia clínica, cobros, contabilidad y sucursales quedan para etapas posteriores.

### DD-16 — El paciente no es un rol ni tiene cuenta en el MVP (cierra IN-03) — 2026-11-18
**Fecha**: 2026-11-18. **Motivo**: decisión de la líder antes de arrancar C00; cierra la pregunta IN-03.
**Decisión**: el paciente es un **actor externo** al sistema:
- **No es un rol** del sistema (no existe rol `PACIENTE`) y **no tiene cuenta** ni acceso en el MVP.
- Tiene un **registro mínimo** — nombre y al menos un contacto, siempre datos ficticios — que crea y gestiona el consultorio (recepción).
- La **reserva online y la auto-reserva quedan fuera de la entrega base**; el paciente pide o cancela turnos a través del consultorio. Si se retoman, será una etapa posterior con spec propio.
**Reemplaza**: IN-03 (rol `PACIENTE` no definido en el plan §5.2).
**Combina con**: DD-17 (roles vigentes) y DD-15 (auto-reserva fuera del alcance base).

### DD-17 — Roles del sistema: admin (incluye dueño), odontólogo y recepción — 2026-11-18
**Fecha**: 2026-11-18. **Motivo**: decisión de la líder; consolida DD-07.
**Decisión**: el sistema tiene exactamente **tres roles**: `ADMIN_CONSULTORIO` (el dueño es el mismo rol), `ODONTOLOGO` y `RECEPCION`. No hay rol de paciente ni otros roles en el MVP. La alta inicial de consultorios es un seed o comando interno, no un rol (ver `03_actores_y_roles.md`).
**Combina con**: DD-07 (permisos por rol; condición profesional separada del acceso administrativo).

### DD-18 — Autenticación: token JWT firmado; `consultorioId` y `rol` siempre desde el token — 2026-11-18
**Fecha**: 2026-11-18. **Motivo**: decisión de la líder; resuelve la estrategia de autenticación (plan §12) antes de arrancar C00.
**Decisión**:
- **Token JWT firmado** con el secreto en `.env` (nunca en el repo — regla dura 5). Token propio, sin proveedor externo.
- `consultorioId` y `rol` salen **siempre del token**, nunca de un parámetro del cliente (regla dura 2; consistente con DD-09).
- **C00 entrega**: el middleware que verifica el token y deja `{ usuarioId, consultorioId, rol }` en la request, más un **helper de tests para emitir tokens ficticios**.
- **C01 entrega**: login con contraseña, expiración del token y gestión de usuarios.
- La interfaz estable `{ usuarioId, consultorioId, rol }` no cambia (DD-14); el módulo `auth` queda aislado en `src/modules/auth/`.
**Reemplaza**: "estrategia de autenticación sin definir (token propio vs proveedor externo)".

### DD-19 — Migración `001`: tablas mínimas `consultorio` y `usuario` creadas en C00 — 2026-11-18
**Fecha**: 2026-11-18. **Motivo**: cerrar la pregunta abierta sobre la propiedad de las tablas iniciales entre C00 y C01 (fila de riesgos de CHANGES.md: "acordar con C01 la propiedad de cada tabla inicial") antes de codear la migración `001`.
**Decisión**: la migración `001` de C00 crea **ambas tablas** `consultorio` y `usuario` con lo mínimo necesario — identificador, `consultorio_id` como clave foránea y `rol` con CHECK de los tres valores de DD-17. C01 las extiende en su rango `010–019` (password, alta de usuarios, permisos) sin editar `001` (regla dura 9).
**Justificación**: CHANGES.md lista "migración `001`" en C00; un `001` vacío dejaría la primera migración sin esquema verificable por `npm test`; las tablas mínimas mantienen pequeña la ola 0 (C00 bloquea al equipo) y C01 extiende hacia adelante sobre migraciones ya mergeadas, sin reescribirlas.

## Supuestos inferidos

### SU-01 — Datos 100% ficticios
**Supuesto**: desarrollo y demostración usan exclusivamente datos ficticios.
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

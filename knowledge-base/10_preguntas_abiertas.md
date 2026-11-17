# Preguntas Abiertas

## Inconsistencias detectadas

### IN-01 — SaaS multi-tenant vs consultorio único
**Documento A dice** (Q&A inicial): system_type = SaaS multi-tenant.
**Documento B dice** (Q&A posterior): un solo consultorio, SIN noción de tenant ahora; entidades bien separadas para migración futura posible.
**Impacto**: si se modelaba tenant desde el inicio, habría complejidad extra innecesaria.
**Resolución**: ~~resuelta a favor de consultorio único (DD-03)~~ → **RESUELTA el 2026-11-17 por el plan de ejecución §2 ("CAMBIA"): el sistema es SaaS multi-tenant con `tenant_id` desde el inicio (DD-09)**. La pregunta del *cuándo* migrar queda obsoleta; ahora las preguntas abiertas son las de la sección siguiente (plan §12).

### IN-02 — Necesarias del Discovery vs MVP recortado
**Documento A dice** (Discovery §5, "innegociables"): pacientes + historia clínica, agenda y turnos, atención y cobros, usuarios y permisos.
**Documento B dice** (Q&A MVP): historia clínica y cobros **fuera** del MVP (post-lanzamiento); quedan agenda+turnos, pacientes (ficha básica) y usuarios/permisos.
**Impacto**: dos de las cuatro "innegociables" se diferían — riesgo de que se reargan por presión.
**Resolución propuesta**: resuelta por Q&A autoritativa; cualquier reintento debe pasar por una nueva decisión explícita (ver PA-01/PA-06). *(2026-11-17: el plan §2 confirma sin cambios — agenda+turnos+paciente mínimo, sin historia clínica ni cobros.)*

### IN-03 — Rol `PACIENTE` no listado en el plan §5.2 (detectada 2026-11-17)
**Documento A dice** (esta KB, `03_actores_y_roles.md` y US-001): existe un rol `PACIENTE` que reserva/cancela sus propios turnos.
**Documento B dice** (plan de ejecución §5.2): solo `ADMIN_CONSULTORIO`, `ODONTOLOGO`, `RECEPCION` + `SUPERADMIN` interno — sin rol de paciente.
**Impacto**: si no hay rol paciente, la auto-reserva (US-001) y RN-AG-04 no aplican; los turnos los crearía `RECEPCION`/`ODONTOLOGO`.
**Resolución propuesta**: **no inventar** — preguntar a la líder si el MVP incluye auto-reserva por paciente o solo creación por recepción. Hasta entonces, US-001 queda cuestionada por IN-03.

## Preguntas abiertas nuevas — plan de ejecución §12 (2026-11-17, verbatim)

- Alcance exacto del multi-tenant dentro de la nota del trabajo (¿es requisito de la cátedra o decisión propia del equipo?).
- Estrategia final de autenticación (token propio o proveedor externo).
- Cumplimiento para datos reales de pacientes antes de salir de la etapa de validación.
- Límites reales de los planes gratuitos de Vercel, Render y Neon al momento del despliegue.
- Si la cátedra espera un solo change por el ciclo OPSX completo o uno por integrante.

## Preguntas abiertas (priorizadas)

| Prioridad | Pregunta | Bloquea | Decisor |
|-----------|----------|---------|---------|
| Alta | **¿Cuándo entra la historia clínica al alcance?** (está definida como post-lanzamiento, sin fecha ni fase) | Fase post-MVP | Product Owner |
| Alta | ~~Multi-sede / multi-tenant futuro~~ → **resuelta 2026-11-17**: multi-tenant desde el inicio (DD-09); ver IN-01 y plan §12 | — | — |
| Alta | **Auditoría y backups de historia clínica**: ¿qué nivel mínimo exigir cuando entre? (hoy sin audit trail por decisión DD-06) | Inicio de la fase de historia clínica | Product Owner |
| Media | ~~Cloud vs on-prem~~ → **parcialmente resuelta 2026-11-17**: local hasta el MVP, después Vercel/Render/Neon en plan gratuito (DD-10); quedan los límites reales de los planes (plan §12) y backups de datos sensibles | Despliegue / datos no-ficticios | Tech Lead |
| Media | **Cobros: ¿comprobante fiscal real o solo registro interno?** (hoy: solo registro interno, RN-COB-01) — confirmar si cambia al entrar cobros | Fase de cobros | Product Owner |
| Media | **Recordatorios: ¿WhatsApp Business API (tiene costo) o primero email?** | Épica de recordatorios | Product Owner |
| Baja | **¿Portal del paciente entra en MVP o post-lanzamiento?** (decidido: post — pero reabrir si se pide auto-servicio completo) | Épica portal | Product Owner |
| Baja | **Adopción de Docker**: si causa problemas en el entorno del equipo, ¿se cae a ejecución sin contenedores? (decisión: Docker solo si no complica; el plan §4 recomienda `docker compose` con PostgreSQL) | Setup del equipo | Equipo técnico |
| Baja | **Rol `PACIENTE` vs plan §5.2**: ¿hay auto-reserva de turnos por paciente en el MVP? (ver IN-03) | Roles y US-001 | Líder |

## Notas de contexto

- Las respuestas de esta tabla provienen del Q&A completado que cerró la fase Mode B de la KB; no deben re-preguntarse, solo evaluarse los hitos de decisión.
- Riesgo de scope (Discovery §10): si se reintenta meter historia clínica + cobros en el MVP, revisar primero `09_decisiones_y_supuestos.md` DD-02.

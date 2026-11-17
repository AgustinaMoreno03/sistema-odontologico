# Visión y Objetivos

## Propósito del sistema

Un sistema web único que gestione el consultorio odontológico (agenda, pacientes, turnos) y permita a los pacientes reservar turnos sin depender de llamadas o WhatsApp.

Hoy el consultorio no tiene un sistema único: la gestión se resuelve —aunque sea a medias— con planillas, cuadernos, WhatsApp y la memoria del odontólogo. Eso genera doble reserva, tiempo perdido confirmando turnos y (a futuro) historia clínica dispersa. El sistema reemplaza ese flujo disperso por una única fuente de verdad para el equipo y los pacientes.

## Objetivos por actor

| Actor | Objetivo principal | Objetivos secundarios |
|---|---|---|
| Odontólogo/a | Ver su agenda del día y gestionar sus turnos | Registrar atención (post-MVP); cargar historia clínica (post-MVP) |
| Paciente | Reservar o cancelar turnos sin llamar/escribir por WhatsApp | Ver sus datos y, a futuro, sus evoluciones |
| Recepción/Administración (`RECEPCION`) | Administrar la agenda general del consultorio | Crear, cancelar y reprogramar turnos; coordinar al equipo |
| `ADMIN_CONSULTORIO` | Gestionar los usuarios y permisos de **su consultorio** | Mantener la configuración base de su consultorio |
| `SUPERADMIN` (interno) | Dar de alta consultorios (tenants) — seed/script en MVP | — |
| Equipo de desarrollo (5 personas) | Mantener y evolucionar el sistema con cambios paralelos | Dividir el trabajo por épicas/historias sin pisarse |

## Alcance v1.0 (MVP)

- Agenda por odontólogo con turnos: alta, visualización, reserva y cancelación.
- Validación de solapamientos **dentro de cada consultorio (tenant)**: por profesional y por sillón/box; los turnos contiguos son válidos.
- Pacientes: alta y búsqueda con datos básicos (nombre, contacto), **dentro del tenant**.
- Catálogo mínimo: profesionales, sillones/boxes y prestaciones con duración variable.
- **Alta mínima de consultorio (tenant)** y **alta de usuarios** del consultorio (US-012, US-013).
- Usuarios y permisos: login por rol con RBAC simple (roles del sistema §5.2: `ADMIN_CONSULTORIO`, `ODONTOLOGO`, `RECEPCION` + `SUPERADMIN` interno — supuesto a confirmar con la líder).
- Backend API + lógica de dominio (Spring Boot + Gradle, monolito modular) como foco del MVP.
- Frontend mínimo y responsivo (TypeScript vanilla) **servido de forma estática por separado** del backend (CORS solo para su dominio).
- Ejecución **local hasta terminar el MVP** (PostgreSQL en Docker); despliegue posterior a Vercel/Render/Neon.
- Datos 100% ficticios (proyecto de estudiantes/grupo; sin compliance real).

## Fuera de alcance (MVP)

- Historia clínica (post-lanzamiento; confidencialidad diferida a fase posterior).
- Cobros / registro de pagos y deudas (post-lanzamiento; no facturación fiscal).
- Integraciones: WhatsApp Business API, email, pagos (Mercado Pago / transferencias / tarjetas).
- Recordatorios automáticos, facturación y reportes, portal del paciente.
- Auditoría de cambios (change-audit) — diferida.
- Planes de suscripción, cobros y facturación **de los consultorios** (multi-tenant sí entra; monetización no).
- Cloud y backups de datos sensibles durante el MVP: **decidido el despliegue** (Vercel/Render/Neon, DD-10) pero recién **después de terminar el MVP en local**; backups = decisión posterior.
- Despliegue en la nube durante el MVP: el sistema corre local hasta terminar el MVP (fase G del plan = despliegue).

## Métricas de éxito

- Cero doble reservas de turnos solapados (validación automática activa).
- Un paciente puede reservar/cancelar un turno sin intervención del odontólogo.
- El equipo (5 desarrolladores) puede implementar features en paralelo sin bloquearse (arquitectura y modelo separados por dominio).
- Nuevo desarrollador entiende el dominio leyendo la KB en < 1 hora.

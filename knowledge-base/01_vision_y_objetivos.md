# Visión y Objetivos

## Propósito del sistema

Un sistema web único que gestione el consultorio odontológico (agenda, pacientes, turnos) con una agenda compartida por el personal del consultorio.

Hoy el consultorio no tiene un sistema único: la gestión se resuelve —aunque sea a medias— con planillas, cuadernos, WhatsApp y la memoria del odontólogo. Eso genera doble reserva, tiempo perdido confirmando turnos y (a futuro) historia clínica dispersa. El sistema reemplaza ese flujo disperso por una única fuente de verdad para el equipo y los pacientes.

## Objetivos por actor

| Actor | Objetivo principal | Objetivos secundarios |
|---|---|---|
| Odontólogo/a | Ver su agenda y dar turnos si está habilitado | Registrar atención (post-MVP); cargar historia clínica (post-MVP) |
| Paciente | Solicitar turnos o cancelaciones por teléfono o WhatsApp | Obtener respuesta del consultorio |
| Recepción/Administración (`RECEPCION`) | Administrar la agenda general del consultorio | Crear, cancelar y reprogramar turnos; coordinar al equipo |
| `ADMIN_CONSULTORIO` | Gestionar los usuarios y permisos de **su consultorio** | Mantener la configuración base de su consultorio |
| Operación interna | Dar de alta consultorios (tenants) — seed/script en MVP | — |
| Equipo de desarrollo (5 personas) | Mantener y evolucionar el sistema con cambios paralelos | Dividir el trabajo por épicas/historias sin pisarse |

## Alcance v1.0 (MVP)

- Agenda por odontólogo con turnos: alta, visualización, reserva y cancelación.
- Validación de solapamientos **dentro de cada consultorio (tenant)**: por profesional y por sillón/box; los turnos contiguos son válidos.
- Pacientes: alta y búsqueda con datos básicos (nombre, contacto), **dentro del tenant**.
- Catálogo mínimo: profesionales, sillones/boxes y prestaciones con duración variable.
- **Alta mínima de consultorio (tenant)** y **alta de usuarios** del consultorio (US-012, US-013).
- Usuarios y permisos: login por rol con RBAC simple (roles del sistema §5.2: `ADMIN_CONSULTORIO`, `ODONTOLOGO` y `RECEPCION`).
- Backend API + lógica de dominio (Node.js + Express 5 (JavaScript), monolito modular) como foco del MVP.
- Frontend mínimo y responsivo (React 19 con Vite (JavaScript)) **servido de forma estática por separado** del backend (CORS solo para su dominio).
- Ejecución **local hasta terminar el MVP** (PostgreSQL en Docker); despliegue posterior a Vercel/Render/Neon.
- Datos 100% ficticios para desarrollo y demostración.

## Fuera de alcance (MVP)

- Historia clínica, cobros y sucursales se abordan en etapas posteriores.
- Cobros / registro de pagos y deudas (post-lanzamiento; no facturación fiscal).
- Integraciones: WhatsApp Business API, email, pagos (Mercado Pago / transferencias / tarjetas).
- Recordatorios automáticos, facturación y reportes, auto-reserva o portal del paciente durante los seis días de base.
- Auditoría de cambios (change-audit) — diferida.
- Planes de suscripción, cobros y facturación **de los consultorios** (multi-tenant sí entra; monetización no).
- Cloud y backups de datos sensibles durante el MVP: **decidido el despliegue** (Vercel/Render/Neon, DD-10) pero recién **después de terminar el MVP en local**; backups = decisión posterior.
- Despliegue en la nube durante el MVP: el sistema corre local hasta terminar el MVP (fase G del plan = despliegue).

## Métricas de éxito

- Cero doble reservas de turnos solapados (validación automática activa).
- Recepción gestiona el ciclo de turnos y registra las cancelaciones solicitadas por el paciente.
- El equipo (5 desarrolladores) puede implementar features en paralelo sin bloquearse (arquitectura y modelo separados por dominio).
- Nuevo desarrollador entiende el dominio leyendo la KB en < 1 hora.

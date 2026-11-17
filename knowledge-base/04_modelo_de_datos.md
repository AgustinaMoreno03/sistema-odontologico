# Modelo de Datos

> Actualizado 2026-11-17 con el plan de ejecución (§3): **multi-tenant** (DD-09) — `tenant_id` en todas las tablas de negocio y entidad `Consultorio` como tenant.

## Dominios

- **Tenancy** — `Consultorio` (tenant): la unidad aislada del SaaS.
- **Acceso** — usuarios, credenciales, roles y permisos (siempre dentro de un consultorio).
- **Catálogo** — profesionales, sillones/boxes y prestaciones (con duración) del consultorio.
- **Pacientes** — ficha básica del paciente (nombre, contacto).
- **Agenda y turnos** — agendas por profesional y turnos con horarios.

Dominios **post-MVP** (modelados conceptualmente, no se implementan aún): Atención y cobros; Historia clínica; suscripciones/facturación de consultorios.

## Multi-tenant (DD-09)

- **Esquema compartido** con `tenant_id` en **todas** las tablas de negocio.
- `tenant_id` sale **del usuario autenticado (token)**, nunca de un parámetro del cliente (RN-TEN-01).
- Filtrado automático por tenant en la capa de persistencia (filtro Hibernate / repositorio base).
- **Toda restricción única e índice incluye `tenant_id`** (el mismo email/username puede repetirse en consultorios distintos).
- Migraciones con **Flyway** versionadas en el repo (iguales en local y en Neon).
- Tests obligatorios de aislamiento entre tenants.

## ERD (Entity Relationship Diagram)

```
Consultorio (tenant) (1) ──── (N) Usuario
Consultorio (tenant) (1) ──── (N) Profesional
Consultorio (tenant) (1) ──── (N) SillonBox
Consultorio (tenant) (1) ──── (N) Prestacion
Consultorio (tenant) (1) ──── (N) Paciente
Consultorio (tenant) (1) ──── (N) AgendaSlot
Consultorio (tenant) (1) ──── (N) Turno

Rol (1) ──── (N) Usuario                [rol → permisos: simple, por rol]
Profesional (1) ──── (N) Turno
SillonBox (1) ──── (N) Turno            [opcional según turno]
Prestacion (1) ──── (N) Turno           [define la duración]
Paciente (1) ──── (N) Turno
AgendaSlot (0..1) ──── (1) Turno

Todas las tablas de negocio llevan tenant_id (FK → Consultorio).

Post-MVP (no implementar):
Paciente (1) ──── (N) HistoriaClinica / Evolucion
Atencion (1) ──── (1) Cobro ──── (N) Pago
Consultorio (1) ──── (1) Suscripcion / Plan   [planes y cobros de consultorios, fuera del MVP]
```

## Entidades

### Consultorio (tenant)
- Atributos: `id` (PK), `nombre`, `slug`/`codigo` (unique), `telefono`, `email`, `direccion` (opcional), `activo`, `creadoEn`.
- Es el **tenant**: todas las tablas de negocio referencian `tenantId` → `Consultorio.id`.
- Relaciones: 1:N con Usuario, Profesional, SillonBox, Prestacion, Paciente, AgendaSlot y Turno.
- Constraints: `slug`/`codigo` único **global** (identifica al tenant); `nombre` obligatorio.
- Índices: `slug`.
- **Alta en MVP**: vía seed/script del `SUPERADMIN` (sin pantalla) — ver DD-09 / US-012.

### Usuario
- Atributos: `id` (PK), `tenantId` (FK → Consultorio), `email`/`username`, `passwordHash`, `nombre`, `rol` (enum: ADMIN_CONSULTORIO, ODONTOLOGO, RECEPCION; interno: SUPERADMIN), `activo`, `creadoEn`.
- Relaciones: N:1 con Consultorio; 1:N con Turno (como odontólogo dueño de agenda).
- Constraints: **único compuesto** (`tenantId`, `username`) — `username` solo es único dentro del consultorio; `rol` obligatorio.
- Índices: (`tenantId`, `username`), `tenantId`.
- Nota: el `SUPERADMIN` es rol interno de plataforma (alta de consultorios) — en el MVP, seed/script.

### Rol y permisos
- Modelo simple: permisos asignados por rol (enumeración de recursos × lectura/escritura), no por usuario individual en el MVP.
- Relación: Rol 1:N Usuario (dentro del tenant).

### Profesional
- Atributos: `id` (PK), `tenantId` (FK → Consultorio), `nombre`, `apellido` (o `nombreCompleto`), `matricula` (opcional), `email` (opcional), `activo`, `creadoEn`.
- Puede estar vinculado a un `Usuario` con rol ODONTOLOGO (relación 1:1 opcional) o ser solo ficha de catálogo.
- Relaciones: 1:N con Turno; N:1 con Consultorio.
- Constraints: **único compuesto** (`tenantId`, `email`) si se informa; `nombre`/`apellido` obligatorios.
- Índices: (`tenantId`, `apellido`), `tenantId`.

### SillonBox
- Atributos: `id` (PK), `tenantId` (FK → Consultorio), `nombre` (p. ej. "Sillón 1", "Box 2"), `descripcion` (opcional), `activo`, `creadoEn`.
- Representa el **recurso físico** donde se atiende (sillón o box); los turnos no pueden solaparse sobre el mismo sillón/box dentro del tenant.
- Relaciones: N:1 con Consultorio; 1:N con Turno.
- Constraints: **único compuesto** (`tenantId`, `nombre`).
- Índices: (`tenantId`, `nombre`).

### Prestacion
- Atributos: `id` (PK), `tenantId` (FK → Consultorio), `nombre`, `duracionMin` (entero, **duración variable**), `descripcion` (opcional), `activo`, `creadoEn`.
- La duración de la prestación define la duración del turno (`horaFin` = `horaInicio` + `duracionMin`).
- Relaciones: N:1 con Consultorio; 1:N con Turno.
- Constraints: **único compuesto** (`tenantId`, `nombre`); `duracionMin` > 0.
- Índices: (`tenantId`, `nombre`).

### Paciente
- Atributos: `id` (PK), `tenantId` (FK → Consultorio), `nombre`, `apellido` (o `nombreCompleto`), `telefono`, `email` (opcional), `notas` (opcional), `activo`, `creadoEn`.
- Relaciones: N:1 con Consultorio; 1:N con Turno.
- Constraints: **único compuesto** (`tenantId`, `email`) si se informa; nombre y al menos un medio de contacto obligatorios.
- Índices: (`tenantId`, `nombre`), (`tenantId`, `telefono`).
- **Nota MVP**: ficha básica únicamente (nombre + contacto). Sin historia clínica.

### AgendaSlot / Agenda
- Atributos: `id` (PK), `tenantId` (FK → Consultorio), `profesionalId` (FK → Profesional), `dia`, `horaInicio`, `horaFin`, `activo`.
- Relaciones: N:1 con Consultorio y con Profesional; 1:1 o 1:N con Turno según si el turno ocupa un slot.
- Representa la disponibilidad semanal por profesional.
- Constraints/índices: índices (`tenantId`, `profesionalId`, `dia`).

### Turno
- Atributos: `id` (PK), `tenantId` (FK → Consultorio), `profesionalId` (FK → Profesional), `sillonBoxId` (FK → SillonBox, opcional), `prestacionId` (FK → Prestacion), `pacienteId` (FK → Paciente), `fecha`, `horaInicio`, `horaFin` (derivado de la duración de la prestación), `estado` (enum: RESERVADO, CANCELADO, ATENDIDO [post-MVP]), `creadoEn`.
- Relaciones: N:1 con Consultorio, Profesional, SillonBox, Prestacion y Paciente.
- Constraints: **sin solapamientos dentro del mismo tenant** — ni por profesional ni por sillón/box (RN-AG-02); un turno que empieza justo cuando termina otro **es válido** (no es solapamiento, RN-AG-06).
- Índices: (`tenantId`, `profesionalId`, `fecha`), (`tenantId`, `sillonBoxId`, `fecha`), (`tenantId`, `pacienteId`, `fecha`), `tenantId`.

### Post-MVP (no implementar en el MVP)
- **HistoriaClinica / Evolucion**: `id`, `tenantId`, `pacienteId`, `profesionalId`, `fecha`, `contenido` (dato de salud sensible, confidencial).
- **Atencion**: registro de la sesión atendida.
- **Cobro / Pago**: registro interno de deuda y pagos (**no** comprobante fiscal).
- **Suscripcion / Plan del consultorio**: planes de suscripción y facturación de los consultorios (fuera del MVP, DD-09).

## Seed data inicial

- 1 `SUPERADMIN` de plataforma (credenciales por variable de entorno) + script/seed que da de alta el primer `Consultorio` (tenant) en el MVP.
- 1 usuario `ADMIN_CONSULTORIO` por consultorio seed (credenciales iniciales por variable de entorno o reset en primer arranque).
- Roles pre-cargados: ADMIN_CONSULTORIO, ODONTOLOGO, RECEPCION (+ SUPERADMIN interno).
- 1-2 usuarios de prueba por rol (odontólogo, recepción) para desarrollo.
- Catálogo mínimo de ejemplo: profesionales, sillones/boxes y prestaciones con duración (del consultorio seed).
- Datos de pacientes y turnos **ficticios** (proyecto de estudiantes; sin datos reales).

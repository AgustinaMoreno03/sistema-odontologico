# Modelo de Datos

> Actualizado 2026-11-17 con el plan de ejecución (§3): **multi-tenant** (DD-09) — `consultorio_id` en todas las tablas de negocio y entidad `Consultorio` como tenant.

## Dominios

- **Consultorios** — `Consultorio` (tenant): la unidad aislada del SaaS.
- **Acceso** — usuarios, credenciales, roles y permisos (siempre dentro de un consultorio).
- **Catálogo** — profesionales, sillones/boxes y prestaciones (con duración) del consultorio.
- **Pacientes** — ficha básica del paciente (nombre, contacto).
- **Agenda y turnos** — agendas por profesional y turnos con horarios.

Dominios **post-MVP** (modelados conceptualmente, no se implementan aún): Atención y cobros; Historia clínica; suscripciones/facturación de consultorios.

## Multi-tenant (DD-09)

- **Esquema compartido** con `consultorio_id` en **todas** las tablas de negocio.
- `consultorio_id` sale **del usuario autenticado (token)**, nunca de un parámetro del cliente (RN-TEN-01).
- Cada consulta del repositorio filtra por el `consultorio_id` autenticado.
- **Toda restricción única e índice incluye `consultorio_id`** (el mismo email/username puede repetirse en consultorios distintos).
- Migraciones SQL numeradas en `db/migrations/` (iguales en local y en Neon).
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

Todas las tablas de negocio llevan consultorio_id (FK → Consultorio).

Post-MVP (no implementar):
Paciente (1) ──── (N) HistoriaClinica / Evolucion
Atencion (1) ──── (1) Cobro ──── (N) Pago
Consultorio (1) ──── (1) Suscripcion / Plan   [planes y cobros de consultorios, fuera del MVP]
```

## Entidades

### Consultorio (tenant)
- Atributos: `id` (PK), `nombre`, `slug`/`codigo` (unique), `telefono`, `email`, `direccion` (opcional), `activo`, `creadoEn`.
- Es el **tenant**: todas las tablas de negocio referencian `consultorioId` → `Consultorio.id`.
- Relaciones: 1:N con Usuario, Profesional, SillonBox, Prestacion, Paciente, AgendaSlot y Turno.
- Constraints: `slug`/`codigo` único **global** en el registro raíz de consultorios (identifica al tenant); `nombre` obligatorio.
- Índices: `slug`.
- **Alta en MVP**: vía seed o comando interno (sin pantalla) — ver DD-09 / US-012.

### Usuario
- Atributos: `id` (PK), `consultorioId` (FK → Consultorio), `email`/`username`, `passwordHash`, `nombre`, `rol` (enum: ADMIN_CONSULTORIO, ODONTOLOGO, RECEPCION), `activo`, `creadoEn`.
- Relaciones: N:1 con Consultorio; vínculo opcional con su ficha profesional.
- Constraints: **único compuesto** (`consultorioId`, `username`) — `username` solo es único dentro del consultorio; `rol` obligatorio.
- Índices: (`consultorioId`, `username`), `consultorioId`.
- Los permisos administrativos y la condición de profesional se representan por separado.

### Rol y permisos
- Modelo simple: permisos asignados por rol (enumeración de recursos × lectura/escritura), no por usuario individual en el MVP.
- Relación: Rol 1:N Usuario (dentro del tenant).

### Profesional
- Atributos: `id` (PK), `consultorioId` (FK → Consultorio), `nombre`, `apellido` (o `nombreCompleto`), `matricula` (opcional), `email` (opcional), `activo`, `creadoEn`.
- Puede estar vinculado a un `Usuario` del mismo consultorio (relación 1:1 opcional), incluso si esa persona también administra. La pertenencia profesional es independiente del permiso administrativo.
- Relaciones: 1:N con Turno; N:1 con Consultorio.
- Constraints: **único compuesto** (`consultorioId`, `email`) si se informa; `nombre`/`apellido` obligatorios.
- Índices: (`consultorioId`, `apellido`), `consultorioId`.

### SillonBox
- Atributos: `id` (PK), `consultorioId` (FK → Consultorio), `nombre` (p. ej. "Sillón 1", "Box 2"), `descripcion` (opcional), `activo`, `creadoEn`.
- Representa el **recurso físico** donde se atiende (sillón o box); los turnos no pueden solaparse sobre el mismo sillón/box dentro del tenant.
- Relaciones: N:1 con Consultorio; 1:N con Turno.
- Constraints: **único compuesto** (`consultorioId`, `nombre`).
- Índices: (`consultorioId`, `nombre`).

### Prestacion
- Atributos: `id` (PK), `consultorioId` (FK → Consultorio), `nombre`, `duracionMin` (entero, **duración variable**), `descripcion` (opcional), `activo`, `creadoEn`.
- La duración de la prestación define la duración del turno (`fin` = `inicio` + `duracionMin`).
- Relaciones: N:1 con Consultorio; 1:N con Turno.
- Constraints: **único compuesto** (`consultorioId`, `nombre`); `duracionMin` > 0.
- Índices: (`consultorioId`, `nombre`).

### Paciente
- Atributos: `id` (PK), `consultorioId` (FK → Consultorio), `nombre`, `apellido` (o `nombreCompleto`), `telefono`, `email` (opcional), `activo`, `creadoEn`.
- Relaciones: N:1 con Consultorio; 1:N con Turno.
- Constraints: **único compuesto** (`consultorioId`, `email`) si se informa; nombre y al menos un medio de contacto obligatorios.
- Índices: (`consultorioId`, `nombre`), (`consultorioId`, `telefono`).
- **Nota MVP**: ficha básica únicamente (nombre + contacto). Sin historia clínica.

### AgendaSlot / Agenda
- Atributos: `id` (PK), `consultorioId` (FK → Consultorio), `profesionalId` (FK → Profesional), `dia`, `horaInicio`, `horaFin`, `activo`.
- Relaciones: N:1 con Consultorio y con Profesional; El spec de C05 define cómo se consulta la disponibilidad.
- Representa la disponibilidad del profesional. Los bloqueos excepcionales se amplían si hay capacidad tras el flujo base.
- Constraints/índices: índices (`consultorioId`, `profesionalId`, `dia`).

### Turno
- Guardar instantes en UTC con `timestamptz`. Mostrar en `America/Argentina/Buenos_Aires`. Usar intervalos `[inicio, fin)`.
- Estados previstos: `PENDIENTE`, `CONFIRMADO`, `ATENDIDO`, `AUSENTE`, `CANCELADO`. El flujo base necesita registrar reservas y cancelaciones. El spec decide las transiciones de confirmación y asistencia según el plazo.
- Las referencias de negocio deben corresponder al mismo consultorio. Las cancelaciones conservan el turno y liberan el horario.
- Atributos: `id` (PK), `consultorioId` (FK → Consultorio), `profesionalId` (FK → Profesional), `sillonBoxId` (FK → SillonBox, opcional), `prestacionId` (FK → Prestacion), `pacienteId` (FK → Paciente), `inicio`, `fin` (derivado de la duración), `estado`, `creadoEn`, `canceladoEn`, identificador del usuario que registró la cancelación y origen (`PACIENTE` o `CONSULTORIO`).
- Relaciones: N:1 con Consultorio, Profesional, SillonBox, Prestacion y Paciente.
- Constraints: **sin solapamientos dentro del mismo tenant** — ni por profesional ni por sillón/box (RN-AG-02); un turno que empieza justo cuando termina otro **es válido** (no es solapamiento, RN-AG-06).
- Índices: (`consultorioId`, `profesionalId`, `inicio`), (`consultorioId`, `sillonBoxId`, `inicio`), (`consultorioId`, `pacienteId`, `inicio`), `consultorioId`.

### Post-MVP (no implementar en el MVP)
- **HistoriaClinica / Evolucion**: `id`, `consultorioId`, `pacienteId`, `profesionalId`, `fecha`, `autor`, `contenido` (dato de salud confidencial). Las correcciones agregan registros y conservan el original.
- **Atencion**: registro de la sesión atendida.
- **Cobro / Pago**: registro interno de deuda y pagos (**no** comprobante fiscal).
- **Suscripcion / Plan del consultorio**: planes de suscripción y facturación de los consultorios (fuera del MVP, DD-09).

## Seed data inicial

- Script o seed que da de alta el primer `Consultorio` del MVP.
- 1 usuario `ADMIN_CONSULTORIO` por consultorio seed (credenciales iniciales por variable de entorno o reset en primer arranque).
- Roles pre-cargados: ADMIN_CONSULTORIO, ODONTOLOGO, RECEPCION.
- 1-2 usuarios de prueba por rol (odontólogo, recepción) para desarrollo.
- Catálogo mínimo de ejemplo: profesionales, sillones/boxes y prestaciones con duración (del consultorio seed).
- Datos de pacientes y turnos **ficticios** (proyecto de estudiantes; sin datos reales).

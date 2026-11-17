# Funcionalidades

Organizadas por **épica** y luego por **historia de usuario** (formato US-NNN).
Alcance según Q&A completada: MVP recortado frente al Discovery original — ver columna de fase.
*Actualizado 2026-11-17 (plan de ejecución §3): el MVP sigue siendo **agenda + turnos + paciente mínimo**; se suman como MVP las altas mínimas de **consultorio (tenant)** y de **usuarios** (US-012 y US-013).*

## Épica 0: Tenancy mínimo (MVP ✅)

> Nuevo (2026-11-17, plan §3): altas mínimas para que el SaaS multi-tenant funcione desde el MVP. **Sin pantalla de suscripciones ni cobros** (eso es post-MVP, DD-09).

### US-012 — Dar de alta un consultorio (tenant)
**Como** `SUPERADMIN` (rol interno de plataforma)
**Quiero** crear un consultorio para que exista como tenant aislado
**Para** que sus datos estén separados de los de otros consultorios

**Criterios de aceptación**:
- [ ] El consultorio queda creado con `tenantId` propio y es el contenedor de sus usuarios, catálogo, pacientes y turnos
- [ ] **En el MVP el alta es un seed o script, sin pantalla** (plan §5.2)
- [ ] Datos siempre ficticios

**Reglas relacionadas**: RN-TEN-01, RN-TEN-02, RN-TEN-04

### US-013 — Alta de usuarios del consultorio
**Como** `ADMIN_CONSULTORIO`
**Quiero** crear usuarios (roles `ODONTOLOGO` / `RECEPCION`) dentro de **mi** consultorio
**Para** que el equipo del consultorio pueda loguearse y trabajar en su tenant

**Criterios de aceptación**:
- [ ] Los usuarios creados quedan asociados a **mi** consultorio (tenant)
- [ ] No puedo crear ni ver usuarios de otro consultorio
- [ ] Usuario nuevo no puede iniciar sesión hasta activarse (si aplica)

**Reglas relacionadas**: RN-AU-02, RN-AU-03, RN-TEN-02

> Nota (plan §7): el **catálogo** mínimo —profesionales, sillones/boxes y prestaciones con duración variable— es prerequisito del cambio de turnos (C05); sus historias de usuario se detallan al proponer esos changes.

## Épica 1: Agenda y turnos (MVP ✅)

### US-001 — Reservar un turno
**Como** paciente
**Quiero** reservar un turno en la disponibilidad del odontólogo
**Para** no depender de llamadas o mensajes de WhatsApp

**Criterios de aceptación**:
- [ ] Veo los slots disponibles del odontólogo por fecha
- [ ] Al reservar, el sistema valida que no haya solapamiento (propio ni del odontólogo)
- [ ] Recibo confirmación con fecha/hora/odontólogo
- [ ] No puedo reservar turnos de otro paciente

**Reglas relacionadas**: RN-AG-01, RN-AG-02, RN-AG-04, RN-AG-05

### US-002 — Cancelar un turno
**Como** paciente
**Quiero** cancelar un turno que reservé
**Para** liberar el horario si ya no puedo asistir

**Criterios de aceptación**:
- [ ] Solo puedo cancelar mis propios turnos
- [ ] El estado del turno pasa a CANCELADO y el slot vuelve a estar disponible
- [ ] El odontólogo/recepción ve la cancelación en la agenda

**Reglas relacionadas**: RN-AG-03, RN-AG-04

### US-003 — Ver la agenda del día
**Como** odontólogo
**Quiero** ver mi agenda del día (y por rango de fechas)
**Para** saber qué turnos tengo y con quién

**Criterios de aceptación**:
- [ ] Veo mis turnos ordenados por hora con estado y paciente
- [ ] Recepción ve la agenda general de todos los odontólogos; cada odontólogo solo la suya

**Reglas relacionadas**: RN-AG-03

### US-004 — Administrar la agenda general
**Como** recepción/administración
**Quiero** crear, mover y cancelar turnos en la agenda de cualquier odontólogo
**Para** coordinar al equipo y resolver cambios de último momento

**Criterios de aceptación**:
- [ ] Puedo reservar/cancelar/mover turnos de cualquier odontólogo
- [ ] Las validaciones de solapamiento aplican igual que en auto-reserva

**Reglas relacionadas**: RN-AG-01, RN-AG-02, RN-AG-03

### US-005 — Definir slots de agenda del odontólogo
**Como** odontólogo (o recepción)
**Quiero** definir mi disponibilidad semanal (días y horarios)
**Para** que los pacientes solo reserven dentro de mi agenda real

**Criterios de aceptación**:
- [ ] Alta/edición/baja de slots por día y rango horario
- [ ] Los turnos solo se crean dentro de slots activos

**Reglas relacionadas**: RN-AG-05

## Épica 2: Pacientes (MVP ✅ — ficha básica)

### US-006 — Dar de alta un paciente
**Como** recepción o administrador
**Quiero** registrar un paciente con nombre y contacto
**Para** poder asignarle turnos

**Criterios de aceptación**:
- [ ] Nombre y al menos un medio de contacto son obligatorios
- [ ] Alta sin duplicados obvios (misma búsqueda previa)

**Reglas relacionadas**: RN-PAC-01

### US-007 — Buscar pacientes
**Como** recepción o odontólogo
**Quiero** buscar pacientes por nombre o contacto
**Para** encontrar rápido su ficha o asignarle un turno

**Criterios de aceptación**:
- [ ] Búsqueda por nombre y teléfono/email
- [ ] Resultados muestran solo ficha básica (nombre, contacto)

**Reglas relacionadas**: RN-PAC-02

## Épica 3: Usuarios y permisos (MVP ✅)

### US-008 — Login por rol
**Como** usuario (cualquiera de los roles del sistema)
**Quiero** iniciar sesión con mis credenciales
**Para** acceder a lo que mi rol me permite

**Criterios de aceptación**:
- [ ] Login con email/usuario + contraseña
- [ ] Sesión expira por inactividad
- [ ] Cada rol ve solo sus pantallas/endpoints
- [ ] El login resuelve el **tenant (consultorio)** desde el usuario autenticado — nunca desde un dato del cliente

**Reglas relacionadas**: RN-AU-01, RN-AU-02, RN-TEN-01

### US-009 — Gestionar usuarios y permisos
**Como** `ADMIN_CONSULTORIO`
**Quiero** crear usuarios, asignar roles y desactivar accesos **de mi consultorio**
**Para** que cada rol vea solo lo que le corresponde

**Criterios de aceptación**:
- [ ] Alta/baja/edición de usuarios con rol, siempre dentro de mi tenant (ver también US-013)
- [ ] Solo el admin **de ese consultorio** accede a esta pantalla
- [ ] Usuario desactivado no puede iniciar sesión

**Reglas relacionadas**: RN-AU-02, RN-AU-03, RN-TEN-02

## Épica 4: Historia clínica (POST-MVP ❌ — fuera del MVP)

> Decisión del Q&A: **NO entra al MVP**; es post-lanzamiento. Pendiente de cuándo entra al alcance (pregunta abierta).

### US-010 — Cargar evolución del paciente (post-MVP)
**Como** odontólogo
**Quiero** registrar la evolución del paciente que atiendo
**Para** mantener la historia clínica ordenada y confidencial

**Criterios de aceptación (preliminares)**:
- [ ] Solo el odontólogo dueño de la agenda edita la historia
- [ ] Acceso restringido (confidencialidad)

**Reglas relacionadas**: RN-HC-01, RN-HC-02

## Épica 5: Atención y cobros (POST-MVP ❌ — fuera del MVP)

### US-011 — Registrar atención y cobro (post-MVP)
**Como** odontólogo/recepción
**Quiero** registrar la sesión atendida y el pago correspondiente
**Para** tener el control de deudas y pagos al día

**Criterios de aceptación (preliminares)**:
- [ ] El cobro es registro interno (no comprobante fiscal)
- [ ] Recepción ve deudas/pagos generales

**Reglas relacionadas**: RN-COB-01, RN-COB-02

## Épica 6: Opcionales (POST-MVP ❌)

- **Recordatorios automáticos** (WhatsApp/Email) — decidir canal primero (costo WhatsApp Business API).
- **Facturación y reportes**.
- **Portal del paciente** (reserva/consulta auto-servicio completo) — decidir si entra en MVP o después (ya decidido: no entra).

# Reglas de Negocio

Cada regla tiene un código único `RN-{DOMINIO}-{NN}` para trazabilidad.

## Dominio: Autenticación (RN-AU)

- **RN-AU-01**: Solo usuarios autenticados acceden a la API salvo las rutas públicas de login — el frontend es estático pero los datos siempre pasan por autorización.
- **RN-AU-02**: Cada usuario tiene exactamente uno de los roles del sistema (`ADMIN_CONSULTORIO`, `ODONTOLOGO`, `RECEPCION`; más el interno `SUPERADMIN`) — el rol define todos sus permisos (modelo simple rol→permisos). *Roles según plan de ejecución §5.2: **supuesto, confirmar con la líder**.*
- **RN-AU-03**: El `ADMIN_CONSULTORIO` es quien crea/desactiva usuarios de **su consultorio** y les asigna roles (dentro de su tenant).

## Dominio: Tenancy / aislamiento de consultorios (RN-TEN) — 2026-11-17

- **RN-TEN-01**: El `tenant_id` (consultorio) de cada request se determina **exclusivamente desde el usuario autenticado (token)**; **nunca** se acepta un identificador de consultorio enviado por el cliente (body, query o header).
- **RN-TEN-02**: **Todo acceso a datos de negocio filtra por `tenant_id`**: un usuario del tenant A **no puede ver ni modificar** datos del tenant B. Filtrado automático en la capa de persistencia (no a mano en cada consulta) y **tests obligatorios de aislamiento**.
- **RN-TEN-03**: Las restricciones únicas e índices **incluyen `tenant_id`** (p. ej. username/email único **dentro** de cada consultorio).
- **RN-TEN-04**: El alta de consultorios (tenants) la hace únicamente el rol interno `SUPERADMIN` (en el MVP: seed/script, sin pantalla).

## Dominio: Agenda y turnos (RN-AG)

> Todas las reglas de agenda aplican **dentro de cada tenant**: no hay solapamientos ni conflictos entre consultorios distintos (se separan por `tenant_id`, RN-TEN-02).

- **RN-AG-01**: **Un paciente no puede tener dos turnos solapados** (dentro del mismo consultorio) — validación en el servidor al reservar (regla dura del dominio).
- **RN-AG-02**: La agenda **no admite turnos solapados por profesional ni por sillón/box** dentro del mismo tenant — un profesional atiende un turno a la vez y un sillón/box se usa a la vez (un odontólogo puede tener más de una silla, por eso el control es por profesional **y** por sillón/box).
- **RN-AG-03**: Solo el odontólogo **dueño** de la agenda (o recepción/administración del mismo consultorio) edita o cancela turnos de esa agenda — un odontólogo no toca la agenda de otro, ni nada de otro tenant.
- **RN-AG-04**: Un paciente solo puede reservar/cancelar sus propios turnos (dentro de su consultorio).
- **RN-AG-05**: Todo turno debe estar dentro de un slot de agenda activo del odontólogo correspondiente.
- **RN-AG-06**: **Los turnos contiguos son válidos**: un turno que empieza **justo cuando termina** otro (mismo profesional o mismo sillón/box) **no** se considera solapamiento.
- **RN-AG-07**: **La duración del turno la define la prestación** (duración variable por prestación): `horaFin = horaInicio + duración de la prestación`; el solapamiento se calcula sobre ese rango.

## Dominio: Pacientes (RN-PAC)

- **RN-PAC-01**: Un paciente requiere nombre y al menos un medio de contacto (teléfono o email) para darse de alta.
- **RN-PAC-02**: El buscador de pacientes solo devuelve fichas básicas (nombre, contacto) en el MVP — no hay historia clínica todavía.

## Dominio: Historia clínica (RN-HC) — post-MVP, diferida

- **RN-HC-01**: **Solo el odontólogo dueño de la agenda carga/edita la historia clínica** del paciente que atiende.
- **RN-HC-02**: **La historia clínica es confidencial** (dato de salud sensible): acceso restringido al odontólogo tratante y, según política futura, al paciente sobre sus propios datos.
- *Nota*: entra en alcance en fase post-lanzamiento; el nivel mínimo de auditoría/backups es pregunta abierta (ver `10_preguntas_abiertas.md`).

## Dominio: Cobros (RN-COB) — post-MVP, diferida

- **RN-COB-01**: Los cobros son un **registro interno de pagos/deudas**, no facturación fiscal (no emiten comprobante fiscal en esta fase).
- **RN-COB-02**: Cobrar una sesión queda ligada a la atención registrada (relación 1:1 conceptual).

## Dominio: Excepciones globales

- **RN-EX-01**: Todo lo no listado explícitamente como post-MVP está **fuera del MVP** — la regla por defecto ante la duda es no agregar alcance (control de scope).
- **RN-EX-02**: Los datos del sistema son **ficticios** (proyecto de estudiantes/grupo): no se aplica compliance real. *(2026-11-17)*: el sistema ya es **multi-tenant** (RN-TEN, DD-09); el aislamiento entre consultorios es regla dura, no "preparación futura".
- **RN-EX-03**: Sin auditoría de cambios en el MVP (change-audit diferido).

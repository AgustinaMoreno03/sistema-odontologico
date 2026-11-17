# Actores y Roles

> Actualizado 2026-11-17 con el plan de ejecución §5.2: roles del sistema `ADMIN_CONSULTORIO`, `ODONTOLOGO`, `RECEPCION` + `SUPERADMIN` interno. **Supuesto: confirmar con la líder** (el plan marca §5.2 como supuesto).

## Actores del sistema

| Actor | Descripción | Cómo interactúa |
|---|---|---|
| `ADMIN_CONSULTORIO` | Administra **su consultorio** y sus usuarios | Login; crea/da de baja usuarios de su consultorio y les asigna roles; gestiona la configuración base de su consultorio |
| `ODONTOLOGO` | Profesional que atiende en el consultorio y es dueño de su agenda | Login; ve y gestiona **su propia agenda** y sus turnos; futuramente registra atención e historia clínica |
| `RECEPCION` | Personal que administra la agenda general del consultorio | Login; **crea, cancela y reprograma turnos** de su consultorio; gestiona pacientes |
| `SUPERADMIN` (interno de plataforma) | Rol interno, **no es pantalla de usuario** | Da de alta consultorios (tenants); en el MVP es un **seed o script**, sin pantalla |

*Nota (contradicción detectada 2026-11-17)*: el plan §5.2 **no lista un rol `PACIENTE`** con auto-reserva de turnos (US-001). Hasta confirmar con la líder, la reserva de turnos queda del lado de `RECEPCION`/`ODONTOLOGO` según §5.2; ver IN-03 en `10_preguntas_abiertas.md`.

Escala: multi-tenant — **< 50 usuarios por tenant**. Proyecto de estudiantes con un equipo de desarrollo de 5 (Agustina, Lucia, Kevin, Lea, Gero).

## RBAC — Matriz de permisos

Modelo simple **rol → permisos** (sin jerarquías complejas). Roles del sistema (plan §5.2 — supuesto a confirmar con la líder):

| Rol | Pacientes | Catálogo (profesionales, sillones/boxes, prestaciones) | Agenda/Turnos | Usuarios del consultorio | Consultorio (tenant) | Historia clínica (post-MVP) |
|---|---|---|---|---|---|---|
| `ADMIN_CONSULTORIO` | CRUD (de su consultorio) | CRUD (de su consultorio) | Lectura | CRUD **solo de su consultorio** | Lectura/edición de su consultorio | — |
| `ODONTOLOGO` | Lectura de su consultorio | Lectura | CRUD **solo de su agenda** | — | — | CRUD solo de su propia historia (post-MVP) |
| `RECEPCION` | CRUD (de su consultorio) | Lectura | CRUD (agenda general de su consultorio: crear, cancelar, reprogramar) | — | — | — |
| `SUPERADMIN` (interno) | — | — | — | — | **Alta de consultorios** (seed/script en MVP) | — |

Notas:
- Permisos como enumeración simple por recurso (lectura/escritura), asignados por rol; no se necesita motor de permisos complejo en el MVP.
- Regla dura transversal: **solo el odontólogo dueño de la agenda edita** su agenda (ver `05_reglas_de_negocio.md`) y **nadie ve datos de otro tenant** (RN-TEN-02).
- El `SUPERADMIN` no pertenece a ningún consultorio: es rol de plataforma para el alta de tenants.

## Rutas públicas

Sin autenticación:
- Ruta de login / página de autenticación.
- (MVP) Cualquier endpoint público estrictamente necesario para el login; todo lo demás requiere sesión/rol **y tenant resuelto desde el token** (RN-TEN-01).

Post-MVP se evaluará si la reserva pública de turnos (sin login de paciente) habilita rutas públicas adicionales — ver pregunta abierta sobre portal del paciente.

## Roles del equipo (se mantienen — plan §5.1)

| Integrante | Rol |
|---|---|
| Agustina | **Líder:** conduce la fundación y el ciclo OPSX, crea el repo, maneja la rama principal y controla los PR, define secuencia y paralelismo de los changes |
| Lucia, Kevin, Lea, Gero | Integrantes: cada uno con su rama, sus commits y sus changes asignados |

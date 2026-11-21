# Actores y Roles

| Rol | Permisos en el consultorio |
|---|---|
| `ADMIN_CONSULTORIO` (dueño o admin) | Administra usuarios, catálogo, fichas básicas y todas las agendas del consultorio. |
| `ODONTOLOGO` | Consulta su propia agenda y las fichas básicas necesarias para atender. Puede marcar asistencia y bloquear su agenda. Puede dar turnos en su agenda cuando el consultorio opera sin recepción y se le habilita ese permiso. |
| `RECEPCION` | Gestiona la agenda general. Crea, reprograma y cancela turnos. Registra y consulta los datos básicos de contacto de los pacientes. |

El alta inicial de consultorios se hace mediante un seed o comando operativo. Ese mecanismo interno no constituye un rol de agenda.

El permiso administrativo y la condición de profesional se representan por separado. Una misma persona puede administrar el consultorio y tener una ficha profesional vinculada. La interfaz de autenticación devuelve `{ usuarioId, consultorioId, rol }` y la autorización profesional se resuelve dentro del consultorio a partir de la identidad autenticada.

El paciente no tiene cuenta ni rol en el sistema (DD-16): es un actor externo con registro mínimo — nombre y al menos un contacto, siempre datos ficticios — que crea y gestiona recepción. Solicita turnos o cancelaciones al consultorio. La reserva online y la auto-reserva quedan fuera de la entrega base de seis días.

## Historia clínica posterior al MVP

En el caso de un único profesional, el odontólogo autorizado es quien accede dentro de la aplicación. La administración y recepción no conceden acceso clínico por sí solas. El dueño que también es odontólogo accede por su condición profesional. El vínculo de atención y el acceso de excepción se evaluarán si se amplía a varios profesionales, incluida una posible integración con PuntoOrden.

## Equipo

Agustina conduce la fundación y los PR. Lucia, Kevin, Lea y Gero mantienen las asignaciones del roadmap. La cátedra permite hasta seis integrantes según la actualización comunicada al equipo.

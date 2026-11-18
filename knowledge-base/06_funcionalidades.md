# Funcionalidades

| Historia | Actor y resultado | Change |
|---|---|---|
| US-001 | Recepción o administración crea un turno para un paciente, con duración de la prestación y sin solapamientos por profesional, box ni paciente. El profesional habilitado puede dar turnos en su propia agenda cuando el consultorio opera sin recepción. | C05 |
| US-002 | Recepción o administración cancela un turno. El registro se conserva, se libera el horario y queda constancia de quién operó, quién lo solicitó y cuándo. | C06 |
| US-003 | El odontólogo consulta su agenda diaria o semanal. Recepción y administración consultan las agendas del consultorio. | C08 |
| US-004 | Recepción o administración reprograma un turno con las mismas garantías de disponibilidad. | C07 |
| US-005 | El consultorio dispone de un catálogo de profesionales y sillones/boxes. | C02 |
| US-006 | Recepción da de alta a un paciente con nombre y contacto. | C03 |
| US-007 | Recepción busca fichas básicas de su consultorio. | C03 |
| US-008 | Un usuario inicia sesión en el módulo aislado y el sistema aplica sus permisos dentro del consultorio. | C00–C01 |
| US-009 | El administrador gestiona usuarios y permisos de su consultorio. | C01 |
| US-012 | El equipo da de alta un consultorio mediante un comando o seed interno. | C01 |
| US-013 | El administrador provisiona usuarios dentro del consultorio. | C01 |
| US-014 | El catálogo registra prestaciones con duración positiva. | C04 |

C09 integra el flujo principal en React 19 y se puede recortar si el plazo compromete la verificación del backend. El spec de cada change identifica un escenario feliz, un error de negocio y un borde, como mínimo.

## Extensiones de agenda sujetas al plazo

Después del flujo base, confirmar turnos, marcar atendido o ausente en la propia agenda y bloquear horarios del profesional. Cualquier bloqueo habilitado debe participar de las reglas de disponibilidad. La auto-reserva queda fuera de los seis días de base. Puede retomarse si sobra tiempo, junto con la alternativa de enlace de cancelación por turno sin cuenta de paciente.

## Post-MVP

- US-010. Historia clínica con acceso profesional y correcciones por adición.
- US-011. Cobros y contabilidad en un módulo separado.
- Sucursales, recordatorios automáticos e integraciones externas.

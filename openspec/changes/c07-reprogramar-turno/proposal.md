# Proposal

## Why

US-004: recepción y administración necesitan corregir la fecha y la hora de un turno ya reservado con las mismas garantías de disponibilidad que la creación (C05). Sin C07, un turno mal reservado solo podría cancelarse y volver a crearse, perdiendo la continuidad del registro.

## What Changes

- Reprogramar la fecha y hora de un turno existente del consultorio autenticado, revalidando **todas** las reglas de solapamiento sobre el nuevo intervalo: RN-AG-01 (paciente), RN-AG-02 (profesional y sillón/box) y RN-AG-06 (intervalos `[inicio, fin)` con contiguos válidos).
- Excluir el turno que se está moviendo de la comprobación de disponibilidad, para que no se solape consigo mismo.
- Recalcular el fin a partir de la duración de la prestación (RN-AG-07); el cliente no envía el fin.
- Operar de forma transaccional: si la validación del nuevo rango falla, el turno **conserva su horario anterior** (RN-AG-09).
- Autorizar la operación a `RECEPCION` y `ADMIN_CONSULTORIO`; un `ODONTOLOGO` recibe 403 y una solicitud sin token válida recibe 401 (RN-AG-03).
- Resolver `consultorioId` exclusivamente del token autenticado (RN-TEN-01/02); un turno de otro consultorio no es reprogramable.
- **Reutilizar la interfaz de validación de disponibilidad de C05 en lugar de duplicar su lógica** (riesgo registrado en CHANGES.md §C07). C05 aún no existe como change; este plan deja dicha dependencia explícita.
- Sin migración nueva: es un comportamiento sobre las tablas que crea C05. El rango 070–079 reservado para C07 queda sin usar salvo que surja una necesidad real.

## Capabilities

### New Capabilities

- `turnos`: agenda de turnos del consultorio — en este change, la reprogramación de fecha/hora con revalidación de disponibilidad, autorización por rol y aislamiento por consultorio. Los requisitos de reserva los aporta C05 y los de cancelación C06, sobre el mismo capability.

### Modified Capabilities

## Impact

- Módulo `turnos`, organizado en capas rutas → servicio → dominio → repositorios con SQL parametrizado; endpoint de reprogramación nuevo.
- Consumidor del middleware de autenticación de C00 (`{ usuarioId, consultorioId, rol }`) y de la interfaz pública de validación de disponibilidad que publicará C05.
- Sin cambios al spec `auth`: la autorización por rol de esta operación se especifica dentro de `turnos`, como en C03 con `pacientes`.
- Sin migración nueva (rango 070–079 reservado sin usar).
- Pruebas con `npm test` (Vitest) sobre PostgreSQL con datos ficticios, incluyendo aislamiento entre consultorios y concurrencia.
- Coordinación de archivos compartidos con C06 y C08, que trabajan en el mismo módulo `turnos`.

**Dependencia:** C07 depende de C05 (crear turno sin solapamientos), que todavía no existe — ni change ni código (`src/modules/turnos/` solo contiene `.gitkeep`). Apply requiere la interfaz de validación de C05 acordada e integrada.

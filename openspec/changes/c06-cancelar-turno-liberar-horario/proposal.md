# Proposal

## Why

El consultorio necesita registrar las cancelaciones solicitadas por pacientes sin perder el historial y liberar el horario para una nueva reserva. C06 completa el ciclo básico de turnos con autorización, auditoría y respuestas seguras ante solicitudes inválidas o repetidas.

## What Changes

- Agregar `PATCH /api/turnos/:id/cancelar`, siguiendo el estilo de ruta de C07: validación de forma, autorización y caso de uso en capas.
- Permitir cancelar a `RECEPCION` y `ADMIN_CONSULTORIO`; `ODONTOLOGO` recibe 403.
- Exigir `solicitadoPor` con valor `PACIENTE` o `CONSULTORIO`; ausencia o valor inválido responde 400.
- Cambiar el estado de un turno `PENDIENTE` a `CANCELADO` conservando el turno y guardar fecha UTC, usuario operador derivado de `req.auth` y solicitante. Repetir una cancelación responde 409 sin alterar la auditoría original; `CONFIRMADO`, `ATENDIDO` y `AUSENTE` quedan fuera de alcance.
- Responder 404 si el turno no existe en el consultorio autenticado y 409 si su inicio ya ocurrió.
- Incorporar una migración nueva del rango 060–069 para los datos de auditoría faltantes; `050_turno.sql` ya define `cancelado_en`. No editar migraciones existentes.
- Actualizar el contrato principal de turnos para incluir cancelación y retirar esa funcionalidad de su lista de exclusiones.

## Capabilities

### New Capabilities

### Modified Capabilities

- `turnos`: incorporar cancelación de turnos y retirar cancelación de fuera de alcance.

## Impact

- API y módulo `src/modules/turnos/` (ruta, servicio, repositorio y dominio).
- Nueva migración SQL en `db/migrations/060–069`; posible impacto en el orden de aplicación relativo a la migración 070 de C07, que se documentará en el design.
- Spec principal `openspec/specs/turnos/spec.md` y delta spec de este change.
- Tests HTTP, servicio y repositorio contra PostgreSQL; sin dependencias nuevas previstas.

# Tasks

## 1. Gate de dependencia

- [x] 1.1 Confirmar la dependencia C05: Agus confirmó que está integrado en `main` con 379 tests en verde; OpenSpec figura in-progress solo porque falta archivar la carpeta. Se toma la dependencia como cumplida.

## 2. Migración y auditoría

- [ ] 2.1 RED: agregar primero una prueba de esquema/migración que espere `cancelado_por` y `solicitado_por` en `turno`, incluida la FK al usuario y la restricción de valores permitidos; verificar que falla antes de crear la migración. `cancelado_en` ya existe desde 050.
- [ ] 2.2 GREEN: crear una migración forward-only `060_cancelar_turno.sql` con los campos de auditoría faltantes y sus constraints, sin editar 001–050 ni 070; verificar migración y re-ejecución en base vacía y con 070 ya aplicada.
- [ ] 2.3 Actualizar fixtures/helpers de turnos con datos ficticios de cancelación y limpieza filtrada por IDs propios; verificar que las pruebas de esquema y las pruebas de humo pasan.

## 3. Repositorio y dominio

- [ ] 3.1 RED: escribir pruebas del repositorio para cancelación transaccional, aislamiento por `consultorio_id`, turno inexistente/ajeno, turno ya cancelado sin alterar auditoría, rechazo de estados `ATENDIDO`/`AUSENTE`, aceptación de `PENDIENTE`/`CONFIRMADO`, inicio pasado y auditoría persistida; verificar fallos esperados contra PostgreSQL real.
- [ ] 3.2 GREEN: implementar la lectura `FOR UPDATE`, validaciones bajo lock y UPDATE parametrizado con reloj UTC de PostgreSQL en `src/modules/turnos/repositorio.js`; verificar todos los casos de 3.1 en verde.
- [ ] 3.3 RED: agregar pruebas de dominio/servicio para UUID, `solicitadoPor` (`PACIENTE`/`CONSULTORIO`) y errores 409 de cancelación repetida/turno pasado; verificar que fallan antes de implementar esas reglas.
- [ ] 3.4 GREEN: implementar validación y coordinación del caso de uso en dominio/servicio; verificar las pruebas de 3.3 en verde.
- [ ] 3.5 Documentar la firma y errores del caso de uso en `src/modules/turnos/README.md`; verificar que la interfaz descrita corresponde a los tests y al DTO de cancelación.

## 4. Ruta HTTP

- [ ] 4.1 RED: agregar pruebas HTTP para recepción/admin autorizados, `ODONTOLOGO` 403, `solicitadoPor` ausente/inválido 400, UUID inválido 400, turno inexistente/ajeno 404 `TURNO_NO_ENCONTRADO`, turno repetido 409 `TURNO_YA_CANCELADO`, pasado 409 `TURNO_PASADO` y estados `ATENDIDO`/`AUSENTE` 409 `ESTADO_INVALIDO`; verificar que fallan antes de implementar la ruta.
- [ ] 4.2 GREEN: agregar `PATCH /api/turnos/:id/cancelar` siguiendo el patrón de C07, derivando consultorio y operador solo de `req.auth`, con errores y DTO acordes al contrato; verificar las pruebas HTTP en verde.

## 5. Integración, liberación y concurrencia

- [ ] 5.1 RED: agregar prueba end-to-end de cancelación seguida de creación sobre mismo horario, paciente, profesional y sillón; verificar que antes del cambio el turno original bloquea la reserva.
- [ ] 5.2 GREEN: integrar la ruta, servicio y repositorio sin cambiar las restricciones de exclusión de C05; verificar que cancelar responde 200 y la nueva reserva responde 201, conservando ambos registros.
- [ ] 5.3 RED: agregar la prueba de dos solicitudes concurrentes de cancelación sobre el mismo turno y verificar que detecta la carrera/auditoría sobrescrita antes de serializar.
- [ ] 5.4 GREEN: hacer que la operación concurrente sea atómica e idempotente bajo lock; verificar que solo una solicitud modifica la fila y la auditoría original se conserva.
- [ ] 5.5 Actualizar `openspec/specs/turnos/spec.md` al integrar para que su propósito ya no enumere cancelación como fuera de alcance; verificar que quedan explícitos el alcance de reprogramación/cancelación y los límites vigentes de C08.

## 6. Verificación final

- [ ] 6.1 Ejecutar `npm test` contra PostgreSQL real, incluyendo cobertura de todos los escenarios de la delta spec y concurrencia; verificar salida en verde.
- [ ] 6.2 Verificar migraciones 001→050→060→070 en base vacía y migración 060 pendiente con 070 ya aplicada; confirmar que el runner detecta y procesa la versión inferior pendiente sin editar migraciones anteriores.
- [ ] 6.3 Revisar `git diff` para confirmar que solo cambian los archivos del módulo turnos, su migración nueva, tests/fixtures y la spec documentados; comprobar tenant desde token y datos exclusivamente ficticios.

## Workflow follow-up

- Presentar resultados de implementación y pruebas para revisión.
- Archivar C06 solo tras aprobación y con `npm test` en verde; verificar que la spec principal de turnos refleja el contrato integrado.

# Design

## Context

Ver `proposal.md` para el motivo y `specs/turnos/spec.md` para el contrato observable. C05 ya define `estado = 'CANCELADO'` como exclusión de las restricciones de solapamiento; C07 aporta el patrón de ruta `PATCH /api/turnos/:id/reprogramar`, la auditoría y la actualización transaccional de turnos existentes.

## Goals / Non-Goals

**Goals:**
- Mantener autorización y validación HTTP en rutas, reglas de cancelación en servicio/dominio y persistencia transaccional en repositorio.
- Hacer atómica la comprobación de pertenencia/estado/fecha y la escritura de estado y auditoría.
- Probar las regresiones primero con tests RED y luego implementar hasta GREEN.

**Non-Goals:**
- Reprogramación, cambios de recursos, listado de agenda y nuevos estados.
- Cambios a las migraciones existentes o a las restricciones de solapamiento de C05.

## Decisions

1. **Ruta hermana de C07.** Agregar `PATCH /:id/cancelar` en `src/modules/turnos/rutas.js`, con validación de UUID y `solicitadoPor`, guardia de roles `RECEPCION`/`ADMIN_CONSULTORIO` y contexto de tenant/operador desde `req.auth`. Mantener la ruta como capa HTTP y delegar el caso de uso a `servicios.js`.
   - Alternativa descartada: endpoint genérico de cambio de estado; permitiría transiciones no definidas por C06.

2. **Cancelación atómica bajo bloqueo de fila.** El repositorio localizará el turno usando `id + consultorio_id` y bloqueará la fila durante la comprobación del estado y del inicio y el `UPDATE`. Se cancelarán `PENDIENTE` y `CONFIRMADO`; `ATENDIDO` y `AUSENTE` producen 409 `ESTADO_INVALIDO`, igual que el turno `CANCELADO` ya no cancelable. Una repetición produce 409 `TURNO_YA_CANCELADO`; el inicio pasado produce 409 `TURNO_PASADO`. Ninguno modifica datos. El UPDATE guarda `estado = 'CANCELADO'`, reutiliza `cancelado_en` existente de la 050 con reloj UTC de la base, y persiste `cancelado_por` del token y `solicitado_por` validado.
   - Decisión aprobada: “ya pasó” significa `inicio <= instante actual UTC` al procesar la cancelación.
   - Alternativa descartada: leer y luego actualizar sin lock; dos solicitudes concurrentes podrían reemplazar la auditoría original.

3. **Auditoría con columnas nuevas.** La 050 ya declara `cancelado_en TIMESTAMPTZ`; la migración forward-only `060_cancelar_turno.sql` agregará `cancelado_por UUID` con FK a `usuario(id)` y `solicitado_por` restringido a `PACIENTE`/`CONSULTORIO`. No reutilizar ni editar 050 o 070.
   - Alternativa descartada: sobrecargar las columnas de reprogramación de 070; mezclan eventos diferentes y no conservan ambas auditorías.

4. **Códigos de error específicos.** Mantener `400 VALIDACION`, `403 SIN_PERMISO` y `404 TURNO_NO_ENCONTRADO` tanto para UUID inexistente como para turno de otro consultorio, igual que C07. Usar `409 ESTADO_INVALIDO` para `ATENDIDO`/`AUSENTE` (convención C07) y, según el contrato explícito de C06, `409 TURNO_YA_CANCELADO` y `409 TURNO_PASADO` para las otras condiciones.

5. **Actualizar el propósito de la spec principal al integrar.** El delta añade requisitos de cancelación en el capability existente `turnos`. Al archivar, actualizar `openspec/specs/turnos/spec.md` para que el propósito ya no diga que cancelación queda fuera de alcance; conservar allí el alcance de bloqueos y listado según C08.

## Risks / Trade-offs

- **[Estado OpenSpec de C05]** C05 está en `main` con 379 tests en verde, según confirmación de Agus; OpenSpec aún lo muestra in-progress porque falta archivar su carpeta → tomar la dependencia como cumplida, sin esperar ese archivo administrativo.
- **[Orden de migraciones con C07/070]** El runner debe fallar visiblemente si 060 queda pendiente después de 070 (spec `schema-migrations`); no se desactiva la validación de orden. En entornos locales que ya tenían aplicada 070, recuperar según `README.md`, sección “Recuperación: recrear la base local”: `docker compose down -v`, recrear la base y aplicar las migraciones en orden, usando solo datos ficticios. Aún no hay entorno desplegado; en el primer despliegue 060 se aplica antes que 070 en la secuencia ascendente.
- **[Carrera entre cancelaciones simultáneas]** Sin serialización se podría sobrescribir la auditoría inicial → lock transaccional y test concurrente de idempotencia; solo la primera solicitud modifica la fila.
- **[Borde temporal]** Una comparación con la hora de la aplicación puede diferir de la base → comparar con reloj UTC de PostgreSQL dentro de la transacción y probar el límite `inicio <= ahora`.

## Migration Plan

1. Aplicar 060 después de 050 y antes de 070 en orden ascendente; no editar archivos versionados.
2. Ejecutar las pruebas contra PostgreSQL real, incluyendo liberación, aplicación desde base vacía, re-ejecución sin pendientes y continuación desde el esquema previo a 060.
3. Rollback operativo: no borrar auditoría ni editar la 060 ya integrada; si se necesita revertir el comportamiento, publicar una migración forward-only y retirar/desplegar la ruta en un cambio coordinado.

## UI Mockups

- Design system revision: n/a
- Decision: no (no UI)
- Mockups: n/a
- Approval: n/a
- Preview: n/a

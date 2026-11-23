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

2. **Cancelación atómica bajo bloqueo de fila.** El repositorio localizará el turno usando `id + consultorio_id` y bloqueará la fila durante la comprobación del estado y del inicio y el `UPDATE`. Una repetición o turno pasado produce 409 antes de modificar datos. El UPDATE guarda `estado = 'CANCELADO'`, `cancelado_en` usando reloj UTC de la base, `cancelado_por` del token y `solicitado_por` validado.
   - Asumimos que “ya pasó” significa `inicio <= instante actual UTC` al procesar la cancelación. Cualquier estado distinto de `CANCELADO` es cancelable si el turno todavía no comenzó; C05/C07 no definen una restricción adicional por estado.
   - Alternativa descartada: leer y luego actualizar sin lock; dos solicitudes concurrentes podrían reemplazar la auditoría original.

3. **Auditoría con columnas nuevas.** Usar `cancelado_en TIMESTAMPTZ`, `cancelado_por UUID` con FK a `usuario(id)` y `solicitado_por` restringido a `PACIENTE`/`CONSULTORIO`. Crear una migración forward-only `060_cancelar_turno.sql`; no reutilizar ni editar 050 o 070.
   - Alternativa descartada: sobrecargar las columnas de reprogramación de 070; mezclan eventos diferentes y no conservan ambas auditorías.

4. **Códigos de error específicos.** Mantener `400 VALIDACION`, `403 SIN_PERMISO`, `404 TURNO_NO_ENCONTRADO` y distinguir los 409 mediante `TURNO_YA_CANCELADO` y `TURNO_PASADO`. Así el cliente puede mostrar el motivo concreto sin exponer información de otros consultorios.

5. **Actualizar el propósito de la spec principal al integrar.** El delta añade requisitos de cancelación en el capability existente `turnos`. Al archivar, actualizar `openspec/specs/turnos/spec.md` para que el propósito ya no diga que cancelación queda fuera de alcance; conservar allí el alcance de bloqueos y listado según C08.

## Risks / Trade-offs

- **[C05 aún incompleto]** La implementación de C06 depende de la tabla, las restricciones parciales y el contrato de creación de C05 → bloquear apply hasta que C05 esté completo y aprobado; no basta con que exista la migración 050.
- **[Orden de migraciones con C07/070]** Si 070 ya fue aplicada en algún entorno antes de que se integre 060, el runner debe detectar y aplicar la versión inferior pendiente de forma segura → usar migración nueva del rango 060–069, verificar el comportamiento del runner en base vacía y base con 070 aplicada, y coordinar el orden ascendente de despliegue. No ejecutar ni reordenar migraciones automáticamente durante C06.
- **[Carrera entre cancelaciones simultáneas]** Sin serialización se podría sobrescribir la auditoría inicial → lock transaccional y test concurrente de idempotencia; solo la primera solicitud modifica la fila.
- **[Borde temporal]** Una comparación con la hora de la aplicación puede diferir de la base → comparar con reloj UTC de PostgreSQL dentro de la transacción y probar el límite `inicio <= ahora`.

## Migration Plan

1. Tras completar C05, aplicar la nueva migración 060 en secuencia numérica junto a las migraciones existentes; no editar archivos versionados.
2. Ejecutar las pruebas contra PostgreSQL real, incluyendo liberación y las migraciones en una base vacía y una que ya tenga 070.
3. Rollback operativo: no borrar auditoría ni editar la 060 ya integrada; si se necesita revertir el comportamiento, publicar una migración forward-only y retirar/desplegar la ruta en un cambio coordinado.

## UI Mockups

- Design system revision: n/a
- Decision: no (no UI)
- Mockups: n/a
- Approval: n/a
- Preview: n/a

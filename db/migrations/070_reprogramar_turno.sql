-- 070_reprogramar_turno.sql — C07 (rango reservado 070–079).
--
-- Auditoría de reprogramación sobre la tabla `turno` (design.md D?;
-- RN-AG-09, RN-AG-03):
--   * `reprogramado_en` — instante UTC de la última reprogramación.
--   * `reprogramado_por` — usuario que operó el cambio.
--
-- * Ambas columnas son NULLABLE: quedan en NULL hasta la primera
--   reprogramación; el servicio de `PATCH /api/turnos/:id/reprogramar`
--   las setea en cada operación exitosa (auditables como RN-AG-08 pide
--   para cancelación, aplicado aquí a reprogramación).
-- * `reprogramado_por` es UUID con FK a `usuario(id)` (tipo verificado en
--   `001_esquema_inicial.sql:17`); la FK se declara SOLO desde esta
--   migración, sin tocar la tabla `usuario` (regla dura 10; precedente de
--   las cinco FKs declaradas desde la 050).
-- * NO hay DDL de solapamiento acá: las tres restricciones de exclusión
--   parciales de la `050_turno.sql` (`WHERE estado <> 'CANCELADO'`) ya
--   protegen el UPDATE de inicio/fin — el pre-check del servicio excluye
--   el turno actual (`id != turnoId`) y `23P01` se traduce a 409.
-- * Forward-only (regla dura 9): cualquier corrección futura va en una
--   migración NUEVA del rango 070–079, nunca editando este archivo
--   una vez mergeado.

ALTER TABLE turno ADD COLUMN reprogramado_en TIMESTAMPTZ;
ALTER TABLE turno ADD COLUMN reprogramado_por UUID REFERENCES usuario (id);

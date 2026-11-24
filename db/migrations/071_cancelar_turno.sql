-- 110_cancelar_turno.sql — C06 (excepción acordada al rango 060–069).
--
-- La 050 ya agregó `cancelado_en`; C06 añade quién operó la cancelación y
-- quién la solicitó. Las columnas quedan NULL hasta cancelar un turno.
-- Se usa el prefijo 110 porque hay bases existentes (local de Kevin y Neon)
-- que ya aplicaron la 070 y no pueden recrearse.
-- Forward-only: no editar esta migración una vez integrada.

ALTER TABLE turno
  ADD COLUMN cancelado_por UUID REFERENCES usuario (id);

ALTER TABLE turno
  ADD COLUMN solicitado_por TEXT;

ALTER TABLE turno
  ADD CONSTRAINT turno_solicitado_por_valido
  CHECK (solicitado_por IS NULL OR solicitado_por IN ('PACIENTE', 'CONSULTORIO'));

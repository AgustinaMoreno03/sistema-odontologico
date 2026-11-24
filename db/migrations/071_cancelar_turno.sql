-- C06 usa la 071 después de la 070 de C07.
--
-- La 050 ya agregó `cancelado_en`; C06 añade quién operó la cancelación y
-- quién la solicitó. Las columnas quedan NULL hasta cancelar un turno.
-- Forward-only: no editar esta migración una vez integrada.

ALTER TABLE turno
  ADD COLUMN cancelado_por UUID REFERENCES usuario (id);

ALTER TABLE turno
  ADD COLUMN solicitado_por TEXT;

ALTER TABLE turno
  ADD CONSTRAINT turno_solicitado_por_valido
  CHECK (solicitado_por IS NULL OR solicitado_por IN ('PACIENTE', 'CONSULTORIO'));

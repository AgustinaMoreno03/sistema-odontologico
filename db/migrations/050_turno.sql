-- 050_turno.sql — C05 (rango reservado 050–059).
--
-- Tabla `turno` y las tres restricciones de exclusión parciales por
-- paciente, profesional y sillón/box (design.md D1/D2; RN-AG-01,
-- RN-AG-02, RN-AG-06, RN-AG-08 y RN-AG-10).
--
-- * `btree_gist` es responsabilidad EXCLUSIVA de esta migración (cabecera
--   del archivo), con `IF NOT EXISTS` para ser idempotente (precedente:
--   `unaccent` en la 030 de C03 — un solo dueño por extensión).
-- * Las cinco FKs a tablas de otros módulos (consultorio, paciente,
--   profesional, sillón/box, prestación) se declaran SOLO desde la 050,
--   sin modificar esas tablas (regla dura 10); por eso 030 < 050 en el
--   orden ascendente del runner.
-- * `tstzrange(inicio, fin)` usa el default `[)` = RN-AG-06: dos turnos
--   contiguos no solapan. `CHECK (fin > inicio)` bloquea el rango vacío
--   (`fin = inicio`), que no chocaría con ninguna exclusión.
-- * `estado` nace con los cinco valores de RN-AG-10 y default PENDIENTE;
--   el `WHERE` parcial `estado <> 'CANCELADO'` prevé que cancelar libere
--   el horario (RN-AG-08, implementación en C06).
-- * Forward-only (regla dura 9): cualquier corrección futura va en una
--   migración NUEVA del rango 050–059, nunca editando este archivo
--   una vez mergeado.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE turno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultorio_id UUID NOT NULL REFERENCES consultorio (id),
  paciente_id UUID NOT NULL REFERENCES paciente (id),
  profesional_id UUID NOT NULL REFERENCES profesional (id),
  sillon_box_id UUID NOT NULL REFERENCES sillon_box (id),
  prestacion_id UUID NOT NULL REFERENCES prestacion (id),
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  duracion_min INTEGER NOT NULL,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE',
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelado_en TIMESTAMPTZ,

  CONSTRAINT turno_estado_valido
    CHECK (estado IN ('PENDIENTE', 'CONFIRMADO', 'ATENDIDO', 'AUSENTE', 'CANCELADO')),

  CONSTRAINT turno_intervalo_valido CHECK (fin > inicio)
);

-- Índices de knowledge-base/04_modelo_de_datos.md:112: accesos de agenda
-- por recurso dentro del consultorio, más el listado por consultorio.
CREATE INDEX turno_consultorio_profesional_inicio_idx
  ON turno (consultorio_id, profesional_id, inicio);
CREATE INDEX turno_consultorio_sillon_box_inicio_idx
  ON turno (consultorio_id, sillon_box_id, inicio);
CREATE INDEX turno_consultorio_paciente_inicio_idx
  ON turno (consultorio_id, paciente_id, inicio);
CREATE INDEX turno_consultorio_idx ON turno (consultorio_id);

-- Restricciones de exclusión parciales (design.md D1): sin turnos
-- solapados por recurso DENTRO del mismo consultorio, salvo los que están
-- CANCELADO. La igualdad sobre UUID participa vía la opclass `uuid` de
-- btree_gist (verificación de Apply: INSERT que choque → 23P01).
ALTER TABLE turno ADD CONSTRAINT turno_paciente_sin_solape
  EXCLUDE USING gist (
    consultorio_id WITH =,
    paciente_id WITH =,
    (tstzrange(inicio, fin)) WITH &&
  )
  WHERE (estado <> 'CANCELADO');

ALTER TABLE turno ADD CONSTRAINT turno_profesional_sin_solape
  EXCLUDE USING gist (
    consultorio_id WITH =,
    profesional_id WITH =,
    (tstzrange(inicio, fin)) WITH &&
  )
  WHERE (estado <> 'CANCELADO');

ALTER TABLE turno ADD CONSTRAINT turno_sillon_box_sin_solape
  EXCLUDE USING gist (
    consultorio_id WITH =,
    sillon_box_id WITH =,
    (tstzrange(inicio, fin)) WITH &&
  )
  WHERE (estado <> 'CANCELADO');

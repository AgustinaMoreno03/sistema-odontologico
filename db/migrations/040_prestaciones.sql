-- 040_prestaciones.sql — C04 (rango reservado 040–049).
-- Catálogo de prestaciones aislado por consultorio.

CREATE TABLE prestacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultorio_id UUID NOT NULL REFERENCES consultorio (id),
  nombre VARCHAR(100) NOT NULL,
  duracion_min INTEGER NOT NULL CHECK (duracion_min BETWEEN 1 AND 480),
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT prestacion_consultorio_nombre_uq UNIQUE (consultorio_id, nombre)
);

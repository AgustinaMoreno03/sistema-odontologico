-- 001_esquema_inicial.sql — C00 (rango reservado 001–009).
--
-- Esquema inicial mínimo, cerrado por DD-19 (knowledge-base/09):
--   * `consultorio` — el tenant raíz.
--   * `usuario` — con `consultorio_id` como clave foránea al consultorio y
--     `rol` con CHECK del conjunto cerrado de DD-17 (ADMIN_CONSULTORIO,
--     ODONTOLOGO, RECEPCION). No existe rol de paciente (DD-16).
--
-- Forward-only (regla dura 9): sin marcadores `down`; C01 extiende estas
-- tablas en su rango 010–019 (password, alta de usuarios, permisos) sin
-- editar este archivo.

CREATE TABLE consultorio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE TABLE usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultorio_id UUID NOT NULL REFERENCES consultorio (id),
  rol TEXT NOT NULL CHECK (rol IN ('ADMIN_CONSULTORIO', 'ODONTOLOGO', 'RECEPCION'))
);

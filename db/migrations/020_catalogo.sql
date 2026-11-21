-- 020_catalogo.sql — C02 (rango reservado 020–029).
--
-- Catálogo de profesionales y sillones/boxes (módulo `catalogo`):
--   * `profesional` — con vínculo 1:1 OPCIONAL a `usuario` (`usuario_id`
--     nullable + índice único parcial). El módulo `catalogo` nunca lee la
--     tabla `usuario` (DD-13): la FK solo garantiza que no haya
--     identificadores colgantes.
--   * `sillon_box` — sillones/boxes del consultorio.
--
-- RN-TEN-03: la unicidad es por consultorio mediante la función
-- `clave_unicidad()` (recorta espacios exteriores, pliega acentos del
-- español y pasa a minúsculas; design.md decisión 3) e índices únicos de
-- expresión compuestos CON `consultorio_id`. La garantía vive en la base:
-- una violación es `23505` y la aplicación la traduce a 409, sin pre-check.
--
-- Forward-only (regla dura 9): sin marcadores `down`; cualquier corrección
-- futura va en una migración NUEVA del mismo rango, nunca editando este
-- archivo. La `001_esquema_inicial.sql` queda intacta.

CREATE FUNCTION clave_unicidad(texto TEXT) RETURNS TEXT
IMMUTABLE STRICT
LANGUAGE sql
AS $$
  SELECT lower(translate(btrim(texto), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))
$$;

CREATE TABLE profesional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultorio_id UUID NOT NULL REFERENCES consultorio (id),
  nombre TEXT NOT NULL,
  matricula TEXT NULL,
  email TEXT NULL,
  usuario_id UUID NULL REFERENCES usuario (id),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sillon_box (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultorio_id UUID NOT NULL REFERENCES consultorio (id),
  nombre TEXT NOT NULL,
  descripcion TEXT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RN-TEN-03: unicidad de nombre por consultorio (caja, espacios exteriores
-- y acentos plegados por clave_unicidad). El valor guardado conserva la
-- escritura original recortada.
CREATE UNIQUE INDEX profesional_nombre_unico
  ON profesional (consultorio_id, clave_unicidad(nombre));

CREATE UNIQUE INDEX sillon_box_nombre_unico
  ON sillon_box (consultorio_id, clave_unicidad(nombre));

-- RN-TEN-03: unicidad de email por consultorio; el email nulo NO participa
-- de la unicidad (dos profesionales sin email conviven sin error).
CREATE UNIQUE INDEX profesional_email_unico
  ON profesional (consultorio_id, clave_unicidad(email))
  WHERE email IS NOT NULL;

-- Vínculo 1:1 opcional con usuario: a lo sumo una ficha por usuario.
CREATE UNIQUE INDEX profesional_usuario_unico
  ON profesional (usuario_id)
  WHERE usuario_id IS NOT NULL;

-- Listados del tenant.
CREATE INDEX profesional_consultorio_id_idx ON profesional (consultorio_id);
CREATE INDEX sillon_box_consultorio_id_idx ON sillon_box (consultorio_id);

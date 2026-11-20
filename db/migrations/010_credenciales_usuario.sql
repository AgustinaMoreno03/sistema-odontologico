-- C01: credenciales de usuario. Las columnas admiten NULL para preservar
-- compatibilidad con inserts y datos previos de C00; el flujo C01 exige y
-- proporciona ambos valores al crear usuarios.
ALTER TABLE usuario
  ADD COLUMN email TEXT,
  ADD COLUMN password_hash TEXT,
  ADD CONSTRAINT usuario_email_unique UNIQUE (email);

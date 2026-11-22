-- C03: ficha básica de pacientes. Rango reservado 030–039.
-- El servicio genera el UUID del paciente.
-- Los cambios posteriores a su integración usan otra migración.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE paciente (
    id UUID PRIMARY KEY,
    consultorio_id UUID NOT NULL REFERENCES consultorio (id),
    nombre TEXT NOT NULL,
    apellido TEXT,
    telefono TEXT,
    email TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT paciente_nombre_obligatorio
        CHECK (nombre ~ '[^[:space:]]'),

    CONSTRAINT paciente_telefono_informado
        CHECK (telefono IS NULL OR telefono ~ '[^[:space:]]'),

    CONSTRAINT paciente_email_informado
        CHECK (email IS NULL OR email ~ '[^[:space:]]'),

    CONSTRAINT paciente_contacto_obligatorio
        CHECK (telefono IS NOT NULL OR email IS NOT NULL)
);

-- Unicidad por consultorio sobre el mismo valor normalizado
-- que utilizará la comparación de email en la búsqueda.
CREATE UNIQUE INDEX paciente_email_consultorio_unico
    ON paciente (consultorio_id, lower(btrim(email)));

CREATE INDEX paciente_consultorio_telefono_idx
    ON paciente (consultorio_id, telefono);

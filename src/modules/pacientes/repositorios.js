import pg from 'pg';

export async function consultarExistenciaPaciente({ pacienteId, consultorioId }) {
  const cliente = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await cliente.connect();
    const resultado = await cliente.query(
      `SELECT EXISTS (
         SELECT 1
         FROM paciente
         WHERE id = $1 AND consultorio_id = $2
       ) AS existe`,
      [pacienteId, consultorioId]
    );
    return resultado.rows[0].existe;
  } finally {
    await cliente.end().catch(() => {});
  }
}

export async function insertarPaciente({
  id, consultorioId, nombre, apellido, telefono, email,
}) {
  const cliente = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await cliente.connect();
    const resultado = await cliente.query(
      `INSERT INTO paciente
         (id, consultorio_id, nombre, apellido, telefono, email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, consultorio_id AS "consultorioId",
                 nombre, apellido, telefono, email,
                 creado_en AS "creadoEn"`,
      [id, consultorioId, nombre, apellido, telefono, email]
    );
    return resultado.rows[0];
  } finally {
    await cliente.end().catch(() => {});
  }
}

export async function consultarPacientes({ consultorioId, texto, telefono }) {
  const cliente = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await cliente.connect();
    const resultado = await cliente.query(
      `WITH busqueda AS (
         SELECT '%' ||
           replace(replace(replace(unaccent($2::text),
             '!', '!!'), '%', '!%'), '_', '!_')
           || '%' AS patron
       )
       SELECT p.id, p.consultorio_id AS "consultorioId",
              p.nombre, p.apellido, p.telefono, p.email,
              p.creado_en AS "creadoEn"
       FROM paciente AS p
       CROSS JOIN busqueda AS b
       WHERE p.consultorio_id = $1
         AND (
           unaccent(p.nombre) ILIKE b.patron ESCAPE '!'
           OR unaccent(p.apellido) ILIKE b.patron ESCAPE '!'
           OR p.telefono = $3
           OR lower(btrim(p.email)) = lower(btrim($2::text))
         )
       ORDER BY p.apellido ASC NULLS LAST, p.nombre ASC, p.id ASC
       LIMIT 50`,
      [consultorioId, texto, telefono]
    );
    return resultado.rows;
  } finally {
    await cliente.end().catch(() => {});
  }
}

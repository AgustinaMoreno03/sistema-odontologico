import pg from 'pg';

export async function consultarNombresPacientes({ pacienteIds, consultorioId }) {
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await cliente.connect();
    const { rows } = await cliente.query(
      'SELECT id, nombre, apellido FROM paciente WHERE consultorio_id = $1 AND id = ANY($2::uuid[])',
      [consultorioId, pacienteIds]
    );
    return rows;
  } finally {
    await cliente.end().catch(() => {});
  }
}

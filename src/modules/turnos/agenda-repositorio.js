import pg from 'pg';

export async function leerAgenda({ consultorioId, desde, hasta, profesionalId, limite, offset }) {
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await cliente.connect();
    const filtro = profesionalId ? ' AND profesional_id = $4' : '';
    const valores = [consultorioId, desde, hasta];
    if (profesionalId) valores.push(profesionalId);
    const posicionLimite = valores.length + 1;
    valores.push(limite + 1, offset);
    const { rows } = await cliente.query(
      `SELECT id, paciente_id AS "pacienteId", profesional_id AS "profesionalId",
              sillon_box_id AS "sillonBoxId", prestacion_id AS "prestacionId",
              inicio, fin, duracion_min AS "duracionMin", estado
         FROM turno
        WHERE consultorio_id = $1 AND inicio < $3 AND fin > $2${filtro}
        ORDER BY inicio ASC, id ASC LIMIT $${posicionLimite} OFFSET $${posicionLimite + 1}`,
      valores
    );
    return rows;
  } finally {
    await cliente.end().catch(() => {});
  }
}

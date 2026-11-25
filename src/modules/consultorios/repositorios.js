// Capa de repositorios del módulo consultorios: acceso SQL parametrizado a su
// propia tabla, sin HTTP ni reglas de negocio (DD-13).
import pg from 'pg';

async function consultar(sql, valores = [], clienteExterno) {
  if (clienteExterno) return clienteExterno.query(sql, valores);
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await cliente.connect();
    return await cliente.query(sql, valores);
  } finally {
    await cliente.end().catch(() => {});
  }
}

/** Aprovisiona un tenant sin exponer una ruta pública de registro. */
export async function crearConsultorio({ cliente } = {}) {
  const resultado = await consultar(
    'INSERT INTO consultorio DEFAULT VALUES RETURNING id',
    [],
    cliente
  );
  return resultado.rows[0];
}

/** Busca un consultorio por su ID para flujos internos del módulo. */
export async function buscarConsultorioPorId(consultorioId) {
  const resultado = await consultar('SELECT id FROM consultorio WHERE id = $1', [
    consultorioId,
  ]);
  return resultado.rows[0] ?? null;
}

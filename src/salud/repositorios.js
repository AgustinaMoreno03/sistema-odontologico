import pg from 'pg';

/**
 * Repositorio del chequeo de salud (capa de acceso a datos de la app):
 * verifica que la conexión a PostgreSQL responda (`SELECT 1`).
 *
 * Es la frontera externa real; los tests solo la sustituyen inyectando
 * otra función en `crearApp({ chequearBase })` (nunca se mockea SQL dentro
 * de la suite: los tests de integración corren contra PostgreSQL real).
 *
 * @param {string} [url] cadena de conexión; por defecto `DATABASE_URL`.
 * @returns {Promise<void>} resuelve si la base responde; lanza si no.
 */
export async function chequearBase(url = process.env.DATABASE_URL) {
  const cliente = new pg.Client({ connectionString: url });
  try {
    await cliente.connect();
    await cliente.query('SELECT 1');
  } finally {
    await cliente.end().catch(() => {});
  }
}

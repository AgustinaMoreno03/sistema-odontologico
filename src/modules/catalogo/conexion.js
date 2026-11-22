// Frontera de conexión del módulo catalogo (design.md, decisión 9):
// pool perezoso de pg sobre `DATABASE_URL` (solo desde el entorno, regla
// dura 5). El pooling es el estándar del proyecto para CRUD; si al integrar
// la ola aparece un `src/db.js` común, este módulo lo adopta sin cambiar el
// comportamiento. `allowExitOnIdle` deja terminar al proceso cuando no hay
// consultas en vuelo (la suite de tests no queda colgada por el pool).
import pg from 'pg';

let pool = null;

/** Pool único y perezoso del módulo (se crea en la primera consulta). */
export function obtenerPool() {
  if (pool === null) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      allowExitOnIdle: true,
    });
  }
  return pool;
}

/**
 * Ejecuta una consulta parametrizada sobre el pool del módulo.
 * SIEMPRE con placeholders `$n` (sql-code-review: jamás concatenar SQL).
 *
 * @param {string} texto SQL con placeholders
 * @param {unknown[]} [params] valores de los placeholders
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function consultar(texto, params = []) {
  return obtenerPool().query(texto, params);
}

// Capa de repositorios (módulo auth): acceso a datos con SQL parametrizado,
// únicamente sobre las tablas de ESTE módulo (regla dura 10: un módulo no
// toca las tablas de otro; se comunica vía la interfaz del módulo).
// Sin HTTP y sin reglas de negocio en esta capa (DD-13).

import pg from 'pg';

async function consultar(sql, valores, clienteExterno) {
  if (clienteExterno) return clienteExterno.query(sql, valores);
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  try {
    await cliente.connect();
    return await cliente.query(sql, valores);
  } finally {
    await cliente.end().catch(() => {});
  }
}

const COLUMNAS_PUBLICAS = 'id, consultorio_id, rol, email';

/** Inserta credenciales ya hasheadas; nunca recibe ni persiste la contraseña. */
export async function crearUsuario({ id, consultorioId, rol, email, passwordHash }, { cliente } = {}) {
  const resultado = await consultar(
    `INSERT INTO usuario (id, consultorio_id, rol, email, password_hash)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5)
     RETURNING id, consultorio_id, rol, email, password_hash`,
    [id ?? null, consultorioId, rol, email, passwordHash],
    cliente
  );
  return resultado.rows[0];
}

/** Carga credenciales internas para login; el hash no se expone por rutas. */
export async function buscarCredencialesPorEmail(email) {
  const resultado = await consultar(
    `SELECT id, consultorio_id, rol, email, password_hash
     FROM usuario
     WHERE email = $1`,
    [email]
  );
  return resultado.rows[0] ?? null;
}

/**
 * Lista usuarios de un único consultorio. El llamador debe pasar el tenant
 * autenticado desde req.auth; no se reciben filtros del cliente.
 */
export async function listarUsuariosPorConsultorio(consultorioId) {
  const resultado = await consultar(
    `SELECT ${COLUMNAS_PUBLICAS}
     FROM usuario
     WHERE consultorio_id = $1
     ORDER BY id`,
    [consultorioId]
  );
  return resultado.rows;
}

/** Busca por ID dentro del tenant, ocultando IDs que pertenezcan a otro. */
export async function buscarUsuarioPorId(consultorioId, usuarioId) {
  const resultado = await consultar(
    `SELECT ${COLUMNAS_PUBLICAS}
     FROM usuario
     WHERE consultorio_id = $1 AND id = $2`,
    [consultorioId, usuarioId]
  );
  return resultado.rows[0] ?? null;
}

// Capa de repositorios (módulo catalogo): SQL parametrizado SOLO sobre la
// tabla `profesional` (regla dura 10: un módulo no toca las tablas de otro;
// `usuario` jamás se consulta desde acá — DD-13). Sin HTTP y sin reglas de
// negocio en esta capa (DD-13). Todas las lecturas filtran
// `consultorio_id` (RN-TEN-01/02) y proyectan solo las columnas necesarias.
import { consultar } from './conexion.js';

const COLUMNAS =
  'id, consultorio_id, nombre, matricula, email, usuario_id, activo, creado_en';

// Columnas actualizables por PUT (whitelist fija: los nombres de columna
// jamás salen del cliente; los VALORES van siempre parametrizados).
const CAMPOS_ACTUALIZABLES = Object.freeze({
  nombre: 'nombre',
  matricula: 'matricula',
  email: 'email',
  activo: 'activo',
});

/**
 * Inserta un profesional en el consultorio y devuelve la fila creada
 * (el id lo genera la base y `activo`/`creado_en` nacen con sus defaults).
 */
export async function insertarProfesional({ consultorioId, nombre, matricula = null, email = null }) {
  const { rows } = await consultar(
    `INSERT INTO profesional (consultorio_id, nombre, matricula, email)
     VALUES ($1, $2, $3, $4)
     RETURNING ${COLUMNAS}`,
    [consultorioId, nombre, matricula, email]
  );
  return rows[0];
}

/** Ficha de `id` DENTRO del consultorio, o null si no existe ahí. */
export async function obtenerProfesionalPorId({ consultorioId, id }) {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM profesional WHERE id = $1 AND consultorio_id = $2`,
    [id, consultorioId]
  );
  return rows[0] ?? null;
}

/** Todos los profesionales del consultorio (activos e inactivos), orden estable. */
export async function listarProfesionales({ consultorioId }) {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM profesional WHERE consultorio_id = $1 ORDER BY creado_en, id`,
    [consultorioId]
  );
  return rows;
}

/**
 * Actualización parcial de la ficha dentro del consultorio: solo los campos
 * presentes en `cambios` entran al `SET` (el resto se conserva). Devuelve la
 * fila resultante o `null` si `id` no existe en el consultorio (RN-TEN-02).
 */
export async function actualizarProfesional({ consultorioId, id, cambios }) {
  const entradas = Object.entries(cambios).filter(([campo]) =>
    Object.hasOwn(CAMPOS_ACTUALIZABLES, campo)
  );
  const asignaciones = entradas.map(
    ([campo], indice) => `${CAMPOS_ACTUALIZABLES[campo]} = $${indice + 3}`
  );
  const valores = entradas.map(([, valor]) => valor);
  const { rows } = await consultar(
    `UPDATE profesional SET ${asignaciones.join(', ')} ` +
      `WHERE id = $1 AND consultorio_id = $2 RETURNING ${COLUMNAS}`,
    [id, consultorioId, ...valores]
  );
  return rows[0] ?? null;
}

/**
 * Proyección mínima del catálogo ACTIVO (design D6): solo `id`, `nombre` y
 * `matricula`, ordenados por nombre e id para una respuesta determinista.
 */
export async function listarProfesionalesActivos({ consultorioId }) {
  const { rows } = await consultar(
    'SELECT id, nombre, matricula FROM profesional ' +
      'WHERE consultorio_id = $1 AND activo = TRUE ORDER BY nombre, id',
    [consultorioId]
  );
  return rows;
}

/**
 * Vínculo 1:1 condicional y SIN CARRERA (design D1): solo actualiza la fila
 * si hoy está sin vínculo (`usuario_id IS NULL`); el índice único parcial de
 * `usuario_id` es la red de seguridad ante la misma pareja en paralelo.
 * Devuelve la fila vinculada o `null` si ya tenía otro vínculo.
 */
export async function vincularUsuarioProfesional({ consultorioId, id, usuarioId }) {
  const { rows } = await consultar(
    `UPDATE profesional SET usuario_id = $3
     WHERE id = $1 AND consultorio_id = $2 AND usuario_id IS NULL
     RETURNING ${COLUMNAS}`,
    [id, consultorioId, usuarioId]
  );
  return rows[0] ?? null;
}

/**
 * Quita el vínculo de usuario (idempotente). Devuelve la fila si el
 * profesional pertenece al consultorio (aunque estuviera ya sin vínculo) o
 * `null` si no es de este consultorio.
 */
export async function desvincularUsuarioProfesional({ consultorioId, id }) {
  const { rows } = await consultar(
    `UPDATE profesional SET usuario_id = NULL
     WHERE id = $1 AND consultorio_id = $2
     RETURNING ${COLUMNAS}`,
    [id, consultorioId]
  );
  return rows[0] ?? null;
}

/**
 * Ficha del profesional vinculado a `usuarioId` DENTRO del consultorio
 * (incluidas las inactivas), o `null`. Nunca consulta la tabla `usuario`
 * (DD-13): solo la columna propia `usuario_id`.
 */
export async function obtenerProfesionalPorUsuario({ consultorioId, usuarioId }) {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM profesional WHERE usuario_id = $1 AND consultorio_id = $2`,
    [usuarioId, consultorioId]
  );
  return rows[0] ?? null;
}

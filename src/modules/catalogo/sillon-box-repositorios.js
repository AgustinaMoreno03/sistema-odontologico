// Capa de repositorios (módulo catalogo): SQL parametrizado SOLO sobre la
// tabla `sillon_box` (regla dura 10). Sin HTTP ni reglas de negocio
// (DD-13). Todas las lecturas filtran `consultorio_id` (RN-TEN-01/02) y
// proyectan solo las columnas necesarias.
import { consultar } from './conexion.js';

const COLUMNAS = 'id, consultorio_id, nombre, descripcion, activo, creado_en';

// Columnas actualizables por PUT (whitelist fija: los nombres de columna
// jamás salen del cliente; los VALORES van siempre parametrizados).
const CAMPOS_ACTUALIZABLES = Object.freeze({
  nombre: 'nombre',
  descripcion: 'descripcion',
  activo: 'activo',
});

/**
 * Inserta un sillón/box en el consultorio y devuelve la fila creada
 * (el id lo genera la base y `activo`/`creado_en` nacen con sus defaults).
 */
export async function insertarSillonBox({ consultorioId, nombre, descripcion = null }) {
  const { rows } = await consultar(
    `INSERT INTO sillon_box (consultorio_id, nombre, descripcion)
     VALUES ($1, $2, $3)
     RETURNING ${COLUMNAS}`,
    [consultorioId, nombre, descripcion]
  );
  return rows[0];
}

/** Ficha de `id` DENTRO del consultorio, o null si no existe ahí. */
export async function obtenerSillonBoxPorId({ consultorioId, id }) {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM sillon_box WHERE id = $1 AND consultorio_id = $2`,
    [id, consultorioId]
  );
  return rows[0] ?? null;
}

/** Todos los sillones/boxes del consultorio (activos e inactivos), orden estable. */
export async function listarSillonBoxes({ consultorioId }) {
  const { rows } = await consultar(
    `SELECT ${COLUMNAS} FROM sillon_box WHERE consultorio_id = $1 ORDER BY creado_en, id`,
    [consultorioId]
  );
  return rows;
}

/**
 * Actualización parcial de la ficha dentro del consultorio: solo los campos
 * presentes en `cambios` entran al `SET` (el resto se conserva). Devuelve la
 * fila resultante o `null` si `id` no existe en el consultorio (RN-TEN-02).
 */
export async function actualizarSillonBox({ consultorioId, id, cambios }) {
  const entradas = Object.entries(cambios).filter(([campo]) =>
    Object.hasOwn(CAMPOS_ACTUALIZABLES, campo)
  );
  const asignaciones = entradas.map(
    ([campo], indice) => `${CAMPOS_ACTUALIZABLES[campo]} = $${indice + 3}`
  );
  const valores = entradas.map(([, valor]) => valor);
  const { rows } = await consultar(
    `UPDATE sillon_box SET ${asignaciones.join(', ')} ` +
      `WHERE id = $1 AND consultorio_id = $2 RETURNING ${COLUMNAS}`,
    [id, consultorioId, ...valores]
  );
  return rows[0] ?? null;
}

/**
 * Proyección mínima del catálogo ACTIVO (design D6): solo `id`, `nombre` y
 * `descripcion`, ordenados por nombre e id para una respuesta determinista.
 */
export async function listarSillonBoxesActivos({ consultorioId }) {
  const { rows } = await consultar(
    'SELECT id, nombre, descripcion FROM sillon_box ' +
      'WHERE consultorio_id = $1 AND activo = TRUE ORDER BY nombre, id',
    [consultorioId]
  );
  return rows;
}

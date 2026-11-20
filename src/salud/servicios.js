import { ApiError } from '../errores.js';

/**
 * Servicio de salud: invoca el chequeo de conexión inyectado y traduce el
 * resultado a la respuesta de `GET /health`.
 *
 * Toda la lógica vive acá (las rutas solo parsean HTTP); cualquier falla
 * del chequeo se vuelve un ApiError operacional 503 con mensaje seguro,
 * sin filtrar credenciales ni el detalle interno de la conexión.
 *
 * @param {() => Promise<void>} chequearBase función de chequeo de la base.
 * @returns {Promise<{status: string}>} estado de la API.
 */
export async function verificarSalud(chequearBase) {
  try {
    await chequearBase();
  } catch {
    throw new ApiError(503, 'BASE_NO_DISPONIBLE', 'Base de datos no disponible');
  }
  return { status: 'ok' };
}

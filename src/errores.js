/**
 * Design D6 — errores y logging mínimo (sin logger estructurado ni requestId).
 *
 * Forma única de error de toda la API: `{ error: { code, message } }`.
 * - Errores operacionales (ApiError) → su status 4xx/5xx con mensaje seguro.
 * - Cualquier otro error inesperado → 500 con mensaje genérico; el stack se
 *   loguea con `console.error` SOLO acá y jamás se expone en la respuesta.
 */

export class ApiError extends Error {
  /** @param {number} statusCode status HTTP operacional (4xx/5xx) */
  /** @param {string} code código estable del error (p. ej. BASE_NO_DISPONIBLE) */
  /** @param {string} message mensaje seguro para el cliente */
  constructor(statusCode, code, message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** Único manejador de errores centralizado de la app (montado después de las rutas). */
export function manejadorErrores(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // Inesperado: 500 seguro. El stack (con la causa) solo al log.
  console.error(err?.stack ?? err);
  res.status(500).json({
    error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor' },
  });
}

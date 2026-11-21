import jwt from 'jsonwebtoken';

// Helper de tests para emitir tokens ficticios (design D2: soporte de
// implementación de la suite, NO requisito del spec auth; vive SOLO en
// tests/, nunca se exporta como código de producción).

// Secreto de pruebas: distinto del real de .env (design, Risks). Ficticio,
// sin valor (regla dura 5); lo inyecta tests/setup/setup.js en cada worker.
export const SECRETO_TEST = 'secreto-de-pruebas-c00-solo-para-la-suite';

/**
 * Emite un JWT ficticio firmado con el secreto de pruebas (HS256 por
 * defecto). Todos los datos por defecto son ficticios (regla dura 1).
 *
 * @param {object} [opciones]
 * @param {string} [opciones.usuarioId]
 * @param {string} [opciones.consultorioId]
 * @param {string} [opciones.rol] rol exacto; sin normalizar
 * @param {boolean} [opciones.expirado] si es true, nace caducado (exp en el
 *   pasado) → 401 instantáneo, sin esperar tiempo real
 * @param {string} [opciones.secreto] secreto con el que firma (para
 *   ejercitar tokens forjados con secreto distinto)
 * @param {string} [opciones.algoritmo] algoritmo de firma (p. ej. HS512
 *   para ejercitar el rechazo de algoritmos fuera del allowlist)
 * @param {string[]} [opciones.omitir] claims a DEJAR FUERA del payload
 *   (task 4.7: token firmado correctamente pero sin un claim requerido)
 * @returns {string} JWT firmado
 */
export function crearToken({
  usuarioId = '00000000-0000-4000-8000-000000000001',
  consultorioId = '00000000-0000-4000-8000-000000000002',
  rol = 'RECEPCION',
  expirado = false,
  secreto = SECRETO_TEST,
  algoritmo = 'HS256',
  omitir = [],
} = {}) {
  const payload = { usuarioId, consultorioId, rol };
  for (const claim of omitir) {
    delete payload[claim];
  }
  if (expirado) {
    // Caducado de fábrica: exp 60 s en el pasado. Sin `expiresIn` negativo
    // (no soportado de forma fiable) y sin dormir en el test.
    payload.exp = Math.floor(Date.now() / 1000) - 60;
  }
  return jwt.sign(payload, secreto, { algorithm: algoritmo });
}

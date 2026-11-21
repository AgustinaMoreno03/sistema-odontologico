// Capa de dominio (módulo auth): reglas de negocio puras del módulo
// (p. ej. el conjunto cerrado de roles DD-17, task 4.3). Sin I/O: no hay
// HTTP, ni base de datos, ni efectos secundarios acá.

/**
 * Design D2 / DD-17: conjunto CERRADO de roles. Sin normalización ni
 * plegado de mayúsculas: solo pasan los tres valores exactos (spec auth R3).
 * DD-16: no existe rol de paciente en el MVP.
 */
export const ROLES_VALIDOS = Object.freeze(['ADMIN_CONSULTORIO', 'ODONTOLOGO', 'RECEPCION']);

/**
 * Valida un rol del token por igualdad EXACTA contra el conjunto cerrado.
 * @param {unknown} rol
 * @returns {boolean}
 */
export function esRolValido(rol) {
  return ROLES_VALIDOS.includes(rol);
}

/** Claims que el contrato del contexto exige SIEMPRE (spec auth R1, DD-14). */
export const CLAIMS_REQUERIDOS = Object.freeze(['usuarioId', 'consultorioId', 'rol']);

/**
 * Spec auth R1, escenario "Claims requeridos faltantes" (task 4.7): los tres
 * claims del contrato deben estar PRESENTES y ser texto NO vacío. Un token
 * firmado correctamente pero sin un claim (o con él vacío, o con un valor no
 * texto p. ej. numérico) NO produce contexto usable → se rechaza.
 *
 * Regla pura de dominio, sin HTTP ni I/O (capas, DD-13).
 *
 * @param {{usuarioId: unknown, consultorioId: unknown, rol: unknown}} contexto
 * @returns {boolean} true solo si los tres claims son strings no vacíos
 */
export function claimsRequeridosCompletos(contexto) {
  return CLAIMS_REQUERIDOS.every(
    (clave) => typeof contexto[clave] === 'string' && contexto[clave] !== ''
  );
}

/**
 * Design D2 / DD-14: el contrato estable del módulo es EXACTAMENTE
 * `{ usuarioId, consultorioId, rol }`. Se publica tal cual, extraído del
 * payload verificado, sin normalizar ni completar valores.
 *
 * @param {Record<string, unknown>} payload payload ya verificado por la
 *   capa de servicios (firma HS256 comprobada).
 * @returns {{usuarioId: unknown, consultorioId: unknown, rol: unknown}}
 */
export function extraerContexto(payload) {
  return {
    usuarioId: payload.usuarioId,
    consultorioId: payload.consultorioId,
    rol: payload.rol,
  };
}

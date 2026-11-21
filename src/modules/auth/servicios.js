// Capa de servicios (módulo auth): casos de uso que orquestan al dominio y
// a los repositorios. Sin HTTP (no importa express) y sin SQL directo.
// Lógica real en C00 §4 (verificación de token) y en C01 (login y usuarios).
import jwt from 'jsonwebtoken';
import { ApiError } from '../../errores.js';
import { claimsRequeridosCompletos, esRolValido, extraerContexto } from './dominio.js';

// Design D2: algoritmo fijo y explícito — `alg: "none"` o cualquier otro
// (RS256, HS512…) se rechaza en la verificación (spec auth R1).
const ALGORITMO_PERMITIDO = 'HS256';

/** 401 único y genérico (D6): jamás distingue firma / estructura / caducidad. */
export function noAutorizado() {
  return new ApiError(401, 'TOKEN_INVALIDO', 'No autorizado');
}

/**
 * Verifica un JWT con el secreto `JWT_SECRET` SOLO desde el entorno
 * (nunca default, regla dura 5) y devuelve el triple del token.
 *
 * Cualquier fallo de verificación lanza ApiError 401 con el MISMO mensaje
 * seguro, sin filtrar la causa ni el detalle interno de jsonwebtoken
 * (spec auth R1/R2; design D2/D6).
 *
 * @param {string} token token crudo extraído del encabezado Authorization
 * @returns {{usuarioId: unknown, consultorioId: unknown, rol: unknown}}
 * @throws {ApiError} 401 TOKEN_INVALIDO ante cualquier fallo
 */
export function verificarToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [ALGORITMO_PERMITIDO],
    });
  } catch {
    // Firma inválida, expirado, malformado o algoritmo no permitido:
    // el mismo 401 seguro para todos, sin causa ni stack (spec auth R1/R2).
    throw noAutorizado();
  }

  // Conjunto cerrado de roles DD-17 (spec auth R3): cualquier otro valor
  // —p. ej. "PACIENTE" (DD-16) o variantes en minúsculas— rechaza el token.
  //
  // Claims requeridos (spec auth R1, escenario "Claims requeridos
  // faltantes", task 4.7): los tres claims deben existir y ser strings no
  // vacíos; ausentes, vacíos o no texto (p. ej. numéricos) → el MISMO 401
  // genérico D6, sin contexto adjunto.
  const contexto = extraerContexto(payload);
  if (!claimsRequeridosCompletos(contexto) || !esRolValido(contexto.rol)) {
    throw noAutorizado();
  }
  return contexto;
}

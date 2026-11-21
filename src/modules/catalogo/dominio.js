// Capa de dominio compartido (módulo catalogo): helpers puros de
// normalización y validación, sin I/O (ni HTTP ni base de datos, DD-13).
// Los usan profesional-dominio.js, sillon-box-dominio.js y las rutas.
import { ApiError } from '../../errores.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ¿Es `valor` una cadena con formato UUID (8-4-4-4-12 hex)?
 * @param {unknown} valor
 * @returns {boolean}
 */
export function esUuid(valor) {
  return typeof valor === 'string' && UUID_REGEX.test(valor);
}

/**
 * Valida un identificador UUID y lo devuelve tal cual.
 *
 * Spec catálogo ("Identificador malformado"): los identificadores sin
 * formato UUID válido lanzan `ApiError` 400 `DATOS_INVALIDOS` (a diferencia
 * de la validación de cuerpos, que es 422 — design.md, decisión 6).
 *
 * @param {unknown} valor identificador a validar
 * @param {string} [campo] nombre del campo para el mensaje seguro
 * @returns {string} el identificador validado
 * @throws {ApiError} 400 DATOS_INVALIDOS si no es un UUID válido
 */
export function validarUuid(valor, campo = 'identificador') {
  if (!esUuid(valor)) {
    throw new ApiError(400, 'DATOS_INVALIDOS', `'${campo}' debe ser un identificador UUID válido`);
  }
  return valor;
}

/**
 * Recorta los espacios exteriores de un texto de nombre, matrícula o
 * descripción; el resultado vacío se guarda como `NULL` (design.md,
 * decisión 5). El interior de la cadena se conserva tal cual.
 *
 * @param {string} valor
 * @returns {string | null} texto recortado o null si quedó vacío
 */
export function normalizarTexto(valor) {
  const recortado = valor.trim();
  return recortado === '' ? null : recortado;
}

/**
 * Recorta y pasa a minúsculas un email; el resultado vacío se guarda como
 * `NULL` (spec: "Nombre con espacios y email con mayúsculas"; el email nulo
 * no participa de la unicidad RN-TEN-03).
 *
 * @param {string} valor
 * @returns {string | null} email recortado y en minúsculas, o null si quedó vacío
 */
export function normalizarEmail(valor) {
  const recortado = valor.trim().toLowerCase();
  return recortado === '' ? null : recortado;
}

/** ¿Es `valor` una cadena de texto? (validación de cuerpos, capa de rutas). */
export function esTexto(valor) {
  return typeof valor === 'string';
}

/** ¿Es `valor` un booleano? (validación de cuerpos, capa de rutas). */
export function esBooleano(valor) {
  return typeof valor === 'boolean';
}

const VALIDADORES_POR_TIPO = {
  texto: esTexto,
  booleano: esBooleano,
};

/**
 * Validación estricta del cuerpo HTTP, hecha a mano en la capa de rutas
 * (design D5: sin dependencias nuevas). SOLO pasan los campos del
 * `esquema`; cualquier clave desconocida —incluidos `consultorioId`
 * (regla dura 2) y `usuarioId`— o valor de tipo inválido responde 422
 * `DATOS_INVALIDOS` sin escribir nada. Los campos ausentes no aparecen en
 * el resultado (la presencia se distingue de los `undefined` de JS).
 *
 * @param {unknown} cuerpo `req.body` (puede ser undefined)
 * @param {Record<string, {tipo: 'texto' | 'booleano', requerido?: boolean}>} esquema
 * @returns {Record<string, unknown>} solo los campos presentes y válidos
 * @throws {ApiError} 422 DATOS_INVALIDOS ante desconocidos, tipos inválidos o requeridos ausentes
 */
export function validarCuerpo(cuerpo, esquema) {
  const entrada = cuerpo ?? {};
  if (typeof entrada !== 'object' || Array.isArray(entrada)) {
    throw new ApiError(422, 'DATOS_INVALIDOS', 'El cuerpo debe ser un objeto JSON');
  }

  const desconocidos = Object.keys(entrada).filter((clave) => !Object.hasOwn(esquema, clave));
  if (desconocidos.length > 0) {
    throw new ApiError(
      422,
      'DATOS_INVALIDOS',
      `Campos no permitidos en el cuerpo: ${desconocidos.join(', ')}`
    );
  }

  const resultado = {};
  for (const [clave, regla] of Object.entries(esquema)) {
    const presente = Object.hasOwn(entrada, clave) && entrada[clave] !== undefined;
    if (!presente) {
      if (regla.requerido) {
        throw new ApiError(422, 'DATOS_INVALIDOS', `El campo '${clave}' es obligatorio`);
      }
      continue;
    }
    if (!VALIDADORES_POR_TIPO[regla.tipo](entrada[clave])) {
      throw new ApiError(
        422,
        'DATOS_INVALIDOS',
        `El campo '${clave}' debe ser de tipo ${regla.tipo}`
      );
    }
    resultado[clave] = entrada[clave];
  }
  return resultado;
}

/**
 * Traduce la violación de una restricción única de la base a un error
 * operacional (design.md, decisión 3): `23505` (unique_violation) → 409
 * `RECURSO_DUPLICADO`. La unicidad RN-TEN-03 la garantiza el índice: la
 * aplicación NO hace pre-check (corre en carrera) y cualquier otro error
 * pasa tal cual al manejador central.
 *
 * @param {unknown} error error proveniente de pg
 * @returns {unknown} ApiError 409 si era 23505; el error original si no
 */
export function traducirViolacionUnica(error) {
  if (error?.code === '23505') {
    return new ApiError(
      409,
      'RECURSO_DUPLICADO',
      'Ya existe un recurso con ese nombre o email en el consultorio'
    );
  }
  return error;
}

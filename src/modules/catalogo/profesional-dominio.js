// Capa de dominio del Profesional (módulo catalogo): reglas puras del
// agregado, sin I/O (DD-13). Combina los helpers compartidos de dominio.js
// con las reglas propias: nombre obligatorio y ficha de salida del contrato.
import { ApiError } from '../../errores.js';
import { normalizarEmail, normalizarTexto } from './dominio.js';

/**
 * Normaliza el alta de un profesional antes de escribir (design.md,
 * decisión 5): `nombre`, `matricula` se recortan; `email` se recorta y pasa
 * a minúsculas; los opcionales vacíos resultan `NULL`. Un nombre vacío o de
 * solo espacios es 422 `DATOS_INVALIDOS` (spec: "Nombre ausente o vacío").
 *
 * @param {{nombre: unknown, matricula?: unknown, email?: unknown}} datos
 * @returns {{nombre: string, matricula: string | null, email: string | null}}
 * @throws {ApiError} 422 DATOS_INVALIDOS si el nombre queda vacío
 */
export function normalizarAlta({ nombre, matricula, email }) {
  const nombreLimpio = normalizarTexto(nombre ?? '');
  if (nombreLimpio === null) {
    throw new ApiError(422, 'DATOS_INVALIDOS', "El campo 'nombre' es obligatorio y no puede estar vacío");
  }
  return {
    nombre: nombreLimpio,
    matricula: matricula == null ? null : normalizarTexto(matricula),
    email: email == null ? null : normalizarEmail(email),
  };
}

/**
 * Normaliza una actualización parcial (PUT): solo los campos PRESENTES
 * (distintos de `undefined`; en JSON no existe "presente pero undefined")
 * entran a `cambios`, conservándose el resto. Mismas reglas de
 * normalización que el alta; nombre presente y vacío → 422.
 *
 * @param {{nombre?: unknown, matricula?: unknown, email?: unknown, activo?: unknown}} datos
 * @returns {{nombre?: string, matricula?: string | null, email?: string | null, activo?: boolean}}
 * @throws {ApiError} 422 DATOS_INVALIDOS si `nombre` está presente y queda vacío
 */
export function normalizarActualizacion({ nombre, matricula, email, activo }) {
  const cambios = {};
  if (nombre !== undefined) {
    const nombreLimpio = normalizarTexto(nombre ?? '');
    if (nombreLimpio === null) {
      throw new ApiError(422, 'DATOS_INVALIDOS', "El campo 'nombre' es obligatorio y no puede estar vacío");
    }
    cambios.nombre = nombreLimpio;
  }
  if (matricula !== undefined) cambios.matricula = normalizarTexto(matricula ?? '');
  if (email !== undefined) cambios.email = normalizarEmail(email ?? '');
  if (activo !== undefined) cambios.activo = activo;
  return cambios;
}

/**
 * Ficha del contrato HTTP y de la interfaz del módulo (design.md,
 * decisión 6): `creadoEn` se serializa ISO 8601 UTC.
 *
 * @param {object} fila fila de la tabla `profesional`
 * @returns {{id: string, consultorioId: string, nombre: string, matricula: string | null,
 *   email: string | null, usuarioId: string | null, activo: boolean, creadoEn: string}}
 */
export function aFichaProfesional(fila) {
  return {
    id: fila.id,
    consultorioId: fila.consultorio_id,
    nombre: fila.nombre,
    matricula: fila.matricula,
    email: fila.email,
    usuarioId: fila.usuario_id,
    activo: fila.activo,
    creadoEn: fila.creado_en.toISOString(),
  };
}

// Capa de dominio del SillonBox (módulo catalogo): reglas puras del
// agregado, sin I/O (DD-13). Misma normalización que el Profesional
// (design.md, decisión 5): nombre obligatorio; descripción opcional.
import { ApiError } from '../../errores.js';
import { normalizarTexto } from './dominio.js';

/**
 * Normaliza el alta de un sillón/box: nombre y descripción se recortan y la
 * descripción vacía resulta `NULL`. Un nombre vacío o de solo espacios es
 * 422 `DATOS_INVALIDOS` (spec: "Nombre de sillón vacío").
 *
 * @param {{nombre: unknown, descripcion?: unknown}} datos
 * @returns {{nombre: string, descripcion: string | null}}
 * @throws {ApiError} 422 DATOS_INVALIDOS si el nombre queda vacío
 */
export function normalizarAlta({ nombre, descripcion }) {
  const nombreLimpio = normalizarTexto(nombre ?? '');
  if (nombreLimpio === null) {
    throw new ApiError(422, 'DATOS_INVALIDOS', "El campo 'nombre' es obligatorio y no puede estar vacío");
  }
  return {
    nombre: nombreLimpio,
    descripcion: descripcion == null ? null : normalizarTexto(descripcion),
  };
}

/**
 * Normaliza una actualización parcial (PUT): solo los campos PRESENTES
 * entran a `cambios`, conservándose el resto. Mismas reglas que el alta;
 * nombre presente y vacío → 422.
 *
 * @param {{nombre?: unknown, descripcion?: unknown, activo?: unknown}} datos
 * @returns {{nombre?: string, descripcion?: string | null, activo?: boolean}}
 * @throws {ApiError} 422 DATOS_INVALIDOS si `nombre` está presente y queda vacío
 */
export function normalizarActualizacion({ nombre, descripcion, activo }) {
  const cambios = {};
  if (nombre !== undefined) {
    const nombreLimpio = normalizarTexto(nombre ?? '');
    if (nombreLimpio === null) {
      throw new ApiError(422, 'DATOS_INVALIDOS', "El campo 'nombre' es obligatorio y no puede estar vacío");
    }
    cambios.nombre = nombreLimpio;
  }
  if (descripcion !== undefined) cambios.descripcion = normalizarTexto(descripcion ?? '');
  if (activo !== undefined) cambios.activo = activo;
  return cambios;
}

/**
 * Ficha del contrato HTTP y de la interfaz del módulo (design.md,
 * decisión 6): `creadoEn` se serializa ISO 8601 UTC.
 *
 * @param {object} fila fila de la tabla `sillon_box`
 * @returns {{id: string, consultorioId: string, nombre: string,
 *   descripcion: string | null, activo: boolean, creadoEn: string}}
 */
export function aFichaSillonBox(fila) {
  return {
    id: fila.id,
    consultorioId: fila.consultorio_id,
    nombre: fila.nombre,
    descripcion: fila.descripcion,
    activo: fila.activo,
    creadoEn: fila.creado_en.toISOString(),
  };
}

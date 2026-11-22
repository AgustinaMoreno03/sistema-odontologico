// Capa de servicios (módulo catalogo): casos de uso del SillonBox que
// orquestan dominio y repositorios. Sin HTTP y sin SQL directo (DD-13).
// Repositorios inyectables para simular fallos de base (design.md, decisión 9).
import { ApiError } from '../../errores.js';
import { traducirViolacionUnica, validarUuid } from './dominio.js';
import {
  aFichaSillonBox,
  normalizarActualizacion,
  normalizarAlta,
} from './sillon-box-dominio.js';
import * as repositorioReal from './sillon-box-repositorios.js';

function repoDe(deps) {
  return deps.sillonBoxRepo ?? repositorioReal;
}

/**
 * Alta de un sillón/box en el consultorio autenticado (spec "Alta de sillón
 * o box y unicidad por consultorio").
 *
 * @param {{consultorioId: string, nombre: string, descripcion?: string | null}} datos
 * @param {{sillonBoxRepo?: object}} [deps]
 * @returns {Promise<object>} ficha creada
 * @throws {ApiError} 422 DATOS_INVALIDOS si el nombre queda vacío
 */
export async function crearSillonBox(datos, deps = {}) {
  const repo = repoDe(deps);
  const normalizados = normalizarAlta(datos);
  try {
    const fila = await repo.insertarSillonBox({
      consultorioId: datos.consultorioId,
      ...normalizados,
    });
    return aFichaSillonBox(fila);
  } catch (error) {
    // Sin pre-check: el índice único de la base garantiza RN-TEN-03 y su
    // violación (23505) es un 409 operacional (design.md, decisión 3).
    throw traducirViolacionUnica(error);
  }
}

/**
 * Comprobación de existencia para turnos (spec "Comprobaciones de existencia
 * para turnos", design D8): `true` si la ficha existe DENTRO del consultorio
 * —incluidos los inactivos— y `false` si no existe o es de otro consultorio.
 * Identificadores malformados → 400 `DATOS_INVALIDOS`; los fallos de base se
 * propagan al consumidor sin transformar.
 *
 * @param {{sillonBoxId: string, consultorioId: string}} parametros
 * @param {{sillonBoxRepo?: object}} [deps]
 * @returns {Promise<boolean>}
 */
export async function existeSillonBox({ sillonBoxId, consultorioId }, deps = {}) {
  validarUuid(sillonBoxId, 'sillonBoxId');
  validarUuid(consultorioId, 'consultorioId');
  const repo = repoDe(deps);
  const fila = await repo.obtenerSillonBoxPorId({ consultorioId, id: sillonBoxId });
  return fila !== null;
}

/**
 * Actualización parcial (PUT) de un sillón/box del consultorio (spec
 * "Actualización y baja lógica del catálogo"): conserva los campos no
 * enviados; `id` inexistente o de otro consultorio → 404
 * `RECURSO_NO_ENCONTRADO`; nombre duplicado → 409 `RECURSO_DUPLICADO` con el
 * registro sin cambios.
 *
 * @param {{consultorioId: string, id: string, nombre?: string,
 *   descripcion?: string | null, activo?: boolean}} datos campos ausentes se conservan
 * @param {{sillonBoxRepo?: object}} [deps]
 * @returns {Promise<object>} ficha actualizada
 * @throws {ApiError} 422 nombre vacío; 404 inexistente; 409 duplicado
 */
export async function actualizarSillonBox(datos, deps = {}) {
  const repo = repoDe(deps);
  const { consultorioId, id } = datos;
  const cambios = normalizarActualizacion(datos);
  try {
    const fila = await repo.actualizarSillonBox({ consultorioId, id, cambios });
    if (fila === null) {
      throw new ApiError(404, 'RECURSO_NO_ENCONTRADO', 'Sillón/box no encontrado en el consultorio');
    }
    return aFichaSillonBox(fila);
  } catch (error) {
    throw traducirViolacionUnica(error);
  }
}

/**
 * Listado de gestión (spec "Listados de gestión del catálogo"): TODOS los
 * sillones/boxes del consultorio —activos e inactivos— con su `activo`,
 * reservado por la ruta a `ADMIN_CONSULTORIO`.
 *
 * @param {{consultorioId: string}} parametros
 * @param {{sillonBoxRepo?: object}} [deps]
 * @returns {Promise<object[]>} fichas completas
 */
export async function listarSillonBoxes({ consultorioId }, deps = {}) {
  const repo = repoDe(deps);
  const filas = await repo.listarSillonBoxes({ consultorioId });
  return filas.map(aFichaSillonBox);
}

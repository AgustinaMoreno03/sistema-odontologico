// Capa de servicios (módulo catalogo): casos de uso del Profesional que
// orquestan dominio y repositorios. Sin HTTP (no importa express) y sin SQL
// directo (DD-13). Los repositorios son inyectables para simular fallos de
// base sin mockear SQL en la suite (design.md, decisión 9, patrón
// `crearApp({ chequearBase })` de C00).
import { ApiError } from '../../errores.js';
import { traducirViolacionUnica, validarUuid } from './dominio.js';
import {
  aFichaProfesional,
  normalizarActualizacion,
  normalizarAlta,
} from './profesional-dominio.js';
import * as repositorioReal from './profesional-repositorios.js';

function repoDe(deps) {
  return deps.profesionalRepo ?? repositorioReal;
}

/**
 * Alta de un profesional en el consultorio autenticado (spec "Alta de
 * profesional en el consultorio autenticado"). La unicidad RN-TEN-03 la
 * garantiza el índice de la base: una violación se traduce en 409 (tarea 4.1).
 *
 * @param {{consultorioId: string, nombre: string, matricula?: string | null, email?: string | null}} datos
 * @param {{profesionalRepo?: object}} [deps]
 * @returns {Promise<object>} ficha creada
 * @throws {ApiError} 422 DATOS_INVALIDOS si el nombre queda vacío
 */
export async function crearProfesional(datos, deps = {}) {
  const repo = repoDe(deps);
  const normalizados = normalizarAlta(datos);
  try {
    const fila = await repo.insertarProfesional({
      consultorioId: datos.consultorioId,
      ...normalizados,
    });
    return aFichaProfesional(fila);
  } catch (error) {
    // Sin pre-check: el índice único de la base garantiza RN-TEN-03 y su
    // violación (23505) es un 409 operacional (design.md, decisión 3).
    throw traducirViolacionUnica(error);
  }
}

/**
 * Comprobación de existencia para turnos (spec "Comprobaciones de existencia
 * para turnos", design D8): `true` si la ficha existe DENTRO del consultorio
 * —incluidos los inactivos (existencia, no disponibilidad; la disponibilidad
 * la define `obtenerCatalogo`)— y `false` si no existe o pertenece a otro
 * consultorio. Identificadores malformados → 400 `DATOS_INVALIDOS`; los
 * fallos de base se propagan al consumidor sin transformar.
 *
 * @param {{profesionalId: string, consultorioId: string}} parametros
 * @param {{profesionalRepo?: object}} [deps]
 * @returns {Promise<boolean>}
 */
export async function existeProfesional({ profesionalId, consultorioId }, deps = {}) {
  validarUuid(profesionalId, 'profesionalId');
  validarUuid(consultorioId, 'consultorioId');
  const repo = repoDe(deps);
  const fila = await repo.obtenerProfesionalPorId({ consultorioId, id: profesionalId });
  return fila !== null;
}

/**
 * Actualización parcial (PUT) de un profesional del consultorio (spec
 * "Actualización y baja lógica del catálogo"): conserva los campos no
 * enviados; un `id` inexistente o de otro consultorio es 404
 * `RECURSO_NO_ENCONTRADO`; un nombre duplicado es 409 `RECURSO_DUPLICADO`
 * con el registro sin cambios (el `UPDATE` aborta entero).
 *
 * @param {{consultorioId: string, id: string, nombre?: string, matricula?: string | null,
 *   email?: string | null, activo?: boolean}} datos campos ausentes se conservan
 * @param {{profesionalRepo?: object}} [deps]
 * @returns {Promise<object>} ficha actualizada
 * @throws {ApiError} 422 nombre vacío; 404 inexistente; 409 duplicado
 */
export async function actualizarProfesional(datos, deps = {}) {
  const repo = repoDe(deps);
  const { consultorioId, id } = datos;
  const cambios = normalizarActualizacion(datos);
  try {
    const fila = await repo.actualizarProfesional({ consultorioId, id, cambios });
    if (fila === null) {
      throw new ApiError(404, 'RECURSO_NO_ENCONTRADO', 'Profesional no encontrado en el consultorio');
    }
    return aFichaProfesional(fila);
  } catch (error) {
    throw traducirViolacionUnica(error);
  }
}

/**
 * Listado de gestión (spec "Listados de gestión del catálogo"): TODOS los
 * profesionales del consultorio —activos e inactivos— con su `activo` y su
 * vínculo `usuarioId`, reservado por la ruta a `ADMIN_CONSULTORIO`.
 *
 * @param {{consultorioId: string}} parametros
 * @param {{profesionalRepo?: object}} [deps]
 * @returns {Promise<object[]>} fichas completas
 */
export async function listarProfesionales({ consultorioId }, deps = {}) {
  const repo = repoDe(deps);
  const filas = await repo.listarProfesionales({ consultorioId });
  return filas.map(aFichaProfesional);
}

/**
 * Vincula un usuario a la ficha profesional 1:1 opcional (spec "Vinculación
 * identidad y ficha profesional", design D1). SOLO interfaz de módulo (sin
 * HTTP), acotada al consultorio y SIN restricción de rol (RN-AU-02).
 *
 * - `false` si el profesional no pertenece al consultorio (sin cambios).
 * - `true` si el vínculo queda guardado; revincular la MISMA pareja es
 *   idempotente.
 * - 409 `RECURSO_DUPLICADO` si el profesional ya está vinculado a otro
 *   usuario o el usuario a otra ficha (se conserva el primer vínculo; hay
 *   que `desvincularUsuario` antes).
 * - 422 `DATOS_INVALIDOS` si el `usuarioId` no existe (FK violada: el
 *   consumidor garantizaba la existencia).
 * El `catalogo` NUNCA lee la tabla `usuario` (DD-13).
 *
 * @param {{profesionalId: string, usuarioId: string, consultorioId: string}} parametros
 * @param {{profesionalRepo?: object}} [deps]
 * @returns {Promise<boolean>}
 */
export async function vincularUsuario({ profesionalId, usuarioId, consultorioId }, deps = {}) {
  validarUuid(profesionalId, 'profesionalId');
  validarUuid(usuarioId, 'usuarioId');
  validarUuid(consultorioId, 'consultorioId');
  const repo = repoDe(deps);

  const fila = await repo.obtenerProfesionalPorId({ consultorioId, id: profesionalId });
  if (fila === null) return false; // de otro consultorio o inexistente: sin cambios
  if (fila.usuario_id === usuarioId) return true; // revinculación idempotente
  if (fila.usuario_id !== null) {
    throw new ApiError(
      409,
      'RECURSO_DUPLICADO',
      'El profesional ya está vinculado a otro usuario; debe desvincularlo antes'
    );
  }

  try {
    // UPDATE condicional sobre usuario_id IS NULL: sin carrera entre altas
    // simultáneas; el índice único parcial es la red de seguridad final.
    const vinculada = await repo.vincularUsuarioProfesional({
      consultorioId,
      id: profesionalId,
      usuarioId,
    });
    if (vinculada === null) {
      throw new ApiError(
        409,
        'RECURSO_DUPLICADO',
        'El usuario ya está vinculado a otra ficha; debe desvincularla antes'
      );
    }
    return true;
  } catch (error) {
    if (error?.code === '23505') {
      // Red de seguridad del índice único parcial usuario_id (design D1).
      throw new ApiError(
        409,
        'RECURSO_DUPLICADO',
        'El usuario ya está vinculado a otra ficha; debe desvincularla antes'
      );
    }
    if (error?.code === '23503') {
      // FK usuario_id rota: el consumidor garantizaba la existencia (design D1).
      throw new ApiError(422, 'DATOS_INVALIDOS', 'El usuario indicado no existe');
    }
    throw error;
  }
}

/**
 * Quita el vínculo de usuario de la ficha (idempotente). Devuelve `true` si
 * el profesional pertenece al consultorio (aunque estuviera ya sin vínculo)
 * y `false` si no es de este consultorio. El profesional sigue publicado
 * tras desvincular.
 *
 * @param {{profesionalId: string, consultorioId: string}} parametros
 * @param {{profesionalRepo?: object}} [deps]
 * @returns {Promise<boolean>}
 */
export async function desvincularUsuario({ profesionalId, consultorioId }, deps = {}) {
  validarUuid(profesionalId, 'profesionalId');
  validarUuid(consultorioId, 'consultorioId');
  const repo = repoDe(deps);
  const fila = await repo.desvincularUsuarioProfesional({ consultorioId, id: profesionalId });
  return fila !== null;
}

/**
 * Resolución inversa del vínculo (spec): ficha del profesional vinculado al
 * usuario DENTRO del consultorio, o `null`. Devuelve también fichas
 * inactivas: resuelve identidad, no disponibilidad (design D1).
 *
 * @param {{usuarioId: string, consultorioId: string}} parametros
 * @param {{profesionalRepo?: object}} [deps]
 * @returns {Promise<object | null>} ficha completa o null
 */
export async function profesionalDeUsuario({ usuarioId, consultorioId }, deps = {}) {
  validarUuid(usuarioId, 'usuarioId');
  validarUuid(consultorioId, 'consultorioId');
  const repo = repoDe(deps);
  const fila = await repo.obtenerProfesionalPorUsuario({ consultorioId, usuarioId });
  return fila === null ? null : aFichaProfesional(fila);
}

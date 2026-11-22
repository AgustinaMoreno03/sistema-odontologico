// Capa de servicios del catálogo agregado (módulo catalogo): la vista que
// C05 consume para resolver recursos válidos al crear turnos (design.md,
// decisión 8). Sin HTTP y sin SQL directo (DD-13); repositorios
// inyectables (design D9).
import { validarUuid } from './dominio.js';
import * as repoProfesionalReal from './profesional-repositorios.js';
import * as repoSillonBoxReal from './sillon-box-repositorios.js';

/**
 * Catálogo ACTIVO del consultorio (spec "Catálogo activo del consultorio
 * para turnos"): profesionales y sillones/boxes activos, con la proyección
 * mínima `{ id, nombre, matricula }` / `{ id, nombre, descripcion }`.
 * Los identificadores malformados lanzan ApiError 400 (design D8).
 *
 * @param {{consultorioId: string}} parametros
 * @param {{profesionalRepo?: object, sillonBoxRepo?: object}} [deps]
 * @returns {Promise<{profesionales: object[], sillonBoxes: object[]}>}
 */
export async function obtenerCatalogo({ consultorioId }, deps = {}) {
  validarUuid(consultorioId, 'consultorioId');
  const repoProfesional = deps.profesionalRepo ?? repoProfesionalReal;
  const repoSillonBox = deps.sillonBoxRepo ?? repoSillonBoxReal;

  const [profesionales, sillonBoxes] = await Promise.all([
    repoProfesional.listarProfesionalesActivos({ consultorioId }),
    repoSillonBox.listarSillonBoxesActivos({ consultorioId }),
  ]);
  return { profesionales, sillonBoxes };
}

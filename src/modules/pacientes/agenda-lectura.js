import { ApiError } from '../../errores.js';
import { validarUuid } from './dominio.js';
import { consultarNombresPacientes } from './agenda-repositorio.js';

/** Lectura mínima por lote para agenda; nunca devuelve contactos. */
export async function obtenerNombresPacientes({ pacienteIds, consultorioId } = {}) {
  validarUuid(consultorioId);
  if (!Array.isArray(pacienteIds) || pacienteIds.length > 200) {
    throw new ApiError(400, 'VALIDACION', 'Se admite un máximo de 200 identificadores de pacientes');
  }
  for (const id of pacienteIds) validarUuid(id);
  const ids = [...new Set(pacienteIds)];
  if (ids.length === 0) return [];
  return consultarNombresPacientes({ pacienteIds: ids, consultorioId });
}

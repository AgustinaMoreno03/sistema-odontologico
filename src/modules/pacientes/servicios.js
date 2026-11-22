import { randomUUID } from 'node:crypto';
import { ApiError } from '../../errores.js';
import { validarUuid, normalizarFicha, prepararBusqueda } from './dominio.js';
import { consultarExistenciaPaciente, insertarPaciente, consultarPacientes } from './repositorios.js';

/**
 * Comprueba pertenencia al consultorio del contexto autenticado.
 * El módulo consumidor obtiene consultorioId del token validado.
 *
 * @param {{ pacienteId: string, consultorioId: string }} parametros
 * @returns {Promise<boolean>}
 */
export async function existePaciente(parametros = {}) {
  const { pacienteId, consultorioId } = parametros ?? {};

  validarUuid(pacienteId);
  validarUuid(consultorioId);

  return consultarExistenciaPaciente({ pacienteId, consultorioId });
}

export async function crearPaciente({ datos, contexto }) {
  if (!['ADMIN_CONSULTORIO', 'RECEPCION'].includes(contexto?.rol)) {
    throw new ApiError(403, 'PROHIBIDO', 'Operación no permitida');
  }

  const consultorioId = contexto.consultorioId;
  validarUuid(consultorioId);
  const ficha = normalizarFicha(datos);

  try {
    return await insertarPaciente({
      id: randomUUID(),
      consultorioId,
      ...ficha,
    });
  } catch (error) {
    if (
      error.code === '23505' &&
      error.constraint === 'paciente_email_consultorio_unico'
    ) {
      throw new ApiError(
        409,
        'EMAIL_DUPLICADO',
        'El email ya está registrado en este consultorio'
      );
    }
    throw error;
  }
}

export async function buscarPacientes({ texto, contexto }) {
  if (!['ADMIN_CONSULTORIO', 'RECEPCION', 'ODONTOLOGO'].includes(contexto?.rol)) {
    throw new ApiError(403, 'PROHIBIDO', 'Operación no permitida');
  }

  const consultorioId = contexto.consultorioId;
  validarUuid(consultorioId);
  const busqueda = prepararBusqueda(texto);

  return consultarPacientes({ consultorioId, ...busqueda });
}

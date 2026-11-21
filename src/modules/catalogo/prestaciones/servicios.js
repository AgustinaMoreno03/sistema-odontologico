import { ApiError } from '../../../errores.js';
import { crearRepositorioPrestaciones } from './repositorio.js';
import { validarCambiosPrestacion, validarPrestacion } from './dominio.js';

const ROLES_LECTURA = new Set(['ADMIN_CONSULTORIO', 'RECEPCION', 'ODONTOLOGO']);

function exigirLectura(rol) {
  if (!ROLES_LECTURA.has(rol)) {
    throw new ApiError(403, 'PERMISO_DENEGADO', 'No tiene permisos para consultar prestaciones');
  }
}

function exigirAdministracion(rol) {
  if (rol !== 'ADMIN_CONSULTORIO') {
    throw new ApiError(403, 'PERMISO_DENEGADO', 'Solo ADMIN_CONSULTORIO puede administrar prestaciones');
  }
}

function traducirErrorPersistencia(err) {
  if (err?.code === '23505') {
    return new ApiError(409, 'PRESTACION_DUPLICADA', 'Ya existe una prestación con ese nombre');
  }
  return err;
}

export function crearServiciosPrestaciones({ repositorio = crearRepositorioPrestaciones({}) } = {}) {
  return {
    async crear({ consultorioId, rol, nombre, duracionMin, descripcion }) {
      exigirAdministracion(rol);
      validarPrestacion({ nombre, duracionMin });
      try {
        return await repositorio.crear({ consultorioId, nombre, duracionMin, descripcion });
      } catch (err) {
        throw traducirErrorPersistencia(err);
      }
    },

    async listar({ consultorioId, rol, activo }) {
      exigirLectura(rol);
      return repositorio.listar({ consultorioId, activo });
    },

    async obtenerPorId({ consultorioId, rol, prestacionId }) {
      exigirLectura(rol);
      return repositorio.obtenerPorId({ consultorioId, prestacionId });
    },

    async editar({ consultorioId, rol, prestacionId, ...cambios }) {
      exigirAdministracion(rol);
      validarCambiosPrestacion(cambios);
      try {
        return await repositorio.actualizar({ consultorioId, prestacionId, cambios });
      } catch (err) {
        throw traducirErrorPersistencia(err);
      }
    },

    obtenerPrestacionParaTurno({ prestacionId, consultorioId }) {
      return repositorio.obtenerPrestacionParaTurno({ prestacionId, consultorioId });
    },
  };
}

const serviciosPrestaciones = crearServiciosPrestaciones();

export function obtenerPrestacionParaTurno({ prestacionId, consultorioId }) {
  return serviciosPrestaciones.obtenerPrestacionParaTurno({ prestacionId, consultorioId });
}

import { ApiError } from '../../../errores.js';

function errorDatosInvalidos(message) {
  return new ApiError(400, 'DATOS_INVALIDOS', message);
}

export function validarPrestacion({ nombre, duracionMin }) {
  if (typeof nombre !== 'string' || nombre.length === 0 || nombre.length > 100) {
    throw errorDatosInvalidos('El nombre debe tener entre 1 y 100 caracteres');
  }
  if (!Number.isInteger(duracionMin) || duracionMin < 1 || duracionMin > 480) {
    throw errorDatosInvalidos('La duración debe ser un entero entre 1 y 480 minutos');
  }
}

export function validarCambiosPrestacion(cambios) {
  if (Object.keys(cambios).length === 0) {
    throw errorDatosInvalidos('Debe especificar al menos un campo para actualizar');
  }
  if ('nombre' in cambios && (typeof cambios.nombre !== 'string' || cambios.nombre.length === 0 || cambios.nombre.length > 100)) {
    throw errorDatosInvalidos('El nombre debe tener entre 1 y 100 caracteres');
  }
  if ('duracionMin' in cambios && (!Number.isInteger(cambios.duracionMin) || cambios.duracionMin < 1 || cambios.duracionMin > 480)) {
    throw errorDatosInvalidos('La duración debe ser un entero entre 1 y 480 minutos');
  }
  if ('activo' in cambios && typeof cambios.activo !== 'boolean') {
    throw errorDatosInvalidos('El campo activo debe ser booleano');
  }
  if ('descripcion' in cambios && cambios.descripcion !== null && typeof cambios.descripcion !== 'string') {
    throw errorDatosInvalidos('La descripción debe ser texto o nula');
  }
}

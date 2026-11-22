import { ApiError } from '../../errores.js';

const FORMATO_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarUuid(valor) {
  if (typeof valor !== 'string' || !FORMATO_UUID.test(valor)) {
    throw new ApiError(400, 'VALIDACION', 'Identificadores inválidos');
  }
}

function normalizarTexto(valor) {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') {
    throw new ApiError(422, 'DATOS_INVALIDOS', 'Los campos deben ser texto');
  }
  return valor.trim() || null;
}

export function normalizarTelefono(valor) {
  const texto = normalizarTexto(valor);
  if (texto === null) return null;

  if (!/^[+0-9\s()-]+$/u.test(texto)) {
    throw new ApiError(422, 'DATOS_INVALIDOS', 'Teléfono inválido');
  }

  const telefono = texto.replace(/[\s()-]/gu, '');
  if (!/^\+?[0-9]*$/.test(telefono)) {
    throw new ApiError(422, 'DATOS_INVALIDOS', 'Teléfono inválido');
  }

  return /[0-9]/.test(telefono) ? telefono : null;
}

export function normalizarFicha(datos) {
  const nombre = normalizarTexto(datos.nombre);
  const apellido = normalizarTexto(datos.apellido);
  const telefono = normalizarTelefono(datos.telefono);
  const email = normalizarTexto(datos.email)?.toLowerCase() ?? null;

  if (!nombre) {
    throw new ApiError(422, 'DATOS_INVALIDOS', 'El nombre es obligatorio');
  }
  if (!telefono && !email) {
    throw new ApiError(422, 'DATOS_INVALIDOS', 'Se requiere teléfono o email');
  }

  return { nombre, apellido, telefono, email };
}

export function prepararBusqueda(valor) {
  if (typeof valor !== 'string' || !valor.trim()) {
    throw new ApiError(422, 'DATOS_INVALIDOS', 'Se requiere un texto de búsqueda');
  }

  const texto = valor.trim();
  const candidato = texto.replace(/[\s()-]/gu, '');
  const telefono = /^\+?[0-9]+$/.test(candidato) ? candidato : null;

  return { texto, telefono };
}

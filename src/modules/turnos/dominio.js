// Capa de dominio del módulo turnos (DD-13): helpers puros, sin I/O
// (ni HTTP ni base de datos). Los consume el repositorio (3.2) y el
// servicio `crearTurno` (4.1); C07 reutilizará esta interfaz en lugar de
// copiarla (CHANGES.md:172).
import { ApiError } from '../../errores.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ISO 8601 con timezone explícita: 'Z' o offset ±HH:MM / ±HHMM. Sin
// timezone la cadena es ambigua (se interpretaría en la zona del servidor)
// y el spec la rechaza con 400 VALIDACION.
const ISO_CON_TIMEZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * ¿Es `valor` una cadena con formato UUID (8-4-4-4-12 hex)?
 *
 * @param {unknown} valor
 * @returns {boolean}
 */
export function esUuid(valor) {
  return typeof valor === 'string' && UUID_REGEX.test(valor);
}

/**
 * Valida un identificador UUID y lo devuelve tal cual.
 *
 * Spec de turnos ("identificador malformado → 400 `VALIDACION`"): a
 * diferencia del catálogo (`DATOS_INVALIDOS`), C05 responde `VALIDACION`
 * también para UUID malformado (design D5).
 *
 * @param {unknown} valor identificador a validar
 * @param {string} [campo] nombre del campo para el mensaje seguro
 * @returns {string} el identificador validado
 * @throws {ApiError} 400 VALIDACION si no es un UUID válido
 */
export function validarUuid(valor, campo = 'identificador') {
  if (!esUuid(valor)) {
    throw new ApiError(400, 'VALIDACION', `'${campo}' debe ser un identificador UUID válido`);
  }
  return valor;
}

/**
 * Valida `inicio` como ISO 8601 con timezone explícita o UTC y devuelve el
 * instante como `Date`. Sin timezone, con fecha imposible o sin ser texto
 * → `ApiError` 400 `VALIDACION` (spec: "sin timezone → 400 VALIDACION").
 *
 * @param {unknown} valor fecha en texto ISO 8601 con timezone
 * @returns {Date} el instante representado
 * @throws {ApiError} 400 VALIDACION si el formato no es válido
 */
export function validarInicio(valor) {
  const valido =
    typeof valor === 'string' &&
    ISO_CON_TIMEZONE.test(valor) &&
    !Number.isNaN(Date.parse(valor));
  if (!valido) {
    throw new ApiError(
      400,
      'VALIDACION',
      "'inicio' debe ser una fecha ISO 8601 con zona horaria explícita"
    );
  }
  return new Date(valor);
}

/**
 * Calcula `fin = inicio + duracionMin` con la duración GUARDADA AL CREARSE
 * el turno (RN-AG-07): editar la prestación después no altera este cálculo.
 *
 * `duracionMin` debe ser un entero ≥ 1: `0` produciría `fin = inicio`
 * (rango vacío, prohibido por el `CHECK` de la base y ajeno a la semántica
 * `[)` de RN-AG-06).
 *
 * @param {Date | string} inicio instante de inicio (Date o ISO con timezone)
 * @param {unknown} duracionMin duración en minutos, entera ≥ 1
 * @returns {Date} el instante final
 * @throws {ApiError} 400 VALIDACION ante inicio inválido o duración inválida
 */
export function calcularFin(inicio, duracionMin) {
  const fecha = inicio instanceof Date ? inicio : validarInicio(inicio);
  if (Number.isNaN(fecha.getTime())) {
    throw new ApiError(
      400,
      'VALIDACION',
      "'inicio' debe ser una fecha ISO 8601 con zona horaria explícita"
    );
  }
  if (!Number.isInteger(duracionMin) || duracionMin < 1) {
    throw new ApiError(400, 'VALIDACION', "'duracionMin' debe ser un entero mayor o igual a 1");
  }
  return new Date(fecha.getTime() + duracionMin * 60_000);
}

/**
 * Traduce los errores de concurrencia de la base a un error operacional
 * (design D1 + opción 1 aprobada para S6): `23P01` (`exclusion_violation`)
 * y `40P01` (`deadlock_detected`, solo como FALLBACK tras agotar los 2
 * intentos de reintento del repositorio) → 409 `SOLAPAMIENTO`. Cualquier
 * otro error pasa tal cual (precedente: `traducirViolacionUnica` de
 * catalogo para `23505`).
 *
 * @param {unknown} error error proveniente de pg
 * @returns {unknown} ApiError 409 si era 23P01 o 40P01; el error original si no
 */
export function traducirViolacionExclusion(error) {
  if (error?.code === '23P01' || error?.code === '40P01') {
    return new ApiError(409, 'SOLAPAMIENTO', 'El turno se solapa con otro turno existente');
  }
  return error;
}

// Mensajes DETALLADOS por recurso del pre-check (design D1: "el pre-check
// SELECT dentro de esa transacción da mensajes detallados"). Son seguros:
// solo nombran el recurso del consultorio autenticado, sin exponer datos
// de otros tenants.
const MENSAJES_SOLAPAMIENTO = {
  profesional: 'El profesional ya tiene un turno en ese horario',
  sillonBox: 'El sillón/box ya tiene un turno en ese horario',
  paciente: 'El paciente ya tiene un turno en ese horario',
};

/**
 * Error de solapamiento con detalle del recurso en conflicto, para el
 * pre-check del repositorio.
 *
 * @param {'profesional' | 'sillonBox' | 'paciente'} [recurso] recurso solapado
 * @returns {ApiError} 409 SOLAPAMIENTO con mensaje seguro
 */
export function errorSolapamiento(recurso) {
  const detalle = MENSAJES_SOLAPAMIENTO[recurso];
  return new ApiError(
    409,
    'SOLAPAMIENTO',
    detalle ?? 'El turno se solapa con otro turno existente en este consultorio'
  );
}

// C07 (design D4): mensajes seguros y GENÉRICOS — el 404 no distingue
// "no existe" de "es de otro consultorio" (una sola señal, como Decisión 4
// de C05) y jamás incluye identificadores ni datos de otro tenant.

/**
 * Error de turno inexistente o ajeno al consultorio autenticado: el
 * `WHERE consultorio_id` del `SELECT … FOR UPDATE` los trata igual
 * (RN-TEN-01/RN-TEN-02) y un rol sin permiso no llega acá (403 en la ruta).
 *
 * @returns {ApiError} 404 TURNO_NO_ENCONTRADO con mensaje seguro
 */
export function errorTurnoNoEncontrado() {
  return new ApiError(404, 'TURNO_NO_ENCONTRADO', 'Turno no encontrado');
}

/**
 * Error de estado: solo los turnos `PENDIENTE` se reprograman (RN-AG-10);
 * `CONFIRMADO`, `ATENDIDO`, `AUSENTE` o `CANCELADO` → este 409 sin
 * modificar el turno.
 *
 * @returns {ApiError} 409 ESTADO_INVALIDO con mensaje seguro
 */
export function errorEstadoInvalido() {
  return new ApiError(
    409,
    'ESTADO_INVALIDO',
    'Solo los turnos en estado PENDIENTE pueden reprogramarse'
  );
}

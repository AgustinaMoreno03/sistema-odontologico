// Capa de servicios del módulo turnos (DD-13): caso de uso `crearTurno`.
// Orquesta las deps de otros módulos SIN tocar sus tablas (regla dura 10) y
// SIN lógica de negocio propia (las reglas viven en el dominio). C07
// reutilizará esta interfaz en lugar de copiarla (CHANGES.md:172).
import { ApiError } from '../../errores.js';
import { validarUuid, validarInicio, calcularFin } from './dominio.js';
import { crearRepositorioTurnos } from './repositorio.js';
import { existePaciente } from '../pacientes/index.js';
import { existeProfesional, existeSillonBox, obtenerCatalogo } from '../catalogo/index.js';
import { obtenerPrestacionParaTurno } from '../catalogo/prestaciones/servicios.js';

// Un mensaje por campo (spec R4): el MISMO texto para inexistente, ajeno o
// inactivo dentro de cada campo — nunca un único mensaje para los cuatro.
const MENSAJES_REFERENCIA = {
  pacienteId:
    "Referencia inválida: 'pacienteId' no existe, es de otro consultorio o está inactivo",
  profesionalId:
    "Referencia inválida: 'profesionalId' no existe, es de otro consultorio o está inactivo",
  sillonBoxId:
    "Referencia inválida: 'sillonBoxId' no existe, es de otro consultorio o está inactivo",
  prestacionId:
    "Referencia inválida: 'prestacionId' no existe, es de otro consultorio o está inactivo",
};

// Repositorio por defecto: cada operación abre su propia conexión (design
// D1/D6). Los tests de servicio NO lo mockean — ejercitan la transacción
// real contra PostgreSQL (regla del proyecto: no se mockea la capa SQL).
const repositorioTurnos = crearRepositorioTurnos();

/**
 * Crea un turno en el consultorio autenticado (spec de turnos, R1–R4).
 *
 * Orden de validación (design D5): UUID e `inicio` ISO 8601 con timezone →
 * 400 `VALIDACION`; pertenencia/activitud de los cuatro recursos → 422
 * `REFERENCIA_INVALIDA` (indicando el campo fallido); transacción con
 * solapamiento + INSERT → 409 `SOLAPAMIENTO` (garantía en la base, `23P01`).
 *
 * @param {{pacienteId: string, profesionalId: string, sillonBoxId: string,
 *   prestacionId: string, inicio: string, consultorioId: string}} parametros
 *   `consultorioId` SIEMPRE desde el token (regla dura 2), nunca del body.
 * @param {object} [deps] consumidores inyectables (tests); en producción
 *   resuelven por imports estáticos (tarea 4.2).
 * @returns {Promise<object>} el turno creado (DTO de la capa de rutas)
 * @throws {ApiError} 400 / 422 / 409 según el spec
 */
export async function crearTurno(
  { pacienteId, profesionalId, sillonBoxId, prestacionId, inicio, consultorioId },
  deps = {}
) {
  const {
    existePaciente: pacienteExiste = existePaciente,
    existeProfesional: profesionalExiste = existeProfesional,
    existeSillonBox: sillonExiste = existeSillonBox,
    obtenerCatalogo: catalogo = obtenerCatalogo,
    obtenerPrestacionParaTurno: prestacionParaTurno = obtenerPrestacionParaTurno,
  } = deps;

  // 400 — formato: los cuatro identificadores deben ser UUID.
  validarUuid(pacienteId, 'pacienteId');
  validarUuid(profesionalId, 'profesionalId');
  validarUuid(sillonBoxId, 'sillonBoxId');
  validarUuid(prestacionId, 'prestacionId');
  // 400 — `inicio` ISO 8601 con timezone explícita (se conserva para el
  // cálculo de `fin` y el INSERT del paso 409).
  const fechaInicio = validarInicio(inicio);

  // 422 — recursos: siempre acotados al consultorio del token.
  if (!(await pacienteExiste({ pacienteId, consultorioId }))) {
    throw new ApiError(422, 'REFERENCIA_INVALIDA', MENSAJES_REFERENCIA.pacienteId);
  }

  // Profesional: `existe*` solo prueba pertenencia (acepta inactivos); el
  // catálogo ACTIVO publicado por obtenerCatalogo() decide la disponibilidad.
  if (!(await profesionalExiste({ profesionalId, consultorioId }))) {
    throw new ApiError(422, 'REFERENCIA_INVALIDA', MENSAJES_REFERENCIA.profesionalId);
  }
  const catalogoActivo = await catalogo({ consultorioId });
  if (!catalogoActivo.profesionales.some((p) => p.id === profesionalId)) {
    throw new ApiError(422, 'REFERENCIA_INVALIDA', MENSAJES_REFERENCIA.profesionalId);
  }

  // Sillón/box: mismo patrón (obligatorio en el alta — decisión de usuaria).
  if (!(await sillonExiste({ sillonBoxId, consultorioId }))) {
    throw new ApiError(422, 'REFERENCIA_INVALIDA', MENSAJES_REFERENCIA.sillonBoxId);
  }
  if (!catalogoActivo.sillonBoxes.some((s) => s.id === sillonBoxId)) {
    throw new ApiError(422, 'REFERENCIA_INVALIDA', MENSAJES_REFERENCIA.sillonBoxId);
  }

  // Prestación: `obtenerPrestacionParaTurno` devuelve null si no existe, es
  // ajena o está inactiva (una sola señal → un solo mensaje por campo).
  const prestacion = await prestacionParaTurno({ prestacionId, consultorioId });
  if (!prestacion) {
    throw new ApiError(422, 'REFERENCIA_INVALIDA', MENSAJES_REFERENCIA.prestacionId);
  }

  // 409 — transacción única (design D1): pre-check de solapamiento + INSERT,
  // acotada siempre por consultorio_id. El índice de exclusión de la 050 es
  // la garantía final ante concurrencia; `23P01` se traduce en el repo.
  const fin = calcularFin(fechaInicio, prestacion.duracionMin);
  return repositorioTurnos.crearTurno({
    consultorioId,
    pacienteId,
    profesionalId,
    sillonBoxId,
    prestacionId,
    inicio: fechaInicio,
    fin,
    duracionMin: prestacion.duracionMin, // duración usada al crearse (RN-AG-07)
  });
}

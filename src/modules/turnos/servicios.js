// Capa de servicios del módulo turnos (DD-13): casos de uso `crearTurno` y
// `reprogramarTurno`. Orquesta las deps de otros módulos SIN tocar sus
// tablas (regla dura 10) y SIN lógica de negocio propia (las reglas viven
// en el dominio). C07 reutiliza la interfaz de C05 en lugar de copiarla
// (CHANGES.md:172).
import { ApiError } from '../../errores.js';
import {
  validarUuid,
  validarInicio,
  calcularFin,
  errorEstadoInvalido,
  validarSolicitadoPor,
  errorTurnoYaCancelado,
  errorTurnoPasado,
  errorEstadoNoCancelable,
} from './dominio.js';
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

/**
 * Reprograma un turno `PENDIENTE` del consultorio autenticado (spec C07:
 * RN-AG-09, RN-AG-10).
 *
 * Orden de errores (design D4): 400 `VALIDACION` defensivo de forma →
 * repositorio: 404 `TURNO_NO_ENCONTRADO` (sin fila por `id + consultorio_id`)
 * → callback BAJO EL LOCK: 409 `ESTADO_INVALIDO` si el estado ya no es
 * `PENDIENTE` → pre-check excluyendo el turno: 409 `SOLAPAMIENTO`.
 * Cualquier fallo hace ROLLBACK y el turno conserva su horario anterior
 * (RN-AG-09).
 *
 * @param {object} parametros
 * @param {string} parametros.turnoId id del turno a mover
 * @param {string} parametros.inicio ISO 8601 con timezone explícita
 * @param {string} parametros.consultorioId SIEMPRE desde el token (regla dura 2)
 * @param {string} parametros.usuarioId usuario del token, dueño de la
 *   auditoría `reprogramado_por` (FK de la 070)
 * @returns {Promise<object>} el turno reprogramado (DTO de la capa de rutas)
 * @throws {ApiError} 400 / 404 / 409 según el spec
 */
export async function reprogramarTurno({ turnoId, inicio, consultorioId, usuarioId }) {
  // 400 — forma defensiva (la ruta ya la validó; precedente C05).
  validarUuid(turnoId, 'id');
  const fechaInicio = validarInicio(inicio);

  return repositorioTurnos.reprogramarTurno(
    { turnoId, consultorioId, inicio: fechaInicio, reprogramadoPor: usuarioId },
    // Callback PURO bajo el lock (design D2): sin I/O, re-ejecutable en el
    // reintento de deadlock. Valida el estado y calcula `fin` con la
    // duración CONGELADA al crearse (RN-AG-07) en intervalos `[)` UTC
    // (RN-AG-06).
    (turnoBloqueado) => {
      if (turnoBloqueado.estado !== 'PENDIENTE') throw errorEstadoInvalido();
      return {
        inicio: fechaInicio,
        fin: calcularFin(fechaInicio, turnoBloqueado.duracionMin),
      };
    }
  );
}

/** Cancela un turno futuro permitido y registra auditoría del token. */
export async function cancelarTurno({
  turnoId,
  consultorioId,
  usuarioId,
  solicitadoPor,
}) {
  validarUuid(turnoId, 'id');
  validarSolicitadoPor(solicitadoPor);
  return repositorioTurnos.cancelarTurno(
    { turnoId, consultorioId, canceladoPor: usuarioId, solicitadoPor },
    (turno, ahora) => {
      if (turno.estado === 'CANCELADO') throw errorTurnoYaCancelado();
      if (!['PENDIENTE', 'CONFIRMADO'].includes(turno.estado)) {
        throw errorEstadoNoCancelable();
      }
      if (new Date(turno.inicio).getTime() <= new Date(ahora).getTime()) {
        throw errorTurnoPasado();
      }
    }
  );
}

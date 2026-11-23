import pg from 'pg';
import { errorSolapamiento, traducirViolacionExclusion } from './dominio.js';

// Acceso persistente a turnos (DD-13: solo SQL parametrizado y sargable,
// sin reglas de negocio). El consultorio NUNCA llega del cliente: el
// servicio lo resuelve del token y lo pasa acá (regla dura 2), y TODA
// operación filtra por él (RN-TEN-01/RN-TEN-02).

function mapearTurno(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    consultorioId: fila.consultorio_id,
    pacienteId: fila.paciente_id,
    profesionalId: fila.profesional_id,
    sillonBoxId: fila.sillon_box_id,
    prestacionId: fila.prestacion_id,
    inicio: fila.inicio,
    fin: fila.fin,
    duracionMin: fila.duracion_min,
    estado: fila.estado,
    creadoEn: fila.creado_en,
  };
}

/**
 * Crea el repositorio de turnos.
 *
 * @param {object} [opciones]
 * @param {import('pg').Client} [opciones.cliente] conexión existente para
 *   inyectar (los tests y futuros consumidores pueden pasar la suya);
 *   si no se pasa, cada operación usa una conexión propia de `DATABASE_URL`.
 * @returns {{ crearTurno: (p: object) => Promise<object> }}
 */
export function crearRepositorioTurnos({ cliente } = {}) {
  const clienteExterno = Boolean(cliente);

  async function conCliente(operacion) {
    const conexion = cliente ?? new pg.Client({ connectionString: process.env.DATABASE_URL });
    if (!clienteExterno) await conexion.connect();
    try {
      return await operacion(conexion);
    } finally {
      if (!clienteExterno) await conexion.end().catch(() => {});
    }
  }

  return {
    /**
     * Da de alta un turno dentro de una ÚNICA transacción (design D1):
     * 1. pre-check SELECT de solapamiento por recurso → mensaje detallado
     *    por el recurso en conflicto (409 `SOLAPAMIENTO`);
     * 2. INSERT parametrizado → la garantía FINAL es el índice de
     *    exclusión de la 050: ante una carrera real, `23P01` se traduce a
     *    409 `SOLAPAMIENTO` con `traducirViolacionExclusion`.
     *
     * Ambos pasos corren sobre la misma transacción: si algo falla se
     * hace ROLLBACK y no queda ningún registro a medias.
     *
     * @param {object} p
     * @param {string} p.consultorioId consultorio (siempre desde el token)
     * @param {string} p.pacienteId
     * @param {string} p.profesionalId
     * @param {string} p.sillonBoxId
     * @param {string} p.prestacionId
     * @param {Date | string} p.inicio instante de inicio (con timezone)
     * @param {Date | string} p.fin instante final calculado por el dominio
     * @param {number} p.duracionMin duración fijada al crearse (RN-AG-07)
     * @returns {Promise<object>} el turno creado (DTO de la fila)
     * @throws {ApiError} 409 SOLAPAMIENTO si el pre-check o el índice detectan solape
     */
    async crearTurno({
      consultorioId,
      pacienteId,
      profesionalId,
      sillonBoxId,
      prestacionId,
      inicio,
      fin,
      duracionMin,
    }) {
      return conCliente(async (conexion) => {
        // Reintento de la transacción COMPLETA (BEGIN → pre-check → INSERT →
        // COMMIT) ante deadlock 40P01 entre inserciones concurrentes (S6):
        // tras el ROLLBACK, y confirmarse el ganador, el pre-check del
        // segundo intento lo ve y responde 409 con mensaje detallado.
        // Límite: 2 intentos; si el segundo también da 40P01, el traductor
        // lo convierte en 409 (nunca 500 por esta causa).
        for (let intento = 1; intento <= 2; intento++) {
          try {
            await conexion.query('BEGIN');
            // Pre-check (design D1): mensajes detallados por recurso. Cada
            // EXISTS lleva `consultorio_id = $1` (acotado al tenant) y el
            // solape `[)` sargable `inicio < finNuevo AND fin > inicioNuevo`,
            // que usa los índices (consultorio_id, recurso, inicio).
            const precheck = await conexion.query(
              `SELECT
                 EXISTS (
                   SELECT 1 FROM turno
                   WHERE consultorio_id = $1 AND profesional_id = $2
                     AND estado <> 'CANCELADO'
                     AND inicio < $4 AND fin > $3
                 ) AS profesional,
                 EXISTS (
                   SELECT 1 FROM turno
                   WHERE consultorio_id = $1 AND sillon_box_id = $5
                     AND estado <> 'CANCELADO'
                     AND inicio < $4 AND fin > $3
                 ) AS sillon_box,
                 EXISTS (
                   SELECT 1 FROM turno
                   WHERE consultorio_id = $1 AND paciente_id = $6
                     AND estado <> 'CANCELADO'
                     AND inicio < $4 AND fin > $3
                 ) AS paciente`,
              [consultorioId, profesionalId, inicio, fin, sillonBoxId, pacienteId]
            );

            const conflicto = precheck.rows[0];
            if (conflicto.profesional) throw errorSolapamiento('profesional');
            if (conflicto.sillon_box) throw errorSolapamiento('sillonBox');
            if (conflicto.paciente) throw errorSolapamiento('paciente');

            const resultado = await conexion.query(
              `INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_box_id,
                                  prestacion_id, inicio, fin, duracion_min)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING id, consultorio_id, paciente_id, profesional_id, sillon_box_id,
                         prestacion_id, inicio, fin, duracion_min, estado, creado_en`,
              [
                consultorioId,
                pacienteId,
                profesionalId,
                sillonBoxId,
                prestacionId,
                inicio,
                fin,
                duracionMin,
              ]
            );
            await conexion.query('COMMIT');
            return mapearTurno(resultado.rows[0]);
          } catch (error) {
            await conexion.query('ROLLBACK').catch(() => {});
            // 40P01 con intentos disponibles → reintentar la transacción
            // entera (el pre-check del reintento ve al ganador).
            if (error?.code === '40P01' && intento < 2) continue;
            // 23P01 (índice de exclusión) y 40P01 (fallback del último
            // intento) → 409; los ApiError del pre-check pasan tal cual.
            throw traducirViolacionExclusion(error);
          }
        }
      });
    },
  };
}

import pg from 'pg';
import {
  errorSolapamiento,
  errorTurnoNoEncontrado,
  traducirViolacionExclusion,
} from './dominio.js';

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
    // Auditoría de la 070 (C07 task 4.3): NULL hasta la primera
    // reprogramación; `?? null` cubre los SELECTs que no las traen.
    reprogramadoEn: fila.reprogramado_en ?? null,
    reprogramadoPor: fila.reprogramado_por ?? null,
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

  /**
   * Pre-check de solapamiento DENTRO de la transacción del llamador:
   * UNA sola copia del SQL, compartida por `crearTurno` (sin exclusión) y
   * `reprogramarTurno` (excluyendo el turno que se mueve — design D1,
   * `CHANGES.md:172`: reutilizar, nunca copiar).
   *
   * Predicado `[)` sargable `inicio < $4 AND fin > $3` sobre los tres
   * recursos, acotado SIEMPRE al consultorio y ignorando `CANCELADO`
   * (WHERE parcial de la 050). Con `excluirTurnoId` agrega `AND id <> $7`
   * (fragmento constante; el id viaja como parámetro — nunca se
   * concatenan valores en el SQL, regla del proyecto).
   *
   * @param {import('pg').Client} conexion conexión de la transacción abierta
   * @param {object} p
   * @param {string} p.consultorioId
   * @param {string} p.profesionalId
   * @param {string} p.sillonBoxId
   * @param {string} p.pacienteId
   * @param {Date | string} p.inicio
   * @param {Date | string} p.fin
   * @param {string} [p.excluirTurnoId] turno a EXCLUIR del solape (reprogramación)
   * @throws {ApiError} 409 SOLAPAMIENTO con mensaje detallado por recurso
   */
  async function precheckSolapamiento(conexion, {
    consultorioId,
    profesionalId,
    sillonBoxId,
    pacienteId,
    inicio,
    fin,
    excluirTurnoId,
  }) {
    const excluye = excluirTurnoId ? ' AND id <> $7' : '';
    const parametros = [consultorioId, profesionalId, inicio, fin, sillonBoxId, pacienteId];
    if (excluirTurnoId) parametros.push(excluirTurnoId);

    const precheck = await conexion.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM turno
           WHERE consultorio_id = $1 AND profesional_id = $2
             AND estado <> 'CANCELADO'${excluye}
             AND inicio < $4 AND fin > $3
         ) AS profesional,
         EXISTS (
           SELECT 1 FROM turno
           WHERE consultorio_id = $1 AND sillon_box_id = $5
             AND estado <> 'CANCELADO'${excluye}
             AND inicio < $4 AND fin > $3
         ) AS sillon_box,
         EXISTS (
           SELECT 1 FROM turno
           WHERE consultorio_id = $1 AND paciente_id = $6
             AND estado <> 'CANCELADO'${excluye}
             AND inicio < $4 AND fin > $3
         ) AS paciente`,
      parametros
    );

    const conflicto = precheck.rows[0];
    if (conflicto.profesional) throw errorSolapamiento('profesional');
    if (conflicto.sillon_box) throw errorSolapamiento('sillonBox');
    if (conflicto.paciente) throw errorSolapamiento('paciente');
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
            await precheckSolapamiento(conexion, {
              consultorioId,
              profesionalId,
              sillonBoxId,
              pacienteId,
              inicio,
              fin,
            });

            const resultado = await conexion.query(
              `INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_box_id,
                                  prestacion_id, inicio, fin, duracion_min)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               RETURNING id, consultorio_id, paciente_id, profesional_id, sillon_box_id,
                         prestacion_id, inicio, fin, duracion_min, estado, creado_en,
                         reprogramado_en, reprogramado_por`,
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

    /**
     * Reprograma un turno dentro de una ÚNICA transacción (design D2):
     * 1. `BEGIN` con reintento COMPLETO máx. 2 ante `40P01` (mismo patrón
     *    que `crearTurno`);
     * 2. `SELECT … FOR UPDATE` por `id + consultorio_id` → sin fila →
     *    ROLLBACK + 404 `TURNO_NO_ENCONTRADO` (el `consultorio_id` en el
     *    `WHERE` da el aislamiento RN-TEN-01/RN-TEN-02);
     * 3. callback del servicio BAJO EL LOCK (`bajoBloqueo`): puro y
     *    re-ejecutable en el reintento; si lanza ApiError → ROLLBACK y se
     *    propaga (409 `ESTADO_INVALIDO`, 400, etc.);
     * 4. pre-check de solapamiento con `excluirTurnoId = turnoId` por
     *    paciente/profesional/sillón-box → 409 `SOLAPAMIENTO`;
     * 5. `UPDATE` de `inicio`/`fin` + auditoría (`reprogramado_en =
     *    now()`, `reprogramado_por` del token) → `COMMIT`.
     *
     * Cualquier fallo hace ROLLBACK: el turno CONSERVA su horario anterior
     * (RN-AG-09). `23P01`/`40P01` del último intento → 409 vía
     * `traducirViolacionExclusion` (nunca 500).
     *
     * @param {object} p
     * @param {string} p.turnoId turno a mover (id + consultorio_id)
     * @param {string} p.consultorioId siempre desde el token (regla dura 2)
     * @param {Date | string} p.inicio nuevo inicio solicitado (con timezone)
     * @param {string} p.reprogramadoPor usuario del token (FK a `usuario`)
     * @param {(turno: object, inicio: Date | string) => Promise<{inicio: Date, fin: Date}>} bajoBloqueo
     *   callback puro del servicio: valida estado y calcula `fin` con la
     *   duración congelada (D3), todo bajo el lock
     * @returns {Promise<object>} el turno reprogramado (DTO de la fila)
     * @throws {ApiError} 404 / 409 según el spec
     */
    async reprogramarTurno({ turnoId, consultorioId, inicio, reprogramadoPor }, bajoBloqueo) {
      return conCliente(async (conexion) => {
        for (let intento = 1; intento <= 2; intento++) {
          try {
            await conexion.query('BEGIN');

            // SELECT … FOR UPDATE: fila propia del tenant, bloqueada para
            // que el chequeo de estado y el UPDATE sean atómicos (D2).
            const { rows } = await conexion.query(
              `SELECT id, consultorio_id, paciente_id, profesional_id, sillon_box_id,
                      prestacion_id, inicio, fin, duracion_min, estado, creado_en,
                      reprogramado_en, reprogramado_por
               FROM turno
               WHERE id = $1 AND consultorio_id = $2
               FOR UPDATE`,
              [turnoId, consultorioId]
            );
            if (!rows[0]) throw errorTurnoNoEncontrado();

            // Callback bajo el lock: valida estado (RN-AG-10) y devuelve la
            // pareja { inicio, fin } con la duración congelada (RN-AG-07).
            const cambios = await bajoBloqueo(mapearTurno(rows[0]), inicio);
            const inicioNuevo = cambios?.inicio ?? inicio;
            const finNuevo = cambios?.fin;

            // Mismo pre-check que crearTurno, EXCLUYENDO el turno que se
            // mueve (D1: una sola copia del SQL, con `excluirTurnoId`).
            await precheckSolapamiento(conexion, {
              consultorioId,
              profesionalId: rows[0].profesional_id,
              sillonBoxId: rows[0].sillon_box_id,
              pacienteId: rows[0].paciente_id,
              inicio: inicioNuevo,
              fin: finNuevo,
              excluirTurnoId: turnoId,
            });

            const resultado = await conexion.query(
              `UPDATE turno
                  SET inicio = $3,
                      fin = $4,
                      reprogramado_en = now(),
                      reprogramado_por = $5
                WHERE id = $1 AND consultorio_id = $2
                RETURNING id, consultorio_id, paciente_id, profesional_id, sillon_box_id,
                          prestacion_id, inicio, fin, duracion_min, estado, creado_en,
                          reprogramado_en, reprogramado_por`,
              [turnoId, consultorioId, inicioNuevo, finNuevo, reprogramadoPor]
            );
            await conexion.query('COMMIT');
            return mapearTurno(resultado.rows[0]);
          } catch (error) {
            await conexion.query('ROLLBACK').catch(() => {});
            // 40P01 con intentos disponibles → reintentar la transacción
            // entera (el callback es puro: se re-ejecuta sin efectos).
            if (error?.code === '40P01' && intento < 2) continue;
            // 23P01 (índice de exclusión, carrera real) y 40P01 (fallback
            // del último intento) → 409; los ApiError pasan tal cual.
            throw traducirViolacionExclusion(error);
          }
        }
      });
    },
  };
}

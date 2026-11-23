import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { crearToken } from './tokens.js';

// Fixtures FICTICIOS de turnos (task 1.2 de C05; regla dura 1: jamás datos
// reales). Vive SOLO en tests/, nunca en producción.
//
// Patrón idéntico a catalogo-fixtures.js:
// - Cada fixture crea SU consultorio (y sus recursos) con UUIDs distintos por
//   test (crypto.randomUUID), para que la suite corra en paralelo sin pisarse.
// - La limpieza es ordenada por FKs (turno → paciente → prestación →
//   sillón/box → profesional → usuario → consultorio), filtrada por
//   identificador y SIN DELETE globales ni TRUNCATE: cada test limpia lo suyo.
// - `limpiar()` es idempotente y cierra la conexión del fixture.
// - El borrado de `turno` va protegido con to_regclass: antes de que exista la
//   migración 050 la tabla no existe y el helper sigue funcionando; después
//   limpia los turnos creados por el test.

/**
 * Ejecuta `funcion({ fixture, token })` con un fixture propio (consultorio +
 * paciente + profesional + sillón/box + prestación ficticios) y un token
 * ficticio para ese consultorio, y limpia al final. Cada test queda
 * autocontenido (UUIDs distintos por test, regla dura 1).
 *
 * @param {(ctx: {fixture: Awaited<ReturnType<typeof crearFixtureTurnos>>, token: string}) => Promise<any>} funcion
 * @param {object} [opciones]
 * @param {string} [opciones.rol] rol del token ficticio
 *   (default ADMIN_CONSULTORIO; RECEPCION y ADMIN_CONSULTORIO crean turnos).
 * @returns {Promise<any>} el resultado de `funcion`
 */
export async function conFixtureTurnos(funcion, { rol = 'ADMIN_CONSULTORIO' } = {}) {
  const fixture = await crearFixtureTurnos();
  try {
    const token = crearToken({
      usuarioId: randomUUID(),
      consultorioId: fixture.consultorioId,
      rol,
    });
    return await funcion({ fixture, token });
  } finally {
    await fixture.limpiar();
  }
}

/**
 * Crea un consultorio ficticio propio con los recursos que un turno necesita:
 * paciente, profesional, sillón/box y prestación (todos ficticios y activos).
 *
 * @returns {Promise<{
 *   consultorioId: string,
 *   pacienteId: string,
 *   profesionalId: string,
 *   sillonBoxId: string,
 *   prestacionId: string,
 *   consultar: (sql: string, params?: unknown[]) => Promise<import('pg').QueryResult>,
 *   limpiar: () => Promise<void>,
 * }>}
 */
export async function crearFixtureTurnos() {
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();

  const consultorioId = randomUUID();
  const pacienteId = randomUUID();
  const profesionalId = randomUUID();
  const sillonBoxId = randomUUID();
  const prestacionId = randomUUID();
  let cerrado = false;

  try {
    await cliente.query('INSERT INTO consultorio (id) VALUES ($1)', [consultorioId]);

    // Paciente ficticio: nombre con no-espacios + un contacto (CHECK de la 030).
    await cliente.query(
      'INSERT INTO paciente (id, consultorio_id, nombre, telefono) VALUES ($1, $2, $3, $4)',
      [pacienteId, consultorioId, 'Paciente Ficticio C05', '11-5555-0000']
    );

    await cliente.query(
      'INSERT INTO profesional (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
      [profesionalId, consultorioId, 'Profesional Ficticio C05']
    );

    await cliente.query(
      'INSERT INTO sillon_box (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
      [sillonBoxId, consultorioId, 'Box Ficticio C05']
    );

    // Prestación ficticia activa con duración válida (CHECK 1..480 de la 040).
    await cliente.query(
      'INSERT INTO prestacion (id, consultorio_id, nombre, duracion_min) VALUES ($1, $2, $3, $4)',
      [prestacionId, consultorioId, 'Prestacion Ficticia C05', 30]
    );
  } catch (error) {
    // Creación fallida: no dejar conexiones ni filas huérfanas detrás.
    await cliente.end().catch(() => {});
    throw error;
  }

  return {
    consultorioId,
    pacienteId,
    profesionalId,
    sillonBoxId,
    prestacionId,

    /** Consulta arbitraria sobre la conexión del fixture (para armar y verificar). */
    consultar(sql, params = []) {
      return cliente.query(sql, params);
    },

    /**
     * Limpia SOLO lo de este fixture, en orden de FKs, y cierra la conexión.
     * Idempotente: una segunda llamada no hace nada.
     */
    async limpiar() {
      if (cerrado) return;
      try {
        // La tabla `turno` recién existe con la migración 050 (C05).
        const { rows } = await cliente.query("SELECT to_regclass('turno') AS tabla");
        if (rows[0]?.tabla) {
          await cliente.query('DELETE FROM turno WHERE consultorio_id = $1', [consultorioId]);
        }
        await cliente.query('DELETE FROM paciente WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM prestacion WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM sillon_box WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM profesional WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM usuario WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM consultorio WHERE id = $1', [consultorioId]);
      } finally {
        cerrado = true;
        await cliente.end().catch(() => {});
      }
    },
  };
}

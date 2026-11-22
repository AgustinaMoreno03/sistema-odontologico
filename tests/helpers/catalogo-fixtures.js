import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { crearToken } from './tokens.js';

// Fixtures FICTICIOS propios del catálogo (design.md, decisión 10; regla
// dura 1: jamás datos reales). Vive SOLO en tests/, nunca en producción.
//
// - Cada fixture crea SU consultorio (y opcionalmente usuarios) con UUIDs
//   distintos por test (crypto.randomUUID), para que la suite corra en
//   paralelo sin pisarse.
// - La limpieza es ordenada por FKs (profesional/sillon_box → usuario →
//   consultorio), filtrada por identificador y SIN DELETE globales ni
//   TRUNCATE: cada test limpia solo lo suyo.
// - `limpiar()` es idempotente y cierra la conexión del fixture.

/**
 * Ejecuta `funcion({ fixture, token })` con un fixture propio y un token
 * ficticio de ADMIN_CONSULTORIO para ese consultorio, y limpia al final.
 * Cada test queda autocontenido (UUIDs distintos por test, regla dura 1).
 */
export async function conFixtureConAdmin(funcion) {
  const fixture = await crearFixture();
  try {
    const token = crearToken({
      usuarioId: randomUUID(),
      consultorioId: fixture.consultorioId,
      rol: 'ADMIN_CONSULTORIO',
    });
    return await funcion({ fixture, token });
  } finally {
    await fixture.limpiar();
  }
}

/**
 * Crea un consultorio ficticio propio y opcionalmente usuarios ficticios.
 *
 * @param {object} [opciones]
 * @param {string[]} [opciones.usuarios] roles de los usuarios a crear
 *   (p. ej. ['ODONTOLOGO', 'ADMIN_CONSULTORIO']); cada usuario nace en ESTE
 *   consultorio (DD-17: solo los tres roles del conjunto cerrado).
 * @returns {Promise<{
 *   consultorioId: string,
 *   usuarios: Array<{id: string, rol: string}>,
 *   consultar: (sql: string, params?: unknown[]) => Promise<import('pg').QueryResult>,
 *   limpiar: () => Promise<void>,
 * }>}
 */
export async function crearFixture({ usuarios: roles = [] } = {}) {
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();

  const consultorioId = randomUUID();
  const usuarios = [];
  let cerrado = false;

  try {
    await cliente.query('INSERT INTO consultorio (id) VALUES ($1)', [consultorioId]);
    for (const rol of roles) {
      const id = randomUUID();
      await cliente.query(
        'INSERT INTO usuario (id, consultorio_id, rol) VALUES ($1, $2, $3)',
        [id, consultorioId, rol]
      );
      usuarios.push({ id, rol });
    }
  } catch (error) {
    // Creación fallida: no dejar conexiones ni filas huérfanas detrás.
    await cliente.end().catch(() => {});
    throw error;
  }

  return {
    consultorioId,
    usuarios,

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
        await cliente.query('DELETE FROM profesional WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM sillon_box WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM usuario WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM consultorio WHERE id = $1', [consultorioId]);
      } finally {
        cerrado = true;
        await cliente.end().catch(() => {});
      }
    },
  };
}

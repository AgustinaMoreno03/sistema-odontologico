import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * C02 — unicidad RN-TEN-03 garantizada por PostgreSQL (design.md, decisión 3).
 *
 * Estos inserts van por SQL CRUDO a propósito (sin pasar por la aplicación):
 * verifican que la garantía vive en los índices únicos de expresión
 * (`clave_unicidad`) y no en un pre-check de la app. La violación de la
 * restricción debe ser `23505` (unique_violation) y colapsar el statement
 * completo (sin escritura parcial).
 *
 * Fixtures ficticios propios (regla dura 1): consultorios A y B con UUIDs
 * aleatorios; la limpieza es filtrada por identificador y sin DELETE globales.
 */

const ID_A = randomUUID();
const ID_B = randomUUID();

let cliente;

beforeAll(async () => {
  cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();
  await cliente.query('INSERT INTO consultorio (id) VALUES ($1), ($2)', [ID_A, ID_B]);
});

afterAll(async () => {
  // Orden de limpieza por FKs: primero las tablas derivadas, luego el tenant.
  await cliente.query('DELETE FROM profesional WHERE consultorio_id = $1 OR consultorio_id = $2', [
    ID_A,
    ID_B,
  ]);
  await cliente.query('DELETE FROM consultorio WHERE id = $1 OR id = $2', [ID_A, ID_B]);
  await cliente.end().catch(() => {});
});

const insertarProfesional = ({ consultorioId, nombre, email = null }) =>
  cliente.query(
    'INSERT INTO profesional (consultorio_id, nombre, email) VALUES ($1, $2, $3)',
    [consultorioId, nombre, email]
  );

describe('RN-TEN-03 a nivel de base: la unicidad la garantiza el índice', () => {
  it('"dr. juan perez" tras "Dr. Juan Pérez" en el mismo consultorio viola la restricción (23505)', async () => {
    await insertarProfesional({ consultorioId: ID_A, nombre: 'Dr. Juan Pérez' });

    // Misma clave normalizada: caja, espacios y tildes plegados (clave_unicidad).
    await expect(
      insertarProfesional({ consultorioId: ID_A, nombre: 'dr. juan perez' })
    ).rejects.toMatchObject({ code: '23505' });

    // El primer registro queda y el segundo NO se crea (sin escritura parcial).
    const { rows } = await cliente.query(
      'SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1',
      [ID_A]
    );
    expect(rows[0].total).toBe(1);
  });

  it('" JUAN@EXAMPLE.COM " tras juan@example.com en el mismo consultorio viola la restricción (23505)', async () => {
    await insertarProfesional({
      consultorioId: ID_A,
      nombre: 'Dra. Ana Ruiz',
      email: 'juan@example.com',
    });

    await expect(
      insertarProfesional({
        consultorioId: ID_A,
        nombre: 'Dra. Zoe Díaz',
        email: ' JUAN@EXAMPLE.COM ',
      })
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('dos profesionales sin email en el mismo consultorio se insertan sin error (el email nulo no participa)', async () => {
    await insertarProfesional({ consultorioId: ID_B, nombre: 'Dra. Luisa Vega' });
    await insertarProfesional({ consultorioId: ID_B, nombre: 'Dr. Marco Soto' });

    const { rows } = await cliente.query(
      'SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1 AND email IS NULL',
      [ID_B]
    );
    expect(rows[0].total).toBe(2);
  });

  it('el mismo nombre y email en otro consultorio se inserta sin error (la unicidad es por tenant)', async () => {
    await insertarProfesional({
      consultorioId: ID_B,
      nombre: 'Dr. Juan Pérez',
      email: 'juan@example.com',
    });

    const { rows } = await cliente.query(
      'SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1',
      [ID_B]
    );
    expect(rows[0].total).toBe(3);
  });
});

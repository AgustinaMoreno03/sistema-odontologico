import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { obtenerUrlBaseTest } from './setup/urls.js';

/**
 * Spec development-environment — "Suite en verde contra la base real",
 * "Base de test inaccesible" (setup) y "Repetible, aislada y con datos
 * ficticios": la suite corre contra PostgreSQL REAL (sin mock de SQL) en
 * una base de test separada de la de desarrollo, con el esquema aplicado
 * desde cero por el global setup.
 *
 * Tolera migraciones de otros changes (C01–C08): solo exige que la 001
 * esté aplicada y sea la primera, y limpia únicamente su propio fixture.
 */
const ID_CONSULTORIO_FIXTURE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

describe('base de test: aislamiento y esquema migrado desde cero', () => {
  it('la suite apunta a la base de test, nunca a la base de desarrollo', () => {
    expect(new URL(process.env.DATABASE_URL).pathname).toBe('/odontologia_test');
    expect(process.env.DATABASE_URL).toBe(obtenerUrlBaseTest());
  });

  it('la base de test tiene las tablas del 001 y su migración registrada una sola vez, como la primera', async () => {
    const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    try {
      const tablas = await cliente.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('consultorio', 'usuario')"
      );
      expect(tablas.rows.map((fila) => fila.table_name).sort()).toEqual(['consultorio', 'usuario']);

      const historial = await cliente.query('SELECT name FROM pgmigrations ORDER BY name');
      const nombres = historial.rows.map((fila) => fila.name);
      expect(nombres[0]).toBe('001_esquema_inicial');
      expect(new Set(nombres).size).toBe(nombres.length); // sin duplicados
    } finally {
      await cliente.end();
    }
  });

  it('el CHECK de roles rechaza PACIENTE en la base real (fixture ficticio, con limpieza propia)', async () => {
    const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    try {
      // Fixture ficticio propio (regla dura 1); este test limpia solo lo suyo.
      const consultorio = await cliente.query(
        'INSERT INTO consultorio (id) VALUES ($1) RETURNING id',
        [ID_CONSULTORIO_FIXTURE]
      );
      expect(consultorio.rows).toHaveLength(1);

      await expect(
        cliente.query("INSERT INTO usuario (consultorio_id, rol) VALUES ($1, 'PACIENTE')", [
          ID_CONSULTORIO_FIXTURE,
        ])
      ).rejects.toMatchObject({ code: '23514' }); // check_violation

      const insertado = await cliente.query(
        'SELECT count(*)::int AS total FROM usuario WHERE consultorio_id = $1',
        [ID_CONSULTORIO_FIXTURE]
      );
      expect(insertado.rows[0].total).toBe(0);
    } finally {
      await cliente.query('DELETE FROM usuario WHERE consultorio_id = $1', [ID_CONSULTORIO_FIXTURE]);
      await cliente.query('DELETE FROM consultorio WHERE id = $1', [ID_CONSULTORIO_FIXTURE]);
      await cliente.end();
    }
  });
});
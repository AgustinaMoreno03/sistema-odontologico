import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { obtenerUrlBaseTest } from './setup/urls.js';

/**
 * Spec development-environment — "Suite en verde contra la base real",
 * "Base de test inaccesible" (setup) y "Repetible, aislada y con datos
 * ficticios": la suite corre contra PostgreSQL REAL (sin mock de SQL) en
 * una base de test separada de la de desarrollo, con el esquema aplicado
 * desde cero por el global setup.
 */
describe('base de test: aislamiento y esquema migrado desde cero', () => {
  it('la suite apunta a la base de test, nunca a la base de desarrollo', () => {
    expect(new URL(process.env.DATABASE_URL).pathname).toBe('/odontologia_test');
    expect(process.env.DATABASE_URL).toBe(obtenerUrlBaseTest());
  });

  it('la base de test tiene las tablas del 001 y exactamente un registro de historial', async () => {
    const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    try {
      const tablas = await cliente.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('consultorio', 'usuario')"
      );
      expect(tablas.rows.map((fila) => fila.table_name).sort()).toEqual(['consultorio', 'usuario']);

      const historial = await cliente.query('SELECT name FROM pgmigrations ORDER BY run_on, id');
      expect(historial.rows.map((fila) => fila.name)).toContain('001_esquema_inicial');
    } finally {
      await cliente.end();
    }
  });

  it('el CHECK de roles rechaza PACIENTE en la base real (fixture ficticio, con limpieza propia)', async () => {
    const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    try {
      // Fixture ficticio propio (regla dura 1); este test limpia lo suyo.
      const consultorio = await cliente.query(
        "INSERT INTO consultorio (id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') RETURNING id"
      );
      expect(consultorio.rows).toHaveLength(1);

      await expect(
        cliente.query(
          "INSERT INTO usuario (consultorio_id, rol) VALUES ($1, 'PACIENTE')",
          [consultorio.rows[0].id]
        )
      ).rejects.toMatchObject({ code: '23514' }); // check_violation

      const insertado = await cliente.query('SELECT count(*)::int AS total FROM usuario');
      expect(insertado.rows[0].total).toBe(0);
    } finally {
      await cliente.query('DELETE FROM usuario');
      await cliente.query('DELETE FROM consultorio');
      await cliente.end();
    }
  });
});

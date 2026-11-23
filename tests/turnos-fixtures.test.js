import { describe, expect, it } from 'vitest';
import pg from 'pg';
import { conFixtureTurnos } from './helpers/turnos-fixtures.js';

/**
 * Smoke test de la task 1.2 (C05): el helper de fixtures de turnos crea un
 * consultorio propio con TODOS los recursos que un turno necesita (paciente,
 * profesional, sillón/box y prestación), todo ficticio (regla dura 1), y al
 * salir limpia SOLO lo suyo en orden de FK, sin DELETE globales.
 * Patrón: tests/helpers/catalogo-fixtures.js.
 */
describe('helper de fixtures de turnos', () => {
  it('crea los recursos ficticios del turno y al salir no queda nada huérfano', async () => {
    const fixture = await conFixtureTurnos(async ({ fixture, token }) => {
      // Token ficticio del rol con permiso de crear turnos.
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      // Los cinco registros existen y pertenecen AL consultorio del fixture.
      const recursos = [
        ['paciente', fixture.pacienteId],
        ['profesional', fixture.profesionalId],
        ['sillon_box', fixture.sillonBoxId],
        ['prestacion', fixture.prestacionId],
      ];
      for (const [tabla, id] of recursos) {
        const { rows } = await fixture.consultar(
          `SELECT 1 FROM ${tabla} WHERE id = $1 AND consultorio_id = $2`,
          [id, fixture.consultorioId]
        );
        expect(rows, `fila de ${tabla}`).toHaveLength(1);
      }

      return fixture;
    });

    // limpiar() ya corrió: el consultorio DE ESTE fixture ya no existe.
    const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    try {
      const { rows } = await cliente.query('SELECT 1 FROM consultorio WHERE id = $1', [
        fixture.consultorioId,
      ]);
      expect(rows, 'consultorio tras limpiar').toHaveLength(0);
    } finally {
      await cliente.end().catch(() => {});
    }
  });
});

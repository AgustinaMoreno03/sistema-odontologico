import { describe, expect, it } from 'vitest';
import { crearFixture } from './helpers/catalogo-fixtures.js';

/**
 * C02 — test de humo de `tests/helpers/catalogo-fixtures.js` (design.md,
 * decisión 10): cada fixture crea sus propios consultorios y usuarios
 * FICTICIOS (regla dura 1) con UUIDs distintos, y limpia solo lo suyo en el
 * orden que exige la FK de `usuario_id` (profesional/sillon_box → usuario →
 * consultorio), con DELETE filtrados por identificador y sin DELETE globales.
 *
 * La verificación cruzada usa el cliente del fixture "vecino" para no
 * depender de la conexión ya cerrada del fixture limpiado.
 */
describe('fixtures del catálogo', () => {
  it('crea y limpia sus fixtures sin tocar datos de otros consultorios', async () => {
    const a = await crearFixture({ usuarios: ['ODONTOLOGO'] });
    const b = await crearFixture({ usuarios: ['ODONTOLOGO'] });
    try {
      await a.consultar('INSERT INTO profesional (consultorio_id, nombre) VALUES ($1, $2)', [
        a.consultorioId,
        'Dra. Alicia Fina',
      ]);
      await a.consultar('INSERT INTO sillon_box (consultorio_id, nombre) VALUES ($1, $2)', [
        a.consultorioId,
        'Sillón A',
      ]);
      await b.consultar('INSERT INTO profesional (consultorio_id, nombre) VALUES ($1, $2)', [
        b.consultorioId,
        'Dr. Bernardo Bajo',
      ]);
      await b.consultar('INSERT INTO sillon_box (consultorio_id, nombre) VALUES ($1, $2)', [
        b.consultorioId,
        'Sillón B',
      ]);

      await a.limpiar();

      const enA = await b.consultar(
        `SELECT
           (SELECT count(*)::int FROM profesional WHERE consultorio_id = $1) AS profesionales,
           (SELECT count(*)::int FROM sillon_box WHERE consultorio_id = $1) AS sillon_boxes,
           (SELECT count(*)::int FROM usuario WHERE consultorio_id = $1) AS usuarios,
           (SELECT count(*)::int FROM consultorio WHERE id = $1) AS consultorios`,
        [a.consultorioId]
      );
      expect(enA.rows[0]).toEqual({ profesionales: 0, sillon_boxes: 0, usuarios: 0, consultorios: 0 });

      const enB = await b.consultar(
        `SELECT
           (SELECT count(*)::int FROM profesional WHERE consultorio_id = $1) AS profesionales,
           (SELECT count(*)::int FROM sillon_box WHERE consultorio_id = $1) AS sillon_boxes,
           (SELECT count(*)::int FROM usuario WHERE consultorio_id = $1) AS usuarios,
           (SELECT count(*)::int FROM consultorio WHERE id = $1) AS consultorios`,
        [b.consultorioId]
      );
      expect(enB.rows[0]).toEqual({ profesionales: 1, sillon_boxes: 1, usuarios: 1, consultorios: 1 });
    } finally {
      await a.limpiar();
      await b.limpiar();
    }
  });

  it('limpia en orden profesional/sillon_box → usuario → consultorio sin violar las FKs', async () => {
    const a = await crearFixture({ usuarios: ['ODONTOLOGO'] });
    const b = await crearFixture();
    try {
      // Profesional VINCULADO al usuario del fixture: limpiar fuera de orden
      // violaría la FK usuario_id; el orden correcto no debe fallar.
      await a.consultar(
        'INSERT INTO profesional (consultorio_id, nombre, usuario_id) VALUES ($1, $2, $3)',
        [a.consultorioId, 'Dra. Carmen Duarte', a.usuarios[0].id]
      );
      await a.consultar('INSERT INTO sillon_box (consultorio_id, nombre) VALUES ($1, $2)', [
        a.consultorioId,
        'Sillón C',
      ]);

      await expect(a.limpiar()).resolves.not.toThrow();

      const restos = await b.consultar(
        `SELECT
           (SELECT count(*)::int FROM profesional WHERE consultorio_id = $1) AS profesionales,
           (SELECT count(*)::int FROM sillon_box WHERE consultorio_id = $1) AS sillon_boxes,
           (SELECT count(*)::int FROM usuario WHERE consultorio_id = $1) AS usuarios,
           (SELECT count(*)::int FROM consultorio WHERE id = $1) AS consultorios`,
        [a.consultorioId]
      );
      expect(restos.rows[0]).toEqual({ profesionales: 0, sillon_boxes: 0, usuarios: 0, consultorios: 0 });
    } finally {
      await a.limpiar();
      await b.limpiar();
    }
  });
});

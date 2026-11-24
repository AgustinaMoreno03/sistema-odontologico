import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { crearToken } from './helpers/tokens.js';
import { conFixtureTurnos } from './helpers/turnos-fixtures.js';

const rango = { desde: '2026-12-01T00:00:00-03:00', hasta: '2026-12-02T00:00:00-03:00' };
const consultar = (token, extra = {}) => request(crearApp()).get('/api/agenda')
  .query({ ...rango, ...extra }).set('Authorization', `Bearer ${token}`);

async function crearCancelados(fixture, ids) {
  // Mismo inicio y recursos para forzar desempate por id. CANCELADO permite
  // coincidir sin violar las exclusiones; son registros ficticios de lectura.
  await fixture.consultar(
    `INSERT INTO turno
       (id, consultorio_id, paciente_id, profesional_id, sillon_box_id, prestacion_id,
        inicio, fin, duracion_min, estado)
     SELECT x.id, $2, $3, $4, $5, $6,
            '2026-12-01T13:00:00Z'::timestamptz, '2026-12-01T13:30:00Z'::timestamptz,
            30, 'CANCELADO'
       FROM unnest($1::uuid[]) AS x(id)`,
    [ids, fixture.consultorioId, fixture.pacienteId, fixture.profesionalId, fixture.sillonBoxId, fixture.prestacionId]
  );
}

describe('C08 tanda 3: paginación', () => {
  it('recorre páginas con orden estable, sin duplicados y con metadata exacta', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const ids = [
        'cccccccc-0000-4000-8000-000000000003',
        'aaaaaaaa-0000-4000-8000-000000000001',
        'bbbbbbbb-0000-4000-8000-000000000002',
      ];
      await crearCancelados(fixture, ids);
      const pagina1 = await consultar(token, { limite: '2' });
      expect(pagina1.status).toBe(200);
      expect(pagina1.body.turnos.map(({ id }) => id)).toEqual([ids[1], ids[2]]);
      expect(pagina1.body.hayMas).toBe(true);
      expect(pagina1.body.siguienteOffset).toBe(2);
      const pagina2 = await consultar(token, { limite: '2', offset: String(pagina1.body.siguienteOffset) });
      expect(pagina2.status).toBe(200);
      expect(pagina2.body.turnos.map(({ id }) => id)).toEqual([ids[0]]);
      expect(pagina2.body.hayMas).toBe(false);
      expect(pagina2.body.siguienteOffset).toBeNull();
      const vacia = await consultar(token, { offset: '10000' });
      expect(vacia.status).toBe(200);
      expect(vacia.body.turnos).toEqual([]);
      expect(vacia.body.hayMas).toBe(false);
      expect(vacia.body.siguienteOffset).toBeNull();
    });
  });

  it('usa 100 por defecto y permite máximo 200 sin perder la fila adicional', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const ids = Array.from({ length: 201 }, () => randomUUID());
      await crearCancelados(fixture, ids);
      const defecto = await consultar(token);
      expect(defecto.status).toBe(200);
      expect(defecto.body.turnos).toHaveLength(100);
      expect(defecto.body.siguienteOffset).toBe(100);
      const maxima = await consultar(token, { limite: '200' });
      expect(maxima.status).toBe(200);
      expect(maxima.body.turnos.map(({ id }) => id)).toEqual([...ids].sort().slice(0, 200));
      expect(maxima.body.hayMas).toBe(true);
      expect(maxima.body.siguienteOffset).toBe(200);
      const ultima = await consultar(token, { limite: '200', offset: '200' });
      expect(ultima.status).toBe(200);
      expect(ultima.body.turnos.map(({ id }) => id)).toEqual([...ids].sort().slice(200));
      expect(ultima.body.siguienteOffset).toBeNull();
    });
  });

  it.each([
    { limite: '0' }, { limite: '201' }, { limite: '1.5' }, { limite: 'texto' },
    { offset: '-1' }, { offset: '0.5' }, { offset: '10001' },
    { limite: ['1', '2'] }, { offset: ['0', '1'] },
  ])('rechaza paginación inválida %j', async (query) => {
    const res = await consultar(crearToken(), query);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });
});

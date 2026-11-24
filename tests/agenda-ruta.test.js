import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { crearToken } from './helpers/tokens.js';
import { conFixtureTurnos, crearTurnoPartida } from './helpers/turnos-fixtures.js';

const rango = { desde: '2026-12-01T00:00:00-03:00', hasta: '2026-12-02T00:00:00-03:00' };
const consultar = (query, token = crearToken()) => request(crearApp())
  .get('/api/agenda').query(query).set('Authorization', `Bearer ${token}`);

describe('C08 tanda 1: ruta y parámetros', () => {
  it('devuelve el contrato vacío y los límites UTC', async () => {
    await conFixtureTurnos(async ({ token }) => {
      const res = await consultar(rango, token);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        desde: '2026-12-01T03:00:00.000Z', hasta: '2026-12-02T03:00:00.000Z',
        zonaHoraria: 'America/Argentina/Buenos_Aires', turnos: [], hayMas: false, siguienteOffset: null,
      });
    });
  });

  it.each([
    ['sin hasta', { desde: rango.desde }],
    ['sin desde', { hasta: rango.hasta }],
    ['sin zona', { ...rango, desde: '2026-12-01T00:00:00' }],
    ['día imposible', { ...rango, desde: '2026-02-30T00:00:00Z' }],
    ['mes imposible', { ...rango, desde: '2026-13-01T00:00:00Z' }],
    ['hora imposible', { ...rango, desde: '2026-12-01T24:00:00Z' }],
    ['rango vacío', { desde: rango.desde, hasta: rango.desde }],
    ['rango invertido', { desde: rango.hasta, hasta: rango.desde }],
    ['más de 168 horas', { ...rango, hasta: '2026-12-09T00:00:00-03:00' }],
    ['UUID inválido', { ...rango, profesionalId: 'otro' }],
    ['parámetro ajeno', { ...rango, consultorioId: 'no-se-acepta' }],
    ['fecha repetida', { ...rango, desde: [rango.desde, rango.desde] }],
    ['fecha estructurada', { ...rango, desde: { fecha: rango.desde } }],
  ])('rechaza %s', async (_caso, query) => {
    const res = await consultar(query);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });

  it.each([
    ['ausente', null], ['expirado', crearToken({ expirado: true })],
    ['forjado', crearToken({ secreto: 'secreto-ficticio-no-valido-para-la-suite' })],
  ])('rechaza token %s con el error uniforme', async (_caso, token) => {
    let peticion = request(crearApp()).get('/api/agenda').query(rango);
    if (token) peticion = peticion.set('Authorization', `Bearer ${token}`);
    const res = await peticion;
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' } });
  });

  it('aplica intersección [) y conserva turno cruzando medianoche', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const cruza = await crearTurnoPartida(fixture, {
        inicio: '2026-12-01T02:30:00Z', fin: '2026-12-01T03:30:00Z', duracionMin: 60,
      });
      await crearTurnoPartida(fixture, {
        inicio: '2026-12-01T02:30:00Z', fin: '2026-12-01T03:00:00Z', crearRecursos: true,
      });
      await crearTurnoPartida(fixture, { inicio: '2026-12-02T03:00:00Z' });
      const res = await consultar(rango, token);
      expect(res.status).toBe(200);
      expect(res.body.turnos.map(({ id }) => id)).toEqual([cruza.id]);
    });
  });

  it('acepta la semana y omite el turno del lunes siguiente', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const dentro = await crearTurnoPartida(fixture, { inicio: '2026-12-01T13:00:00Z' });
      await crearTurnoPartida(fixture, { inicio: '2026-12-07T03:00:00Z' });
      const res = await consultar({ desde: '2026-11-30T00:00:00-03:00', hasta: '2026-12-07T00:00:00-03:00' }, token);
      expect(res.status).toBe(200);
      expect(res.body.turnos.map(({ id }) => id)).toEqual([dentro.id]);
    });
  });

  it('incluye cancelados y muestra el nuevo horario tras reprogramar', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const cancelado = await crearTurnoPartida(fixture, { estado: 'CANCELADO', inicio: '2026-12-01T13:00:00Z' });
      const movido = await crearTurnoPartida(fixture, { inicio: '2026-12-01T14:00:00Z' });
      const cambio = await request(crearApp()).patch(`/api/turnos/${movido.id}/reprogramar`)
        .set('Authorization', `Bearer ${token}`).send({ inicio: '2026-12-01T15:00:00Z' });
      expect(cambio.status).toBe(200);
      const res = await consultar(rango, token);
      expect(res.status).toBe(200);
      expect(res.body.turnos).toEqual([
        expect.objectContaining({ id: cancelado.id, estado: 'CANCELADO' }),
        expect.objectContaining({ id: movido.id, inicio: '2026-12-01T15:00:00.000Z' }),
      ]);
      expect(res.body.turnos[0]).not.toHaveProperty('consultorioId');
      expect(res.body.turnos[0]).not.toHaveProperty('telefono');
    });
  });
});

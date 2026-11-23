import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { manejadorErrores } from '../src/errores.js';
import { crearRouterTurnos } from '../src/modules/turnos/rutas.js';
import { conFixtureTurnos, crearTurnoPartida } from './helpers/turnos-fixtures.js';

function appDeTurnos() {
  const app = express();
  app.use(express.json());
  app.use('/api/turnos', crearRouterTurnos());
  app.use(manejadorErrores);
  return app;
}

const patch = (app, id, token, body = { solicitadoPor: 'PACIENTE' }) =>
  request(app)
    .patch(`/api/turnos/${id}/cancelar`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

describe('PATCH /api/turnos/:id/cancelar — capa HTTP (C06 task 4.1)', () => {
  it('sin token → 401 TOKEN_INVALIDO', async () => {
    const res = await request(appDeTurnos())
      .patch(`/api/turnos/${randomUUID()}/cancelar`)
      .send({ solicitadoPor: 'PACIENTE' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDO');
  });

  it.each(['RECEPCION', 'ADMIN_CONSULTORIO'])(
    '%s cancela un turno futuro y recibe DTO con auditoría sin consultorioId',
    async (rol) => {
      await conFixtureTurnos(async ({ fixture, token }) => {
        const turno = await crearTurnoPartida(fixture, { inicio: '2030-02-20T10:00:00Z' });
        const res = await patch(crearApp(), turno.id, token);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          id: turno.id,
          estado: 'CANCELADO',
          canceladoPor: fixture.usuarioId,
          solicitadoPor: 'PACIENTE',
        });
        expect(res.body.canceladoEn).toBeTruthy();
        expect(res.body).not.toHaveProperty('consultorioId');
        const { rows } = await fixture.consultar(
          'SELECT estado, cancelado_en, cancelado_por, solicitado_por FROM turno WHERE id = $1',
          [turno.id]
        );
        expect(rows[0]).toMatchObject({
          estado: 'CANCELADO',
          cancelado_por: fixture.usuarioId,
          solicitado_por: 'PACIENTE',
        });
        expect(rows[0].cancelado_en).toBeInstanceOf(Date);
      }, { rol });
    }
  );

  it('ODONTOLOGO recibe 403 SIN_PERMISO y no altera el turno', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const turno = await crearTurnoPartida(fixture, { inicio: '2030-02-20T10:00:00Z' });
      const res = await patch(crearApp(), turno.id, token);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SIN_PERMISO');
      const { rows } = await fixture.consultar(
        'SELECT estado, cancelado_en FROM turno WHERE id = $1',
        [turno.id]
      );
      expect(rows[0]).toEqual({ estado: 'PENDIENTE', cancelado_en: null });
    }, { rol: 'ODONTOLOGO' });
  });

  it.each([
    ['solicitadoPor ausente', {}],
    ['solicitadoPor inválido', { solicitadoPor: 'OTRO' }],
  ])('%s → 400 VALIDACION sin modificar el turno', async (_caso, body) => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const turno = await crearTurnoPartida(fixture, { inicio: '2030-02-20T10:00:00Z' });
      const res = await patch(crearApp(), turno.id, token, body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDACION');
      const { rows } = await fixture.consultar(
        'SELECT estado, cancelado_en FROM turno WHERE id = $1',
        [turno.id]
      );
      expect(rows[0]).toEqual({ estado: 'PENDIENTE', cancelado_en: null });
    });
  });

  it('UUID malformado → 400 VALIDACION', async () => {
    await conFixtureTurnos(async ({ token }) => {
      const res = await patch(crearApp(), 'malformado', token);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDACION');
    });
  });

  it('turno inexistente o de otro consultorio → 404 TURNO_NO_ENCONTRADO', async () => {
    await conFixtureTurnos(async (a) => {
      await conFixtureTurnos(async (b) => {
        const ajeno = await crearTurnoPartida(b.fixture, { inicio: '2030-02-20T10:00:00Z' });
        for (const id of [randomUUID(), ajeno.id]) {
          const res = await patch(crearApp(), id, a.token);
          expect(res.status).toBe(404);
          expect(res.body.error.code).toBe('TURNO_NO_ENCONTRADO');
        }
        const { rows } = await b.fixture.consultar(
          'SELECT estado, cancelado_en FROM turno WHERE id = $1',
          [ajeno.id]
        );
        expect(rows[0]).toEqual({ estado: 'PENDIENTE', cancelado_en: null });
      });
    });
  });

  it('repetir cancelación → 409 TURNO_YA_CANCELADO y conserva auditoría original', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const turno = await crearTurnoPartida(fixture, {
        inicio: '2030-02-20T10:00:00Z',
        estado: 'CANCELADO',
      });
      await fixture.consultar(
        `UPDATE turno SET cancelado_en = '2026-01-02T03:04:05Z',
                          cancelado_por = $2, solicitado_por = 'CONSULTORIO'
         WHERE id = $1`,
        [turno.id, fixture.usuarioId]
      );
      const before = await fixture.consultar(
        'SELECT estado, cancelado_en, cancelado_por, solicitado_por FROM turno WHERE id = $1',
        [turno.id]
      );
      const res = await patch(crearApp(), turno.id, token);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TURNO_YA_CANCELADO');
      const after = await fixture.consultar(
        'SELECT estado, cancelado_en, cancelado_por, solicitado_por FROM turno WHERE id = $1',
        [turno.id]
      );
      expect(after.rows[0]).toEqual(before.rows[0]);
    });
  });

  it.each(['ATENDIDO', 'AUSENTE'])('%s → 409 ESTADO_INVALIDO', async (estado) => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const turno = await crearTurnoPartida(fixture, { inicio: '2030-02-20T10:00:00Z', estado });
      const res = await patch(crearApp(), turno.id, token);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ESTADO_INVALIDO');
    });
  });

  it('turno pasado → 409 TURNO_PASADO', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const turno = await crearTurnoPartida(fixture, {
        inicio: new Date(Date.now() - 60_000).toISOString(),
      });
      const res = await patch(crearApp(), turno.id, token);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('TURNO_PASADO');
    });
  });

  it('crearApp() monta PATCH bajo /api/turnos', async () => {
    await conFixtureTurnos(async ({ token }) => {
      const res = await request(crearApp())
        .patch('/api/turnos/no-es-uuid/cancelar')
        .set('Authorization', `Bearer ${token}`)
        .send({ solicitadoPor: 'PACIENTE' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDACION');
    });
  });
});

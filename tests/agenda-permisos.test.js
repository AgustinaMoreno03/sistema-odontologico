import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { crearApp } from '../src/app.js';
import * as catalogo from '../src/modules/catalogo/index.js';
import * as pacientes from '../src/modules/pacientes/index.js';
import { crearTurnoPartida } from './helpers/turnos-fixtures.js';
import { conDosAgendas } from './fixtures/agenda.js';

const rango = { desde: '2026-12-01T00:00:00-03:00', hasta: '2026-12-02T00:00:00-03:00' };
const consultar = (token, extra = {}) => request(crearApp()).get('/api/agenda')
  .query({ ...rango, ...extra }).set('Authorization', `Bearer ${token}`);

async function segundoProfesional(a) {
  const id = randomUUID();
  await a.consultar('INSERT INTO profesional (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
    [id, a.consultorioId, 'Profesional Ficticio Segundo C08']);
  const turno = await crearTurnoPartida(a, { profesionalId: id, inicio: '2026-12-01T15:00:00Z' });
  return { id, turno };
}

describe('C08 tanda 2: roles y contexto autenticado', () => {
  it.each(['RECEPCION', 'ADMIN_CONSULTORIO'])('%s ve todas sus agendas y puede filtrar', async (rolA) => {
    await conDosAgendas(async ({ a, tokenA, turnoA }) => {
      const segundo = await segundoProfesional(a);
      // La condición profesional no reduce el permiso administrativo.
      if (rolA === 'ADMIN_CONSULTORIO') await catalogo.vincularUsuario({
        profesionalId: a.profesionalId, usuarioId: a.usuarioId, consultorioId: a.consultorioId,
      });
      const todas = await consultar(tokenA);
      expect(todas.status).toBe(200);
      expect(todas.body.turnos.map(({ id }) => id)).toEqual([turnoA.id, segundo.turno.id]);
      const filtrada = await consultar(tokenA, { profesionalId: segundo.id });
      expect(filtrada.status).toBe(200);
      expect(filtrada.body.turnos.map(({ id }) => id)).toEqual([segundo.turno.id]);
      await a.consultar('UPDATE profesional SET activo = FALSE WHERE id = $1 AND consultorio_id = $2',
        [segundo.id, a.consultorioId]);
      const inactiva = await consultar(tokenA, { profesionalId: segundo.id });
      expect(inactiva.status).toBe(200);
      expect(inactiva.body.turnos.map(({ id }) => id)).toEqual([segundo.turno.id]);
    }, { rolA });
  });

  it('filtro administrativo ajeno o inexistente da el mismo 404', async () => {
    await conDosAgendas(async ({ b, tokenA }) => {
      const ajena = await consultar(tokenA, { profesionalId: b.profesionalId });
      const ausente = await consultar(tokenA, { profesionalId: randomUUID() });
      expect([ajena.status, ausente.status]).toEqual([404, 404]);
      expect(ajena.body.error.code).toBe('PROFESIONAL_NO_ENCONTRADO');
      expect(ajena.body).toEqual(ausente.body);
      expect(JSON.stringify(ajena.body)).not.toContain(b.profesionalId);
    });
  });

  it('odontólogo usa profesionalDeUsuario y ve solo su agenda, también inactiva', async () => {
    await conDosAgendas(async ({ a, tokenA, turnoA }) => {
      await segundoProfesional(a);
      await catalogo.vincularUsuario({
        profesionalId: a.profesionalId, usuarioId: a.usuarioId, consultorioId: a.consultorioId,
      });
      const resolver = vi.spyOn(catalogo, 'profesionalDeUsuario');
      try {
        for (const extra of [{}, { profesionalId: a.profesionalId }]) {
          const res = await consultar(tokenA, extra);
          expect(res.status).toBe(200);
          expect(res.body.turnos.map(({ id }) => id)).toEqual([turnoA.id]);
        }
        expect(resolver).toHaveBeenCalledWith({ usuarioId: a.usuarioId, consultorioId: a.consultorioId });
        await a.consultar('UPDATE profesional SET activo = FALSE WHERE id = $1 AND consultorio_id = $2',
          [a.profesionalId, a.consultorioId]);
        const inactiva = await consultar(tokenA);
        expect(inactiva.status).toBe(200);
        expect(inactiva.body.turnos.map(({ id }) => id)).toEqual([turnoA.id]);
      } finally { resolver.mockRestore(); }
    }, { rolA: 'ODONTOLOGO' });
  });

  it('odontólogo no puede consultar otra ficha propia, ajena o inexistente', async () => {
    await conDosAgendas(async ({ a, b, tokenA }) => {
      const segundo = await segundoProfesional(a);
      await catalogo.vincularUsuario({
        profesionalId: a.profesionalId, usuarioId: a.usuarioId, consultorioId: a.consultorioId,
      });
      for (const profesionalId of [segundo.id, b.profesionalId, randomUUID()]) {
        const res = await consultar(tokenA, { profesionalId });
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('SIN_PERMISO');
        expect(res.body).not.toHaveProperty('turnos');
      }
    }, { rolA: 'ODONTOLOGO' });
  });

  it('odontólogo sin vínculo recibe 403', async () => {
    await conDosAgendas(async ({ tokenA }) => {
      const res = await consultar(tokenA);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('SIN_PERMISO');
    }, { rolA: 'ODONTOLOGO' });
  });

  it('ignora contexto de body/headers y rechaza suplantación por query', async () => {
    await conDosAgendas(async ({ a, b, tokenA, turnoA }) => {
      const res = await consultar(tokenA).set('x-tenant-id', b.consultorioId)
        .set('x-consultorio-id', b.consultorioId).set('x-usuario-id', b.usuarioId)
        .send({ consultorioId: b.consultorioId, usuarioId: b.usuarioId });
      expect(res.status).toBe(200);
      expect(res.body.turnos.map(({ id }) => id)).toEqual([turnoA.id]);
      expect(JSON.stringify(res.body)).not.toContain(b.pacienteId);
      const query = await consultar(tokenA, { consultorioId: b.consultorioId });
      expect(query.status).toBe(400);
      const { rows } = await a.consultar('SELECT id, estado FROM turno WHERE id = $1 AND consultorio_id = $2',
        [turnoA.id, a.consultorioId]);
      expect(rows).toEqual([{ id: turnoA.id, estado: 'PENDIENTE' }]);
    });
  });

  it('limpiar A conserva consultorio y turnos de B', async () => {
    await conDosAgendas(async ({ a, b, turnoB }) => {
      await a.limpiar();
      const { rows } = await b.consultar('SELECT id FROM turno WHERE consultorio_id = $1', [b.consultorioId]);
      expect(rows).toEqual([{ id: turnoB.id }]);
      const ausente = await b.consultar('SELECT id FROM consultorio WHERE id = $1', [a.consultorioId]);
      expect(ausente.rows).toEqual([]);
    });
  });

  it('un fallo de la interfaz de pacientes no filtra detalles ni datos parciales', async () => {
    await conDosAgendas(async ({ tokenA }) => {
      const lectura = vi.spyOn(pacientes, 'obtenerNombresPacientes')
        .mockRejectedValue(new Error('detalle-ficticio-no-debe-exponerse'));
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const res = await consultar(tokenA);
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor' } });
      } finally { lectura.mockRestore(); log.mockRestore(); }
    });
  });
});

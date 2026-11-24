import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import * as pacientes from '../src/modules/pacientes/index.js';
import { conFixtureTurnos } from './helpers/turnos-fixtures.js';

describe('C08: interfaz mínima de nombres de pacientes', () => {
  it('resuelve vacío, deduplica y devuelve solo nombres con apellido null', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const contexto = { consultorioId: fixture.consultorioId };
      expect(await pacientes.obtenerNombresPacientes({ ...contexto, pacienteIds: [] })).toEqual([]);
      const filas = await pacientes.obtenerNombresPacientes({
        ...contexto, pacienteIds: [fixture.pacienteId, fixture.pacienteId],
      });
      expect(filas).toEqual([{ id: fixture.pacienteId, nombre: 'Paciente Ficticio C05', apellido: null }]);
    });
  });

  it('omite pacientes ajenos e inexistentes', async () => {
    await conFixtureTurnos(async ({ fixture: a }) => {
      await conFixtureTurnos(async ({ fixture: b }) => {
        const filas = await pacientes.obtenerNombresPacientes({
          consultorioId: a.consultorioId, pacienteIds: [a.pacienteId, b.pacienteId, randomUUID()],
        });
        expect(filas.map(({ id }) => id)).toEqual([a.pacienteId]);
      });
    });
  });

  it.each([
    { consultorioId: 'mal', pacienteIds: [] },
    { consultorioId: randomUUID(), pacienteIds: ['mal'] },
    { consultorioId: randomUUID(), pacienteIds: 'no-array' },
    { consultorioId: randomUUID(), pacienteIds: Array.from({ length: 201 }, () => randomUUID()) },
  ])('rechaza parámetros inválidos', async (parametros) => {
    await expect(pacientes.obtenerNombresPacientes(parametros))
      .rejects.toMatchObject({ statusCode: 400, code: 'VALIDACION' });
  });
});

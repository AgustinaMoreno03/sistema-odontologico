import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../src/errores.js';
import { crearFixture } from './helpers/catalogo-fixtures.js';
import { crearProfesional } from '../src/modules/catalogo/profesional-servicios.js';

/**
 * C02 — servicio de alta de `profesional` (spec "Alta de profesional en el
 * consultorio autenticado"). Casos de uso sobre la base REAL: normalización
 * de dominio antes de escribir, defaults de la ficha y rechazo del nombre
 * vacío con `ApiError` 422 `DATOS_INVALIDOS` SIN crear registro.
 */

let a;

beforeAll(async () => {
  a = await crearFixture();
});

afterAll(async () => {
  await a.limpiar();
});

describe('servicio de alta de profesional', () => {
  it('crea la ficha recortada con activo true, usuarioId nulo y creadoEn en ISO 8601 UTC', async () => {
    const ficha = await crearProfesional({
      consultorioId: a.consultorioId,
      nombre: '  Dra. Ana Ruiz  ',
      matricula: ' MN-1234 ',
      email: ' ANA@EXAMPLE.COM ',
    });

    expect(ficha).toEqual({
      id: expect.any(String),
      consultorioId: a.consultorioId,
      nombre: 'Dra. Ana Ruiz',
      matricula: 'MN-1234',
      email: 'ana@example.com',
      usuarioId: null,
      activo: true,
      creadoEn: expect.any(String),
    });
    // creadoEn serializado ISO 8601 UTC (design.md, decisión 2).
    expect(ficha.creadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
  });

  it('matrícula y email vacíos se guardan como NULL', async () => {
    const ficha = await crearProfesional({
      consultorioId: a.consultorioId,
      nombre: 'Dr. Omar Paredes',
      matricula: '   ',
      email: '',
    });

    expect(ficha.matricula).toBeNull();
    expect(ficha.email).toBeNull();
  });

  it('nombre vacío o de solo espacios lanza ApiError 422 DATOS_INVALIDOS sin crear registro', async () => {
    const antes = await a.consultar(
      'SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1',
      [a.consultorioId]
    );

    for (const nombre of ['', '   ']) {
      let error;
      try {
        await crearProfesional({ consultorioId: a.consultorioId, nombre });
      } catch (err) {
        error = err;
      }
      expect(error, `debe rechazar nombre ${JSON.stringify(nombre)}`).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('DATOS_INVALIDOS');
    }

    const despues = await a.consultar(
      'SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1',
      [a.consultorioId]
    );
    expect(despues.rows[0].total).toBe(antes.rows[0].total);
  });
});

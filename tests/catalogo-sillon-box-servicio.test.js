import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../src/errores.js';
import { crearFixture } from './helpers/catalogo-fixtures.js';
import {
  insertarSillonBox,
  listarSillonBoxes,
  obtenerSillonBoxPorId,
} from '../src/modules/catalogo/sillon-box-repositorios.js';
import { crearSillonBox } from '../src/modules/catalogo/sillon-box-servicios.js';

/**
 * C02 — persistencia y alta de `sillon_box` (spec "Alta de sillón o box y
 * unicidad por consultorio") contra PostgreSQL REAL, sin mock de SQL.
 * Misma tanda de pruebas que el Profesional: repositorio (filas y
 * aislamiento RN-TEN-02) y servicio (normalización y 422 sin registro).
 */

let a;
let b;

beforeAll(async () => {
  a = await crearFixture();
  b = await crearFixture();
});

afterAll(async () => {
  await a.limpiar();
  await b.limpiar();
});

describe('repositorio de sillon_box', () => {
  it('inserta con consultorio_id del tenant, activo true y creado_en', async () => {
    const fila = await insertarSillonBox({
      consultorioId: a.consultorioId,
      nombre: 'Sillón 1',
      descripcion: 'Box de ortodoncia',
    });

    expect(fila.consultorio_id).toBe(a.consultorioId);
    expect(fila.nombre).toBe('Sillón 1');
    expect(fila.descripcion).toBe('Box de ortodoncia');
    expect(fila.activo).toBe(true);
    expect(fila.creado_en).toBeInstanceOf(Date);
  });

  it('obtenerSillonBoxPorId devuelve la ficha propia y null para otro consultorio o un id inexistente', async () => {
    const fila = await insertarSillonBox({ consultorioId: a.consultorioId, nombre: 'Sillón 2' });
    expect(fila.descripcion).toBeNull();

    const propia = await obtenerSillonBoxPorId({ consultorioId: a.consultorioId, id: fila.id });
    expect(propia.id).toBe(fila.id);

    expect(
      await obtenerSillonBoxPorId({ consultorioId: b.consultorioId, id: fila.id })
    ).toBeNull();
    expect(
      await obtenerSillonBoxPorId({ consultorioId: a.consultorioId, id: randomUUID() })
    ).toBeNull();
  });

  it('listarSillonBoxes nunca devuelve filas de otro consultorio', async () => {
    await insertarSillonBox({ consultorioId: b.consultorioId, nombre: 'Box B' });

    const deA = await listarSillonBoxes({ consultorioId: a.consultorioId });
    expect(deA.map((f) => f.consultorio_id)).toEqual([a.consultorioId, a.consultorioId]);

    const deB = await listarSillonBoxes({ consultorioId: b.consultorioId });
    expect(deB.map((f) => f.nombre)).toEqual(['Box B']);
  });
});

describe('servicio de alta de sillon_box', () => {
  it('crea la ficha con nombre y descripción recortados, activo true y creadoEn ISO UTC', async () => {
    const ficha = await crearSillonBox({
      consultorioId: a.consultorioId,
      nombre: '  Sillón 3  ',
      descripcion: '  Box de cirugía  ',
    });

    expect(ficha).toEqual({
      id: expect.any(String),
      consultorioId: a.consultorioId,
      nombre: 'Sillón 3',
      descripcion: 'Box de cirugía',
      activo: true,
      creadoEn: expect.any(String),
    });
    expect(ficha.creadoEn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
  });

  it('descripción vacía o de solo espacios se guarda como NULL', async () => {
    const ficha = await crearSillonBox({
      consultorioId: a.consultorioId,
      nombre: 'Sillón 4',
      descripcion: '   ',
    });
    expect(ficha.descripcion).toBeNull();
  });

  it('nombre vacío o de solo espacios lanza ApiError 422 DATOS_INVALIDOS sin crear registro', async () => {
    const antes = await a.consultar(
      'SELECT count(*)::int AS total FROM sillon_box WHERE consultorio_id = $1',
      [a.consultorioId]
    );

    for (const nombre of ['', '   ']) {
      let error;
      try {
        await crearSillonBox({ consultorioId: a.consultorioId, nombre });
      } catch (err) {
        error = err;
      }
      expect(error, `debe rechazar nombre ${JSON.stringify(nombre)}`).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('DATOS_INVALIDOS');
    }

    const despues = await a.consultar(
      'SELECT count(*)::int AS total FROM sillon_box WHERE consultorio_id = $1',
      [a.consultorioId]
    );
    expect(despues.rows[0].total).toBe(antes.rows[0].total);
  });

  it('el alta queda solo en el consultorio del contexto (aislamiento por tenant)', async () => {
    const ficha = await crearSillonBox({
      consultorioId: a.consultorioId,
      nombre: 'Sillón Aislado',
    });
    expect(ficha.consultorioId).toBe(a.consultorioId);

    const enB = await b.consultar(
      'SELECT count(*)::int AS total FROM sillon_box WHERE consultorio_id = $1 AND nombre = $2',
      [b.consultorioId, 'Sillón Aislado']
    );
    expect(enB.rows[0].total).toBe(0);
  });
});

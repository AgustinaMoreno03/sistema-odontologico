import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearFixture } from './helpers/catalogo-fixtures.js';
import {
  insertarProfesional,
  listarProfesionales,
  obtenerProfesionalPorId,
} from '../src/modules/catalogo/profesional-repositorios.js';

/**
 * C02 — repositorio de `profesional` contra PostgreSQL REAL (sin mock de
 * SQL; design.md, decisión 10). Verifica el escenario del spec "Alta válida
 * con nombre y matrícula" a nivel de persistencia: `consultorio_id` del
 * tenant, `activo` true, `usuario_id` nulo y `creado_en` informado, y el
 * aislamiento RN-TEN-02 (nunca filas de otro consultorio).
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

describe('repositorio de profesional', () => {
  it('inserta con consultorio_id del tenant, activo true, usuario_id nulo y creado_en', async () => {
    const fila = await insertarProfesional({
      consultorioId: a.consultorioId,
      nombre: 'Dra. María López',
      matricula: 'MN-1234',
      email: 'maria@example.com',
    });

    expect(fila.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(fila.consultorio_id).toBe(a.consultorioId);
    expect(fila.nombre).toBe('Dra. María López');
    expect(fila.matricula).toBe('MN-1234');
    expect(fila.email).toBe('maria@example.com');
    expect(fila.usuario_id).toBeNull();
    expect(fila.activo).toBe(true);
    expect(fila.creado_en).toBeInstanceOf(Date);

    // La fila vive realmente en la base, con los defaults de la 020.
    const { rows } = await a.consultar('SELECT * FROM profesional WHERE id = $1', [fila.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].activo).toBe(true);
    expect(rows[0].usuario_id).toBeNull();
  });

  it('obtenerProfesionalPorId devuelve la ficha propia y null para otro consultorio o un id inexistente', async () => {
    const fila = await insertarProfesional({
      consultorioId: a.consultorioId,
      nombre: 'Dr. Omar Paredes',
    });
    expect(fila.matricula).toBeNull();
    expect(fila.email).toBeNull();

    const propia = await obtenerProfesionalPorId({
      consultorioId: a.consultorioId,
      id: fila.id,
    });
    expect(propia).not.toBeNull();
    expect(propia.id).toBe(fila.id);
    expect(propia.nombre).toBe('Dr. Omar Paredes');

    // RN-TEN-02: un id de otro consultorio o inexistente es "no encontrado".
    const ajena = await obtenerProfesionalPorId({
      consultorioId: b.consultorioId,
      id: fila.id,
    });
    expect(ajena).toBeNull();

    const inexistente = await obtenerProfesionalPorId({
      consultorioId: a.consultorioId,
      id: randomUUID(),
    });
    expect(inexistente).toBeNull();
  });

  it('listarProfesionales nunca devuelve filas de otro consultorio', async () => {
    await insertarProfesional({ consultorioId: b.consultorioId, nombre: 'Dra. Carla Ríos' });

    const deA = await listarProfesionales({ consultorioId: a.consultorioId });
    expect(deA.length).toBe(2);
    expect(deA.map((f) => f.consultorio_id)).toEqual([a.consultorioId, a.consultorioId]);

    const deB = await listarProfesionales({ consultorioId: b.consultorioId });
    expect(deB.map((f) => f.nombre)).toEqual(['Dra. Carla Ríos']);
  });
});

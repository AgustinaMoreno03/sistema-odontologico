import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { obtenerCatalogo } from '../src/modules/catalogo/index.js';
import { crearFixture } from './helpers/catalogo-fixtures.js';
import { crearToken } from './helpers/tokens.js';

/**
 * C02 — catálogo activo del consultorio (spec "Catálogo activo del
 * consultorio para turnos"): `GET /api/catalogo` y la función de módulo
 * `obtenerCatalogo({ consultorioId })` (interfaz para C05). Solo activos,
 * proyección mínima, los tres roles autenticados, aislamiento por tenant y
 * arrays vacíos para un consultorio sin recursos.
 */

let a;
let b;
let fichas;

beforeAll(async () => {
  a = await crearFixture();
  b = await crearFixture();

  // Datos ficticios (regla dura 1): un profesional y un sillón activos en A.
  await a.consultar(
    'INSERT INTO profesional (consultorio_id, nombre, matricula) VALUES ($1, $2, $3)',
    [a.consultorioId, 'Dra. María López', 'MN-1234']
  );
  await a.consultar(
    'INSERT INTO sillon_box (consultorio_id, nombre, descripcion) VALUES ($1, $2, $3)',
    [a.consultorioId, 'Sillón 1', 'Box de ortodoncia']
  );
  // En B, recursos propios que jamás deben filtrarse en las respuestas de A.
  await b.consultar(
    'INSERT INTO profesional (consultorio_id, nombre) VALUES ($1, $2)',
    [b.consultorioId, 'Dr. Externo']
  );
  await b.consultar(
    'INSERT INTO sillon_box (consultorio_id, nombre) VALUES ($1, $2)',
    [b.consultorioId, 'Sillón Externo']
  );

  const { rows } = await a.consultar(
    'SELECT id, nombre, matricula FROM profesional WHERE consultorio_id = $1',
    [a.consultorioId]
  );
  const sillas = await a.consultar(
    'SELECT id, nombre, descripcion FROM sillon_box WHERE consultorio_id = $1',
    [a.consultorioId]
  );
  fichas = {
    profesionales: rows.map((f) => ({ id: f.id, nombre: f.nombre, matricula: f.matricula })),
    sillonBoxes: sillas.rows.map((f) => ({ id: f.id, nombre: f.nombre, descripcion: f.descripcion })),
  };
});

afterAll(async () => {
  await a.limpiar();
  await b.limpiar();
});

const tokenPara = (fixture, rol) =>
  crearToken({ usuarioId: randomUUID(), consultorioId: fixture.consultorioId, rol });

describe('GET /api/catalogo', () => {
  it('los tres roles autenticados acceden con la proyección mínima id+nombre+matricula/descripcion', async () => {
    for (const rol of ['ADMIN_CONSULTORIO', 'ODONTOLOGO', 'RECEPCION']) {
      const res = await request(crearApp())
        .get('/api/catalogo')
        .set('Authorization', `Bearer ${tokenPara(a, rol)}`);

      expect(res.status, rol).toBe(200);
      // Proyección mínima (design D6): sin activo, usuarioId, email ni creadoEn.
      expect(res.body, rol).toEqual(fichas);
    }
  });

  it('los registros inactivos se excluyen del catálogo', async () => {
    await a.consultar('UPDATE profesional SET activo = false WHERE consultorio_id = $1', [
      a.consultorioId,
    ]);

    const res = await request(crearApp())
      .get('/api/catalogo')
      .set('Authorization', `Bearer ${tokenPara(a, 'RECEPCION')}`);

    expect(res.status).toBe(200);
    expect(res.body.profesionales).toEqual([]);

    await a.consultar('UPDATE profesional SET activo = true WHERE consultorio_id = $1', [
      a.consultorioId,
    ]);
  });

  it('aislamiento entre consultorios: la respuesta de A no contiene datos de B', async () => {
    const res = await request(crearApp())
      .get('/api/catalogo')
      .set('Authorization', `Bearer ${tokenPara(a, 'ADMIN_CONSULTORIO')}`);

    expect(res.status).toBe(200);
    const cuerpo = JSON.stringify(res.body);
    expect(cuerpo).not.toContain('Externo');

    const ids = [
      ...res.body.profesionales.map((f) => f.id),
      ...res.body.sillonBoxes.map((f) => f.id),
    ];
    expect(ids).toHaveLength(2);
  });

  it('un consultorio sin recursos responde 200 con arrays vacíos', async () => {
    const vacio = await crearFixture();
    try {
      const res = await request(crearApp())
        .get('/api/catalogo')
        .set('Authorization', `Bearer ${tokenPara(vacio, 'ADMIN_CONSULTORIO')}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ profesionales: [], sillonBoxes: [] });
    } finally {
      await vacio.limpiar();
    }
  });

  it('sin encabezado de autorización responde 401 TOKEN_INVALIDO (mensaje uniforme de C00)', async () => {
    const res = await request(crearApp()).get('/api/catalogo');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' } });
  });
});

describe('obtenerCatalogo (interfaz de módulo para C05)', () => {
  it('devuelve solo los activos del consultorio indicado, con proyección mínima', async () => {
    const catalogo = await obtenerCatalogo({ consultorioId: a.consultorioId });

    expect(catalogo).toEqual(fichas);
  });

  it('devuelve arrays vacíos para un consultorio sin recursos', async () => {
    const vacio = await crearFixture();
    try {
      expect(await obtenerCatalogo({ consultorioId: vacio.consultorioId })).toEqual({
        profesionales: [],
        sillonBoxes: [],
      });
    } finally {
      await vacio.limpiar();
    }
  });

  it('un consultorioId malformado lanza ApiError 400 DATOS_INVALIDOS (design D8)', async () => {
    let error;
    try {
      await obtenerCatalogo({ consultorioId: 'no-es-uuid' });
    } catch (err) {
      error = err;
    }
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('DATOS_INVALIDOS');
  });
});

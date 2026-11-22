import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { crearFixture } from './helpers/catalogo-fixtures.js';
import { crearToken } from './helpers/tokens.js';

/**
 * C02 — aislamiento de datos entre consultorios (spec "Aislamiento de datos
 * entre consultorios", RN-TEN-01/02) extremo a extremo por HTTP: el
 * consultorio sale SOLO del token; un `:id` de otro consultorio se trata
 * como inexistente; `?consultorioId=`, los headers `x-tenant-*` y el
 * `consultorioId` del cuerpo jamás cambian el consultorio de operación.
 */

let a;
let b;
let tokenA;
let datosB;

beforeAll(async () => {
  a = await crearFixture();
  b = await crearFixture();
  tokenA = crearToken({
    usuarioId: randomUUID(),
    consultorioId: a.consultorioId,
    rol: 'ADMIN_CONSULTORIO',
  });

  // Recursos propios de B (ficticios, regla dura 1).
  const { rows: profB } = await b.consultar(
    'INSERT INTO profesional (consultorio_id, nombre, matricula) VALUES ($1, $2, $3) RETURNING id',
    [b.consultorioId, 'Dra. Externa B', 'MN-B1']
  );
  const { rows: sillB } = await b.consultar(
    'INSERT INTO sillon_box (consultorio_id, nombre, descripcion) VALUES ($1, $2, $3) RETURNING id',
    [b.consultorioId, 'Sillón Externo B', 'Box de B']
  );
  datosB = { profesionalId: profB[0].id, sillonBoxId: sillB[0].id };
});

afterAll(async () => {
  await a.limpiar();
  await b.limpiar();
});

const estadoDeB = async () => {
  const prof = await b.consultar('SELECT nombre, matricula, activo FROM profesional WHERE id = $1', [
    datosB.profesionalId,
  ]);
  const sill = await b.consultar('SELECT nombre, descripcion, activo FROM sillon_box WHERE id = $1', [
    datosB.sillonBoxId,
  ]);
  return { profesional: prof.rows[0], sillonBox: sill.rows[0] };
};

describe('aislamiento entre consultorios (RN-TEN-01, RN-TEN-02)', () => {
  it('las operaciones de A solo devuelven datos de A', async () => {
    await request(crearApp())
      .post('/api/profesionales')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nombre: 'Dra. Propia A' })
      .expect(201);

    const listado = await request(crearApp())
      .get('/api/profesionales')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listado.status).toBe(200);
    expect(listado.body.map((f) => f.nombre)).toEqual(['Dra. Propia A']);
    expect(JSON.stringify(listado.body)).not.toContain('Externa B');

    const catalogo = await request(crearApp())
      .get('/api/catalogo')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(catalogo.status).toBe(200);
    expect(catalogo.body.profesionales.map((f) => f.nombre)).toEqual(['Dra. Propia A']);
    expect(catalogo.body.sillonBoxes).toEqual([]);
  });

  it('PUT con un :id del consultorio B → 404 y el registro de B queda intacto', async () => {
    const antes = await estadoDeB();

    for (const [ruta, id, cuerpo] of [
      ['/api/profesionales', datosB.profesionalId, { nombre: 'Dra. Hackeada' }],
      ['/api/sillon-boxes', datosB.sillonBoxId, { activo: false }],
    ]) {
      const res = await request(crearApp())
        .put(`${ruta}/${id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send(cuerpo);
      expect(res.status, ruta).toBe(404);
      expect(res.body.error.code).toBe('RECURSO_NO_ENCONTRADO');
    }

    expect(await estadoDeB()).toEqual(antes);
  });

  it('la query ?consultorioId=B y los headers x-tenant-* se descartan: siempre se opera sobre A', async () => {
    const idFalso = b.consultorioId;

    // Alta con query y headers apuntando a B: el registro nace en A.
    const alta = await request(crearApp())
      .post('/api/profesionales?consultorioId=' + idFalso)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-consultorio', idFalso)
      .set('x-tenant-id', idFalso)
      .send({ nombre: 'Dra. Con Query Ajena' });
    expect(alta.status).toBe(201);
    expect(alta.body.consultorioId).toBe(a.consultorioId);

    // El listado con query ajena sigue devolviendo solo A.
    const listado = await request(crearApp())
      .get('/api/sillon-boxes?consultorioId=' + idFalso)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-tenant-consultorio', idFalso);
    expect(listado.status).toBe(200);
    expect(listado.body).toEqual([]);

    const enB = await b.consultar(
      'SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1',
      [b.consultorioId]
    );
    expect(enB.rows[0].total).toBe(1); // solo la ficha propia de B
  });

  it('un consultorioId en el cuerpo responde 422 y no crea nada en ningún consultorio', async () => {
    const res = await request(crearApp())
      .post('/api/profesionales')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ nombre: 'Dra. Cuerpo Ajeno', consultorioId: b.consultorioId });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DATOS_INVALIDOS');

    for (const fixture of [a, b]) {
      const { rows } = await fixture.consultar(
        'SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1 AND nombre = $2',
        [fixture.consultorioId, 'Dra. Cuerpo Ajeno']
      );
      expect(rows[0].total).toBe(0);
    }
  });

  it('el catálogo y los listados de A no contienen ningún dato de B', async () => {
    const catalogo = await request(crearApp())
      .get('/api/catalogo')
      .set('Authorization', `Bearer ${tokenA}`);
    const listadoProf = await request(crearApp())
      .get('/api/profesionales')
      .set('Authorization', `Bearer ${tokenA}`);
    const listadoSill = await request(crearApp())
      .get('/api/sillon-boxes')
      .set('Authorization', `Bearer ${tokenA}`);

    const respuestas = JSON.stringify([catalogo.body, listadoProf.body, listadoSill.body]);
    expect(respuestas).not.toContain('Externa B');
    expect(respuestas).not.toContain('Externo B');
    expect(respuestas).not.toContain(b.consultorioId);
    expect(respuestas).not.toContain(datosB.profesionalId);
    expect(respuestas).not.toContain(datosB.sillonBoxId);
  });
});

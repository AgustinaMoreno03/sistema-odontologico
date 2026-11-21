import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { crearFixture, conFixtureConAdmin as conFixturePropio } from './helpers/catalogo-fixtures.js';
import { crearToken } from './helpers/tokens.js';

/**
 * C02 — HTTP de `POST /api/profesionales` (spec "Alta de profesional" y
 * "Autorización por rol en las operaciones del catálogo"). Integración
 * rutas → servicios → repositorios contra PostgreSQL REAL con supertest y
 * tokens ficticios (crearToken). El `consultorioId` sale SOLO del token
 * (regla dura 2); los datos son ficticios (regla dura 1).
 */

let a;
let b;
let tokenAdmin;
let tokenAdminB;

beforeAll(async () => {
  a = await crearFixture();
  b = await crearFixture();
  tokenAdmin = crearToken({
    usuarioId: randomUUID(),
    consultorioId: a.consultorioId,
    rol: 'ADMIN_CONSULTORIO',
  });
  tokenAdminB = crearToken({
    usuarioId: randomUUID(),
    consultorioId: b.consultorioId,
    rol: 'ADMIN_CONSULTORIO',
  });
});

afterAll(async () => {
  await a.limpiar();
  await b.limpiar();
});

describe('POST /api/profesionales', () => {
  it('201 con la ficha completa para ADMIN_CONSULTORIO (spec: alta válida con nombre y matrícula)', async () => {
    const app = crearApp();

    const res = await request(app)
      .post('/api/profesionales')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Dra. María López', matricula: 'MN-1234', email: 'maria@example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      consultorioId: a.consultorioId,
      nombre: 'Dra. María López',
      matricula: 'MN-1234',
      email: 'maria@example.com',
      usuarioId: null,
      activo: true,
      creadoEn: expect.any(String),
    });
  });

  it('403 SIN_PERMISO para RECEPCION y ODONTOLOGO y el catálogo queda intacto', async () => {
    const app = crearApp();
    const antes = await a.consultar(
      'SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1',
      [a.consultorioId]
    );

    for (const rol of ['RECEPCION', 'ODONTOLOGO']) {
      const token = crearToken({ usuarioId: randomUUID(), consultorioId: a.consultorioId, rol });
      const res = await request(app)
        .post('/api/profesionales')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: `Dr. No Autorizado ${rol}` });

      expect(res.status, rol).toBe(403);
      expect(res.body).toEqual({
        error: { code: 'SIN_PERMISO', message: expect.any(String) },
      });
    }

    const despues = await a.consultar(
      'SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1',
      [a.consultorioId]
    );
    expect(despues.rows[0].total).toBe(antes.rows[0].total);
  });

  it('401 TOKEN_INVALIDO sin encabezado de autorización (mensaje uniforme de C00)', async () => {
    const app = crearApp();

    const res = await request(app)
      .post('/api/profesionales')
      .send({ nombre: 'Dra. Sin Token' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' },
    });
  });
});

describe('unicidad RN-TEN-03 en el alta de profesionales', () => {
  it('nombre repetido con distinta caja y tilde → 409 RECURSO_DUPLICADO sin crear el segundo registro', async () => {
    const app = crearApp();

    const primero = await request(app)
      .post('/api/profesionales')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Dr. Juan Pérez' });
    expect(primero.status).toBe(201);

    const antes = await a.consultar(
      'SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1',
      [a.consultorioId]
    );

    const segundo = await request(app)
      .post('/api/profesionales')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'dr. juan perez' });

    expect(segundo.status).toBe(409);
    expect(segundo.body).toEqual({
      error: { code: 'RECURSO_DUPLICADO', message: expect.any(String) },
    });

    const despues = await a.consultar(
      'SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1',
      [a.consultorioId]
    );
    expect(despues.rows[0].total).toBe(antes.rows[0].total);
  });

  it('email repetido con mayúsculas y espacios → 409 RECURSO_DUPLICADO', async () => {
    const app = crearApp();

    const primero = await request(app)
      .post('/api/profesionales')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Dra. Elena Vidal', email: 'elena@example.com' });
    expect(primero.status).toBe(201);

    const segundo = await request(app)
      .post('/api/profesionales')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ nombre: 'Dr. Federico Vera', email: ' ELENA@EXAMPLE.COM ' });

    expect(segundo.status).toBe(409);
    expect(segundo.body.error.code).toBe('RECURSO_DUPLICADO');
  });

  it('dos profesionales sin email en el mismo consultorio → ambos 201 (el email nulo no participa)', async () => {
    const app = crearApp();

    for (const nombre of ['Dra. Paula Guerra', 'Dr. Quique Sosa']) {
      const res = await request(app)
        .post('/api/profesionales')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ nombre });
      expect(res.status, nombre).toBe(201);
    }
  });

  it('mismo nombre y email en otro consultorio → 201 y el registro queda en B', async () => {
    const app = crearApp();

    const res = await request(app)
      .post('/api/profesionales')
      .set('Authorization', `Bearer ${tokenAdminB}`)
      .send({ nombre: 'Dr. Juan Pérez', email: 'juan@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.consultorioId).toBe(b.consultorioId);

    const enB = await b.consultar('SELECT count(*)::int AS total FROM profesional WHERE consultorio_id = $1', [
      b.consultorioId,
    ]);
    expect(enB.rows[0].total).toBe(1);
  });
});

const crearProfesionalHttp = (token, cuerpo) =>
  request(crearApp()).post('/api/profesionales').set('Authorization', `Bearer ${token}`).send(cuerpo);

const actualizarProfesionalHttp = (token, id, cuerpo) =>
  request(crearApp()).put(`/api/profesionales/${id}`).set('Authorization', `Bearer ${token}`).send(cuerpo);

describe('PUT /api/profesionales/:id (actualización y baja lógica)', () => {
  it('200 con los campos actualizados conservando los no enviados', async () => {
    await conFixturePropio(async ({ fixture, token }) => {
      const creada = await crearProfesionalHttp(token, {
        nombre: 'Dra. María López',
        matricula: 'MN-1234',
        email: 'maria@example.com',
      });
      expect(creada.status).toBe(201);

      const res = await actualizarProfesionalHttp(token, creada.body.id, { email: 'mlopez@example.com' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: creada.body.id,
        consultorioId: fixture.consultorioId,
        nombre: 'Dra. María López', // conservado
        matricula: 'MN-1234', // conservado
        email: 'mlopez@example.com',
        usuarioId: null,
        activo: true,
        creadoEn: creada.body.creadoEn,
      });
    });
  });

  it(':id malformado → 400 DATOS_INVALIDOS, validado ANTES que el cuerpo', async () => {
    await conFixturePropio(async ({ token }) => {
      // Cuerpo también inválido (consultorioId prohibido): manda el 400 del :id.
      const res = await actualizarProfesionalHttp(token, 'no-es-uuid', { consultorioId: 'x' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DATOS_INVALIDOS');
    });
  });

  it('id válido inexistente → 404 RECURSO_NO_ENCONTRADO', async () => {
    await conFixturePropio(async ({ token }) => {
      const res = await actualizarProfesionalHttp(token, randomUUID(), { nombre: 'Dra. Nadie' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RECURSO_NO_ENCONTRADO');
    });
  });

  it('id de otro consultorio → 404 y el registro ajeno queda intacto (RN-TEN-02)', async () => {
    await conFixturePropio(async ({ token }) => {
      const ajena = await crearFixture();
      try {
        const tokenAjeno = crearToken({
          usuarioId: randomUUID(),
          consultorioId: ajena.consultorioId,
          rol: 'ADMIN_CONSULTORIO',
        });
        const creada = await crearProfesionalHttp(tokenAjeno, {
          nombre: 'Dra. Externa',
          matricula: 'MN-0000',
        });
        expect(creada.status).toBe(201);

        const res = await actualizarProfesionalHttp(token, creada.body.id, { nombre: 'Dra. Hackeada' });

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('RECURSO_NO_ENCONTRADO');

        const { rows } = await ajena.consultar('SELECT nombre, matricula FROM profesional WHERE id = $1', [
          creada.body.id,
        ]);
        expect(rows).toEqual([{ nombre: 'Dra. Externa', matricula: 'MN-0000' }]);
      } finally {
        await ajena.limpiar();
      }
    });
  });

  it('renombrar a un nombre ya ocupado → 409 RECURSO_DUPLICADO y el registro queda sin cambios', async () => {
    await conFixturePropio(async ({ fixture, token }) => {
      const ana = await crearProfesionalHttp(token, { nombre: 'Dra. Ana Ruiz' });
      const zoe = await crearProfesionalHttp(token, { nombre: 'Dra. Zoe Díaz' });
      expect(ana.status).toBe(201);
      expect(zoe.status).toBe(201);

      const res = await actualizarProfesionalHttp(token, zoe.body.id, { nombre: 'dra. ana ruiz' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RECURSO_DUPLICADO');

      const { rows } = await fixture.consultar('SELECT nombre FROM profesional WHERE id = $1', [
        zoe.body.id,
      ]);
      expect(rows[0].nombre).toBe('Dra. Zoe Díaz'); // el registro queda sin cambios
    });
  });

  it('nombre vacío o de solo espacios en PUT → 422 DATOS_INVALIDOS y el registro queda sin cambios', async () => {
    await conFixturePropio(async ({ fixture, token }) => {
      const creada = await crearProfesionalHttp(token, { nombre: 'Dr. Omar Paredes' });
      expect(creada.status).toBe(201);

      for (const nombre of ['', '   ']) {
        const res = await actualizarProfesionalHttp(token, creada.body.id, { nombre });
        expect(res.status, JSON.stringify(nombre)).toBe(422);
        expect(res.body.error.code).toBe('DATOS_INVALIDOS');
      }

      const { rows } = await fixture.consultar('SELECT nombre FROM profesional WHERE id = $1', [
        creada.body.id,
      ]);
      expect(rows[0].nombre).toBe('Dr. Omar Paredes');
    });
  });

  it('403 SIN_PERMISO para RECEPCION y ODONTOLOGO y 401 TOKEN_INVALIDO sin token', async () => {
    await conFixturePropio(async ({ fixture }) => {
      const tokenAdmin = crearToken({
        usuarioId: randomUUID(),
        consultorioId: fixture.consultorioId,
        rol: 'ADMIN_CONSULTORIO',
      });
      const creada = await crearProfesionalHttp(tokenAdmin, { nombre: 'Dra. Protegida' });
      expect(creada.status).toBe(201);

      for (const rol of ['RECEPCION', 'ODONTOLOGO']) {
        const token = crearToken({ usuarioId: randomUUID(), consultorioId: fixture.consultorioId, rol });
        const res = await actualizarProfesionalHttp(token, creada.body.id, { activo: false });
        expect(res.status, rol).toBe(403);
        expect(res.body.error.code).toBe('SIN_PERMISO');
      }

      const sinToken = await request(crearApp())
        .put(`/api/profesionales/${creada.body.id}`)
        .send({ activo: false });
      expect(sinToken.status).toBe(401);
      expect(sinToken.body).toEqual({
        error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' },
      });

      // El catálogo quedó intacto (esquema "Escritura solicitada por otros roles").
      const { rows } = await fixture.consultar('SELECT activo FROM profesional WHERE id = $1', [
        creada.body.id,
      ]);
      expect(rows[0].activo).toBe(true);
    });
  });
});

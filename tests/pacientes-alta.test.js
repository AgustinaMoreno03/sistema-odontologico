import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { crearToken } from './helpers/tokens.js';

describe('C03: POST /api/pacientes', () => {
  let cliente;
  let consultorioA;
  let consultorioB;
  let app;

  beforeEach(async () => {
    cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    consultorioA = randomUUID();
    consultorioB = randomUUID();

    await cliente.query(
      'INSERT INTO consultorio (id) VALUES ($1), ($2)',
      [consultorioA, consultorioB]
    );
    app = crearApp();
  });

  afterEach(async () => {
    if (cliente) {
      try {
        await cliente.query(
          'DELETE FROM paciente WHERE consultorio_id = ANY($1::uuid[])',
          [[consultorioA, consultorioB]]
        );
        await cliente.query(
          'DELETE FROM consultorio WHERE id = ANY($1::uuid[])',
          [[consultorioA, consultorioB]]
        );
      } finally {
        await cliente.end();
      }
    }
  });

  function alta(datos, { rol = 'RECEPCION', consultorioId = consultorioA } = {}) {
    return request(app)
      .post('/api/pacientes')
      .set('Authorization', `Bearer ${crearToken({ consultorioId, rol })}`)
      .send(datos);
  }

  it.each(['RECEPCION', 'ADMIN_CONSULTORIO'])(
    'permite alta con nombre y teléfono a %s',
    async (rol) => {
      const res = await alta(
        { nombre: ' Ana ', apellido: ' Pérez ', telefono: '11 0000-0000' },
        { rol }
      );
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        nombre: 'Ana',
        apellido: 'Pérez',
        telefono: '1100000000',
        email: null,
        consultorioId: consultorioA,
      });
      expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(Number.isNaN(Date.parse(res.body.creadoEn))).toBe(false);

      const guardado = await cliente.query(
        'SELECT consultorio_id, telefono FROM paciente WHERE id = $1 AND consultorio_id = $2',
        [res.body.id, consultorioA]
      );
      expect(guardado.rows).toEqual([
        { consultorio_id: consultorioA, telefono: '1100000000' },
      ]);
    }
  );

  it('acepta solo email como contacto y lo normaliza', async () => {
    const res = await alta({ nombre: 'Ana', email: ' ANA@EXAMPLE.COM ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: 'ana@example.com',
      telefono: null,
      apellido: null,
    });
  });

  it('normaliza un teléfono con +54 y separadores', async () => {
    const res = await alta({ nombre: 'Ana', telefono: '+54 (11) 0000-0000' });
    expect(res.status).toBe(201);
    expect(res.body.telefono).toBe('+541100000000');
  });

  it('trata teléfono "()" como ausente cuando hay email', async () => {
    const res = await alta({
      nombre: 'Ana',
      telefono: '()',
      email: 'ana@example.com',
    });
    expect(res.status).toBe(201);
    expect(res.body.telefono).toBeNull();

    const guardado = await cliente.query(
      'SELECT telefono FROM paciente WHERE id = $1 AND consultorio_id = $2',
      [res.body.id, consultorioA]
    );
    expect(guardado.rows[0].telefono).toBeNull();
  });

  it.each([
    { nombre: 'Ana' },
    { nombre: 'Ana', telefono: '()', email: null },
    { nombre: 'Ana', telefono: '   ', email: '   ' },
    { nombre: '   ', telefono: '1100000000' },
    { telefono: '1100000000' },
    { nombre: 'Ana', telefono: 'abc', email: 'ana@example.com' },
    { nombre: 'Ana', telefono: 1100000000 },
    { nombre: 'Ana', email: 123 },
  ])('rechaza datos inválidos sin crear una ficha: %j', async (datos) => {
    const res = await alta(datos);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DATOS_INVALIDOS');

    const cantidad = await cliente.query(
      'SELECT count(*)::int AS total FROM paciente WHERE consultorio_id = $1',
      [consultorioA]
    );
    expect(cantidad.rows[0].total).toBe(0);
  });

  it('rechaza un email repetido sin distinguir mayúsculas', async () => {
    const primera = await alta({ nombre: 'Ana', email: 'ana@example.com' });
    expect(primera.status).toBe(201);

    const segunda = await alta({ nombre: 'Otra ficha', email: ' ANA@EXAMPLE.COM ' });
    expect(segunda.status).toBe(409);
    expect(segunda.body.error.code).toBe('EMAIL_DUPLICADO');
  });

  it('permite el mismo email en consultorios diferentes', async () => {
    expect((await alta({ nombre: 'Ana', email: 'ana@example.com' })).status).toBe(201);

    const res = await alta(
      { nombre: 'Otra ficha', email: 'ANA@EXAMPLE.COM' },
      { consultorioId: consultorioB }
    );
    expect(res.status).toBe(201);
    expect(res.body.consultorioId).toBe(consultorioB);
  });

  it('rechaza alta por odontólogo sin permiso administrativo', async () => {
    const res = await alta(
      { nombre: 'Ana', telefono: '1100000000' },
      { rol: 'ODONTOLOGO' }
    );
    expect(res.status).toBe(403);
  });

  it('rechaza alta sin token con el error uniforme de C00', async () => {
    const res = await request(app)
      .post('/api/pacientes')
      .send({ nombre: 'Ana', telefono: '1100000000' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' },
    });
  });

  it('rechaza un consultorio enviado en el body', async () => {
    const res = await alta({
      nombre: 'Ana',
      telefono: '1100000000',
      consultorioId: consultorioB,
    });
    expect(res.status).toBe(422);
  });

  it('toma el consultorio del token aunque query y headers indiquen otro', async () => {
    const res = await request(app)
      .post(`/api/pacientes?consultorioId=${consultorioB}`)
      .set('Authorization', `Bearer ${crearToken({ consultorioId: consultorioA })}`)
      .set('x-tenant-id', consultorioB)
      .send({ nombre: 'Ana', telefono: '1100000000' });

    expect(res.status).toBe(201);
    expect(res.body.consultorioId).toBe(consultorioA);
  });
});

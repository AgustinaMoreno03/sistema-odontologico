import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { crearToken } from './helpers/tokens.js';

describe('C03: GET /api/pacientes', () => {
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

  async function insertar({
    nombre = 'Ana', apellido = 'Pérez', telefono = '1100000000',
    email = null, consultorioId = consultorioA,
  } = {}) {
    const id = randomUUID();
    await cliente.query(
      `INSERT INTO paciente
         (id, consultorio_id, nombre, apellido, telefono, email)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, consultorioId, nombre, apellido, telefono, email]
    );
    return id;
  }

  function buscar(q, extras = {}, rol = 'RECEPCION') {
    return request(app)
      .get('/api/pacientes')
      .query({ q, ...extras })
      .set('Authorization', `Bearer ${crearToken({ consultorioId: consultorioA, rol })}`);
  }

  it.each(['RECEPCION', 'ADMIN_CONSULTORIO', 'ODONTOLOGO'])(
    'permite buscar fichas básicas a %s',
    async (rol) => {
      const id = await insertar();
      const res = await buscar('Ana', {}, rol);
      expect(res.status).toBe(200);
      expect(res.body.map((fila) => fila.id)).toEqual([id]);
      expect(res.body[0]).toMatchObject({
        consultorioId: consultorioA, nombre: 'Ana', apellido: 'Pérez',
      });
    }
  );

  it.each(['JOSE', 'ALVAR'])(
    'busca parcialmente sin distinguir tildes ni mayúsculas: %s',
    async (texto) => {
      const id = await insertar({ nombre: 'José', apellido: 'Álvarez' });
      const res = await buscar(texto);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ id, nombre: 'José', apellido: 'Álvarez' });
    }
  );

  it('devuelve lista vacía cuando no hay coincidencias', async () => {
    await insertar();
    const res = await buscar('Inexistente');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('busca teléfono con +54 y separadores', async () => {
    const id = await insertar({ telefono: '+541100000000' });
    const res = await buscar('+54 (11) 0000-0000');
    expect(res.status).toBe(200);
    expect(res.body.map((fila) => fila.id)).toEqual([id]);
  });

  it('no equipara automáticamente un teléfono internacional con uno local', async () => {
    await insertar({ telefono: '+541100000000' });
    const res = await buscar('1100000000');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('compara email usando las mismas reglas de espacios y mayúsculas del índice', async () => {
    const id = await insertar({ email: ' ANA@EXAMPLE.COM ' });
    const res = await buscar(' ana@example.com ');
    expect(res.status).toBe(200);
    expect(res.body.map((fila) => fila.id)).toEqual([id]);
  });

  it.each(['Ana', '1100000000', 'ana@example.com'])(
    'excluye fichas ajenas al buscar por %s',
    async (texto) => {
      await insertar({ consultorioId: consultorioB, email: 'ana@example.com' });
      const res = await buscar(texto, { consultorioId: consultorioB });
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    }
  );

  it.each(['%', '_', '\\'])('interpreta literalmente el carácter %s', async (texto) => {
    const id = await insertar({ nombre: `Nombre ${texto} ficticio` });
    await insertar({ nombre: 'Otra ficha' });

    const res = await buscar(texto);
    expect(res.status).toBe(200);
    expect(res.body.map((fila) => fila.id)).toEqual([id]);
  });

  it('trata un intento de inyección como texto de búsqueda', async () => {
    await insertar();
    const res = await buscar("' OR 1=1 --");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('limita a 50 y mantiene el orden aunque el cliente solicite más', async () => {
    const idsOrdenados = [];
    for (let numero = 0; numero < 51; numero += 1) {
      idsOrdenados.push(await insertar({
        nombre: `Serie ${String(numero).padStart(2, '0')}`,
        apellido: 'Prueba',
      }));
    }
    await insertar({ nombre: 'Serie ajena', consultorioId: consultorioB });

    const res = await buscar('Serie', { limit: 1000 });
    expect(res.status).toBe(200);
    expect(res.body.map((fila) => fila.id)).toEqual(idsOrdenados.slice(0, 50));
  });

  it.each([[''], ['   '], [['Ana', 'Pérez']]])(
    'rechaza un texto de búsqueda inválido: %j',
    async (texto) => {
      const res = await buscar(texto);
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('DATOS_INVALIDOS');
    }
  );

  it('rechaza búsqueda sin token', async () => {
    const res = await request(app).get('/api/pacientes').query({ q: 'Ana' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' },
    });
  });
});

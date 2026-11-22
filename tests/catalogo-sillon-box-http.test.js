import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { crearFixture, conFixtureConAdmin as conFixture } from './helpers/catalogo-fixtures.js';
import { crearToken } from './helpers/tokens.js';

/**
 * C02 — HTTP de `POST /api/sillon-boxes` (spec "Alta de sillón o box y
 * unicidad por consultorio" y "Autorización por rol"). Cada test arma su
 * propio fixture ficticio (regla dura 1) para poder usar los nombres
 * literales del spec sin depender del orden entre tests.
 */

const crear = (token, cuerpo) =>
  request(crearApp()).post('/api/sillon-boxes').set('Authorization', `Bearer ${token}`).send(cuerpo);

const actualizar = (token, id, cuerpo) =>
  request(crearApp()).put(`/api/sillon-boxes/${id}`).set('Authorization', `Bearer ${token}`).send(cuerpo);

describe('POST /api/sillon-boxes', () => {
  it('201 con la ficha del sillón creado (spec: alta válida de sillón)', async () => {
    await conFixture(async ({ fixture, token }) => {
      const res = await crear(token, { nombre: 'Sillón 1', descripcion: 'Box de ortodoncia' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        consultorioId: fixture.consultorioId,
        nombre: 'Sillón 1',
        descripcion: 'Box de ortodoncia',
        activo: true,
        creadoEn: expect.any(String),
      });
    });
  });

  it('422 DATOS_INVALIDOS con nombre vacío y no se crea ningún registro', async () => {
    await conFixture(async ({ fixture, token }) => {
      for (const nombre of ['', '   ']) {
        const res = await crear(token, { nombre });
        expect(res.status, JSON.stringify(nombre)).toBe(422);
        expect(res.body.error.code).toBe('DATOS_INVALIDOS');
      }

      const { rows } = await fixture.consultar(
        'SELECT count(*)::int AS total FROM sillon_box WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].total).toBe(0);
    });
  });

  it('409 RECURSO_DUPLICADO con "SILLÓN 1" tras "Sillón 1" (RN-TEN-03)', async () => {
    await conFixture(async ({ fixture, token }) => {
      const primero = await crear(token, { nombre: 'Sillón 1' });
      expect(primero.status).toBe(201);

      const segundo = await crear(token, { nombre: 'SILLÓN 1' });

      expect(segundo.status).toBe(409);
      expect(segundo.body).toEqual({
        error: { code: 'RECURSO_DUPLICADO', message: expect.any(String) },
      });

      const { rows } = await fixture.consultar(
        'SELECT count(*)::int AS total FROM sillon_box WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].total).toBe(1);
    });
  });

  it('201 con el mismo nombre de sillón en otro consultorio y el registro queda en B', async () => {
    const a = await crearFixture();
    const b = await crearFixture();
    try {
      const tokenA = crearToken({ usuarioId: randomUUID(), consultorioId: a.consultorioId, rol: 'ADMIN_CONSULTORIO' });
      const tokenB = crearToken({ usuarioId: randomUUID(), consultorioId: b.consultorioId, rol: 'ADMIN_CONSULTORIO' });

      expect((await crear(tokenA, { nombre: 'Sillón 1' })).status).toBe(201);
      const res = await crear(tokenB, { nombre: 'Sillón 1' });

      expect(res.status).toBe(201);
      expect(res.body.consultorioId).toBe(b.consultorioId);
    } finally {
      await a.limpiar();
      await b.limpiar();
    }
  });

  it('403 SIN_PERMISO para RECEPCION y ODONTOLOGO con el catálogo intacto, y 401 sin token', async () => {
    await conFixture(async ({ fixture }) => {
      for (const rol of ['RECEPCION', 'ODONTOLOGO']) {
        const token = crearToken({ usuarioId: randomUUID(), consultorioId: fixture.consultorioId, rol });
        const res = await crear(token, { nombre: `Sillón No Autorizado ${rol}` });
        expect(res.status, rol).toBe(403);
        expect(res.body.error.code).toBe('SIN_PERMISO');
      }

      const sinToken = await request(crearApp()).post('/api/sillon-boxes').send({ nombre: 'Sillón Fantasma' });
      expect(sinToken.status).toBe(401);
      expect(sinToken.body).toEqual({
        error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' },
      });

      const { rows } = await fixture.consultar(
        'SELECT count(*)::int AS total FROM sillon_box WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].total).toBe(0);
    });
  });
});

describe('PUT /api/sillon-boxes/:id (actualización y baja lógica)', () => {
  it('200 con los campos actualizados conservando los no enviados (spec: actualización de datos)', async () => {
    await conFixture(async ({ fixture, token }) => {
      const creada = await crear(token, { nombre: 'Sillón 1', descripcion: 'Box de ortodoncia' });
      expect(creada.status).toBe(201);

      const res = await actualizar(token, creada.body.id, { descripcion: 'Box de cirugía menor' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: creada.body.id,
        consultorioId: fixture.consultorioId,
        nombre: 'Sillón 1', // conservado
        descripcion: 'Box de cirugía menor',
        activo: true,
        creadoEn: creada.body.creadoEn,
      });
    });
  });

  it(':id malformado → 400 DATOS_INVALIDOS, validado ANTES que el cuerpo', async () => {
    await conFixture(async ({ token }) => {
      const res = await actualizar(token, 'no-es-uuid', { consultorioId: 'x' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('DATOS_INVALIDOS');
    });
  });

  it('id válido inexistente → 404 RECURSO_NO_ENCONTRADO', async () => {
    await conFixture(async ({ token }) => {
      const res = await actualizar(token, randomUUID(), { descripcion: 'Nada' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RECURSO_NO_ENCONTRADO');
    });
  });

  it('id de otro consultorio → 404 y el registro ajeno queda intacto (RN-TEN-02)', async () => {
    await conFixture(async ({ token }) => {
      const ajena = await crearFixture();
      try {
        const tokenAjeno = crearToken({
          usuarioId: randomUUID(),
          consultorioId: ajena.consultorioId,
          rol: 'ADMIN_CONSULTORIO',
        });
        const creada = await crear(tokenAjeno, { nombre: 'Sillón Externo', descripcion: 'Original' });
        expect(creada.status).toBe(201);

        const res = await actualizar(token, creada.body.id, { descripcion: 'Hackeado' });

        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('RECURSO_NO_ENCONTRADO');

        const { rows } = await ajena.consultar('SELECT descripcion FROM sillon_box WHERE id = $1', [
          creada.body.id,
        ]);
        expect(rows).toEqual([{ descripcion: 'Original' }]);
      } finally {
        await ajena.limpiar();
      }
    });
  });

  it('renombrar a un nombre ya ocupado → 409 RECURSO_DUPLICADO y el registro queda sin cambios', async () => {
    await conFixture(async ({ fixture, token }) => {
      const primero = await crear(token, { nombre: 'Sillón 1' });
      const segundo = await crear(token, { nombre: 'Sillón 2' });
      expect(primero.status).toBe(201);
      expect(segundo.status).toBe(201);

      const res = await actualizar(token, segundo.body.id, { nombre: 'SILLÓN 1' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('RECURSO_DUPLICADO');

      const { rows } = await fixture.consultar('SELECT nombre FROM sillon_box WHERE id = $1', [
        segundo.body.id,
      ]);
      expect(rows[0].nombre).toBe('Sillón 2');
    });
  });

  it('baja lógica y reactivación: activo false conserva el registro, lo excluye del catálogo y activo true lo devuelve', async () => {
    await conFixture(async ({ fixture, token }) => {
      // Escenario literal del spec con un PROFESIONAL, más su variante en sillón.
      const profesional = await request(crearApp())
        .post('/api/profesionales')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Dra. Baja Lógica' });
      expect(profesional.status).toBe(201);
      const sillon = await crear(token, { nombre: 'Sillón Baja', descripcion: 'Box de prueba' });
      expect(sillon.status).toBe(201);

      const catalogoLleno = await request(crearApp())
        .get('/api/catalogo')
        .set('Authorization', `Bearer ${token}`);
      expect(catalogoLleno.body.profesionales).toHaveLength(1);
      expect(catalogoLleno.body.sillonBoxes).toHaveLength(1);

      // activo false en ambos.
      const bajaProfesional = await request(crearApp())
        .put(`/api/profesionales/${profesional.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });
      expect(bajaProfesional.status).toBe(200);
      expect(bajaProfesional.body.activo).toBe(false);

      const bajaSillon = await actualizar(token, sillon.body.id, { activo: false });
      expect(bajaSillon.status).toBe(200);
      expect(bajaSillon.body.activo).toBe(false);

      // El registro permanece con sus datos y desaparece del catálogo activo.
      const catalogoVacio = await request(crearApp())
        .get('/api/catalogo')
        .set('Authorization', `Bearer ${token}`);
      expect(catalogoVacio.body).toEqual({ profesionales: [], sillonBoxes: [] });

      const { rows } = await fixture.consultar(
        'SELECT nombre, descripcion, activo FROM sillon_box WHERE id = $1',
        [sillon.body.id]
      );
      expect(rows).toEqual([{ nombre: 'Sillón Baja', descripcion: 'Box de prueba', activo: false }]);

      // Reactivación: vuelve al catálogo (spec: "al marcarlo activo verdadero").
      const reactivarSillon = await actualizar(token, sillon.body.id, { activo: true });
      expect(reactivarSillon.status).toBe(200);

      const catalogoReactivado = await request(crearApp())
        .get('/api/catalogo')
        .set('Authorization', `Bearer ${token}`);
      expect(catalogoReactivado.body.sillonBoxes.map((f) => f.nombre)).toEqual(['Sillón Baja']);
    });
  });

  it('403 SIN_PERMISO para RECEPCION y ODONTOLOGO y 401 TOKEN_INVALIDO sin token', async () => {
    await conFixture(async ({ fixture }) => {
      const tokenAdmin = crearToken({
        usuarioId: randomUUID(),
        consultorioId: fixture.consultorioId,
        rol: 'ADMIN_CONSULTORIO',
      });
      const creada = await crear(tokenAdmin, { nombre: 'Sillón Protegido' });
      expect(creada.status).toBe(201);

      for (const rol of ['RECEPCION', 'ODONTOLOGO']) {
        const token = crearToken({ usuarioId: randomUUID(), consultorioId: fixture.consultorioId, rol });
        const res = await actualizar(token, creada.body.id, { activo: false });
        expect(res.status, rol).toBe(403);
        expect(res.body.error.code).toBe('SIN_PERMISO');
      }

      const sinToken = await request(crearApp())
        .put(`/api/sillon-boxes/${creada.body.id}`)
        .send({ activo: false });
      expect(sinToken.status).toBe(401);
      expect(sinToken.body).toEqual({
        error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' },
      });

      const { rows } = await fixture.consultar('SELECT activo FROM sillon_box WHERE id = $1', [
        creada.body.id,
      ]);
      expect(rows[0].activo).toBe(true);
    });
  });
});

import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { conFixtureConAdmin, crearFixture } from './helpers/catalogo-fixtures.js';
import { crearToken } from './helpers/tokens.js';

/**
 * C02 — listados de gestión del catálogo (spec "Listados de gestión del
 * catálogo"): `GET /api/profesionales` y `GET /api/sillon-boxes` reservados
 * a `ADMIN_CONSULTORIO`, con activos e inactivos, su `activo` y su vínculo
 * `usuarioId`. Otros roles → 403 `SIN_PERMISO`; sin token → 401 uniforme.
 */

const listar = (token, ruta) =>
  request(crearApp()).get(ruta).set('Authorization', `Bearer ${token}`);

describe('GET /api/profesionales y GET /api/sillon-boxes (listados de gestión)', () => {
  it('admin lista activos e inactivos con activo y usuarioId (spec)', async () => {
    await conFixtureConAdmin(async ({ fixture, token }) => {
      // Ficticios (regla dura 1): uno activo VINCULADO a un usuario y otro
      // inactivo sin vínculo. El vínculo se fija por SQL en el fixture: el
      // listado solo debe REFLEJARLO (la vinculación es interfaz de módulo,
      // tarea 10.1).
      const { rows: usuarios } = await fixture.consultar(
        "INSERT INTO usuario (id, consultorio_id, rol) VALUES ($1, $2, 'ODONTOLOGO') RETURNING id",
        [randomUUID(), fixture.consultorioId]
      );
      await fixture.consultar(
        'INSERT INTO profesional (consultorio_id, nombre, usuario_id) VALUES ($1, $2, $3)',
        [fixture.consultorioId, 'Dra. Activa Vinculada', usuarios[0].id]
      );
      await fixture.consultar(
        'INSERT INTO profesional (consultorio_id, nombre, activo) VALUES ($1, $2, false)',
        [fixture.consultorioId, 'Dr. Inactivo Sin Vínculo']
      );

      const res = await listar(token, '/api/profesionales');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      const porNombre = new Map(res.body.map((f) => [f.nombre, f]));
      expect(porNombre.get('Dra. Activa Vinculada')).toEqual({
        id: expect.any(String),
        consultorioId: fixture.consultorioId,
        nombre: 'Dra. Activa Vinculada',
        matricula: null,
        email: null,
        usuarioId: usuarios[0].id,
        activo: true,
        creadoEn: expect.any(String),
      });
      expect(porNombre.get('Dr. Inactivo Sin Vínculo')).toEqual(
        expect.objectContaining({ usuarioId: null, activo: false })
      );
    });
  });

  it('admin lista los sillones/boxes activos e inactivos con su estado', async () => {
    await conFixtureConAdmin(async ({ fixture, token }) => {
      await fixture.consultar(
        'INSERT INTO sillon_box (consultorio_id, nombre, activo) VALUES ($1, $2, false)',
        [fixture.consultorioId, 'Sillón Retirado']
      );
      await fixture.consultar(
        'INSERT INTO sillon_box (consultorio_id, nombre, descripcion) VALUES ($1, $2, $3)',
        [fixture.consultorioId, 'Sillón 1', 'Box de ortodoncia']
      );

      const res = await listar(token, '/api/sillon-boxes');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      const porNombre = new Map(res.body.map((f) => [f.nombre, f]));
      expect(porNombre.get('Sillón Retirado')).toEqual(
        expect.objectContaining({ activo: false })
      );
      expect(porNombre.get('Sillón 1')).toEqual(
        expect.objectContaining({ descripcion: 'Box de ortodoncia', activo: true })
      );
    });
  });

  it('listado de un consultorio sin registros → 200 con lista vacía', async () => {
    await conFixtureConAdmin(async ({ token }) => {
      for (const ruta of ['/api/profesionales', '/api/sillon-boxes']) {
        const res = await listar(token, ruta);
        expect(res.status, ruta).toBe(200);
        expect(res.body, ruta).toEqual([]);
      }
    });
  });

  it('RECEPCION y ODONTOLOGO reciben 403 SIN_PERMISO en ambos listados', async () => {
    await conFixtureConAdmin(async ({ fixture }) => {
      for (const rol of ['RECEPCION', 'ODONTOLOGO']) {
        const token = crearToken({ usuarioId: randomUUID(), consultorioId: fixture.consultorioId, rol });
        for (const ruta of ['/api/profesionales', '/api/sillon-boxes']) {
          const res = await listar(token, ruta);
          expect(res.status, `${rol} ${ruta}`).toBe(403);
          expect(res.body.error.code).toBe('SIN_PERMISO');
        }
      }
    });
  });

  it('sin token responden 401 TOKEN_INVALIDO (mensaje uniforme de C00)', async () => {
    for (const ruta of ['/api/profesionales', '/api/sillon-boxes']) {
      const res = await request(crearApp()).get(ruta);
      expect(res.status, ruta).toBe(401);
      expect(res.body).toEqual({ error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' } });
    }
  });
});

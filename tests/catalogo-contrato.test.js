import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';
import { crearFixture, conFixtureConAdmin as conFixtureAdmin } from './helpers/catalogo-fixtures.js';

/**
 * C02 — contrato de entrada de los cuerpos HTTP (spec "Contrato de entrada
 * de los cuerpos HTTP", design D5/D6). Validación estricta hecha a mano en
 * la capa de rutas (sin dependencias nuevas): SOLO los campos documentados;
 * `consultorioId` (regla dura 2), `usuarioId`, tipos inválidos y campos
 * desconocidos → 422 `DATOS_INVALIDOS` SIN escribir nada; `PUT` sin campos →
 * 422. Los mismos rechazos valen para ambas entidades y para alta y
 * actualización.
 */

const contar = (fixture, tabla) =>
  fixture.consultar(`SELECT count(*)::int AS total FROM ${tabla} WHERE consultorio_id = $1`, [
    fixture.consultorioId,
  ]).then((r) => r.rows[0].total);

const post = (token, ruta, cuerpo) =>
  request(crearApp()).post(ruta).set('Authorization', `Bearer ${token}`).send(cuerpo);

const put = (token, ruta, id, cuerpo) =>
  request(crearApp()).put(`${ruta}/${id}`).set('Authorization', `Bearer ${token}`).send(cuerpo);

const esperar422 = (res, detalle) => {
  expect(res.status, detalle).toBe(422);
  expect(res.body.error.code).toBe('DATOS_INVALIDOS');
};

describe('contrato de entrada: POST /api/profesionales y PUT /api/profesionales/:id', () => {
  it('cuerpo con los campos documentados → 201 (spec)', async () => {
    await conFixtureAdmin(async ({ fixture, token }) => {
      const res = await post(token, '/api/profesionales', { nombre: 'Dra. Ana Ruiz', email: 'ana@example.com' });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('ana@example.com');
    });
  });

  it('consultorioId en el cuerpo → 422 y no se escribe nada en ningún consultorio', async () => {
    await conFixtureAdmin(async ({ fixture, token }) => {
      const ajeno = await crearFixture();
      try {
        const alta = await post(token, '/api/profesionales', {
          nombre: 'Dra. Intrusa',
          consultorioId: ajeno.consultorioId,
        });
        esperar422(alta, 'alta con consultorioId');
        expect(await contar(fixture, 'profesional')).toBe(0);
        expect(await contar(ajeno, 'profesional')).toBe(0);

        // En actualización: 422 y el registro queda sin cambios.
        const creada = await post(token, '/api/profesionales', { nombre: 'Dra. Ana Ruiz' });
        const actualizacion = await put(token, '/api/profesionales', creada.body.id, {
          nombre: 'Dra. Cambiada',
          consultorioId: ajeno.consultorioId,
        });
        esperar422(actualizacion, 'PUT con consultorioId');
        const { rows } = await fixture.consultar('SELECT nombre FROM profesional WHERE id = $1', [
          creada.body.id,
        ]);
        expect(rows[0].nombre).toBe('Dra. Ana Ruiz');
      } finally {
        await ajeno.limpiar();
      }
    });
  });

  it('usuarioId en el cuerpo → 422 sin escribir nada (el vínculo es solo interfaz de módulo)', async () => {
    await conFixtureAdmin(async ({ fixture, token }) => {
      const alta = await post(token, '/api/profesionales', {
        nombre: 'Dra. Vinculada',
        usuarioId: randomUUID(),
      });
      esperar422(alta, 'alta con usuarioId');
      expect(await contar(fixture, 'profesional')).toBe(0);

      const creada = await post(token, '/api/profesionales', { nombre: 'Dra. Ana Ruiz' });
      const actualizacion = await put(token, '/api/profesionales', creada.body.id, {
        usuarioId: randomUUID(),
      });
      esperar422(actualizacion, 'PUT con usuarioId');
      const { rows } = await fixture.consultar('SELECT usuario_id FROM profesional WHERE id = $1', [
        creada.body.id,
      ]);
      expect(rows[0].usuario_id).toBeNull();
    });
  });

  it('tipos inválidos y campos desconocidos → 422 en alta y actualización, sin escribir nada', async () => {
    await conFixtureAdmin(async ({ fixture, token }) => {
      const creada = await post(token, '/api/profesionales', { nombre: 'Dra. Ana Ruiz' });
      expect(creada.status).toBe(201);

      const rechazos = [
        { detalle: 'nombre numérico', alta: { nombre: 123 }, put: { nombre: 123 } },
        { detalle: 'matrícula booleana', alta: { nombre: 'X', matricula: true }, put: { matricula: true } },
        { detalle: 'email objeto', alta: { nombre: 'X', email: {} }, put: { email: {} } },
        { detalle: 'activo textual', alta: { nombre: 'X', activo: 'no' }, put: { activo: 'no' } },
        { detalle: 'campo desconocido', alta: { nombre: 'X', apodo: 'Dra' }, put: { apodo: 'Dra' } },
      ];

      for (const { detalle, alta, put: cuerpoPut } of rechazos) {
        esperar422(await post(token, '/api/profesionales', alta), `alta: ${detalle}`);
        esperar422(
          await put(token, '/api/profesionales', creada.body.id, cuerpoPut),
          `PUT: ${detalle}`
        );
      }

      // Sin escrituras: sigue habiendo una sola ficha, intacta.
      expect(await contar(fixture, 'profesional')).toBe(1);
      const { rows } = await fixture.consultar('SELECT nombre, matricula, email FROM profesional WHERE id = $1', [
        creada.body.id,
      ]);
      expect(rows).toEqual([{ nombre: 'Dra. Ana Ruiz', matricula: null, email: null }]);
    });
  });

  it('PUT sin campos → 422 DATOS_INVALIDOS', async () => {
    await conFixtureAdmin(async ({ fixture, token }) => {
      const creada = await post(token, '/api/profesionales', { nombre: 'Dra. Ana Ruiz' });

      esperar422(await put(token, '/api/profesionales', creada.body.id, {}), 'PUT vacío');
    });
  });

  it('el email con mayúsculas y espacios se guarda recortado y en minúsculas en alta y actualización', async () => {
    await conFixtureAdmin(async ({ fixture, token }) => {
      const alta = await post(token, '/api/profesionales', {
        nombre: 'Dra. Ana Ruiz',
        email: ' ANA@EXAMPLE.COM ',
      });
      expect(alta.status).toBe(201);
      expect(alta.body.email).toBe('ana@example.com');

      const actualizacion = await put(token, '/api/profesionales', alta.body.id, {
        email: ' OTRA@EXAMPLE.COM ',
      });
      expect(actualizacion.status).toBe(200);
      expect(actualizacion.body.email).toBe('otra@example.com');
    });
  });
});

describe('contrato de entrada: POST /api/sillon-boxes y PUT /api/sillon-boxes/:id', () => {
  it('cuerpo con los campos documentados → 201 (spec)', async () => {
    await conFixtureAdmin(async ({ token }) => {
      const res = await post(token, '/api/sillon-boxes', { nombre: 'Sillón 1' });

      expect(res.status).toBe(201);
    });
  });

  it('consultorioId y usuarioId en el cuerpo → 422 sin escribir nada', async () => {
    await conFixtureAdmin(async ({ fixture, token }) => {
      esperar422(
        await post(token, '/api/sillon-boxes', { nombre: 'Sillón Intruso', consultorioId: randomUUID() }),
        'alta con consultorioId'
      );
      esperar422(
        await post(token, '/api/sillon-boxes', { nombre: 'Sillón Intruso', usuarioId: randomUUID() }),
        'alta con usuarioId'
      );
      expect(await contar(fixture, 'sillon_box')).toBe(0);

      const creada = await post(token, '/api/sillon-boxes', { nombre: 'Sillón 1' });
      esperar422(
        await put(token, '/api/sillon-boxes', creada.body.id, { consultorioId: randomUUID() }),
        'PUT con consultorioId'
      );
      esperar422(
        await put(token, '/api/sillon-boxes', creada.body.id, { usuarioId: randomUUID() }),
        'PUT con usuarioId'
      );
      const { rows } = await fixture.consultar('SELECT nombre FROM sillon_box WHERE id = $1', [
        creada.body.id,
      ]);
      expect(rows[0].nombre).toBe('Sillón 1');
    });
  });

  it('tipos inválidos y campos desconocidos → 422 en alta y actualización, sin escribir nada', async () => {
    await conFixtureAdmin(async ({ fixture, token }) => {
      const creada = await post(token, '/api/sillon-boxes', { nombre: 'Sillón 1' });
      expect(creada.status).toBe(201);

      const rechazos = [
        { detalle: 'nombre numérico', alta: { nombre: 42 }, put: { nombre: 42 } },
        { detalle: 'descripción booleana', alta: { nombre: 'X', descripcion: true }, put: { descripcion: true } },
        { detalle: 'activo textual', alta: { nombre: 'X', activo: 'sí' }, put: { activo: 'sí' } },
        { detalle: 'campo desconocido', alta: { nombre: 'X', email: 'x@example.com' }, put: { email: 'x@example.com' } },
      ];

      for (const { detalle, alta, put: cuerpoPut } of rechazos) {
        esperar422(await post(token, '/api/sillon-boxes', alta), `alta: ${detalle}`);
        esperar422(
          await put(token, '/api/sillon-boxes', creada.body.id, cuerpoPut),
          `PUT: ${detalle}`
        );
      }

      expect(await contar(fixture, 'sillon_box')).toBe(1);
    });
  });

  it('PUT sin campos → 422 DATOS_INVALIDOS', async () => {
    await conFixtureAdmin(async ({ token }) => {
      const creada = await post(token, '/api/sillon-boxes', { nombre: 'Sillón 1' });

      esperar422(await put(token, '/api/sillon-boxes', creada.body.id, {}), 'PUT vacío');
    });
  });

  it('la descripción con espacios se guarda recortada en alta y actualización', async () => {
    await conFixtureAdmin(async ({ token }) => {
      const alta = await post(token, '/api/sillon-boxes', {
        nombre: 'Sillón 1',
        descripcion: '  Box de ortodoncia  ',
      });
      expect(alta.status).toBe(201);
      expect(alta.body.descripcion).toBe('Box de ortodoncia');

      const actualizacion = await put(token, '/api/sillon-boxes', alta.body.id, {
        descripcion: '  Box de cirugía  ',
      });
      expect(actualizacion.status).toBe(200);
      expect(actualizacion.body.descripcion).toBe('Box de cirugía');
    });
  });
});

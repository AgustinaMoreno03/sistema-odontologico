import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { crearToken } from './helpers/tokens.js';

const CONSULTORIO = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

describe('integración de prestaciones en la app', () => {
  let cliente;

  beforeAll(async () => {
    cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    await cliente.query('INSERT INTO consultorio (id) VALUES ($1)', [CONSULTORIO]);
  });

  afterAll(async () => {
    await cliente.query('DELETE FROM prestacion WHERE consultorio_id = $1', [CONSULTORIO]);
    await cliente.query('DELETE FROM consultorio WHERE id = $1', [CONSULTORIO]);
    await cliente.end();
  });

  it('monta POST y GET /api/prestaciones con auth y persistencia reales', async () => {
    const app = crearApp();
    const authorization = `Bearer ${crearToken({ consultorioId: CONSULTORIO, rol: 'ADMIN_CONSULTORIO' })}`;
    const alta = await request(app).post('/api/prestaciones').set('Authorization', authorization).send({ nombre: 'Control integrado', duracionMin: 25 });
    const listado = await request(app).get('/api/prestaciones').set('Authorization', authorization);

    expect(alta.status).toBe(201);
    expect(alta.body).toMatchObject({ nombre: 'Control integrado', duracionMin: 25, activo: true });
    expect(listado.status).toBe(200);
    expect(listado.body).toEqual([expect.objectContaining({ id: alta.body.id, nombre: 'Control integrado' })]);
  });
});

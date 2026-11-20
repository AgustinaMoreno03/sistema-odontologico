import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearApp } from '../src/app.js';

/**
 * Spec development-environment — "Base inaccesible con recuperación sin
 * reinicio" y spec auth R2 — "Health exento de autenticación".
 * Solo se mockea la frontera externa (el chequeo de conexión a la base);
 * el resto de la app es la real (sin mockear la capa SQL).
 */
describe('GET /health', () => {
  it('responde 200 cuando la base está sana (chequeo real)', async () => {
    const app = crearApp();

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('responde 503 con JSON seguro cuando el chequeo de la base falla', async () => {
    const app = crearApp({
      chequearBase: async () => {
        throw new Error('connection refused 127.0.0.1:5432 (detalle sensible)');
      },
    });

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'BASE_NO_DISPONIBLE', message: 'Base de datos no disponible' },
    });
    // Nunca credenciales, stack ni el detalle interno de la falla.
    const cuerpo = JSON.stringify(res.body);
    expect(cuerpo).not.toMatch(/connection refused|detalle sensible|password|stack/i);
  });

  it('sin token nunca responde 401 (health exento de autenticación)', async () => {
    const app = crearApp();

    const res = await request(app).get('/health');

    expect(res.status).not.toBe(401);
    expect([200, 503]).toContain(res.status);
  });

  it('sigue viva tras un 503 y recupera 200 sin reiniciar la API', async () => {
    let baseCaida = true;
    const app = crearApp({
      chequearBase: async () => {
        if (baseCaida) throw new Error('db down');
      },
    });

    const primera = await request(app).get('/health');
    expect(primera.status).toBe(503);

    baseCaida = false;
    const segunda = await request(app).get('/health');
    expect(segunda.status).toBe(200);
    expect(segunda.body).toEqual({ status: 'ok' });
  });

  it('no expone el header X-Powered-By (fingerprinting del framework)', async () => {
    const app = crearApp();

    const res = await request(app).get('/health');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

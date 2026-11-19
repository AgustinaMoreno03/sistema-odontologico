import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, manejadorErrores } from '../src/errores.js';

/**
 * Design D6 — manejador de errores centralizado: forma única
 * `{ error: { code, message } }`, errores operacionales → 4xx con mensaje
 * seguro; inesperados → 500 + `console.error` con stack, jamás en la respuesta.
 */
describe('manejador de errores centralizado (ApiError)', () => {
  it('un ApiError responde con su status y la forma única { error: { code, message } }', async () => {
    const app = express();
    app.get('/ruta-protegida', () => {
      throw new ApiError(401, 'TOKEN_INVALIDO', 'No autorizado');
    });
    app.use(manejadorErrores);

    const res = await request(app).get('/ruta-protegida');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' } });
  });

  it('un ApiError con otro status operacional respeta ese status y la misma forma única', async () => {
    const app = express();
    app.get('/validacion', () => {
      throw new ApiError(400, 'DATOS_INVALIDOS', 'Datos inválidos');
    });
    app.use(manejadorErrores);

    const res = await request(app).get('/validacion');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'DATOS_INVALIDOS', message: 'Datos inválidos' } });
    // Nunca se filtra el stack de un error operacional.
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.js:/);
  });

  it('un error inesperado responde 500 seguro, sin stack en la respuesta, y loguea el stack con console.error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const app = express();
      app.get('/boom', () => {
        throw new Error('detalle interno sensible que no debe filtrarse');
      });
      app.use(manejadorErrores);

      const res = await request(app).get('/boom');

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor' },
      });
      expect(JSON.stringify(res.body)).not.toMatch(/sensible/);
      expect(spy).toHaveBeenCalled();
      // D6: el stack (con la causa) va SOLO al log, nunca a la respuesta.
      expect(String(spy.mock.calls[0][0])).toMatch(/Error interno del servidor|sensible/);
    } finally {
      spy.mockRestore();
    }
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearAppProtegida } from './helpers/appProtegida.js';
import { crearToken } from './helpers/tokens.js';

/**
 * Task 4.5 — helper de tokens de test (design D2): soporte de
 * implementación de la suite, sin requisito propio en el spec auth.
 * Verifica que el helper emita tokens ficticios firmados con el secreto de
 * pruebas y que sus modos de falla produzcan 401 instantáneos.
 */
const USUARIO_A = '00000000-0000-4000-8000-000000000001';
const CONSULTORIO_A = '00000000-0000-4000-8000-000000000002';

function expect401Seguro(res) {
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' } });
}

describe('helper de tests de tokens (design D2 — soporte de implementación)', () => {
  it('token del helper es aceptado con su triple exacto', async () => {
    const app = crearAppProtegida();
    const token = crearToken({
      usuarioId: USUARIO_A,
      consultorioId: CONSULTORIO_A,
      rol: 'RECEPCION',
    });

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.auth).toEqual({
      usuarioId: USUARIO_A,
      consultorioId: CONSULTORIO_A,
      rol: 'RECEPCION',
    });
  });

  it('helper con un secreto distinto → 401 (firma que el middleware no acepta)', async () => {
    const app = crearAppProtegida();
    const token = crearToken({ secreto: 'otro-secreto-ficticio' });

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect401Seguro(res);
  });

  it('helper en modo expirado → 401 instantáneo, sin esperar tiempo real', async () => {
    const app = crearAppProtegida();
    const inicio = Date.now();
    const token = crearToken({ expirado: true });

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect401Seguro(res);
    // El token nace caducado (exp en el pasado): nada de dormir en el test.
    expect(Date.now() - inicio).toBeLessThan(1000);
  });

  it('helper en modo rol "PACIENTE" → 401, para ejercitar el rechazo DD-16', async () => {
    const app = crearAppProtegida();
    const token = crearToken({ rol: 'PACIENTE' });

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect401Seguro(res);
  });
});

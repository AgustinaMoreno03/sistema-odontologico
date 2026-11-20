import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { crearAppProtegida } from './helpers/appProtegida.js';
import { crearToken } from './helpers/tokens.js';

/**
 * Spec auth — R1 (middleware adjunta el triple), R2 (ausente/malformado),
 * R3 (roles cerrados DD-17) y R4 (consultorioId y rol solo desde el token).
 * Los tokens se emiten con el helper de la task 4.5 (design D2), firmado
 * con el secreto de pruebas que inyecta tests/setup/setup.js.
 * Fixtures ficticias (regla dura 1). Sin base de datos: el middleware es
 * puro HTTP + crypto.
 */
const USUARIO_A = '00000000-0000-4000-8000-000000000001';
const CONSULTORIO_A = '00000000-0000-4000-8000-000000000002';
const CONSULTORIO_B = '00000000-0000-4000-8000-000000000003';

/** Token con header `alg: "none"` y firma vacía, armado a mano. */
function tokenAlgoritmoNone(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const cuerpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${cuerpo}.`;
}

/** 401 seguro: forma única D6, sin contexto y sin revelar la causa. */
function expect401Seguro(res) {
  expect(res.status).toBe(401);
  expect(res.body).toEqual({ error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' } });
  const cuerpo = JSON.stringify(res.body);
  expect(cuerpo).not.toMatch(/jwt|expired|signature|algorithm|malformed|stack|\.js:/i);
}

describe('spec auth R1 — Middleware que adjunta el triple desde un token válido', () => {
  it('Token válido adjunta el triple exacto (los valores salen del token, no de la query ni de headers)', async () => {
    const app = crearAppProtegida();
    const token = crearToken({ usuarioId: USUARIO_A, consultorioId: CONSULTORIO_A, rol: 'RECEPCION' });

    const res = await request(app)
      .get(`/protegido?consultorioId=${CONSULTORIO_B}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', CONSULTORIO_B);

    expect(res.status).toBe(200);
    expect(res.body.auth).toEqual({
      usuarioId: USUARIO_A,
      consultorioId: CONSULTORIO_A,
      rol: 'RECEPCION',
    });
  });

  it('Token forjado firmado con un secreto distinto → 401 seguro sin contexto', async () => {
    const app = crearAppProtegida();
    const token = crearToken({
      usuarioId: USUARIO_A,
      consultorioId: CONSULTORIO_A,
      rol: 'RECEPCION',
      secreto: 'otro-secreto-ficticio',
    });

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect401Seguro(res);
    expect(res.body.auth).toBeUndefined();
  });

  it('Claims alterados conservando la firma original → 401 seguro sin contexto', async () => {
    const app = crearAppProtegida();
    const token = crearToken({ usuarioId: USUARIO_A, consultorioId: CONSULTORIO_A, rol: 'RECEPCION' });
    const [header, , firma] = token.split('.');
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    payload.rol = 'ADMIN_CONSULTORIO';
    const alterado = `${header}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${firma}`;

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${alterado}`);

    expect401Seguro(res);
    expect(res.body.auth).toBeUndefined();
  });

  it('Token correcto pero expirado → 401 (la caducidad se verifica desde el inicio)', async () => {
    const app = crearAppProtegida();
    const token = crearToken({
      usuarioId: USUARIO_A,
      consultorioId: CONSULTORIO_A,
      rol: 'RECEPCION',
      expirado: true,
    });

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect401Seguro(res);
    expect(res.body.auth).toBeUndefined();
  });

  it('Algoritmo no permitido: alg "none" → 401 seguro sin contexto', async () => {
    const app = crearAppProtegida();
    const token = tokenAlgoritmoNone({
      usuarioId: USUARIO_A,
      consultorioId: CONSULTORIO_A,
      rol: 'RECEPCION',
    });

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect401Seguro(res);
    expect(res.body.auth).toBeUndefined();
  });

  it('Algoritmo no permitido: HS512 (distinto del allowlist HS256) → 401 seguro sin contexto', async () => {
    const app = crearAppProtegida();
    const token = crearToken({
      usuarioId: USUARIO_A,
      consultorioId: CONSULTORIO_A,
      rol: 'RECEPCION',
      algoritmo: 'HS512',
    });

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect401Seguro(res);
    expect(res.body.auth).toBeUndefined();
  });
});

describe('spec auth R1 — Claims requeridos faltantes (task 4.7)', () => {
  // Triage de cobertura: 3 claim ausente + 3 claim vacío + 1 claim no texto.
  // Todos deben caer en el MISMO 401 genérico D6, sin contexto adjunto.
  it.each(['usuarioId', 'consultorioId', 'rol'])(
    'Token firmado correctamente pero sin el claim %s → 401 TOKEN_INVALIDO genérico sin contexto',
    async (claim) => {
      const app = crearAppProtegida();
      const token = crearToken({ omitir: [claim] });

      const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

      expect401Seguro(res);
      expect(res.body.auth).toBeUndefined();
    }
  );

  it.each(['usuarioId', 'consultorioId', 'rol'])(
    'Token firmado correctamente con el claim %s vacío ("") → 401 TOKEN_INVALIDO genérico sin contexto',
    async (claim) => {
      const app = crearAppProtegida();
      const token = crearToken({ [claim]: '' });

      const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

      expect401Seguro(res);
      expect(res.body.auth).toBeUndefined();
    }
  );

  it('Token firmado con usuarioId presente pero NO texto (numérico 12345) → 401 TOKEN_INVALIDO genérico sin contexto', async () => {
    const app = crearAppProtegida();
    const token = crearToken({ usuarioId: 12345 });

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect401Seguro(res);
    expect(res.body.auth).toBeUndefined();
  });
});

describe('spec auth R2 — Token ausente o malformado rechazado con 401 seguro', () => {
  it('Ruta protegida sin Authorization → 401 con la forma de error consistente y sin contexto', async () => {
    const app = crearAppProtegida();

    const res = await request(app).get('/protegido');

    expect401Seguro(res);
    expect(res.body.auth).toBeUndefined();
  });

  it('Contenido que no es un JWT (basura en Bearer) → 401 sin revelar si fue firma, estructura o caducidad', async () => {
    const app = crearAppProtegida();

    const res = await request(app)
      .get('/protegido')
      .set('Authorization', 'Bearer basura-que-no-es-un-jwt!!!');

    expect401Seguro(res);
    expect(res.body.auth).toBeUndefined();
  });

  it('Health exento de autenticación → 200 sin token', async () => {
    const app = crearApp();

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('spec auth R3 — Conjunto cerrado de roles válidos (DD-17)', () => {
  it('Los tres roles vigentes son aceptados y quedan en el contexto sin normalizar', async () => {
    const roles = ['ADMIN_CONSULTORIO', 'ODONTOLOGO', 'RECEPCION'];
    for (const rol of roles) {
      const app = crearAppProtegida();
      const token = crearToken({ usuarioId: USUARIO_A, consultorioId: CONSULTORIO_A, rol });

      const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.auth.rol).toBe(rol);
    }
  });

  it('Rol de paciente rechazado → 401 (DD-16: el paciente no es un rol del sistema)', async () => {
    const app = crearAppProtegida();
    const token = crearToken({ usuarioId: USUARIO_A, consultorioId: CONSULTORIO_A, rol: 'PACIENTE' });

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect401Seguro(res);
    expect(res.body.auth).toBeUndefined();
  });

  it('Variante fuera del conjunto exacto (rol "admin") → 401, sin normalización implícita', async () => {
    const app = crearAppProtegida();
    const token = crearToken({ usuarioId: USUARIO_A, consultorioId: CONSULTORIO_A, rol: 'admin' });

    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);

    expect401Seguro(res);
    expect(res.body.auth).toBeUndefined();
  });
});

describe('spec auth R4 — consultorioId y rol siempre desde el token, nunca del cliente', () => {
  it('Valores de consultorio enviados por el cliente ignorados (?consultorioId=B y x-tenant-id: B)', async () => {
    const app = crearAppProtegida();
    const token = crearToken({ usuarioId: USUARIO_A, consultorioId: CONSULTORIO_A, rol: 'RECEPCION' });

    const res = await request(app)
      .get(`/protegido?consultorioId=${CONSULTORIO_B}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', CONSULTORIO_B);

    expect(res.status).toBe(200);
    expect(res.body.auth.consultorioId).toBe(CONSULTORIO_A);
    // Los headers de tenant del cliente se descartan por completo.
    expect(res.body.headersTenant).toEqual([]);
  });

  it('Token del consultorio A nunca puede operar como B (query + body + headers)', async () => {
    const app = crearAppProtegida();
    const token = crearToken({ usuarioId: USUARIO_A, consultorioId: CONSULTORIO_A, rol: 'ODONTOLOGO' });

    const res = await request(app)
      .post(`/protegido?consultorioId=${CONSULTORIO_B}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', CONSULTORIO_B)
      .set('x-tenant-consultorio', CONSULTORIO_B)
      .send({ consultorioId: CONSULTORIO_B, rol: 'ADMIN_CONSULTORIO' });

    expect(res.status).toBe(200);
    expect(res.body.auth.consultorioId).toBe(CONSULTORIO_A);
    expect(res.body.auth.consultorioId).not.toBe(CONSULTORIO_B);
    expect(res.body.auth.rol).toBe('ODONTOLOGO');
    expect(res.body.headersTenant).toEqual([]);
  });
});

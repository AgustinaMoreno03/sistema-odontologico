import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { hashearPassword } from '../src/modules/auth/servicios.js';
import { crearUsuario } from '../src/modules/auth/repositorios.js';
import { obtenerUrlBaseTest } from './setup/urls.js';

const PASSWORD = 'clave-ficticia-de-prueba-2026';
const fixtures = [];

async function crearUsuarioDePrueba() {
  const consultorioId = randomUUID();
  const usuarioId = randomUUID();
  const email = `login-${usuarioId}@example.test`;
  const passwordHash = await hashearPassword(PASSWORD);
  const cliente = new pg.Client({ connectionString: obtenerUrlBaseTest() });
  await cliente.connect();
  try {
    await cliente.query('INSERT INTO consultorio (id) VALUES ($1)', [consultorioId]);
  } finally {
    await cliente.end();
  }

  fixtures.push({ consultorioId, usuarioId });
  const usuario = await crearUsuario({
    id: usuarioId,
    consultorioId,
    rol: 'RECEPCION',
    email,
    passwordHash,
  });
  return { usuario, consultorioId, usuarioId, email, passwordHash };
}

afterEach(async () => {
  if (!fixtures.length) return;
  const cliente = new pg.Client({ connectionString: obtenerUrlBaseTest() });
  await cliente.connect();
  try {
    for (const fixture of fixtures.splice(0)) {
      await cliente.query('DELETE FROM usuario WHERE id = $1', [fixture.usuarioId]);
      await cliente.query('DELETE FROM consultorio WHERE id = $1', [fixture.consultorioId]);
    }
  } finally {
    await cliente.end();
  }
});

describe('login con email y contraseña', () => {
  it('login válido devuelve un JWT con exp exactamente ocho horas después de iat', async () => {
    const { email } = await crearUsuarioDePrueba();

    const respuesta = await request(crearApp())
      .post('/auth/login')
      .send({ email, password: PASSWORD });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.token).toEqual(expect.any(String));
    const [, cuerpo] = respuesta.body.token.split('.');
    const claims = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    expect(claims.exp - claims.iat).toBe(8 * 60 * 60);
  });

  it('email desconocido y contraseña incorrecta responden el mismo mensaje genérico', async () => {
    const { email } = await crearUsuarioDePrueba();
    const app = crearApp();

    const emailDesconocido = await request(app)
      .post('/auth/login')
      .send({ email: `desconocido-${randomUUID()}@example.test`, password: PASSWORD });
    const passwordIncorrecta = await request(app)
      .post('/auth/login')
      .send({ email, password: 'otra-clave-ficticia' });

    expect(emailDesconocido.status).toBe(401);
    expect(passwordIncorrecta.status).toBe(401);
    expect(emailDesconocido.body).toEqual(passwordIncorrecta.body);
    expect(emailDesconocido.body.error.message).toBe('Usuario o contraseña incorrectos');
  });

  it('la contraseña se persiste como hash salado y nunca como texto plano', async () => {
    const { usuario, passwordHash } = await crearUsuarioDePrueba();

    expect(passwordHash).not.toBe(PASSWORD);
    expect(passwordHash).toMatch(/^scrypt\$/);
    expect(usuario.password_hash).toBe(passwordHash);
    expect(usuario.password_hash).not.toBe(PASSWORD);
  });
});

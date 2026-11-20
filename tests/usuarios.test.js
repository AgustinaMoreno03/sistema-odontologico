import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { crearUsuario } from '../src/modules/auth/repositorios.js';
import { hashearPassword } from '../src/modules/auth/servicios.js';
import { crearToken } from './helpers/tokens.js';
import { obtenerUrlBaseTest } from './setup/urls.js';

const PASSWORD = 'clave-ficticia-admin-c01';
const consultorios = [];
const usuarios = [];

async function crearUsuarioDePrueba(consultorioId, rol, email = undefined) {
  const usuarioId = randomUUID();
  const usuario = await crearUsuario({
    id: usuarioId,
    consultorioId,
    rol,
    email: email ?? `usuario-${usuarioId}@example.test`,
    passwordHash: await hashearPassword(PASSWORD),
  });
  usuarios.push(usuarioId);
  return usuario;
}

async function crearContexto(rol = 'ADMIN_CONSULTORIO') {
  const { crearConsultorio } = await import('../src/modules/consultorios/repositorios.js');
  const consultorio = await crearConsultorio();
  consultorios.push(consultorio.id);
  const usuario = await crearUsuarioDePrueba(consultorio.id, rol);
  const token = crearToken({
    usuarioId: usuario.id,
    consultorioId: consultorio.id,
    rol,
  });
  return { consultorioId: consultorio.id, usuario, token };
}

afterEach(async () => {
  const cliente = new pg.Client({ connectionString: obtenerUrlBaseTest() });
  await cliente.connect();
  try {
    if (usuarios.length) {
      await cliente.query('DELETE FROM usuario WHERE id = ANY($1::uuid[])', [usuarios.splice(0)]);
    }
    if (consultorios.length) {
      await cliente.query('DELETE FROM consultorio WHERE id = ANY($1::uuid[])', [
        consultorios.splice(0),
      ]);
    }
  } finally {
    await cliente.end();
  }
});

describe('gestión de usuarios por consultorio', () => {
  it('POST /consultorios devuelve 404 sin ofrecer registro público', async () => {
    const respuesta = await request(crearApp()).post('/consultorios').send({});

    expect(respuesta.status).toBe(404);
  });

  it('un admin crea usuarios con cualquiera de los tres roles (201) en su consultorio', async () => {
    const { consultorioId, token } = await crearContexto();
    const roles = ['ADMIN_CONSULTORIO', 'ODONTOLOGO', 'RECEPCION'];

    for (const rol of roles) {
      const respuesta = await request(crearApp())
        .post('/usuarios')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: `nuevo-${rol.toLowerCase()}-${randomUUID()}@example.test`,
          password: 'clave-ficticia-nuevo-usuario',
          rol,
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body).toMatchObject({ consultorioId, rol });
      expect(respuesta.body).not.toHaveProperty('password');
      expect(respuesta.body).not.toHaveProperty('password_hash');
      usuarios.push(respuesta.body.usuarioId);
    }
  });

  it.each(['ODONTOLOGO', 'RECEPCION'])(
    '%s recibe 403 al intentar crear un usuario',
    async (rol) => {
      const { token } = await crearContexto(rol);

      const respuesta = await request(crearApp())
        .post('/usuarios')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: `no-autorizado-${randomUUID()}@example.test`,
          password: 'clave-ficticia-nuevo-usuario',
          rol: 'RECEPCION',
        });

      expect(respuesta.status).toBe(403);
    }
  );

  it.each([
    [{ password: 'clave-ficticia-nuevo-usuario', rol: 'RECEPCION' }],
    [{ email: 'faltante@example.test', rol: 'RECEPCION' }],
  ])('POST /usuarios falla si falta email o contraseña', async (body) => {
    const { token } = await crearContexto();

    const respuesta = await request(crearApp())
      .post('/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

    expect(respuesta.status).toBe(400);
  });

  it('un email duplicado devuelve 409', async () => {
    const { consultorioId, token } = await crearContexto();
    const email = `duplicado-${randomUUID()}@example.test`;
    await crearUsuarioDePrueba(consultorioId, 'RECEPCION', email);

    const respuesta = await request(crearApp())
      .post('/usuarios')
      .set('Authorization', `Bearer ${token}`)
      .send({ email, password: 'clave-ficticia-nuevo-usuario', rol: 'ODONTOLOGO' });

    expect(respuesta.status).toBe(409);
  });

  it('ignora consultorioId enviado en el body y usa el consultorio del admin', async () => {
    const admin = await crearContexto();
    const otro = await crearContexto();

    const respuesta = await request(crearApp())
      .post('/usuarios')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        email: `tenant-body-${randomUUID()}@example.test`,
        password: 'clave-ficticia-nuevo-usuario',
        rol: 'ODONTOLOGO',
        consultorioId: otro.consultorioId,
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.consultorioId).toBe(admin.consultorioId);
    expect(respuesta.body.consultorioId).not.toBe(otro.consultorioId);
    usuarios.push(respuesta.body.usuarioId);
  });

  it('GET /usuarios lista solo usuarios del consultorio autenticado', async () => {
    const propio = await crearContexto();
    await crearUsuarioDePrueba(propio.consultorioId, 'ODONTOLOGO');
    const ajeno = await crearContexto();

    const respuesta = await request(crearApp())
      .get('/usuarios')
      .set('Authorization', `Bearer ${propio.token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.usuarios).toHaveLength(2);
    expect(respuesta.body.usuarios.every((usuario) => usuario.consultorioId === propio.consultorioId))
      .toBe(true);
    expect(respuesta.body.usuarios.map((usuario) => usuario.usuarioId)).not.toContain(ajeno.usuario.id);
  });

  it('GET /usuarios/:id devuelve 200 para un usuario del propio consultorio', async () => {
    const propio = await crearContexto();

    const respuesta = await request(crearApp())
      .get(`/usuarios/${propio.usuario.id}`)
      .set('Authorization', `Bearer ${propio.token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({
      usuarioId: propio.usuario.id,
      consultorioId: propio.consultorioId,
      email: propio.usuario.email,
    });
    expect(respuesta.body).not.toHaveProperty('password_hash');
  });

  it('GET /usuarios/:id de otro consultorio devuelve 404', async () => {
    const propio = await crearContexto();
    const ajeno = await crearContexto();

    const respuesta = await request(crearApp())
      .get(`/usuarios/${ajeno.usuario.id}`)
      .set('Authorization', `Bearer ${propio.token}`);

    expect(respuesta.status).toBe(404);
  });
});

import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buscarUsuarioPorId,
  listarUsuariosPorConsultorio,
} from '../src/modules/auth/repositorios.js';
import {
  crearConsultorio,
  buscarConsultorioPorId,
} from '../src/modules/consultorios/repositorios.js';
import { obtenerUrlBaseTest } from './setup/urls.js';

const clientes = [];
const fixtures = [];

async function conectar() {
  const cliente = new pg.Client({ connectionString: obtenerUrlBaseTest() });
  await cliente.connect();
  clientes.push(cliente);
  return cliente;
}

async function crearFixtureDosConsultorios() {
  const cliente = await conectar();
  const consultorioA = randomUUID();
  const consultorioB = randomUUID();
  const usuarioA = randomUUID();
  const usuarioB = randomUUID();

  fixtures.push({ consultorioA, consultorioB });
  await cliente.query('INSERT INTO consultorio (id) VALUES ($1), ($2)', [consultorioA, consultorioB]);
  await cliente.query(
    `INSERT INTO usuario (id, consultorio_id, rol, email, password_hash)
     VALUES ($1, $2, 'ADMIN_CONSULTORIO', $3, 'hash-ficticio-a'),
            ($4, $5, 'RECEPCION', $6, 'hash-ficticio-b')`,
    [
      usuarioA,
      consultorioA,
      `admin-${usuarioA}@example.test`,
      usuarioB,
      consultorioB,
      `recepcion-${usuarioB}@example.test`,
    ]
  );
  return { consultorioA, consultorioB, usuarioA, usuarioB };
}

afterEach(async () => {
  for (const cliente of clientes.splice(0)) {
    await cliente.end().catch(() => {});
  }
  if (fixtures.length) {
    const cliente = new pg.Client({ connectionString: obtenerUrlBaseTest() });
    await cliente.connect();
    try {
      for (const fixture of fixtures.splice(0)) {
        await cliente.query('DELETE FROM usuario WHERE consultorio_id = ANY($1::uuid[])', [
          [fixture.consultorioA, fixture.consultorioB],
        ]);
        await cliente.query('DELETE FROM consultorio WHERE id = ANY($1::uuid[])', [
          [fixture.consultorioA, fixture.consultorioB],
        ]);
      }
    } finally {
      await cliente.end();
    }
  }
});

describe('repositorios C01: aislamiento por consultorio', () => {
  it('listarUsuariosPorConsultorio devuelve solo los usuarios del tenant solicitado', async () => {
    const { consultorioA, usuarioA } = await crearFixtureDosConsultorios();

    const usuarios = await listarUsuariosPorConsultorio(consultorioA);

    expect(usuarios.map((usuario) => usuario.id)).toEqual([usuarioA]);
    expect(usuarios[0]).not.toHaveProperty('password_hash');
  });

  it('buscarUsuarioPorId no revela un usuario que pertenece a otro consultorio', async () => {
    const { consultorioA, consultorioB, usuarioB } = await crearFixtureDosConsultorios();

    await expect(buscarUsuarioPorId(consultorioA, usuarioB)).resolves.toBeNull();
    await expect(buscarUsuarioPorId(consultorioB, usuarioB)).resolves.toMatchObject({
      id: usuarioB,
      consultorio_id: consultorioB,
    });
  });

  it('crearConsultorio aprovisiona un tenant y se puede recuperar por su ID', async () => {
    const consultorio = await crearConsultorio();
    fixtures.push({ consultorioA: consultorio.id, consultorioB: consultorio.id });

    expect(consultorio.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    await expect(buscarConsultorioPorId(consultorio.id)).resolves.toEqual(consultorio);
  });
});

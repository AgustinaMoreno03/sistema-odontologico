import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('C03: esquema de pacientes', () => {
  let cliente;
  let consultorioA;
  let consultorioB;

  beforeEach(async () => {
    cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    await cliente.query('BEGIN');

    consultorioA = randomUUID();
    consultorioB = randomUUID();

    await cliente.query(
      'INSERT INTO consultorio (id) VALUES ($1), ($2)',
      [consultorioA, consultorioB]
    );
  });

  afterEach(async () => {
    if (cliente) {
      try {
        await cliente.query('ROLLBACK');
      } finally {
        await cliente.end();
      }
    }
  });

  async function insertarPaciente({
    consultorioId = consultorioA,
    nombre = 'Paciente ficticio',
    telefono = '1100000000',
    email = null,
  } = {}) {
    return cliente.query(
      `INSERT INTO paciente (id, consultorio_id, nombre, telefono, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, consultorio_id, nombre, apellido, telefono,
                 email, creado_en`,
      [randomUUID(), consultorioId, nombre, telefono, email]
    );
  }

  it('guarda la ficha mínima con teléfono y asigna sus valores iniciales', async () => {
    const resultado = await insertarPaciente();
    expect(resultado.rows).toHaveLength(1);
    expect(resultado.rows[0]).toMatchObject({
      consultorio_id: consultorioA,
      nombre: 'Paciente ficticio',
      telefono: '1100000000',
      email: null,
      apellido: null,
    });
    expect(resultado.rows[0].id).toEqual(expect.any(String));
    expect(resultado.rows[0].creado_en).toBeInstanceOf(Date);
  });

  it('acepta un paciente con email como único contacto', async () => {
    const resultado = await insertarPaciente({
      telefono: null,
      email: 'ana@example.com',
    });
    expect(resultado.rows[0].telefono).toBeNull();
    expect(resultado.rows[0].email).toBe('ana@example.com');
  });

  it('rechaza una ficha sin ningún contacto', async () => {
    await expect(
      insertarPaciente({ telefono: null, email: null })
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rechaza un nombre compuesto solo por espacios', async () => {
    await expect(
      insertarPaciente({ nombre: '   ' })
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('impide emails equivalentes por mayúsculas y espacios en el mismo consultorio', async () => {
    await insertarPaciente({ email: 'ana@example.com' });

    await expect(
      insertarPaciente({ email: ' ANA@EXAMPLE.COM ' })
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('permite el mismo email en otro consultorio y múltiples emails ausentes', async () => {
    await insertarPaciente({ email: 'ana@example.com' });
    await insertarPaciente({
      consultorioId: consultorioB,
      email: 'ANA@EXAMPLE.COM',
    });
    await insertarPaciente();
    await insertarPaciente();

    const resultado = await cliente.query(
      'SELECT count(*)::int AS total FROM paciente WHERE consultorio_id = $1',
      [consultorioA]
    );
    expect(resultado.rows[0].total).toBe(3);
  });

  it('rechaza una referencia a un consultorio inexistente', async () => {
    await expect(
      insertarPaciente({ consultorioId: randomUUID() })
    ).rejects.toMatchObject({ code: '23503' });
  });

  it('rechaza email de solo espacios aunque haya teléfono válido', async () => {
    await expect(
      insertarPaciente({ telefono: '1100000000', email: '   ' })
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('rechaza teléfono de solo espacios aunque haya email válido', async () => {
    await expect(
      insertarPaciente({ telefono: '   ', email: 'ana@example.com' })
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('mantiene la ficha mínima sin columna activo', async () => {
    const resultado = await cliente.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'paciente'`
    );
    expect(resultado.rows.map((fila) => fila.column_name)).not.toContain('activo');
  });

  it('habilita unaccent para comparar nombres sin tildes', async () => {
    const resultado = await cliente.query(
      'SELECT unaccent($1::text) AS nombre',
      ['José Álvarez']
    );
    expect(resultado.rows[0].nombre).toBe('Jose Alvarez');
  });
});

import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('C03: interfaz existePaciente para C05', () => {
  let cliente;
  let consultorioA;
  let consultorioB;
  let pacienteId;

  beforeEach(async () => {
    cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();

    consultorioA = randomUUID();
    consultorioB = randomUUID();
    pacienteId = randomUUID();

    await cliente.query(
      'INSERT INTO consultorio (id) VALUES ($1), ($2)',
      [consultorioA, consultorioB]
    );
    await cliente.query(
      `INSERT INTO paciente (id, consultorio_id, nombre, telefono)
       VALUES ($1, $2, $3, $4)`,
      [pacienteId, consultorioA, 'Paciente ficticio de C03', '1100000000']
    );
  });

  afterEach(async () => {
    if (cliente) {
      try {
        await cliente.query(
          'DELETE FROM paciente WHERE consultorio_id = ANY($1::uuid[])',
          [[consultorioA, consultorioB]]
        );
        await cliente.query(
          'DELETE FROM consultorio WHERE id = ANY($1::uuid[])',
          [[consultorioA, consultorioB]]
        );
      } finally {
        await cliente.end();
      }
    }
  });

  async function comprobar(parametros) {
    const { existePaciente } = await import('../src/modules/pacientes/index.js');
    return existePaciente(parametros);
  }

  it('devuelve true para un paciente del consultorio indicado', async () => {
    await expect(
      comprobar({ pacienteId, consultorioId: consultorioA })
    ).resolves.toBe(true);
  });

  it('devuelve false para un paciente de otro consultorio', async () => {
    await expect(
      comprobar({ pacienteId, consultorioId: consultorioB })
    ).resolves.toBe(false);
  });

  it('devuelve false para un paciente inexistente', async () => {
    await expect(
      comprobar({ pacienteId: randomUUID(), consultorioId: consultorioA })
    ).resolves.toBe(false);
  });

  it.each([
    ['pacienteId', 'incorrecto'],
    ['consultorioId', 'incorrecto'],
    ['pacienteId', undefined],
    ['consultorioId', 123],
  ])('rechaza %s inválido (%s) con ApiError 400 VALIDACION', async (campo, valor) => {
    const parametros = { pacienteId, consultorioId: consultorioA };
    parametros[campo] = valor;

    await expect(comprobar(parametros)).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 400,
      code: 'VALIDACION',
    });
  });

  it('propaga un fallo de conexión y lo distingue de un paciente inexistente', async () => {
    const urlOriginal = process.env.DATABASE_URL;
    try {
      process.env.DATABASE_URL =
        'postgresql://ficticio:ficticio@127.0.0.1:1/odontologia_test?connect_timeout=1';

      await expect(
        comprobar({ pacienteId, consultorioId: consultorioA })
      ).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    } finally {
      process.env.DATABASE_URL = urlOriginal;
    }
  });
});

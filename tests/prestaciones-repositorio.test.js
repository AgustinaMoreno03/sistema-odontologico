import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearRepositorioPrestaciones } from '../src/modules/catalogo/prestaciones/repositorio.js';

const ID_CONSULTORIO_A = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ID_CONSULTORIO_B = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
let repositorio;

describe('repositorio de prestaciones (seccion 1)', () => {
  beforeAll(async () => {
    await cliente.connect();
    repositorio = crearRepositorioPrestaciones({ cliente });
    await cliente.query('INSERT INTO consultorio (id) VALUES ($1), ($2)', [ID_CONSULTORIO_A, ID_CONSULTORIO_B]);
  });

  afterAll(async () => {
    await cliente.query('DELETE FROM prestacion WHERE consultorio_id IN ($1, $2)', [ID_CONSULTORIO_A, ID_CONSULTORIO_B]);
    await cliente.query('DELETE FROM consultorio WHERE id IN ($1, $2)', [ID_CONSULTORIO_A, ID_CONSULTORIO_B]);
    await cliente.end();
  });

  it('crea una prestacion valida y devuelve su DTO persistido', async () => {
    const prestacion = await repositorio.crear({
      consultorioId: ID_CONSULTORIO_A,
      nombre: 'Limpieza dental',
      duracionMin: 45,
    });

    expect(prestacion).toMatchObject({
      nombre: 'Limpieza dental',
      duracionMin: 45,
      activo: true,
    });
    expect(prestacion.id).toEqual(expect.any(String));
    expect(prestacion.creadoEn).toEqual(expect.any(Date));
  });

  it.each([0, -1, 481])('rechaza duracion fuera de rango: %s', async (duracionMin) => {
    await expect(
      repositorio.crear({ consultorioId: ID_CONSULTORIO_A, nombre: `Duracion ${duracionMin}`, duracionMin })
    ).rejects.toMatchObject({ code: '23514' });
  });

  it.each([45.5, 'cuarenta'])('rechaza duracion no entera: %s', async (duracionMin) => {
    await expect(
      repositorio.crear({ consultorioId: ID_CONSULTORIO_A, nombre: 'Duracion invalida', duracionMin })
    ).rejects.toMatchObject({ code: expect.stringMatching(/^(22P02|23514)$/) });
  });

  it('rechaza nombres de mas de 100 caracteres', async () => {
    await expect(
      repositorio.crear({ consultorioId: ID_CONSULTORIO_A, nombre: 'x'.repeat(101), duracionMin: 30 })
    ).rejects.toMatchObject({ code: '22001' });
  });

  it('rechaza duplicados en el mismo consultorio y permite el mismo nombre en otro', async () => {
    await repositorio.crear({ consultorioId: ID_CONSULTORIO_A, nombre: 'Consulta', duracionMin: 30 });

    await expect(
      repositorio.crear({ consultorioId: ID_CONSULTORIO_A, nombre: 'Consulta', duracionMin: 60 })
    ).rejects.toMatchObject({ code: '23505' });

    const otra = await repositorio.crear({
      consultorioId: ID_CONSULTORIO_B,
      nombre: 'Consulta',
      duracionMin: 60,
    });
    expect(otra.nombre).toBe('Consulta');
  });

  it('obtiene solo la prestacion activa del consultorio solicitado', async () => {
    const activa = await repositorio.crear({
      consultorioId: ID_CONSULTORIO_A,
      nombre: 'Contrato activo',
      duracionMin: 20,
    });
    const ajena = await repositorio.crear({
      consultorioId: ID_CONSULTORIO_B,
      nombre: 'Contrato ajeno',
      duracionMin: 25,
    });

    await expect(
      repositorio.obtenerPrestacionParaTurno({ prestacionId: ajena.id, consultorioId: ID_CONSULTORIO_A })
    ).resolves.toBeNull();
    await expect(
      repositorio.obtenerPrestacionParaTurno({ prestacionId: activa.id, consultorioId: ID_CONSULTORIO_A })
    ).resolves.toMatchObject({ id: activa.id, nombre: 'Contrato activo', duracionMin: 20, activo: true });

    await cliente.query('UPDATE prestacion SET activo = FALSE WHERE id = $1', [activa.id]);
    await expect(
      repositorio.obtenerPrestacionParaTurno({ prestacionId: activa.id, consultorioId: ID_CONSULTORIO_A })
    ).resolves.toBeNull();
  });
});

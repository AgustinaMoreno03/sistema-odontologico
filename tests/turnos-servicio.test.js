import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errores.js';
import { crearTurno } from '../src/modules/turnos/servicios.js';
import { conFixtureTurnos } from './helpers/turnos-fixtures.js';

/**
 * Spec turnos + design D3/D5 — servicio `crearTurno` con deps inyectables.
 * Los cinco consumidores externos se inyectan por `deps`; en producción
 * resuelven por imports estáticos (tarea 4.2). Nada de HTTP ni SQL acá.
 */
function argsValidos(consultorioId = randomUUID()) {
  return {
    pacienteId: randomUUID(),
    profesionalId: randomUUID(),
    sillonBoxId: randomUUID(),
    prestacionId: randomUUID(),
    inicio: '2026-11-23T14:00:00Z',
    consultorioId,
  };
}

function depsCon(args, overrides = {}) {
  return {
    existePaciente: async () => true,
    existeProfesional: async () => true,
    existeSillonBox: async () => true,
    obtenerCatalogo: async () => ({
      profesionales: [{ id: args.profesionalId }],
      sillonBoxes: [{ id: args.sillonBoxId }],
    }),
    obtenerPrestacionParaTurno: async () => ({
      id: args.prestacionId,
      nombre: 'Prestacion Ficticia C05',
      duracionMin: 30,
      activo: true,
    }),
    ...overrides,
  };
}

async function capturarError(promesa) {
  try {
    await promesa;
    return null;
  } catch (error) {
    return error;
  }
}

describe('crearTurno — deps inyectables (design D3)', () => {
  it('existePaciente falso → 422 REFERENCIA_INVALIDA indicando pacienteId', async () => {
    const args = argsValidos();
    let llamadaPaciente = null;
    const deps = depsCon(args, {
      existePaciente: async (params) => {
        llamadaPaciente = params;
        return false;
      },
    });

    const error = await capturarError(crearTurno(args, deps));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('REFERENCIA_INVALIDA');
    // Indica EL CAMPO fallido (spec R4: un mensaje por campo).
    expect(error.message).toContain('pacienteId');
    // La comprobación siempre va acotada al consultorio del token.
    expect(llamadaPaciente).toEqual({
      pacienteId: args.pacienteId,
      consultorioId: args.consultorioId,
    });
  });
});

describe('crearTurno — 400 VALIDACION de formato (spec R1)', () => {
  it.each(['pacienteId', 'profesionalId', 'sillonBoxId', 'prestacionId'])(
    'UUID malformado en %s → 400 VALIDACION nombrando el campo',
    async (campo) => {
      const args = { ...argsValidos(), [campo]: 'no-es-un-uuid' };

      const error = await capturarError(crearTurno(args, depsCon(args)));

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDACION');
      expect(error.message).toContain(campo);
    }
  );

  it('propaga el ApiError 400 VALIDACION de existePaciente (contrato C03 §7)', async () => {
    const args = argsValidos();
    const deps = depsCon(args, {
      existePaciente: async () => {
        throw new ApiError(400, 'VALIDACION', 'Identificadores inválidos');
      },
    });

    const error = await capturarError(crearTurno(args, deps));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDACION');
  });

  it('inicio sin zona horaria → 400 VALIDACION nombrando inicio', async () => {
    const args = { ...argsValidos(), inicio: '2026-11-23T14:00:00' };

    const error = await capturarError(crearTurno(args, depsCon(args)));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDACION');
    expect(error.message).toContain('inicio');
  });
});

describe('crearTurno — 422 REFERENCIA_INVALIDA por campo (spec R4)', () => {
  /**
   * Ejecuta `crearTurno` con la sobrescritura de deps indicada y devuelve el
   * mensaje del 422, validando status/code/campo en el camino.
   * `sobrescritura` puede ser un objeto o una función de `args`.
   */
  async function errorDeReferencia(campo, sobrescritura) {
    const args = argsValidos();
    const deps = depsCon(
      args,
      typeof sobrescritura === 'function' ? sobrescritura(args) : sobrescritura
    );

    const error = await capturarError(crearTurno(args, deps));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('REFERENCIA_INVALIDA');
    expect(error.message).toContain(campo);
    return error.message;
  }

  it('pacienteId: el mismo mensaje para inexistente y ajeno (030 no tiene estado inactivo)', async () => {
    const mensajes = [
      await errorDeReferencia('pacienteId', { existePaciente: async () => false }), // inexistente
      await errorDeReferencia('pacienteId', { existePaciente: async () => false }), // ajeno: existePaciente devuelve false también (C03 §7)
    ];

    expect(new Set(mensajes).size).toBe(1);
  });

  it('profesionalId: el mismo mensaje para inexistente, ajeno e inactivo', async () => {
    const mensajes = [
      await errorDeReferencia('profesionalId', { existeProfesional: async () => false }), // inexistente
      await errorDeReferencia('profesionalId', { existeProfesional: async () => false }), // ajeno: misma señal false (C02)
      await errorDeReferencia('profesionalId', {
        existeProfesional: async () => true,
        obtenerCatalogo: async () => ({ profesionales: [], sillonBoxes: [] }), // existe pero NO figura activo
      }),
    ];

    expect(new Set(mensajes).size).toBe(1);
  });

  it('sillonBoxId: el mismo mensaje para inexistente, ajeno e inactivo', async () => {
    const mensajes = [
      await errorDeReferencia('sillonBoxId', { existeSillonBox: async () => false }), // inexistente
      await errorDeReferencia('sillonBoxId', { existeSillonBox: async () => false }), // ajeno
      await errorDeReferencia('sillonBoxId', (args) => ({
        existeSillonBox: async () => true,
        obtenerCatalogo: async () => ({
          profesionales: [{ id: args.profesionalId }], // el profesional sí pasa
          sillonBoxes: [], // pero el sillón NO figura activo
        }),
      })),
    ];

    expect(new Set(mensajes).size).toBe(1);
  });

  it('prestacionId: el mismo mensaje para inexistente, ajeno e inactivo', async () => {
    const mensajes = [
      await errorDeReferencia('prestacionId', { obtenerPrestacionParaTurno: async () => null }), // inexistente
      await errorDeReferencia('prestacionId', { obtenerPrestacionParaTurno: async () => null }), // ajeno: null también (SQL con activo=TRUE)
      await errorDeReferencia('prestacionId', { obtenerPrestacionParaTurno: async () => null }), // inactiva: null también
    ];

    expect(new Set(mensajes).size).toBe(1);
  });
});

describe('crearTurno — 409 SOLAPAMIENTO contra la base real (una por restricción)', () => {
  /**
   * Agrega al consultorio del fixture los recursos "del otro lado" que cada
   * restricción necesita (siempre ficticios — regla dura 1).
   */
  async function agregarRecursosExtra(fixture) {
    const profesionalId2 = randomUUID();
    const sillonBoxId2 = randomUUID();
    const pacienteId2 = randomUUID();
    await fixture.consultar(
      'INSERT INTO profesional (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
      [profesionalId2, fixture.consultorioId, 'Profesional Extra Ficticio']
    );
    await fixture.consultar(
      'INSERT INTO sillon_box (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
      [sillonBoxId2, fixture.consultorioId, 'Box Extra Ficticio']
    );
    await fixture.consultar(
      'INSERT INTO paciente (id, consultorio_id, nombre, telefono) VALUES ($1, $2, $3, $4)',
      [pacienteId2, fixture.consultorioId, 'Paciente Extra Ficticio', '11-5555-1111']
    );
    return { profesionalId2, sillonBoxId2, pacienteId2 };
  }

  /** Turno previo 17:00–17:30 UTC con los recursos indicados. */
  async function insertarTurnoPrevio(fixture, { pacienteId, profesionalId, sillonBoxId }) {
    await fixture.consultar(
      `INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_box_id,
                          prestacion_id, inicio, fin, duracion_min)
       VALUES ($1, $2, $3, $4, $5, '2026-11-23T17:00:00+00:00', '2026-11-23T17:30:00+00:00', 30)`,
      [fixture.consultorioId, pacienteId, profesionalId, sillonBoxId, fixture.prestacionId]
    );
  }

  async function contarTurnos(fixture) {
    const { rows } = await fixture.consultar(
      'SELECT COUNT(*)::int AS n FROM turno WHERE consultorio_id = $1',
      [fixture.consultorioId]
    );
    return rows[0].n;
  }

  it('restricción de paciente (RN-AG-01): 409 SOLAPAMIENTO y no crea el segundo turno', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const extra = await agregarRecursosExtra(fixture);
      await insertarTurnoPrevio(fixture, fixture); // mismo paciente, otro profesional y box

      const error = await capturarError(
        crearTurno({
          pacienteId: fixture.pacienteId,
          profesionalId: extra.profesionalId2,
          sillonBoxId: extra.sillonBoxId2,
          prestacionId: fixture.prestacionId,
          inicio: '2026-11-23T17:00:00Z',
          consultorioId: fixture.consultorioId,
        })
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('SOLAPAMIENTO');
      expect(await contarTurnos(fixture)).toBe(1); // solo el previo
    });
  });

  it('restricción de profesional (RN-AG-02): 409 SOLAPAMIENTO y no crea el segundo turno', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const extra = await agregarRecursosExtra(fixture);
      await insertarTurnoPrevio(fixture, fixture); // mismo profesional, otro paciente y box

      const error = await capturarError(
        crearTurno({
          pacienteId: extra.pacienteId2,
          profesionalId: fixture.profesionalId,
          sillonBoxId: extra.sillonBoxId2,
          prestacionId: fixture.prestacionId,
          inicio: '2026-11-23T17:00:00Z',
          consultorioId: fixture.consultorioId,
        })
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('SOLAPAMIENTO');
      expect(await contarTurnos(fixture)).toBe(1);
    });
  });

  it('restricción de sillón/box (RN-AG-02): 409 SOLAPAMIENTO y no crea el segundo turno', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const extra = await agregarRecursosExtra(fixture);
      await insertarTurnoPrevio(fixture, fixture); // mismo box, otro paciente y profesional

      const error = await capturarError(
        crearTurno({
          pacienteId: extra.pacienteId2,
          profesionalId: extra.profesionalId2,
          sillonBoxId: fixture.sillonBoxId,
          prestacionId: fixture.prestacionId,
          inicio: '2026-11-23T17:00:00Z',
          consultorioId: fixture.consultorioId,
        })
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('SOLAPAMIENTO');
      expect(await contarTurnos(fixture)).toBe(1);
    });
  });
});

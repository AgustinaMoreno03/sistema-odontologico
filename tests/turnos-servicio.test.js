import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errores.js';
import { crearTurno, reprogramarTurno } from '../src/modules/turnos/servicios.js';
import { conFixtureTurnos, crearTurnoPartida } from './helpers/turnos-fixtures.js';

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

/**
 * C07 task 5.1 — servicio `reprogramarTurno` contra PostgreSQL REAL
 * (design D2/D3): validación de forma defensiva → 400; transacción del
 * repositorio con callback que, BAJO EL LOCK, exige estado `PENDIENTE`
 * (RN-AG-10) y calcula `fin = inicio + duracionMin` con la duración
 * congelada al crearse (RN-AG-07, `[)` UTC RN-AG-06). Si algo falla, el
 * turno conserva su horario anterior (RN-AG-09).
 */
describe('reprogramarTurno — servicio (C07 task 5.1)', () => {
  async function leerTurno(fixture, turnoId) {
    const { rows } = await fixture.consultar(
      `SELECT inicio, fin, estado, reprogramado_en, reprogramado_por
       FROM turno WHERE id = $1 AND consultorio_id = $2`,
      [turnoId, fixture.consultorioId]
    );
    return rows[0] ?? null;
  }

  const args = (fixture, turnoId, overrides = {}) => ({
    turnoId,
    inicio: '2026-12-01T15:00:00Z',
    consultorioId: fixture.consultorioId,
    usuarioId: fixture.usuarioId,
    ...overrides,
  });

  it('éxito: fin = inicio + 30 min con la duración congelada y auditoría del usuario', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const turno = await crearTurnoPartida(fixture); // 10:00–10:30, 30 min

      const resultado = await reprogramarTurno(args(fixture, turno.id));

      // S1: el mismo turno, inicio 15:00 UTC, fin 15:30 UTC (misma duración).
      expect(resultado).toMatchObject({ id: turno.id, duracionMin: 30, estado: 'PENDIENTE' });
      expect(new Date(resultado.inicio).toISOString()).toBe('2026-12-01T15:00:00.000Z');
      expect(new Date(resultado.fin).toISOString()).toBe('2026-12-01T15:30:00.000Z');

      // Auditoría (design D5): usuario del token + instante real.
      expect(resultado.reprogramadoPor).toBe(fixture.usuarioId);
      expect(resultado.reprogramadoEn).toBeInstanceOf(Date);

      // Persistido en la base, acotado al consultorio del token.
      const fila = await leerTurno(fixture, turno.id);
      expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T15:00:00.000Z');
      expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T15:30:00.000Z');
      expect(fila.reprogramado_por).toBe(fixture.usuarioId);
      expect(fila.reprogramado_en).toBeInstanceOf(Date);
    });
  });

  it('400 defensivo: turnoId malformado o inicio sin timezone → VALIDACION sin tocar la base', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const turno = await crearTurnoPartida(fixture);

      const errorId = await capturarError(
        reprogramarTurno(args(fixture, 'no-es-un-uuid'))
      );
      expect(errorId).toBeInstanceOf(ApiError);
      expect(errorId).toMatchObject({ statusCode: 400, code: 'VALIDACION' });

      const errorInicio = await capturarError(
        reprogramarTurno(args(fixture, turno.id, { inicio: '2026-12-01T15:00:00' }))
      );
      expect(errorInicio).toBeInstanceOf(ApiError);
      expect(errorInicio).toMatchObject({ statusCode: 400, code: 'VALIDACION' });
      expect(errorInicio.message).toContain('inicio');

      // En ambos casos el turno quedó EXACTAMENTE como estaba.
      const fila = await leerTurno(fixture, turno.id);
      expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
      expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
      expect(fila.reprogramado_en).toBeNull();
    });
  });

  it('estado CANCELADO → 409 ESTADO_INVALIDO sin cambios (RN-AG-10)', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const turno = await crearTurnoPartida(fixture, {
        inicio: '2026-12-01T11:00:00Z',
        estado: 'CANCELADO',
      });

      const error = await capturarError(reprogramarTurno(args(fixture, turno.id)));

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ statusCode: 409, code: 'ESTADO_INVALIDO' });

      const fila = await leerTurno(fixture, turno.id);
      expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T11:00:00.000Z');
      expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T11:30:00.000Z');
      expect(fila.estado).toBe('CANCELADO'); // estado original intacto
      expect(fila.reprogramado_en).toBeNull();
    });
  });

  it('estado ATENDIDO → 409 ESTADO_INVALIDO sin cambios (RN-AG-10, triangulación)', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const turno = await crearTurnoPartida(fixture, {
        inicio: '2026-12-01T12:00:00Z',
        estado: 'ATENDIDO',
      });

      const error = await capturarError(reprogramarTurno(args(fixture, turno.id)));

      expect(error).toMatchObject({ statusCode: 409, code: 'ESTADO_INVALIDO' });

      const fila = await leerTurno(fixture, turno.id);
      expect(fila.estado).toBe('ATENDIDO');
      expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T12:00:00.000Z');
      expect(fila.reprogramado_en).toBeNull();
    });
  });

  it('solape con otro turno → 409 SOLAPAMIENTO y conserva el horario anterior (RN-AG-09)', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const turno = await crearTurnoPartida(fixture); // 10:00–10:30
      // Otro turno con los MISMOS recursos en 15:00–15:30.
      await crearTurnoPartida(fixture, { inicio: '2026-12-01T15:00:00Z' });

      const error = await capturarError(
        reprogramarTurno(args(fixture, turno.id, { inicio: '2026-12-01T15:15:00Z' }))
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        statusCode: 409,
        code: 'SOLAPAMIENTO',
        message: expect.stringMatching(/profesional/i),
      });

      // El turno reprogramado conserva inicio 10:00 / fin 10:30 (S2).
      const fila = await leerTurno(fixture, turno.id);
      expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
      expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
      expect(fila.reprogramado_en).toBeNull();
    });
  });

  it('turno inexistente o de OTRO consultorio → 404 TURNO_NO_ENCONTRADO sin modificar nada', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const turno = await crearTurnoPartida(fixture);

      // (i) id inexistente.
      const inexistente = await capturarError(
        reprogramarTurno(args(fixture, randomUUID()))
      );
      expect(inexistente).toMatchObject({ statusCode: 404, code: 'TURNO_NO_ENCONTRADO' });

      // (ii) turno REAL del consultorio B: con el consultorio del token (A)
      // el SELECT FOR UPDATE no encuentra fila → mismo 404 (RN-TEN-01).
      const otro = await conFixtureTurnos(async ({ fixture: fixtureB }) => {
        const turnoDeB = await crearTurnoPartida(fixtureB);
        const error = await capturarError(
          reprogramarTurno(args(fixture, turnoDeB.id))
        );
        expect(error).toMatchObject({ statusCode: 404, code: 'TURNO_NO_ENCONTRADO' });
        return leerTurno(fixtureB, turnoDeB.id);
      });

      // El turno de B quedó intacto (inicio original, sin auditoría).
      expect(new Date(otro.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
      expect(new Date(otro.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
      expect(otro.reprogramado_en).toBeNull();

      // El turno de A también sigue igual.
      const fila = await leerTurno(fixture, turno.id);
      expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
      expect(fila.reprogramado_en).toBeNull();
    });
  });
});

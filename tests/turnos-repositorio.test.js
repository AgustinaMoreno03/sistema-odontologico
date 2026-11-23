import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errores.js';
import { crearRepositorioTurnos } from '../src/modules/turnos/repositorio.js';
import { conFixtureTurnos, crearFixtureTurnos, crearTurnoPartida } from './helpers/turnos-fixtures.js';

/**
 * C05 task 3.2 — repositorio de turnos contra PostgreSQL REAL (design D6):
 * INSERT parametrizado + pre-check SELECT de solapamiento, ambos dentro de
 * una ÚNICA transacción, filtrando SIEMPRE por `consultorio_id`, con SQL
 * sargable que usa los índices de knowledge-base/04:112.
 *
 * Cubre: conflicto por cada recurso (409 SOLAPAMIENTO con el mensaje
 * detallado del pre-check y sin registro creado), contigüidad `[)`
 * (RN-AG-06), aislamiento por consultorio (RN-TEN-01) y el alta feliz con
 * `fin = inicio + duracionMin` (RN-AG-07). Datos SIEMPRE ficticios
 * (regla dura 1), UUIDs por test, limpieza por FK con el helper.
 */

const H = '2030-02-20T'; // horario ficticio fijo por test (futuro)

const base = (fixture) => ({
  consultorioId: fixture.consultorioId,
  pacienteId: fixture.pacienteId,
  profesionalId: fixture.profesionalId,
  sillonBoxId: fixture.sillonBoxId,
  prestacionId: fixture.prestacionId,
});

/** Recursos ficticios adicionales para aislar QUÉ recurso dispara el conflicto. */
async function crearRecursosExtras(fixture) {
  const paciente2 = randomUUID();
  const profesional2 = randomUUID();
  const sillon2 = randomUUID();
  await fixture.consultar(
    'INSERT INTO paciente (id, consultorio_id, nombre, telefono) VALUES ($1, $2, $3, $4)',
    [paciente2, fixture.consultorioId, 'Paciente Ficticio 2 Repo', '11-5555-0003']
  );
  await fixture.consultar(
    'INSERT INTO profesional (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
    [profesional2, fixture.consultorioId, 'Profesional Ficticio 2 Repo']
  );
  await fixture.consultar(
    'INSERT INTO sillon_box (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
    [sillon2, fixture.consultorioId, 'Box Ficticio 2 Repo']
  );
  return { paciente2, profesional2, sillon2 };
}

async function contarTurnos(fixture) {
  const { rows } = await fixture.consultar(
    'SELECT count(*)::int AS total FROM turno WHERE consultorio_id = $1',
    [fixture.consultorioId]
  );
  return rows[0].total;
}

describe('repositorio de turnos: alta y solapamientos (task 3.2)', () => {
  it('crea un turno ficticio con fin = inicio + duración y estado PENDIENTE', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const repo = crearRepositorioTurnos();

      const turno = await repo.crearTurno({
        ...base(fixture),
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
        duracionMin: 30,
      });

      expect(turno).toMatchObject({
        consultorioId: fixture.consultorioId,
        pacienteId: fixture.pacienteId,
        profesionalId: fixture.profesionalId,
        sillonBoxId: fixture.sillonBoxId,
        prestacionId: fixture.prestacionId,
        duracionMin: 30,
        estado: 'PENDIENTE',
      });
      expect(turno.id).toEqual(expect.any(String));
      expect(new Date(turno.inicio).toISOString()).toBe(`${H}10:00:00.000Z`);
      expect(new Date(turno.fin).toISOString()).toBe(`${H}10:30:00.000Z`);
      expect(turno.creadoEn).toBeInstanceOf(Date);

      // Persistido y acotado al consultorio del fixture.
      expect(await contarTurnos(fixture)).toBe(1);
    });
  });

  it('solape por profesional → 409 SOLAPAMIENTO nombrando al profesional y sin segundo registro', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const { paciente2, sillon2 } = await crearRecursosExtras(fixture);
      const repo = crearRepositorioTurnos();
      await repo.crearTurno({
        ...base(fixture),
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
        duracionMin: 30,
      });

      // Mismo profesional; paciente y sillón distintos → solo el pre-check
      // de profesional puede disparar.
      await expect(
        repo.crearTurno({
          ...base(fixture),
          pacienteId: paciente2,
          sillonBoxId: sillon2,
          inicio: `${H}10:15:00.000Z`,
          fin: `${H}10:45:00.000Z`,
          duracionMin: 30,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SOLAPAMIENTO',
        message: expect.stringMatching(/profesional/i),
      });

      // La transacción no dejó nada a medias: sigue solo el primer turno.
      expect(await contarTurnos(fixture)).toBe(1);
    });
  });

  it('solape por sillón/box → 409 SOLAPAMIENTO nombrando al sillón y sin segundo registro', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const { paciente2, profesional2 } = await crearRecursosExtras(fixture);
      const repo = crearRepositorioTurnos();
      await repo.crearTurno({
        ...base(fixture),
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
        duracionMin: 30,
      });

      await expect(
        repo.crearTurno({
          ...base(fixture),
          pacienteId: paciente2,
          profesionalId: profesional2,
          inicio: `${H}10:15:00.000Z`,
          fin: `${H}10:45:00.000Z`,
          duracionMin: 30,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SOLAPAMIENTO',
        message: expect.stringMatching(/sill/i),
      });

      expect(await contarTurnos(fixture)).toBe(1);
    });
  });

  it('solape por paciente → 409 SOLAPAMIENTO nombrando al paciente y sin segundo registro', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const { profesional2, sillon2 } = await crearRecursosExtras(fixture);
      const repo = crearRepositorioTurnos();
      await repo.crearTurno({
        ...base(fixture),
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
        duracionMin: 30,
      });

      await expect(
        repo.crearTurno({
          ...base(fixture),
          profesionalId: profesional2,
          sillonBoxId: sillon2,
          inicio: `${H}10:15:00.000Z`,
          fin: `${H}10:45:00.000Z`,
          duracionMin: 30,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        code: 'SOLAPAMIENTO',
        message: expect.stringMatching(/paciente/i),
      });

      expect(await contarTurnos(fixture)).toBe(1);
    });
  });

  it('dos turnos contiguos [) del mismo recurso coexisten (RN-AG-06)', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const repo = crearRepositorioTurnos();

      await repo.crearTurno({
        ...base(fixture),
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
        duracionMin: 30,
      });
      // Empieza EXACTAMENTE cuando termina el primero.
      await repo.crearTurno({
        ...base(fixture),
        inicio: `${H}10:30:00.000Z`,
        fin: `${H}11:00:00.000Z`,
        duracionMin: 30,
      });

      expect(await contarTurnos(fixture)).toBe(2);
    });
  });

  it('turnos en el mismo intervalo con recursos distintos coexisten dentro del consultorio', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const { paciente2, profesional2, sillon2 } = await crearRecursosExtras(fixture);
      const repo = crearRepositorioTurnos();

      await repo.crearTurno({
        ...base(fixture),
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
        duracionMin: 30,
      });
      await repo.crearTurno({
        ...base(fixture),
        pacienteId: paciente2,
        profesionalId: profesional2,
        sillonBoxId: sillon2,
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
        duracionMin: 30,
      });

      expect(await contarTurnos(fixture)).toBe(2);
    });
  });

  it('el pre-check y el índice filtran SIEMPRE por consultorio (RN-TEN-01)', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const otro = await crearFixtureTurnos(); // segundo consultorio ficticio
      try {
        // Fila del consultorio B que reutiliza el PROFESIONAL de A en el
        // mismo intervalo: sin el filtro por consultorio, el pre-check de A
        // la vería y rechazaría un turno legítimo.
        await otro.consultar(
          `INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_box_id,
                              prestacion_id, inicio, fin, duracion_min)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 30)`,
          [
            otro.consultorioId,
            otro.pacienteId,
            fixture.profesionalId,
            otro.sillonBoxId,
            otro.prestacionId,
            `${H}10:00:00.000Z`,
            `${H}10:30:00.000Z`,
          ]
        );

        const repo = crearRepositorioTurnos();
        const turno = await repo.crearTurno({
          ...base(fixture),
          inicio: `${H}10:00:00.000Z`,
          fin: `${H}10:30:00.000Z`,
          duracionMin: 30,
        });

        // El turno de A se creó en A; ninguna fila cruzada.
        expect(turno.consultorioId).toBe(fixture.consultorioId);
        const { rows } = await fixture.consultar(
          'SELECT consultorio_id FROM turno WHERE profesional_id = $1',
          [fixture.profesionalId]
        );
        expect(rows.map((f) => f.consultorio_id).sort()).toEqual(
          [fixture.consultorioId, otro.consultorioId].sort()
        );
      } finally {
        await otro.limpiar();
      }
    });
  });
});

describe('repositorio: reintento de transacción ante deadlock 40P01 (S6, opción 1)', () => {
  const SIN_CONFLICTO = { profesional: false, sillon_box: false, paciente: false };
  const CONFLICTO_PROFESIONAL = { profesional: true, sillon_box: false, paciente: false };

  /**
   * Cliente falso con el seam de inyección del repo (`{ cliente }`): ejecuta
   * BEGIN/COMMIT/ROLLBACK, devuelve el estado de pre-check que le pidan y
   * lanza `40P01` (deadlock) en los primeros `fallosInsert` INSERT.
   */
  function clienteFalso({ preChecks, fallosInsert }) {
    const llamadas = [];
    let intentosInsert = 0;
    let indicePrecheck = 0;
    return {
      llamadas,
      async query(sql) {
        const palabra = sql
          .replace(/\s+/g, ' ')
          .trim()
          .split(' ')[0]
          .toUpperCase();
        llamadas.push(palabra);
        if (palabra === 'BEGIN' || palabra === 'COMMIT' || palabra === 'ROLLBACK') return {};
        if (palabra === 'SELECT') {
          const estado = preChecks[Math.min(indicePrecheck, preChecks.length - 1)];
          indicePrecheck += 1;
          return { rows: [estado] };
        }
        if (palabra === 'INSERT') {
          intentosInsert += 1;
          if (intentosInsert <= fallosInsert) {
            const error = new Error('deadlock detected');
            error.code = '40P01';
            throw error;
          }
          return { rows: [] }; // no usado: los dos caminos terminan antes
        }
        throw new Error(`SQL no soportado en el cliente falso: ${palabra}`);
      },
    };
  }

  function parametros() {
    return {
      consultorioId: randomUUID(),
      pacienteId: randomUUID(),
      profesionalId: randomUUID(),
      sillonBoxId: randomUUID(),
      prestacionId: randomUUID(),
      inicio: new Date('2030-02-20T10:00:00.000Z'),
      fin: new Date('2030-02-20T10:30:00.000Z'),
      duracionMin: 30,
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

  it('40P01 en el primer INSERT → reintenta la transacción COMPLETA y el pre-check ve al ganador (409 detallado)', async () => {
    const cliente = clienteFalso({
      preChecks: [SIN_CONFLICTO, CONFLICTO_PROFESIONAL],
      fallosInsert: 1,
    });
    const repo = crearRepositorioTurnos({ cliente });

    const error = await capturarError(repo.crearTurno(parametros()));

    // 409 con el mensaje DETALLADO del recurso (tras el rollback, el
    // pre-check del segundo intento ve el turno ganador).
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('SOLAPAMIENTO');
    expect(error.message).toBe('El profesional ya tiene un turno en ese horario');

    // La transacción entera se reintentó: dos BEGIN y un solo INSERT.
    expect(cliente.llamadas.filter((p) => p === 'BEGIN')).toHaveLength(2);
    expect(cliente.llamadas.filter((p) => p === 'INSERT')).toHaveLength(1);
  });

  it('40P01 también en el segundo intento → fallback a 409 SOLAPAMIENTO (nunca 500) y no hay tercer intento', async () => {
    const cliente = clienteFalso({
      preChecks: [SIN_CONFLICTO, SIN_CONFLICTO],
      fallosInsert: 2,
    });
    const repo = crearRepositorioTurnos({ cliente });

    const error = await capturarError(repo.crearTurno(parametros()));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(409); // nunca 500 por esta causa
    expect(error.code).toBe('SOLAPAMIENTO');
    // Límite de 2 intentos: no hubo un tercer BEGIN.
    expect(cliente.llamadas.filter((p) => p === 'BEGIN')).toHaveLength(2);
  });
});

/**
 * C07 task 4.2 — `reprogramarTurno` contra PostgreSQL REAL (design D2):
 * UNA transacción con reintento máx. 2 → `SELECT … FOR UPDATE` por
 * `id + consultorio_id` (404 si no hay fila) → callback bajo el lock →
 * pre-check con `excluirTurnoId` → `UPDATE` con auditoría → `COMMIT`.
 * Si algo falla, el ROLLBACK conserva el horario anterior (RN-AG-09).
 */
describe('repositorio: reprogramarTurno transaccional (C07 task 4.2)', () => {
  async function capturarError(promesa) {
    try {
      await promesa;
      return null;
    } catch (error) {
      return error;
    }
  }

  /** Fila del turno tal como queda en la base (horario + auditoría). */
  async function leerTurno(fixture, turnoId, consultorioId = fixture.consultorioId) {
    const { rows } = await fixture.consultar(
      `SELECT inicio, fin, estado, reprogramado_en, reprogramado_por
       FROM turno WHERE id = $1 AND consultorio_id = $2`,
      [turnoId, consultorioId]
    );
    return rows[0] ?? null;
  }

  const params = (fixture, turnoId, overrides = {}) => ({
    turnoId,
    consultorioId: fixture.consultorioId,
    inicio: '2026-12-01T15:00:00Z',
    reprogramadoPor: fixture.usuarioId,
    ...overrides,
  });

  it('(a) el callback lanza ApiError 409 → ROLLBACK: horario conservado y sin auditoría', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const repo = crearRepositorioTurnos();
      const turno = await crearTurnoPartida(fixture); // 10:00–10:30 PENDIENTE

      const error = await capturarError(
        repo.reprogramarTurno(params(fixture, turno.id), () => {
          // Simula el chequeo de estado del servicio (RN-AG-10) bajo el lock.
          throw new ApiError(409, 'ESTADO_INVALIDO', 'Solo los turnos en estado PENDIENTE pueden reprogramarse');
        })
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ statusCode: 409, code: 'ESTADO_INVALIDO' });

      // RN-AG-09: el ROLLBACK dejó el turno EXACTAMENTE como estaba.
      const fila = await leerTurno(fixture, turno.id);
      expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
      expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
      expect(fila.estado).toBe('PENDIENTE');
      expect(fila.reprogramado_en).toBeNull(); // el UPDATE nunca llegó
      expect(fila.reprogramado_por).toBeNull();
    });
  });

  it('(a2) el nuevo horario solapa con OTRO turno → 409 SOLAPAMIENTO y conserva el horario anterior', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const repo = crearRepositorioTurnos();
      const turno = await crearTurnoPartida(fixture); // 10:00–10:30
      // Segundo turno MISMO paciente/profesional/sillón en 15:00–15:30.
      await crearTurnoPartida(fixture, { inicio: '2026-12-01T15:00:00Z' });

      const error = await capturarError(
        repo.reprogramarTurno(
          params(fixture, turno.id, { inicio: '2026-12-01T15:15:00Z' }),
          () => ({ inicio: new Date('2026-12-01T15:15:00Z'), fin: new Date('2026-12-01T15:45:00Z') })
        )
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({
        statusCode: 409,
        code: 'SOLAPAMIENTO',
        message: expect.stringMatching(/profesional/i),
      });

      const fila = await leerTurno(fixture, turno.id);
      expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
      expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
      expect(fila.reprogramado_en).toBeNull();
    });
  });

  it('(b) id inexistente → 404 TURNO_NO_ENCONTRADO y ninguna fila modificada', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const repo = crearRepositorioTurnos();
      const turno = await crearTurnoPartida(fixture);

      const error = await capturarError(
        repo.reprogramarTurno(params(fixture, randomUUID()), () => ({
          inicio: new Date('2026-12-01T15:00:00Z'),
          fin: new Date('2026-12-01T15:30:00Z'),
        }))
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ statusCode: 404, code: 'TURNO_NO_ENCONTRADO' });

      const fila = await leerTurno(fixture, turno.id);
      expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
      expect(fila.reprogramado_en).toBeNull();
      const { rows } = await fixture.consultar(
        'SELECT count(*)::int AS total FROM turno WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].total).toBe(1); // ninguna fila creada ni modificada
    });
  });

  it('(b2) turno de OTRO consultorio → 404 y el turno ajeno queda intacto (RN-TEN-01)', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const otro = await crearFixtureTurnos(); // consultorio B (ficticio)
      try {
        const repo = crearRepositorioTurnos();
        const turnoDeB = await crearTurnoPartida(otro); // 10:00–10:30 en B

        const error = await capturarError(
          repo.reprogramarTurno(
            // Consultorio A en el token/params, turno de B: sin fila → 404.
            params(fixture, turnoDeB.id),
            () => ({
              inicio: new Date('2026-12-01T15:00:00Z'),
              fin: new Date('2026-12-01T15:30:00Z'),
            })
          )
        );

        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ statusCode: 404, code: 'TURNO_NO_ENCONTRADO' });

        // El turno de B sigue en su horario original y sin auditoría.
        const filaB = await leerTurno(otro, turnoDeB.id);
        expect(new Date(filaB.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
        expect(new Date(filaB.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
        expect(filaB.reprogramado_en).toBeNull();
        expect(filaB.reprogramado_por).toBeNull();
      } finally {
        await otro.limpiar();
      }
    });
  });

  it('(c) reprogramar al MISMO horario del propio turno no se auto-conflicta (exclusión id != turnoId)', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const repo = crearRepositorioTurnos();
      const turno = await crearTurnoPartida(fixture); // 10:00–10:30

      // Sin la exclusión `id <> turnoId`, el pre-check encontraría ESTE
      // turno (mismos recursos, mismo rango, PENDIENTE) y fallaría.
      const resultado = await repo.reprogramarTurno(
        params(fixture, turno.id, {
          inicio: '2026-12-01T10:00:00Z',
        }),
        () => ({
          inicio: new Date('2026-12-01T10:00:00Z'),
          fin: new Date('2026-12-01T10:30:00Z'),
        })
      );

      expect(resultado).toMatchObject({
        id: turno.id,
        inicio: expect.anything(),
        fin: expect.anything(),
      });
      expect(new Date(resultado.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
      expect(new Date(resultado.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');

      // La UPDATE salió: auditoría registrada sobre el mismo horario.
      const fila = await leerTurno(fixture, turno.id);
      expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
      expect(fila.reprogramado_en).toBeInstanceOf(Date);
      expect(fila.reprogramado_por).toBe(fixture.usuarioId);
    });
  });

  it('(c2) dos turnos distintos en solape → el pre-check excluye SOLO al propio turno y señala al conflicto real', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const repo = crearRepositorioTurnos();
      const turno = await crearTurnoPartida(fixture); // 10:00–10:30
      // OTRO turno (mismos recursos) en 11:00–11:30.
      const otro = await crearTurnoPartida(fixture, { inicio: '2026-12-01T11:00:00Z' });

      // Mover el primero a 11:15 choca CON EL OTRO (no consigo mismo).
      const error = await capturarError(
        repo.reprogramarTurno(
          params(fixture, turno.id, { inicio: '2026-12-01T11:15:00Z' }),
          () => ({
            inicio: new Date('2026-12-01T11:15:00Z'),
            fin: new Date('2026-12-01T11:45:00Z'),
          })
        )
      );

      expect(error).toMatchObject({ statusCode: 409, code: 'SOLAPAMIENTO' });
      expect(new Date((await leerTurno(fixture, turno.id)).inicio).toISOString()).toBe(
        '2026-12-01T10:00:00.000Z'
      );
      // El otro turno jamás se tocó.
      expect(new Date((await leerTurno(fixture, otro.id)).inicio).toISOString()).toBe(
        '2026-12-01T11:00:00.000Z'
      );
    });
  });

  it('(d) 40P01 en el UPDATE: reintenta la transacción completa y, si persiste, 409 (nunca 500)', async () => {
    // Cliente falso con el seam `{ cliente }` del repo: el SELECT FOR UPDATE
    // devuelve una fila PENDIENTE y el UPDATE falla con 40P01 las primeras
    // `fallosUpdate` veces.
    function clienteFalso({ fallosUpdate, turnoId }) {
      const llamadas = [];
      let intentosUpdate = 0;
      const fila = {
        id: turnoId,
        consultorio_id: randomUUID(),
        paciente_id: randomUUID(),
        profesional_id: randomUUID(),
        sillon_box_id: randomUUID(),
        prestacion_id: randomUUID(),
        inicio: new Date('2026-12-01T10:00:00Z'),
        fin: new Date('2026-12-01T10:30:00Z'),
        duracion_min: 30,
        estado: 'PENDIENTE',
        creado_en: new Date(),
      };
      return {
        llamadas,
        async query(sql) {
          const palabra = sql.replace(/\s+/g, ' ').trim().split(' ')[0].toUpperCase();
          llamadas.push(palabra);
          if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(palabra)) return {};
          if (palabra === 'SELECT') return { rows: [fila] }; // FOR UPDATE + pre-check
          if (palabra === 'UPDATE') {
            intentosUpdate += 1;
            if (intentosUpdate <= fallosUpdate) {
              const error = new Error('deadlock detected');
              error.code = '40P01';
              throw error;
            }
            return { rows: [{ ...fila, reprogramado_en: new Date(), reprogramado_por: randomUUID() }] };
          }
          throw new Error(`SQL no soportado en el cliente falso: ${palabra}`);
        },
      };
    }

    const paramsFalsos = {
      turnoId: randomUUID(),
      consultorioId: randomUUID(),
      inicio: new Date('2026-12-01T15:00:00Z'),
      reprogramadoPor: randomUUID(),
    };
    const callback = () => ({
      inicio: new Date('2026-12-01T15:00:00Z'),
      fin: new Date('2026-12-01T15:30:00Z'),
    });

    // 40P01 una vez → la transacción COMPLETA se reintenta y triunfa.
    const unaVez = clienteFalso({ fallosUpdate: 1, turnoId: paramsFalsos.turnoId });
    const repoUnaVez = crearRepositorioTurnos({ cliente: unaVez });
    const resultado = await repoUnaVez.reprogramarTurno(paramsFalsos, callback);
    expect(resultado).toMatchObject({ id: paramsFalsos.turnoId });
    expect(unaVez.llamadas.filter((p) => p === 'BEGIN')).toHaveLength(2);

    // 40P01 en AMBOS intentos → 409 vía traducirViolacionExclusion, sin 3er BEGIN.
    const dosVeces = clienteFalso({ fallosUpdate: 2, turnoId: paramsFalsos.turnoId });
    const repoDosVeces = crearRepositorioTurnos({ cliente: dosVeces });
    const error = await capturarError(repoDosVeces.reprogramarTurno(paramsFalsos, callback));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ statusCode: 409, code: 'SOLAPAMIENTO' });
    expect(dosVeces.llamadas.filter((p) => p === 'BEGIN')).toHaveLength(2);
  });
});

/**
 * C07 task 4.3 — `mapearTurno` expone la auditoría de la 070:
 * `reprogramadoEn`/`reprogramadoPor` en NULL hasta la primera
 * reprogramación, con valores después de un `reprogramarTurno` exitoso.
 */
describe('repositorio: mapearTurno con auditoría de reprogramación (C07 task 4.3)', () => {
  it('un turno recién creado tiene reprogramadoEn y reprogramadoPor en null', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const repo = crearRepositorioTurnos();

      const turno = await repo.crearTurno({
        consultorioId: fixture.consultorioId,
        pacienteId: fixture.pacienteId,
        profesionalId: fixture.profesionalId,
        sillonBoxId: fixture.sillonBoxId,
        prestacionId: fixture.prestacionId,
        inicio: '2026-12-01T10:00:00Z',
        fin: '2026-12-01T10:30:00Z',
        duracionMin: 30,
      });

      expect(turno).toHaveProperty('reprogramadoEn', null);
      expect(turno).toHaveProperty('reprogramadoPor', null);
    });
  });

  it('tras un reprogramarTurno exitoso, el DTO devuelve ambos campos con valor', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const repo = crearRepositorioTurnos();
      const creado = await repo.crearTurno({
        consultorioId: fixture.consultorioId,
        pacienteId: fixture.pacienteId,
        profesionalId: fixture.profesionalId,
        sillonBoxId: fixture.sillonBoxId,
        prestacionId: fixture.prestacionId,
        inicio: '2026-12-01T10:00:00Z',
        fin: '2026-12-01T10:30:00Z',
        duracionMin: 30,
      });

      const reprogramado = await repo.reprogramarTurno(
        {
          turnoId: creado.id,
          consultorioId: fixture.consultorioId,
          inicio: '2026-12-01T15:00:00Z',
          reprogramadoPor: fixture.usuarioId,
        },
        () => ({
          inicio: new Date('2026-12-01T15:00:00Z'),
          fin: new Date('2026-12-01T15:30:00Z'),
        })
      );

      expect(reprogramado.reprogramadoEn).toBeInstanceOf(Date);
      expect(reprogramado.reprogramadoPor).toBe(fixture.usuarioId);
      expect(new Date(reprogramado.inicio).toISOString()).toBe('2026-12-01T15:00:00.000Z');
      expect(new Date(reprogramado.fin).toISOString()).toBe('2026-12-01T15:30:00.000Z');
    });
  });
});

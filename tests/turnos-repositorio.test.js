import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { crearRepositorioTurnos } from '../src/modules/turnos/repositorio.js';
import { conFixtureTurnos, crearFixtureTurnos } from './helpers/turnos-fixtures.js';

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

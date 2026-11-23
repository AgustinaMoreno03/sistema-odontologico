import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errores.js';
import { crearRepositorioTurnos } from '../src/modules/turnos/repositorio.js';
import { cancelarTurno } from '../src/modules/turnos/servicios.js';
import { conFixtureTurnos, crearFixtureTurnos, crearTurnoPartida } from './helpers/turnos-fixtures.js';

/**
 * C06 task 3.1 — cancelación transaccional contra PostgreSQL real.
 * El callback expresa la decisión de dominio bajo el lock del repositorio;
 * los datos y auditorías de partida son ficticios.
 */
const args = (fixture, turnoId, overrides = {}) => ({
  turnoId,
  consultorioId: fixture.consultorioId,
  canceladoPor: fixture.usuarioId,
  solicitadoPor: 'PACIENTE',
  ...overrides,
});

function validarCancelacion(turno, ahora) {
  if (turno.estado === 'CANCELADO') {
    throw new ApiError(409, 'TURNO_YA_CANCELADO', 'El turno ya está cancelado');
  }
  if (!['PENDIENTE', 'CONFIRMADO'].includes(turno.estado)) {
    throw new ApiError(409, 'ESTADO_INVALIDO', 'El estado del turno no permite cancelarlo');
  }
  if (new Date(turno.inicio).getTime() <= new Date(ahora).getTime()) {
    throw new ApiError(409, 'TURNO_PASADO', 'No se puede cancelar un turno que ya comenzó');
  }
}

async function leerAuditoria(fixture, turnoId) {
  const { rows } = await fixture.consultar(
    `SELECT estado, cancelado_en, cancelado_por, solicitado_por
       FROM turno WHERE id = $1 AND consultorio_id = $2`,
    [turnoId, fixture.consultorioId]
  );
  return rows[0] ?? null;
}

async function capturarError(promesa) {
  try {
    await promesa;
    return null;
  } catch (error) {
    return error;
  }
}

describe('repositorio: cancelarTurno transaccional (C06 task 3.1)', () => {
  it('el servicio valida UUID y solicitadoPor antes de acceder al repositorio', async () => {
    await expect(cancelarTurno({
      turnoId: 'no-es-uuid', consultorioId: randomUUID(), usuarioId: randomUUID(),
      solicitadoPor: 'PACIENTE',
    })).rejects.toMatchObject({ statusCode: 400, code: 'VALIDACION' });
    await expect(cancelarTurno({
      turnoId: randomUUID(), consultorioId: randomUUID(), usuarioId: randomUUID(),
      solicitadoPor: 'OTRO',
    })).rejects.toMatchObject({ statusCode: 400, code: 'VALIDACION' });
  });

  it('el servicio cancela turno futuro y registra el operador recibido', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const turno = await crearTurnoPartida(fixture);
      const resultado = await cancelarTurno({
        turnoId: turno.id,
        consultorioId: fixture.consultorioId,
        usuarioId: fixture.usuarioId,
        solicitadoPor: 'CONSULTORIO',
      });
      expect(resultado).toMatchObject({
        id: turno.id, estado: 'CANCELADO',
        canceladoPor: fixture.usuarioId, solicitadoPor: 'CONSULTORIO',
      });
    });
  });

  it.each([
    ['CANCELADO', '2030-02-20T10:00:00Z', 'TURNO_YA_CANCELADO'],
    ['ATENDIDO', '2030-02-20T10:00:00Z', 'ESTADO_INVALIDO'],
    ['PENDIENTE', new Date(Date.now() - 60_000).toISOString(), 'TURNO_PASADO'],
  ])('el servicio responde 409 %s → %s', async (estado, inicio, code) => {
    await conFixtureTurnos(async ({ fixture }) => {
      const turno = await crearTurnoPartida(fixture, { estado, inicio });
      await expect(cancelarTurno({
        turnoId: turno.id,
        consultorioId: fixture.consultorioId,
        usuarioId: fixture.usuarioId,
        solicitadoPor: 'PACIENTE',
      })).rejects.toMatchObject({ statusCode: 409, code });
    });
  });

  it.each(['PENDIENTE', 'CONFIRMADO'])(
    'cancela turno %s y persiste auditoría UTC, operador y solicitante',
    async (estado) => {
      await conFixtureTurnos(async ({ fixture }) => {
        const turno = await crearTurnoPartida(fixture, { estado });
        const repo = crearRepositorioTurnos();

        const resultado = await repo.cancelarTurno(args(fixture, turno.id), validarCancelacion);

        expect(resultado).toMatchObject({
          id: turno.id,
          estado: 'CANCELADO',
          canceladoPor: fixture.usuarioId,
          solicitadoPor: 'PACIENTE',
        });
        expect(resultado.canceladoEn).toBeInstanceOf(Date);
        const fila = await leerAuditoria(fixture, turno.id);
        expect(fila.estado).toBe('CANCELADO');
        expect(fila.cancelado_en).toBeInstanceOf(Date);
        expect(fila.cancelado_por).toBe(fixture.usuarioId);
        expect(fila.solicitado_por).toBe('PACIENTE');
      });
    }
  );

  it('id inexistente o turno de otro consultorio → 404 TURNO_NO_ENCONTRADO sin cambios', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const repo = crearRepositorioTurnos();
      const propio = await crearTurnoPartida(fixture);

      const inexistente = await capturarError(
        repo.cancelarTurno(args(fixture, randomUUID()), validarCancelacion)
      );
      expect(inexistente).toMatchObject({ statusCode: 404, code: 'TURNO_NO_ENCONTRADO' });

      const otro = await crearFixtureTurnos();
      try {
        const ajeno = await crearTurnoPartida(otro);
        const errorAjeno = await capturarError(
          repo.cancelarTurno(args(fixture, ajeno.id), validarCancelacion)
        );
        expect(errorAjeno).toMatchObject({ statusCode: 404, code: 'TURNO_NO_ENCONTRADO' });
        expect(await leerAuditoria(otro, ajeno.id)).toMatchObject({
          estado: 'PENDIENTE',
          cancelado_en: null,
          cancelado_por: null,
          solicitado_por: null,
        });
      } finally {
        await otro.limpiar();
      }

      expect(await leerAuditoria(fixture, propio.id)).toMatchObject({
        estado: 'PENDIENTE',
        cancelado_en: null,
        cancelado_por: null,
        solicitado_por: null,
      });
    });
  });

  it.each([
    ['CANCELADO', 'futuro', 'TURNO_YA_CANCELADO'],
    ['ATENDIDO', 'futuro', 'ESTADO_INVALIDO'],
    ['AUSENTE', 'futuro', 'ESTADO_INVALIDO'],
    ['PENDIENTE', 'pasado', 'TURNO_PASADO'],
  ])('%s %s → 409 %s y conserva estado y auditoría', async (estado, tiempo, code) => {
    await conFixtureTurnos(async ({ fixture }) => {
      const inicio =
        tiempo === 'pasado'
          ? new Date(Date.now() - 60_000).toISOString()
          : '2030-02-20T10:00:00Z';
      const turno = await crearTurnoPartida(fixture, { inicio, estado });
      if (estado === 'CANCELADO') {
        await fixture.consultar(
          `UPDATE turno
              SET cancelado_en = '2026-01-02T03:04:05Z',
                  cancelado_por = $2,
                  solicitado_por = 'CONSULTORIO'
            WHERE id = $1`,
          [turno.id, fixture.usuarioId]
        );
      }
      const auditoriaOriginal = await leerAuditoria(fixture, turno.id);

      const error = await capturarError(
        crearRepositorioTurnos().cancelarTurno(args(fixture, turno.id), validarCancelacion)
      );

      expect(error).toMatchObject({ statusCode: 409, code });
      expect(await leerAuditoria(fixture, turno.id)).toEqual(auditoriaOriginal);
    });
  });
});

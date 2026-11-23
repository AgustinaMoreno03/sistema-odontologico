import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { conFixtureTurnos, crearFixtureTurnos, crearTurnoPartida } from './helpers/turnos-fixtures.js';
import { SECRETO_TEST } from './helpers/tokens.js';

/**
 * Smoke test de la task 1.2 (C05): el helper de fixtures de turnos crea un
 * consultorio propio con TODOS los recursos que un turno necesita (paciente,
 * profesional, sillón/box y prestación), todo ficticio (regla dura 1), y al
 * salir limpia SOLO lo suyo en orden de FK, sin DELETE globales.
 * Patrón: tests/helpers/catalogo-fixtures.js.
 */
describe('helper de fixtures de turnos', () => {
  it('crea los recursos ficticios del turno y al salir no queda nada huérfano', async () => {
    const fixture = await conFixtureTurnos(async ({ fixture, token }) => {
      // Token ficticio del rol con permiso de crear turnos.
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);

      // Los cinco registros existen y pertenecen AL consultorio del fixture.
      const recursos = [
        ['paciente', fixture.pacienteId],
        ['profesional', fixture.profesionalId],
        ['sillon_box', fixture.sillonBoxId],
        ['prestacion', fixture.prestacionId],
      ];
      for (const [tabla, id] of recursos) {
        const { rows } = await fixture.consultar(
          `SELECT 1 FROM ${tabla} WHERE id = $1 AND consultorio_id = $2`,
          [id, fixture.consultorioId]
        );
        expect(rows, `fila de ${tabla}`).toHaveLength(1);
      }

      return fixture;
    });

    // limpiar() ya corrió: el consultorio DE ESTE fixture ya no existe.
    const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await cliente.connect();
    try {
      const { rows } = await cliente.query('SELECT 1 FROM consultorio WHERE id = $1', [
        fixture.consultorioId,
      ]);
      expect(rows, 'consultorio tras limpiar').toHaveLength(0);
    } finally {
      await cliente.end().catch(() => {});
    }
  });
});

/**
 * C07 task 1.2 — el fixture crea un `usuario` FICTICIO y firma el token con
 * ESE id: la FK `reprogramado_por → usuario(id)` de la migración 070 lo
 * exige (design D5). Además publica `crearTurnoPartida` para armar el
 * escenario de reprogramación (turno PENDIENTE de partida, o en estado
 * CANCELADO/ATENDIDO vía SQL directa solo en tests, con overrides de
 * recursos para aislar el conflicto de S2).
 */
describe('C07 task 1.2 — usuario ficticio del fixture y turnos de partida', () => {
  it('crea un usuario ficticio en el consultorio y el token del fixture referencia ESE id', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      // El usuario existe, es del consultorio del fixture y su rol coincide
      // con el del token (ambos ficticios, regla dura 1).
      const { rows } = await fixture.consultar(
        'SELECT consultorio_id, rol FROM usuario WHERE id = $1',
        [fixture.usuarioId]
      );
      expect(rows, 'usuario del fixture').toHaveLength(1);
      expect(rows[0].consultorio_id).toBe(fixture.consultorioId);
      expect(rows[0].rol).toBe('ADMIN_CONSULTORIO');

      // El JWT firmado por conFixtureTurnos referencia ESE usuario (no un
      // UUID aleatorio): es el que la FK reprogramado_por va a aceptar.
      const payload = jwt.verify(token, SECRETO_TEST);
      expect(payload.usuarioId).toBe(fixture.usuarioId);
      expect(payload.consultorioId).toBe(fixture.consultorioId);
      expect(payload.rol).toBe('ADMIN_CONSULTORIO');
    });
  });

  it('crearTurnoPartida crea un turno PENDIENTE 10:00–10:30 UTC con los recursos del fixture', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const turno = await crearTurnoPartida(fixture);

      expect(turno).toMatchObject({
        consultorioId: fixture.consultorioId,
        pacienteId: fixture.pacienteId,
        profesionalId: fixture.profesionalId,
        sillonBoxId: fixture.sillonBoxId,
        prestacionId: fixture.prestacionId,
        duracionMin: 30,
        estado: 'PENDIENTE',
      });
      expect(new Date(turno.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
      expect(new Date(turno.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
      // Aún no fue reprogramado: las columnas de auditoría de la 070 están NULL.
      const { rows } = await fixture.consultar(
        'SELECT reprogramado_en, reprogramado_por FROM turno WHERE id = $1',
        [turno.id]
      );
      expect(rows[0].reprogramado_en).toBeNull();
      expect(rows[0].reprogramado_por).toBeNull();
    });
  });

  it('crearTurnoPartida admite overrides de estado (CANCELADO/ATENDIDO) y de recursos', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      // Estado vía SQL directa SOLO en tests (no existe API de estados: C06).
      const cancelado = await crearTurnoPartida(fixture, {
        inicio: '2026-12-01T11:00:00Z',
        estado: 'CANCELADO',
      });
      expect(cancelado.estado).toBe('CANCELADO');
      expect(new Date(cancelado.inicio).toISOString()).toBe('2026-12-01T11:00:00.000Z');
      expect(new Date(cancelado.fin).toISOString()).toBe('2026-12-01T11:30:00.000Z');

      const atendido = await crearTurnoPartida(fixture, {
        inicio: '2026-12-01T12:00:00Z',
        estado: 'ATENDIDO',
        duracionMin: 45,
      });
      expect(atendido.estado).toBe('ATENDIDO');
      expect(new Date(atendido.fin).toISOString()).toBe('2026-12-01T12:45:00.000Z');

      // Recursos alternativos (aislan QUÉ recurso dispara el conflicto de S2):
      // `crearRecursos: true` inserta paciente/profesional/sillón FICTICIOS
      // nuevos y el turno los usa (las FKs de la 050 exigen filas reales).
      const otro = await crearTurnoPartida(fixture, {
        inicio: '2026-12-01T13:00:00Z',
        crearRecursos: true,
      });
      expect(otro.profesionalId).not.toBe(fixture.profesionalId);
      expect(otro.sillonBoxId).not.toBe(fixture.sillonBoxId);
      expect(otro.pacienteId).not.toBe(fixture.pacienteId);
      expect(otro.profesionalId).toEqual(expect.any(String));
      expect(otro.sillonBoxId).toEqual(expect.any(String));
      expect(otro.pacienteId).toEqual(expect.any(String));

      // Los tres turnos coexisten (horarios distintos, recursos distintos).
      const { rows } = await fixture.consultar(
        'SELECT count(*)::int AS total FROM turno WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].total).toBe(3);
    });
  });

  it('la limpieza por FK borra el turno auditado con reprogramado_por ANTES que el usuario', async () => {
    const fixture = await crearFixtureTurnos();
    try {
      // Turno que YA fue reprogramado: referencia al usuario del fixture
      // (misma FK que setea el UPDATE de reprogramarTurno).
      await fixture.consultar(
        `INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_box_id,
                            prestacion_id, inicio, fin, duracion_min, reprogramado_en, reprogramado_por)
         VALUES ($1, $2, $3, $4, $5, '2026-12-01T14:00:00Z', '2026-12-01T14:30:00Z', 30, now(), $6)`,
        [
          fixture.consultorioId,
          fixture.pacienteId,
          fixture.profesionalId,
          fixture.sillonBoxId,
          fixture.prestacionId,
          fixture.usuarioId,
        ]
      );

      // limpiar() borra turnos primero y luego el usuario: sin error de FK.
      await fixture.limpiar();

      const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await cliente.connect();
      try {
        const { rows } = await cliente.query(
          'SELECT 1 FROM usuario WHERE consultorio_id = $1',
          [fixture.consultorioId]
        );
        expect(rows, 'usuario huérfano tras limpiar').toHaveLength(0);
      } finally {
        await cliente.end().catch(() => {});
      }
    } catch (error) {
      await fixture.limpiar().catch(() => {});
      throw error;
    }
  });
});

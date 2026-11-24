import request from 'supertest';
import { expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { conFixtureTurnos, crearTurnoPartida } from './helpers/turnos-fixtures.js';

// C08: escenario aprobado "A no ve los turnos ni nombres de B".
// Preparación RED autorizada; todavía NO se implementa GET /api/agenda.
// PostgreSQL real, app real y tokens del helper C00. Sin mock de SQL/rutas.
it('C08: dos consultorios consultan su agenda por HTTP sin compartir turnos ni nombres', async () => {
  await conFixtureTurnos(async ({ fixture: a, token: tokenA }) => {
    await conFixtureTurnos(async ({ fixture: b, token: tokenB }) => {
      const nombreA = 'Paciente Ficticio Agenda A';
      const nombreB = 'Paciente Ficticio Agenda B';
      for (const [fixture, nombre] of [[a, nombreA], [b, nombreB]]) {
        await fixture.consultar(
          'UPDATE paciente SET nombre = $1, apellido = NULL WHERE id = $2 AND consultorio_id = $3',
          [nombre, fixture.pacienteId, fixture.consultorioId]
        );
      }

      const { rows: consultorios } = await a.consultar(
        'SELECT id FROM consultorio WHERE id = ANY($1::uuid[])',
        [[a.consultorioId, b.consultorioId]]
      );
      expect(consultorios.map(({ id }) => id).sort()).toEqual(
        [a.consultorioId, b.consultorioId].sort()
      );

      // Un turno real por consultorio, en el mismo horario. Son fixtures,
      // no creación de una ruta, repositorio o consulta productiva de agenda.
      const turnoA = await crearTurnoPartida(a, { inicio: '2026-12-01T13:00:00Z' });
      const turnoB = await crearTurnoPartida(b, { inicio: '2026-12-01T13:00:00Z' });
      const app = crearApp();

      // Verificar identidad y acceso a datos propios por una ruta EXISTENTE.
      // Si falla esto, no se presenta un 401 o error de setup como RED de C08.
      const [pacientesA, pacientesB] = await Promise.all([
        request(app).get('/api/pacientes').query({ q: nombreA })
          .set('Authorization', `Bearer ${tokenA}`),
        request(app).get('/api/pacientes').query({ q: nombreB })
          .set('Authorization', `Bearer ${tokenB}`),
      ]);
      expect([pacientesA.status, pacientesB.status]).toEqual([200, 200]);
      expect(pacientesA.body.map(({ id }) => id)).toEqual([a.pacienteId]);
      expect(pacientesB.body.map(({ id }) => id)).toEqual([b.pacienteId]);

      const rango = {
        desde: '2026-12-01T00:00:00-03:00',
        hasta: '2026-12-02T00:00:00-03:00',
      };
      // Ejecutar AMBAS consultas antes de la aserción que producirá el RED.
      const [agendaA, agendaB] = await Promise.all([
        request(app).get('/api/agenda').query(rango)
          .set('Authorization', `Bearer ${tokenA}`),
        request(app).get('/api/agenda').query(rango)
          .set('Authorization', `Bearer ${tokenB}`),
      ]);
      console.info('C08 aislamiento: ' + JSON.stringify({
        consultoriosPersistidos: consultorios.length,
        pacientesHTTP: [pacientesA.status, pacientesB.status],
        agendaHTTP: [agendaA.status, agendaB.status],
      }));

      // Esperar el contrato final (200), no 404: el fallo es genuino.
      expect([agendaA.status, agendaB.status], 'Agenda debe existir para ambos consultorios')
        .toEqual([200, 200]);
      expect(agendaA.body.turnos).toEqual([expect.objectContaining({
        id: turnoA.id,
        pacienteId: a.pacienteId,
        pacienteNombre: nombreA,
        pacienteApellido: null,
        profesionalId: a.profesionalId,
      })]);
      expect(agendaB.body.turnos).toEqual([expect.objectContaining({
        id: turnoB.id,
        pacienteId: b.pacienteId,
        pacienteNombre: nombreB,
        pacienteApellido: null,
        profesionalId: b.profesionalId,
      })]);
      expect(JSON.stringify(agendaA.body)).not.toContain(turnoB.id);
      expect(JSON.stringify(agendaA.body)).not.toContain(nombreB);
      expect(JSON.stringify(agendaB.body)).not.toContain(turnoA.id);
      expect(JSON.stringify(agendaB.body)).not.toContain(nombreA);
    }, { rol: 'RECEPCION' });
  }, { rol: 'RECEPCION' });
  // Los helpers limpian en finally por consultorio, también ante RED.
}, 20_000);

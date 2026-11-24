import { conFixtureTurnos, crearTurnoPartida } from '../helpers/turnos-fixtures.js';

// Fixtures propios C08 sobre los helpers existentes, sin modificarlos.
export async function conDosAgendas(funcion, { rolA = 'RECEPCION' } = {}) {
  await conFixtureTurnos(async ({ fixture: a, token: tokenA }) => {
    await conFixtureTurnos(async ({ fixture: b, token: tokenB }) => {
      for (const [fixture, nombre] of [[a, 'Paciente Ficticio C08 A'], [b, 'Paciente Ficticio C08 B']]) {
        await fixture.consultar(
          'UPDATE paciente SET nombre = $1 WHERE id = $2 AND consultorio_id = $3',
          [nombre, fixture.pacienteId, fixture.consultorioId]
        );
      }
      const turnoA = await crearTurnoPartida(a, { inicio: '2026-12-01T13:00:00Z' });
      const turnoB = await crearTurnoPartida(b, { inicio: '2026-12-01T13:00:00Z' });
      await funcion({ a, b, tokenA, tokenB, turnoA, turnoB });
    }, { rol: 'RECEPCION' });
  }, { rol: rolA });
}

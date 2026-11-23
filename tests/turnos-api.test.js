import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { manejadorErrores } from '../src/errores.js';
import { crearRouterTurnos } from '../src/modules/turnos/rutas.js';
import { crearToken } from './helpers/tokens.js';
import { conFixtureTurnos, crearTurnoPartida } from './helpers/turnos-fixtures.js';

/**
 * Spec turnos R1 + design D5 — capa HTTP de `POST /api/turnos`.
 * Arnés mínimo al estilo de `appProtegida.js`: la app se arma en el test
 * con el manejador de errores central SIEMPRE al final. El montaje real en
 * `src/app.js` es la tarea 5.2.
 */
function appDeTurnos() {
  const app = express();
  app.use(express.json());
  app.use('/api/turnos', crearRouterTurnos());
  app.use(manejadorErrores);
  return app;
}

/** Cuerpo bien formado (los 4 UUID reales + inicio en UTC). */
function cuerpoValido() {
  return {
    pacienteId: randomUUID(),
    profesionalId: randomUUID(),
    sillonBoxId: randomUUID(),
    prestacionId: randomUUID(),
    inicio: '2026-11-23T17:00:00Z',
  };
}

function tokenRecepcion() {
  return crearToken({
    usuarioId: randomUUID(),
    consultorioId: randomUUID(),
    rol: 'RECEPCION',
  });
}

describe('POST /api/turnos — capa HTTP (spec R1)', () => {
  it('sin token → 401 TOKEN_INVALIDO', async () => {
    const res = await request(appDeTurnos()).post('/api/turnos').send(cuerpoValido());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDO');
  });

  it('rol ODONTOLOGO → 403 SIN_PERMISO y no se crea ningún turno', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const res = await request(appDeTurnos())
          .post('/api/turnos')
          .set('Authorization', `Bearer ${token}`)
          .send(cuerpoValido());

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('SIN_PERMISO');

        const { rows } = await fixture.consultar(
          'SELECT COUNT(*)::int AS n FROM turno WHERE consultorio_id = $1',
          [fixture.consultorioId]
        );
        expect(rows[0].n).toBe(0);
      },
      { rol: 'ODONTOLOGO' }
    );
  });

  it('UUID malformado → 400 VALIDACION nombrando el campo', async () => {
    const res = await request(appDeTurnos())
      .post('/api/turnos')
      .set('Authorization', `Bearer ${tokenRecepcion()}`)
      .send({ ...cuerpoValido(), pacienteId: 'no-es-un-uuid' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
    expect(res.body.error.message).toContain('pacienteId');
  });

  it('inicio sin zona horaria → 400 VALIDACION nombrando inicio', async () => {
    const res = await request(appDeTurnos())
      .post('/api/turnos')
      .set('Authorization', `Bearer ${tokenRecepcion()}`)
      .send({ ...cuerpoValido(), inicio: '2026-11-23T17:00:00' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
    expect(res.body.error.message).toContain('inicio');
  });

  it('crearApp() expone /api/turnos: con token válido y UUID malformado responde 400 (no 404)', async () => {
    const res = await request(crearApp())
      .post('/api/turnos')
      .set('Authorization', `Bearer ${tokenRecepcion()}`)
      .send({ ...cuerpoValido(), pacienteId: 'no-es-un-uuid' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });

  it('crearApp() /api/turnos sin token → 401 TOKEN_INVALIDO (el auth blanket de /api lo cubre aunque la ruta no exista)', async () => {
    const res = await request(crearApp()).post('/api/turnos').send(cuerpoValido());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDO');
  });
});

describe('Escenarios del spec — contra crearApp() real (Tanda D)', () => {
  it('S1 — reserva válida: 201 con fin = inicio + 30 min, estado PENDIENTE y fila persistida', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const inicio = '2026-11-24T15:00:00Z';

        const res = await request(crearApp())
          .post('/api/turnos')
          .set('Authorization', `Bearer ${token}`)
          .send({
            pacienteId: fixture.pacienteId,
            profesionalId: fixture.profesionalId,
            sillonBoxId: fixture.sillonBoxId,
            prestacionId: fixture.prestacionId,
            inicio,
          });

        // Respuesta: 201 con inicio, fin = inicio + 30 min y PENDIENTE.
        expect(res.status).toBe(201);
        expect(res.body.inicio).toBeDefined();
        expect(res.body.fin).toBeDefined();
        expect(new Date(res.body.fin).getTime() - new Date(res.body.inicio).getTime()).toBe(
          30 * 60_000
        );
        expect(res.body.estado).toBe('PENDIENTE');

        // Fila en la base con esos valores, en el consultorio del token.
        const { rows } = await fixture.consultar(
          'SELECT inicio, fin, estado, duracion_min, consultorio_id FROM turno WHERE id = $1',
          [res.body.id]
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].estado).toBe('PENDIENTE');
        expect(rows[0].duracion_min).toBe(30);
        expect(new Date(rows[0].fin).getTime() - new Date(rows[0].inicio).getTime()).toBe(
          30 * 60_000
        );
        expect(rows[0].consultorio_id).toBe(fixture.consultorioId);
      },
      { rol: 'RECEPCION' }
    );
  });

  it('S2 — conflicto por profesional: 409 SOLAPAMIENTO y no se crea el segundo turno', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      // Turno previo REAL en la base (17:00–17:30 UTC) con el profesional P.
      await fixture.consultar(
        `INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_box_id,
                            prestacion_id, inicio, fin, duracion_min)
         VALUES ($1, $2, $3, $4, $5, '2026-11-24T17:00:00+00:00', '2026-11-24T17:30:00+00:00', 30)`,
        [
          fixture.consultorioId,
          fixture.pacienteId,
          fixture.profesionalId,
          fixture.sillonBoxId,
          fixture.prestacionId,
        ]
      );

      // Otro paciente y otro sillón (ficticios): el ÚNICO recurso en común
      // con el turno previo es el profesional P.
      const pacienteId2 = randomUUID();
      const sillonBoxId2 = randomUUID();
      await fixture.consultar(
        'INSERT INTO paciente (id, consultorio_id, nombre, telefono) VALUES ($1, $2, $3, $4)',
        [pacienteId2, fixture.consultorioId, 'Paciente S2 Ficticio', '11-5555-2222']
      );
      await fixture.consultar(
        'INSERT INTO sillon_box (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
        [sillonBoxId2, fixture.consultorioId, 'Box S2 Ficticio']
      );

      const res = await request(crearApp())
        .post('/api/turnos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          pacienteId: pacienteId2,
          profesionalId: fixture.profesionalId, // mismo profesional P
          sillonBoxId: sillonBoxId2, // otro sillón/box
          prestacionId: fixture.prestacionId,
          inicio: '2026-11-24T17:15:00Z', // empieza DURANTE el intervalo previo
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SOLAPAMIENTO');

      // No se creó el segundo turno: queda solo el previo.
      const { rows } = await fixture.consultar(
        'SELECT COUNT(*)::int AS n FROM turno WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].n).toBe(1);
    });
  });

  it('S3 — conflicto por sillón/box: 409 SOLAPAMIENTO y no se crea el segundo turno', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      // Turno previo REAL (17:00–17:30 UTC): mismo sillón S, otro profesional
      // y otro paciente — el ÚNICO recurso en común es el sillón.
      const profesionalId2 = randomUUID();
      const pacienteId2 = randomUUID();
      await fixture.consultar(
        'INSERT INTO profesional (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
        [profesionalId2, fixture.consultorioId, 'Profesional S3 Ficticio']
      );
      await fixture.consultar(
        'INSERT INTO paciente (id, consultorio_id, nombre, telefono) VALUES ($1, $2, $3, $4)',
        [pacienteId2, fixture.consultorioId, 'Paciente S3 Ficticio', '11-5555-3333']
      );
      await fixture.consultar(
        `INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_box_id,
                            prestacion_id, inicio, fin, duracion_min)
         VALUES ($1, $2, $3, $4, $5, '2026-11-24T17:00:00+00:00', '2026-11-24T17:30:00+00:00', 30)`,
        [
          fixture.consultorioId,
          pacienteId2,
          profesionalId2,
          fixture.sillonBoxId, // sillón S (el que se prueba)
          fixture.prestacionId,
        ]
      );

      // Reserva nueva: mismo sillón S, distinto profesional y paciente
      // (los del fixture, que no están en el turno previo).
      const res = await request(crearApp())
        .post('/api/turnos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          pacienteId: fixture.pacienteId,
          profesionalId: fixture.profesionalId,
          sillonBoxId: fixture.sillonBoxId, // mismo sillón S
          prestacionId: fixture.prestacionId,
          inicio: '2026-11-24T17:15:00Z', // durante el intervalo previo
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SOLAPAMIENTO');

      const { rows } = await fixture.consultar(
        'SELECT COUNT(*)::int AS n FROM turno WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].n).toBe(1); // solo el previo
    });
  });

  it('S4 — turno contiguo válido: 201 con inicio 17:30Z y fin 18:00Z, COUNT = 2', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      // Turno previo REAL 17:00–17:30 UTC con P, S y X del fixture.
      await fixture.consultar(
        `INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_box_id,
                            prestacion_id, inicio, fin, duracion_min)
         VALUES ($1, $2, $3, $4, $5, '2026-11-24T17:00:00+00:00', '2026-11-24T17:30:00+00:00', 30)`,
        [
          fixture.consultorioId,
          fixture.pacienteId,
          fixture.profesionalId,
          fixture.sillonBoxId,
          fixture.prestacionId,
        ]
      );

      // Reserva que empieza EXACTAMENTE cuando termina el previo (borde [)),
      // compartiendo los TRES recursos: el borde es lo que se prueba.
      const res = await request(crearApp())
        .post('/api/turnos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          pacienteId: fixture.pacienteId,
          profesionalId: fixture.profesionalId,
          sillonBoxId: fixture.sillonBoxId,
          prestacionId: fixture.prestacionId,
          inicio: '2026-11-24T17:30:00Z',
        });

      expect(res.status).toBe(201);
      expect(new Date(res.body.fin).getTime()).toBe(Date.parse('2026-11-24T18:00:00Z'));
      expect(res.body.estado).toBe('PENDIENTE');

      const { rows } = await fixture.consultar(
        'SELECT COUNT(*)::int AS n FROM turno WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].n).toBe(2); // previo + contiguo coexisten
    });
  });

  it('S5 — conflicto por paciente (RN-AG-01): 409 SOLAPAMIENTO y COUNT = 1', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      // Extras ficticios: otro profesional P2 y otro sillón S2.
      const profesionalId2 = randomUUID();
      const sillonBoxId2 = randomUUID();
      await fixture.consultar(
        'INSERT INTO profesional (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
        [profesionalId2, fixture.consultorioId, 'Profesional S5 Ficticio']
      );
      await fixture.consultar(
        'INSERT INTO sillon_box (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
        [sillonBoxId2, fixture.consultorioId, 'Box S5 Ficticio']
      );

      // Precondición EXPLÍCITA: el único recurso de solape compartido con el
      // turno previo va a ser el paciente X (profesional y sillón distintos).
      expect(profesionalId2).not.toBe(fixture.profesionalId);
      expect(sillonBoxId2).not.toBe(fixture.sillonBoxId);

      // Turno previo REAL: paciente X con P1 y S1 del fixture.
      await fixture.consultar(
        `INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_box_id,
                            prestacion_id, inicio, fin, duracion_min)
         VALUES ($1, $2, $3, $4, $5, '2026-11-24T17:00:00+00:00', '2026-11-24T17:30:00+00:00', 30)`,
        [
          fixture.consultorioId,
          fixture.pacienteId,
          fixture.profesionalId,
          fixture.sillonBoxId,
          fixture.prestacionId,
        ]
      );

      // Reserva nueva: MISMO paciente X, P2 y S2 distintos, 17:15Z (dentro).
      const res = await request(crearApp())
        .post('/api/turnos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          pacienteId: fixture.pacienteId, // mismo paciente X
          profesionalId: profesionalId2, // distinto
          sillonBoxId: sillonBoxId2, // distinto
          prestacionId: fixture.prestacionId,
          inicio: '2026-11-24T17:15:00Z',
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SOLAPAMIENTO');

      const { rows } = await fixture.consultar(
        'SELECT COUNT(*)::int AS n FROM turno WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].n).toBe(1); // solo el previo
    });
  });

  it('S6 — concurrencia: dos POST idénticos en paralelo → exactamente un 201 y un 409', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const cuerpo = {
        pacienteId: fixture.pacienteId,
        profesionalId: fixture.profesionalId,
        sillonBoxId: fixture.sillonBoxId,
        prestacionId: fixture.prestacionId,
        inicio: '2026-11-24T19:00:00Z',
      };

      let envioA = 0;
      let respuestaA = 0;
      let envioB = 0;
      let respuestaB = 0;

      const [pedidoA, pedidoB] = await Promise.all([
        (async () => {
          envioA = performance.now();
          const r = await request(crearApp())
            .post('/api/turnos')
            .set('Authorization', `Bearer ${token}`)
            .send(cuerpo);
          respuestaA = performance.now();
          return r;
        })(),
        (async () => {
          envioB = performance.now();
          const r = await request(crearApp())
            .post('/api/turnos')
            .set('Authorization', `Bearer ${token}`)
            .send(cuerpo);
          respuestaB = performance.now();
          return r;
        })(),
      ]);

      // Instantes de cada pedido (performance.now, ms desde el inicio del worker).
      console.log(
        `S6 instantes → A: envío=${envioA.toFixed(2)} respuesta=${respuestaA.toFixed(2)} status=${pedidoA.status} | ` +
          `B: envío=${envioB.toFixed(2)} respuesta=${respuestaB.toFixed(2)} status=${pedidoB.status}`
      );

      // Los intervalos [envío, respuesta] deben CRUZARSE: si uno termina
      // antes de que el otro empiece, esto no prueba concurrencia.
      const seCruzan = Math.max(envioA, envioB) < Math.min(respuestaA, respuestaB);
      expect(
        seCruzan,
        `intervalos sin cruce: A=[${envioA.toFixed(2)}, ${respuestaA.toFixed(2)}] ` +
          `B=[${envioB.toFixed(2)}, ${respuestaB.toFixed(2)}]`
      ).toBe(true);

      // Exactamente un 201 y un 409 con code SOLAPAMIENTO.
      const statuses = [pedidoA.status, pedidoB.status].sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409]);
      const pedido409 = pedidoA.status === 409 ? pedidoA : pedidoB;
      expect(pedido409.body.error.code).toBe('SOLAPAMIENTO');

      // Queda un solo turno creado.
      const { rows } = await fixture.consultar(
        'SELECT COUNT(*)::int AS n FROM turno WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].n).toBe(1);
    });
  });

  it('S7 — aislamiento: turnos solapados idénticos en A y B → ambos 201; consultorioId en query/body/header se ignora', async () => {
    await conFixtureTurnos(async (a) => {
      await conFixtureTurnos(async (b) => {
        // Turno previo REAL en A (17:00–17:30 UTC) con los recursos de A.
        await a.fixture.consultar(
          `INSERT INTO turno (consultorio_id, paciente_id, profesional_id, sillon_box_id,
                              prestacion_id, inicio, fin, duracion_min)
           VALUES ($1, $2, $3, $4, $5, '2026-11-24T17:00:00+00:00', '2026-11-24T17:30:00+00:00', 30)`,
          [
            a.fixture.consultorioId,
            a.fixture.pacienteId,
            a.fixture.profesionalId,
            a.fixture.sillonBoxId,
            a.fixture.prestacionId,
          ]
        );

        // Pedido idéntico (mismo intervalo) en B con el token de B → 201:
        // la validación está acotada al consultorio del token.
        const resB = await request(crearApp())
          .post('/api/turnos')
          .set('Authorization', `Bearer ${b.token}`)
          .send({
            pacienteId: b.fixture.pacienteId,
            profesionalId: b.fixture.profesionalId,
            sillonBoxId: b.fixture.sillonBoxId,
            prestacionId: b.fixture.prestacionId,
            inicio: '2026-11-24T17:00:00Z',
          });
        expect(resB.status).toBe(201);

        // Con el token de A: consultorioId de B intentado por query, body y
        // header x-tenant-* (que el middleware de C00 borra). El consultorio
        // usado tiene que ser A.
        const resA = await request(crearApp())
          .post(`/api/turnos?consultorioId=${b.fixture.consultorioId}`)
          .set('Authorization', `Bearer ${a.token}`)
          .set('x-tenant-consultorioId', b.fixture.consultorioId)
          .send({
            pacienteId: a.fixture.pacienteId,
            profesionalId: a.fixture.profesionalId,
            sillonBoxId: a.fixture.sillonBoxId,
            prestacionId: a.fixture.prestacionId,
            inicio: '2026-11-24T18:00:00Z',
            consultorioId: b.fixture.consultorioId, // debe ignorarse
          });
        expect(resA.status).toBe(201);

        // La fila creada es de A (verificable en la fila)…
        const { rows } = await a.fixture.consultar(
          'SELECT consultorio_id FROM turno WHERE id = $1',
          [resA.body.id]
        );
        expect(rows).toHaveLength(1);
        expect(rows[0].consultorio_id).toBe(a.fixture.consultorioId);

        // …y en el COUNT: A con 2 (previo + suyo), B solo con 1 (el suyo).
        const countA = await a.fixture.consultar(
          'SELECT COUNT(*)::int AS n FROM turno WHERE consultorio_id = $1',
          [a.fixture.consultorioId]
        );
        expect(countA.rows[0].n).toBe(2);
        const countB = await b.fixture.consultar(
          'SELECT COUNT(*)::int AS n FROM turno WHERE consultorio_id = $1',
          [b.fixture.consultorioId]
        );
        expect(countB.rows[0].n).toBe(1);

        // Sin filas cruzadas: el turno de B es de B.
        const filaB = await b.fixture.consultar(
          'SELECT consultorio_id FROM turno WHERE id = $1',
          [resB.body.id]
        );
        expect(filaB.rows[0].consultorio_id).toBe(b.fixture.consultorioId);
      });
    });
  });

  it('S7 — recurso de B enviado desde A → 422 idéntico al inexistente (respuesta completa, 4 campos)', async () => {
    await conFixtureTurnos(async (a) => {
      await conFixtureTurnos(async (b) => {
        const campos = [
          ['pacienteId', b.fixture.pacienteId],
          ['profesionalId', b.fixture.profesionalId],
          ['sillonBoxId', b.fixture.sillonBoxId],
          ['prestacionId', b.fixture.prestacionId],
        ];

        for (const [campo, recursoDeB] of campos) {
          const base = {
            pacienteId: a.fixture.pacienteId,
            profesionalId: a.fixture.profesionalId,
            sillonBoxId: a.fixture.sillonBoxId,
            prestacionId: a.fixture.prestacionId,
            inicio: '2026-11-24T20:00:00Z',
          };

          const resAjeno = await request(crearApp())
            .post('/api/turnos')
            .set('Authorization', `Bearer ${a.token}`)
            .send({ ...base, [campo]: recursoDeB });

          const resInexistente = await request(crearApp())
            .post('/api/turnos')
            .set('Authorization', `Bearer ${a.token}`)
            .send({ ...base, [campo]: randomUUID() });

          // Misma respuesta COMPLETA (status + code + mensaje), no solo el código.
          expect(resAjeno.status).toBe(422);
          expect(resInexistente.status).toBe(422);
          expect(resAjeno.body).toEqual(resInexistente.body);
          expect(resAjeno.body.error.code).toBe('REFERENCIA_INVALIDA');
          expect(resAjeno.body.error.message).toContain(campo);
        }
      });
    });
  });

  it('S8 — 422 por campo con datos reales: inactivo/ajeno/inexistente → bodies idénticos', async () => {
    await conFixtureTurnos(async (a) => {
      await conFixtureTurnos(async (b) => {
        // Datos REALES en A: profesional inactivo y prestación inactiva
        // (activo = false en la base, no fakes de servicio).
        const profesionalInactivo = randomUUID();
        await a.fixture.consultar(
          'INSERT INTO profesional (id, consultorio_id, nombre, activo) VALUES ($1, $2, $3, false)',
          [profesionalInactivo, a.fixture.consultorioId, 'Profesional Inactivo S8']
        );
        const prestacionInactiva = randomUUID();
        await a.fixture.consultar(
          'INSERT INTO prestacion (id, consultorio_id, nombre, duracion_min, activo) VALUES ($1, $2, $3, 45, false)',
          [prestacionInactiva, a.fixture.consultorioId, 'Prestacion Inactiva S8']
        );

        const enviar = (overrides) =>
          request(crearApp())
            .post('/api/turnos')
            .set('Authorization', `Bearer ${a.token}`)
            .send({
              pacienteId: a.fixture.pacienteId,
              profesionalId: a.fixture.profesionalId,
              sillonBoxId: a.fixture.sillonBoxId,
              prestacionId: a.fixture.prestacionId,
              inicio: '2026-11-24T21:00:00Z',
              ...overrides,
            });

        const assert422 = (res, campo) => {
          expect(res.status).toBe(422);
          expect(res.body.error.code).toBe('REFERENCIA_INVALIDA');
          expect(res.body.error.message).toContain(campo);
        };

        // profesionalId: inactivo (real) vs ajeno (de B) vs inexistente.
        const profInactivo = await enviar({ profesionalId: profesionalInactivo });
        const profAjeno = await enviar({ profesionalId: b.fixture.profesionalId });
        const profInexistente = await enviar({ profesionalId: randomUUID() });
        assert422(profInactivo, 'profesionalId');
        assert422(profAjeno, 'profesionalId');
        assert422(profInexistente, 'profesionalId');
        expect(profAjeno.body).toEqual(profInactivo.body);
        expect(profInexistente.body).toEqual(profInactivo.body);

        // prestacionId: inactiva (real) vs ajena (de B) vs inexistente.
        const prestInactiva = await enviar({ prestacionId: prestacionInactiva });
        const prestAjena = await enviar({ prestacionId: b.fixture.prestacionId });
        const prestInexistente = await enviar({ prestacionId: randomUUID() });
        assert422(prestInactiva, 'prestacionId');
        assert422(prestAjena, 'prestacionId');
        assert422(prestInexistente, 'prestacionId');
        expect(prestAjena.body).toEqual(prestInactiva.body);
        expect(prestInexistente.body).toEqual(prestInactiva.body);

        // UUID inexistente para CADA campo → 422 nombrando ese campo.
        for (const campo of ['pacienteId', 'profesionalId', 'sillonBoxId', 'prestacionId']) {
          const res = await enviar({ [campo]: randomUUID() });
          assert422(res, campo);
        }

        // Entre campos, los mensajes completos solo se diferencian en el
        // nombre del campo (mismo texto, otro placeholder).
        const normalizar = (mensaje, campo) => mensaje.replaceAll(campo, '<campo>');
        expect(normalizar(profInactivo.body.error.message, 'profesionalId')).toBe(
          normalizar(prestInactiva.body.error.message, 'prestacionId')
        );
      });
    });
  });

  it('S9 — duración fijada al crearse: editar la prestación a 60 min no altera el turno existente y la nueva reserva usa 60', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      // Reserva 1 con la prestación de 30 min (10:00 UTC, como el spec S9).
      const res1 = await request(crearApp())
        .post('/api/turnos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          pacienteId: fixture.pacienteId,
          profesionalId: fixture.profesionalId,
          sillonBoxId: fixture.sillonBoxId,
          prestacionId: fixture.prestacionId,
          inicio: '2026-11-24T10:00:00Z',
        });
      expect(res1.status).toBe(201);
      expect(new Date(res1.body.fin).getTime() - new Date(res1.body.inicio).getTime()).toBe(
        30 * 60_000
      );
      expect(res1.body.duracionMin).toBe(30);

      // Editar la prestación a 60 min en la base REAL.
      await fixture.consultar('UPDATE prestacion SET duracion_min = 60 WHERE id = $1', [
        fixture.prestacionId,
      ]);

      // El turno existente conserva su fin (10:30 UTC) y su duración de 30.
      const { rows } = await fixture.consultar(
        'SELECT inicio, fin, duracion_min FROM turno WHERE id = $1',
        [res1.body.id]
      );
      expect(new Date(rows[0].fin).getTime()).toBe(Date.parse('2026-11-24T10:30:00Z'));
      expect(new Date(rows[0].fin).getTime() - new Date(rows[0].inicio).getTime()).toBe(
        30 * 60_000
      );
      expect(rows[0].duracion_min).toBe(30);

      // Una nueva reserva posterior con la MISMA prestación se calcula con 60.
      const res2 = await request(crearApp())
        .post('/api/turnos')
        .set('Authorization', `Bearer ${token}`)
        .send({
          pacienteId: fixture.pacienteId,
          profesionalId: fixture.profesionalId,
          sillonBoxId: fixture.sillonBoxId,
          prestacionId: fixture.prestacionId,
          inicio: '2026-11-24T11:00:00Z',
        });
      expect(res2.status).toBe(201);
      expect(new Date(res2.body.fin).getTime()).toBe(Date.parse('2026-11-24T12:00:00Z'));
      expect(new Date(res2.body.fin).getTime() - new Date(res2.body.inicio).getTime()).toBe(
        60 * 60_000
      );
      expect(res2.body.duracionMin).toBe(60);
    });
  });

  it('S10 — ODONTOLOGO → 403 SIN_PERMISO y no se crea ningún turno (contra crearApp())', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        // Datos válidos y activos del consultorio A (fixture).
        const conteo = async () => {
          const { rows } = await fixture.consultar(
            'SELECT COUNT(*)::int AS n FROM turno WHERE consultorio_id = $1',
            [fixture.consultorioId]
          );
          return rows[0].n;
        };
        const antes = await conteo();

        const res = await request(crearApp())
          .post('/api/turnos')
          .set('Authorization', `Bearer ${token}`)
          .send({
            pacienteId: fixture.pacienteId,
            profesionalId: fixture.profesionalId,
            sillonBoxId: fixture.sillonBoxId,
            prestacionId: fixture.prestacionId,
            inicio: '2026-11-24T16:00:00Z',
          });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('SIN_PERMISO');

        // El COUNT es idéntico al de antes del pedido: no se creó nada.
        expect(await conteo()).toBe(antes);
      },
      { rol: 'ODONTOLOGO' }
    );
  });
});

/**
 * C07 task 6.1 — `PATCH /api/turnos/:id/reprogramar` en la capa HTTP
 * (design D4/D6): SOLO forma (`:id` UUID + `inicio` ISO con timezone) y
 * guardia de rol (`RECEPCION`/`ADMIN_CONSULTORIO`, RN-AG-03); el
 * `consultorioId` y el `usuarioId` salen SOLO de `req.auth` (regla dura 2).
 * Sin tocar `src/app.js` (el router ya estaba montado por C05).
 */
describe('PATCH /api/turnos/:id/reprogramar — capa HTTP (C07 task 6.1)', () => {
  it('sin token → 401 TOKEN_INVALIDO', async () => {
    const res = await request(appDeTurnos())
      .patch(`/api/turnos/${randomUUID()}/reprogramar`)
      .send({ inicio: '2026-12-01T15:00:00Z' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALIDO');
  });

  it(':id malformado → 400 VALIDACION sin tocar la base', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const turno = await crearTurnoPartida(fixture);

      const res = await request(appDeTurnos())
        .patch('/api/turnos/no-es-un-uuid/reprogramar')
        .set('Authorization', `Bearer ${token}`)
        .send({ inicio: '2026-12-01T15:00:00Z' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDACION');
      expect(res.body.error.message).toContain('id');

      // El turno sigue en su horario original.
      const { rows } = await fixture.consultar(
        'SELECT inicio FROM turno WHERE id = $1',
        [turno.id]
      );
      expect(new Date(rows[0].inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
    });
  });

  it('inicio sin timezone → 400 VALIDACION sin tocar la base', async () => {
    await conFixtureTurnos(async ({ fixture, token }) => {
      const turno = await crearTurnoPartida(fixture);

      const res = await request(appDeTurnos())
        .patch(`/api/turnos/${turno.id}/reprogramar`)
        .set('Authorization', `Bearer ${token}`)
        .send({ inicio: '2026-12-01T15:00:00' }); // sin zona horaria

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDACION');
      expect(res.body.error.message).toContain('inicio');

      const { rows } = await fixture.consultar(
        'SELECT inicio FROM turno WHERE id = $1',
        [turno.id]
      );
      expect(new Date(rows[0].inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
    });
  });

  it('rol ODONTOLOGO → 403 SIN_PERMISO (después de la forma, antes de tocar la base)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await crearTurnoPartida(fixture);

        const res = await request(appDeTurnos())
          .patch(`/api/turnos/${turno.id}/reprogramar`)
          .set('Authorization', `Bearer ${token}`)
          .send({ inicio: '2026-12-01T15:00:00Z' });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('SIN_PERMISO');

        // El turno no se modificó (ni horario ni auditoría).
        const { rows } = await fixture.consultar(
          'SELECT inicio, reprogramado_en FROM turno WHERE id = $1',
          [turno.id]
        );
        expect(new Date(rows[0].inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
        expect(rows[0].reprogramado_en).toBeNull();
      },
      { rol: 'ODONTOLOGO' }
    );
  });

  it('crearApp() expone el PATCH: con token válido e id malformado responde 400 (no 404)', async () => {
    const res = await request(crearApp())
      .patch('/api/turnos/no-es-un-uuid/reprogramar')
      .set('Authorization', `Bearer ${tokenRecepcion()}`)
      .send({ inicio: '2026-12-01T15:00:00Z' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDACION');
  });
});

/**
 * C07 tasks 7.1–7.8 — escenarios S1–S6 del spec + bordes de R2 y carrera,
 * contra `crearApp()` REAL y PostgreSQL real. Los recursos del escenario
 * salen del fixture (ficticios, regla dura 1); el token de recepción es el
 * del fixture (mismo usuario ficticio que la FK `reprogramado_por`).
 */
describe('Reprogramación — escenarios del spec contra crearApp() (C07 tasks 7.1–7.8)', () => {
  /** Turno PENDIENTE de partida 10:00–10:30 UTC (misma duración que S1). */
  async function turnoDePartida(fixture, overrides = {}) {
    return crearTurnoPartida(fixture, {
      inicio: '2026-12-01T10:00:00Z',
      ...overrides,
    });
  }

  async function leerTurno(fixture, turnoId) {
    const { rows } = await fixture.consultar(
      `SELECT inicio, fin, estado, reprogramado_en, reprogramado_por
       FROM turno WHERE id = $1 AND consultorio_id = $2`,
      [turnoId, fixture.consultorioId]
    );
    return rows[0] ?? null;
  }

  it('S1 — reprogramación exitosa: 200 con el mismo turno, 15:00–15:30 UTC y auditoría (task 7.1)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await turnoDePartida(fixture);

        const res = await request(crearApp())
          .patch(`/api/turnos/${turno.id}/reprogramar`)
          .set('Authorization', `Bearer ${token}`)
          .send({ inicio: '2026-12-01T15:00:00Z' });

        // 200 con el MISMO turno y sus recursos (S1).
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          id: turno.id,
          pacienteId: fixture.pacienteId,
          profesionalId: fixture.profesionalId,
          sillonBoxId: fixture.sillonBoxId,
          prestacionId: fixture.prestacionId,
          duracionMin: 30,
          estado: 'PENDIENTE',
        });
        // El DTO de la capa HTTP nunca expone el consultorio (design D6).
        expect(res.body).not.toHaveProperty('consultorioId');

        // inicio 15:00 UTC, fin 15:30 UTC (misma duración, RN-AG-07).
        expect(new Date(res.body.inicio).toISOString()).toBe('2026-12-01T15:00:00.000Z');
        expect(new Date(res.body.fin).toISOString()).toBe('2026-12-01T15:30:00.000Z');

        // Auditoría registrada (design D5).
        expect(res.body.reprogramadoEn).toBeDefined();
        expect(new Date(res.body.reprogramadoEn).toString()).not.toBe('Invalid Date');
        expect(res.body.reprogramadoPor).toBe(fixture.usuarioId);

        // …y persistida en la base, acotada al consultorio del token.
        const fila = await leerTurno(fixture, turno.id);
        expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T15:00:00.000Z');
        expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T15:30:00.000Z');
        expect(fila.reprogramado_por).toBe(fixture.usuarioId);
        expect(fila.reprogramado_en).toBeInstanceOf(Date);
      },
      { rol: 'RECEPCION' }
    );
  });

  it('S2 — conflicto: 409 SOLAPAMIENTO y el turno conserva inicio 10:00 / fin 10:30 UTC (task 7.2)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await turnoDePartida(fixture); // 10:00–10:30, recurso P
        // Otro turno del MISMO profesional en 15:00–16:00 UTC (spec S2).
        await turnoDePartida(fixture, { inicio: '2026-12-01T15:00:00Z', duracionMin: 60 });

        const res = await request(crearApp())
          .patch(`/api/turnos/${turno.id}/reprogramar`)
          .set('Authorization', `Bearer ${token}`)
          .send({ inicio: '2026-12-01T15:15:00Z' }); // cae DENTRO de 15:00–16:00

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('SOLAPAMIENTO');

        // RN-AG-09: conserva inicio 10:00 / fin 10:30 UTC y sin auditoría.
        const fila = await leerTurno(fixture, turno.id);
        expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
        expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
        expect(fila.estado).toBe('PENDIENTE');
        expect(fila.reprogramado_en).toBeNull();
      },
      { rol: 'RECEPCION' }
    );
  });

  it('S3 — 404 TURNO_NO_ENCONTRADO: id inexistente y turno de otro consultorio, sin modificar filas (task 7.3)', async () => {
    await conFixtureTurnos(async (a) => {
      await conFixtureTurnos(async (b) => {
        // Turno ajeno en B (10:00–10:30 UTC, spec S3) y uno propio en A para
        // comprobar que NINGUNA fila se modifica (RN-TEN-01/RN-TEN-02).
        const turnoAjeno = await crearTurnoPartida(b.fixture);
        const turnoPropio = await turnoDePartida(a.fixture);

        // (a) id inexistente → 404 TURNO_NO_ENCONTRADO.
        const resInexistente = await request(crearApp())
          .patch(`/api/turnos/${randomUUID()}/reprogramar`)
          .set('Authorization', `Bearer ${a.token}`)
          .send({ inicio: '2026-12-01T15:00:00Z' });
        expect(resInexistente.status).toBe(404);
        expect(resInexistente.body.error.code).toBe('TURNO_NO_ENCONTRADO');

        // (b) turno de OTRO consultorio → 404 idéntico (aislamiento por
        // consultorio_id en el WHERE del FOR UPDATE, design D2).
        const resAjeno = await request(crearApp())
          .patch(`/api/turnos/${turnoAjeno.id}/reprogramar`)
          .set('Authorization', `Bearer ${a.token}`)
          .send({ inicio: '2026-12-01T15:00:00Z' });
        expect(resAjeno.status).toBe(404);
        expect(resAjeno.body.error.code).toBe('TURNO_NO_ENCONTRADO');

        // Mensaje seguro: no filtra el id del turno ajeno (task 3.1).
        expect(resAjeno.body.error.message).not.toContain(turnoAjeno.id);

        // Ningún turno modificado: el ajeno conserva 10:00–10:30 UTC, sin
        // auditoría y en su estado original…
        const filaAjena = await b.fixture.consultar(
          'SELECT inicio, fin, estado, reprogramado_en FROM turno WHERE id = $1',
          [turnoAjeno.id]
        );
        expect(new Date(filaAjena.rows[0].inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
        expect(new Date(filaAjena.rows[0].fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
        expect(filaAjena.rows[0].estado).toBe('PENDIENTE');
        expect(filaAjena.rows[0].reprogramado_en).toBeNull();

        // …y en A sigue solo el turno de partida, intacto.
        const filaPropia = await leerTurno(a.fixture, turnoPropio.id);
        expect(new Date(filaPropia.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
        expect(filaPropia.reprogramado_en).toBeNull();
        const countA = await a.fixture.consultar(
          'SELECT COUNT(*)::int AS n FROM turno WHERE consultorio_id = $1',
          [a.fixture.consultorioId]
        );
        expect(countA.rows[0].n).toBe(1);
      });
    });
  });

  it('S4 — turno CANCELADO → 409 ESTADO_INVALIDO y conserva horario y estado (task 7.4)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await turnoDePartida(fixture, { estado: 'CANCELADO' });

        const res = await request(crearApp())
          .patch(`/api/turnos/${turno.id}/reprogramar`)
          .set('Authorization', `Bearer ${token}`)
          .send({ inicio: '2026-12-01T15:00:00Z' }); // horario libre, sin conflictos

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('ESTADO_INVALIDO');

        // RN-AG-10: conserva horario y estado originales.
        const fila = await leerTurno(fixture, turno.id);
        expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
        expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
        expect(fila.estado).toBe('CANCELADO');
        expect(fila.reprogramado_en).toBeNull();
      },
      { rol: 'RECEPCION' }
    );
  });

  it('S4 — turno ATENDIDO → 409 ESTADO_INVALIDO y conserva horario y estado (task 7.4)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await turnoDePartida(fixture, { estado: 'ATENDIDO' });

        const res = await request(crearApp())
          .patch(`/api/turnos/${turno.id}/reprogramar`)
          .set('Authorization', `Bearer ${token}`)
          .send({ inicio: '2026-12-01T15:00:00Z' }); // horario libre, sin conflictos

        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe('ESTADO_INVALIDO');

        // RN-AG-10: conserva horario y estado originales.
        const fila = await leerTurno(fixture, turno.id);
        expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
        expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
        expect(fila.estado).toBe('ATENDIDO');
        expect(fila.reprogramado_en).toBeNull();
      },
      { rol: 'RECEPCION' }
    );
  });

  it('S5 — inicio sin zona horaria → 400 VALIDACION y el turno conserva su horario anterior (task 7.5)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await turnoDePartida(fixture);

        const res = await request(crearApp())
          .patch(`/api/turnos/${turno.id}/reprogramar`)
          .set('Authorization', `Bearer ${token}`)
          .send({ inicio: '2026-12-01T15:00:00' }); // ISO sin timezone

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDACION');
        expect(res.body.error.message).toContain('inicio');

        // El turno conserva su horario anterior (10:00–10:30 UTC).
        const fila = await leerTurno(fixture, turno.id);
        expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
        expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
        expect(fila.reprogramado_en).toBeNull();
      },
      { rol: 'RECEPCION' }
    );
  });

  it('S5 — :id malformado → 400 VALIDACION nombrando el campo (task 7.5)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await turnoDePartida(fixture);

        const res = await request(crearApp())
          .patch('/api/turnos/no-es-un-uuid/reprogramar')
          .set('Authorization', `Bearer ${token}`)
          .send({ inicio: '2026-12-01T15:00:00Z' });

        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDACION');
        expect(res.body.error.message).toContain('id');

        // El turno conserva su horario anterior.
        const fila = await leerTurno(fixture, turno.id);
        expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
        expect(fila.reprogramado_en).toBeNull();
      },
      { rol: 'RECEPCION' }
    );
  });

  it('S6 — token ODONTOLOGO → 403 SIN_PERMISO y el turno no se modifica (task 7.6)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await turnoDePartida(fixture);

        const res = await request(crearApp())
          .patch(`/api/turnos/${turno.id}/reprogramar`)
          .set('Authorization', `Bearer ${token}`) // rol ODONTOLOGO
          .send({ inicio: '2026-12-01T15:00:00Z' });

        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('SIN_PERMISO');

        // El turno no se modifica (ni horario, ni estado, ni auditoría).
        const fila = await leerTurno(fixture, turno.id);
        expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T10:00:00.000Z');
        expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T10:30:00.000Z');
        expect(fila.estado).toBe('PENDIENTE');
        expect(fila.reprogramado_en).toBeNull();

        // Triangulación: el MISMO turno con el mismo inicio SÍ se reprograma
        // con un rol permitido — el 403 fue por rol, no por el turno.
        const tokenRecepcion = crearToken({
          usuarioId: fixture.usuarioId,
          consultorioId: fixture.consultorioId,
          rol: 'RECEPCION',
        });
        const resPermitido = await request(crearApp())
          .patch(`/api/turnos/${turno.id}/reprogramar`)
          .set('Authorization', `Bearer ${tokenRecepcion}`)
          .send({ inicio: '2026-12-01T15:00:00Z' });
        expect(resPermitido.status).toBe(200);
      },
      { rol: 'ODONTOLOGO' }
    );
  });

  it('R2 — el turno que empieza justo cuando termina el reprogramado no bloquea ([), RN-AG-06) (task 7.7)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await turnoDePartida(fixture); // 10:00–10:30 → se mueve a 15:00–15:30
        // Vecino del MISMO profesional que empieza 15:30 (justo cuando termina).
        await turnoDePartida(fixture, { inicio: '2026-12-01T15:30:00Z', duracionMin: 60 });

        const res = await request(crearApp())
          .patch(`/api/turnos/${turno.id}/reprogramar`)
          .set('Authorization', `Bearer ${token}`)
          .send({ inicio: '2026-12-01T15:00:00Z' });

        expect(res.status).toBe(200);
        expect(new Date(res.body.inicio).toISOString()).toBe('2026-12-01T15:00:00.000Z');
        expect(new Date(res.body.fin).toISOString()).toBe('2026-12-01T15:30:00.000Z');
      },
      { rol: 'RECEPCION' }
    );
  });

  it('R2 — el turno que termina justo cuando empieza el reprogramado no bloquea ([), RN-AG-06) (task 7.7)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await turnoDePartida(fixture); // 10:00–10:30 → se mueve a 15:00–15:30
        // Vecino del MISMO profesional que termina 15:00 (justo cuando empieza).
        await turnoDePartida(fixture, { inicio: '2026-12-01T14:30:00Z', duracionMin: 30 });

        const res = await request(crearApp())
          .patch(`/api/turnos/${turno.id}/reprogramar`)
          .set('Authorization', `Bearer ${token}`)
          .send({ inicio: '2026-12-01T15:00:00Z' });

        expect(res.status).toBe(200);
        expect(new Date(res.body.inicio).toISOString()).toBe('2026-12-01T15:00:00.000Z');
        expect(new Date(res.body.fin).toISOString()).toBe('2026-12-01T15:30:00.000Z');
      },
      { rol: 'RECEPCION' }
    );
  });

  it('R2 — un turno CANCELADO en el nuevo rango no bloquea la reprogramación (task 7.7)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await turnoDePartida(fixture); // 10:00–10:30 → se mueve a 15:15–15:45
        // Vecino CANCELADO del MISMO profesional cubriendo el nuevo rango.
        await turnoDePartida(fixture, {
          inicio: '2026-12-01T15:00:00Z',
          duracionMin: 60,
          estado: 'CANCELADO',
        });

        const res = await request(crearApp())
          .patch(`/api/turnos/${turno.id}/reprogramar`)
          .set('Authorization', `Bearer ${token}`)
          .send({ inicio: '2026-12-01T15:15:00Z' });

        expect(res.status).toBe(200);
        expect(new Date(res.body.inicio).toISOString()).toBe('2026-12-01T15:15:00.000Z');
        expect(new Date(res.body.fin).toISOString()).toBe('2026-12-01T15:45:00.000Z');

        // El turno movido quedó auditado; el CANCELADO quedó intacto.
        const fila = await leerTurno(fixture, turno.id);
        expect(fila.reprogramado_por).toBe(fixture.usuarioId);
      },
      { rol: 'RECEPCION' }
    );
  });

  it('Carrera — dos PATCH idénticos en paralelo: dos 200 y un solo horario final (task 7.8)', async () => {
    await conFixtureTurnos(
      async ({ fixture, token }) => {
        const turno = await turnoDePartida(fixture); // 10:00–10:30

        const pedido = () =>
          request(crearApp())
            .patch(`/api/turnos/${turno.id}/reprogramar`)
            .set('Authorization', `Bearer ${token}`)
            .send({ inicio: '2026-12-01T15:00:00Z' });

        // Dos PATCH idénticos disparados en paralelo (design D2: el
        // SELECT … FOR UPDATE serializa ambos sobre la misma fila).
        const [res1, res2] = await Promise.all([pedido(), pedido()]);

        // Sin 500 y dos respuestas 2xx (el contrato exige 200 en ambas).
        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);

        // Un SOLO horario final en la base: la fila quedó en 15:00–15:30 UTC.
        const fila = await leerTurno(fixture, turno.id);
        expect(new Date(fila.inicio).toISOString()).toBe('2026-12-01T15:00:00.000Z');
        expect(new Date(fila.fin).toISOString()).toBe('2026-12-01T15:30:00.000Z');
        expect(fila.estado).toBe('PENDIENTE');
        expect(fila.reprogramado_por).toBe(fixture.usuarioId);

        // Y sigue siendo UNA sola fila para ese turno (sin duplicados).
        const { rows } = await fixture.consultar(
          'SELECT COUNT(*)::int AS n FROM turno WHERE id = $1',
          [turno.id]
        );
        expect(rows[0].n).toBe(1);
      },
      { rol: 'RECEPCION' }
    );
  });
});

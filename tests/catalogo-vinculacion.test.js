import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError } from '../src/errores.js';
import {
  desvincularUsuario,
  obtenerCatalogo,
  profesionalDeUsuario,
  vincularUsuario,
} from '../src/modules/catalogo/index.js';
import { crearFixture } from './helpers/catalogo-fixtures.js';

/**
 * C02 — vinculación identidad–ficha 1:1 opcional (spec "Vinculación
 * identidad y ficha profesional", design D1): SOLO interfaz de módulo (sin
 * HTTP), acotada al consultorio, sin restricción de rol (RN-AU-02) y sin
 * leer la tabla `usuario` desde `catalogo` (DD-13): el consumidor dueño de
 * los usuarios garantiza su existencia y pertenencia.
 *
 * Cada test crea SUS usuarios ficticios (regla dura 1) para no depender del
 * estado de los demás (el 1:1 hace que un usuario compartido acople los tests).
 */

let a;
let b;

const insertarProfesional = (fixture, nombre, activo = true) =>
  fixture
    .consultar(
      'INSERT INTO profesional (consultorio_id, nombre, activo) VALUES ($1, $2, $3) RETURNING id',
      [fixture.consultorioId, nombre, activo]
    )
    .then((r) => r.rows[0].id);

const insertarUsuario = (fixture, rol = 'ODONTOLOGO') =>
  fixture
    .consultar('INSERT INTO usuario (id, consultorio_id, rol) VALUES ($1, $2, $3) RETURNING id', [
      randomUUID(),
      fixture.consultorioId,
      rol,
    ])
    .then((r) => r.rows[0].id);

beforeAll(async () => {
  a = await crearFixture();
  b = await crearFixture();
});

afterAll(async () => {
  await a.limpiar();
  await b.limpiar();
});

describe('vincularUsuario / profesionalDeUsuario (interfaz de módulo para C01)', () => {
  it('vincula y resuelve inversamente: profesionalDeUsuario devuelve la ficha dentro del consultorio', async () => {
    const profesionalId = await insertarProfesional(a, 'Dra. Vinculada Uno');
    const usuarioId = await insertarUsuario(a);

    const resultado = await vincularUsuario({
      profesionalId,
      usuarioId,
      consultorioId: a.consultorioId,
    });

    expect(resultado).toBe(true);

    const ficha = await profesionalDeUsuario({ usuarioId, consultorioId: a.consultorioId });
    expect(ficha).toEqual(
      expect.objectContaining({ id: profesionalId, nombre: 'Dra. Vinculada Uno', usuarioId })
    );
  });

  it('el vínculo se permite sin restricción de rol (RN-AU-02): un usuario ADMIN_CONSULTORIO se vincula', async () => {
    const profesionalId = await insertarProfesional(a, 'Dra. Vinculada Dos');
    const usuarioAdmin = await insertarUsuario(a, 'ADMIN_CONSULTORIO');

    expect(
      await vincularUsuario({
        profesionalId,
        usuarioId: usuarioAdmin,
        consultorioId: a.consultorioId,
      })
    ).toBe(true);

    const ficha = await profesionalDeUsuario({
      usuarioId: usuarioAdmin,
      consultorioId: a.consultorioId,
    });
    expect(ficha.id).toBe(profesionalId);
  });

  it('un profesional de otro consultorio → false y ningún vínculo cambia', async () => {
    const profesionalDeB = await insertarProfesional(b, 'Dr. Externo');
    const usuarioDeA = await insertarUsuario(a);

    const resultado = await vincularUsuario({
      profesionalId: profesionalDeB,
      usuarioId: usuarioDeA,
      consultorioId: a.consultorioId,
    });

    expect(resultado).toBe(false);
    const { rows } = await b.consultar('SELECT usuario_id FROM profesional WHERE id = $1', [
      profesionalDeB,
    ]);
    expect(rows[0].usuario_id).toBeNull();
    expect(
      await profesionalDeUsuario({ usuarioId: usuarioDeA, consultorioId: b.consultorioId })
    ).toBeNull();
  });

  it('usuario ya vinculado a otra ficha → ApiError 409 RECURSO_DUPLICADO conservando el primer vínculo', async () => {
    const primera = await insertarProfesional(a, 'Dra. Primera Ficha');
    const segunda = await insertarProfesional(a, 'Dra. Segunda Ficha');
    const usuarioId = await insertarUsuario(a);

    await vincularUsuario({ profesionalId: primera, usuarioId, consultorioId: a.consultorioId });

    let error;
    try {
      await vincularUsuario({ profesionalId: segunda, usuarioId, consultorioId: a.consultorioId });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('RECURSO_DUPLICADO');

    // El primer vínculo se conserva; la segunda ficha queda sin vínculo.
    const ficha = await profesionalDeUsuario({ usuarioId, consultorioId: a.consultorioId });
    expect(ficha.id).toBe(primera);
    const { rows } = await a.consultar('SELECT usuario_id FROM profesional WHERE id = $1', [segunda]);
    expect(rows[0].usuario_id).toBeNull();
  });

  it('profesional ya vinculado a otro usuario → 409 RECURSO_DUPLICADO conservando el primer vínculo', async () => {
    const profesionalId = await insertarProfesional(a, 'Dra. Ocupada');
    const primerUsuario = await insertarUsuario(a);
    const segundoUsuario = await insertarUsuario(a);
    await vincularUsuario({
      profesionalId,
      usuarioId: primerUsuario,
      consultorioId: a.consultorioId,
    });

    let error;
    try {
      await vincularUsuario({
        profesionalId,
        usuarioId: segundoUsuario,
        consultorioId: a.consultorioId,
      });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('RECURSO_DUPLICADO');

    const { rows } = await a.consultar('SELECT usuario_id FROM profesional WHERE id = $1', [
      profesionalId,
    ]);
    expect(rows[0].usuario_id).toBe(primerUsuario);
  });

  it('revincular la misma pareja es idempotente y devuelve true', async () => {
    const profesionalId = await insertarProfesional(a, 'Dra. Re Vinculada');
    const usuarioId = await insertarUsuario(a);

    expect(
      await vincularUsuario({ profesionalId, usuarioId, consultorioId: a.consultorioId })
    ).toBe(true);
    expect(
      await vincularUsuario({ profesionalId, usuarioId, consultorioId: a.consultorioId })
    ).toBe(true);
  });
});

describe('desvincularUsuario (interfaz de módulo para C01)', () => {
  it('desvincula: devuelve true, profesionalDeUsuario → null y el profesional sigue publicado en el catálogo', async () => {
    const profesionalId = await insertarProfesional(a, 'Dra. Desvinculada');
    const usuarioId = await insertarUsuario(a);
    await vincularUsuario({ profesionalId, usuarioId, consultorioId: a.consultorioId });

    const resultado = await desvincularUsuario({
      profesionalId,
      consultorioId: a.consultorioId,
    });

    expect(resultado).toBe(true);
    expect(await profesionalDeUsuario({ usuarioId, consultorioId: a.consultorioId })).toBeNull();

    // Sigue publicado (el vínculo no define la disponibilidad).
    const catalogo = await obtenerCatalogo({ consultorioId: a.consultorioId });
    expect(catalogo.profesionales.map((f) => f.id)).toContain(profesionalId);

    // Idempotente: desvincular de nuevo sigue devolviendo true.
    expect(
      await desvincularUsuario({ profesionalId, consultorioId: a.consultorioId })
    ).toBe(true);
  });

  it('profesional de otro consultorio → false sin cambios', async () => {
    const profesionalDeB = await insertarProfesional(b, 'Dr. Externo Dos');
    const usuarioDeB = await insertarUsuario(b);
    await vincularUsuario({
      profesionalId: profesionalDeB,
      usuarioId: usuarioDeB,
      consultorioId: b.consultorioId,
    });

    expect(
      await desvincularUsuario({ profesionalId: profesionalDeB, consultorioId: a.consultorioId })
    ).toBe(false);

    const { rows } = await b.consultar('SELECT usuario_id FROM profesional WHERE id = $1', [
      profesionalDeB,
    ]);
    expect(rows[0].usuario_id).toBe(usuarioDeB);
  });
});

describe('borde de la vinculación (design D1/D8)', () => {
  it('profesionalDeUsuario devuelve también fichas inactivas (resuelve identidad, no disponibilidad)', async () => {
    const profesionalId = await insertarProfesional(a, 'Dra. Inactiva Vinculada', false);
    const usuarioId = await insertarUsuario(a);
    await vincularUsuario({ profesionalId, usuarioId, consultorioId: a.consultorioId });

    const ficha = await profesionalDeUsuario({ usuarioId, consultorioId: a.consultorioId });
    expect(ficha).toEqual(expect.objectContaining({ id: profesionalId, activo: false }));
  });

  it('un usuarioId inexistente viola la FK → ApiError 422 DATOS_INVALIDOS', async () => {
    const profesionalId = await insertarProfesional(a, 'Dra. Con Usuario Fantasma');

    let error;
    try {
      await vincularUsuario({
        profesionalId,
        usuarioId: randomUUID(),
        consultorioId: a.consultorioId,
      });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ApiError);
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe('DATOS_INVALIDOS');

    const { rows } = await a.consultar('SELECT usuario_id FROM profesional WHERE id = $1', [
      profesionalId,
    ]);
    expect(rows[0].usuario_id).toBeNull();
  });

  it('identificadores malformados lanzan ApiError 400 DATOS_INVALIDOS', async () => {
    for (const malformado of ['no-es-uuid', '', '123']) {
      for (const invocacion of [
        () =>
          vincularUsuario({
            profesionalId: malformado,
            usuarioId: randomUUID(),
            consultorioId: a.consultorioId,
          }),
        () =>
          vincularUsuario({
            profesionalId: randomUUID(),
            usuarioId: malformado,
            consultorioId: a.consultorioId,
          }),
        () => desvincularUsuario({ profesionalId: malformado, consultorioId: a.consultorioId }),
        () => profesionalDeUsuario({ usuarioId: malformado, consultorioId: a.consultorioId }),
      ]) {
        let error;
        try {
          await invocacion();
        } catch (err) {
          error = err;
        }
        expect(error, JSON.stringify(malformado)).toBeInstanceOf(ApiError);
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('DATOS_INVALIDOS');
      }
    }
  });
});

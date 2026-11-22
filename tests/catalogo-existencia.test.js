import { randomUUID } from 'node:crypto';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { ApiError, manejadorErrores } from '../src/errores.js';
import { existeProfesional, existeSillonBox } from '../src/modules/catalogo/index.js';
import { crearFixture } from './helpers/catalogo-fixtures.js';

/**
 * C02 — comprobaciones de existencia para turnos (spec "Comprobaciones de
 * existencia para turnos"): `existeProfesional` e `existeSillonBox` de la
 * interfaz pública del módulo (design D8). Semántica: existencia DENTRO del
 * consultorio incluidos los inactivos; `false` también para recursos de
 * otro consultorio. Identificadores malformados → 400; fallos de base → se
 * propagan al consumidor (y el manejador central responde 500).
 */

let a;
let b;
let profesionalActivo;
let profesionalInactivo;
let sillonActivo;
let sillonInactivo;

beforeAll(async () => {
  a = await crearFixture();
  b = await crearFixture();

  const profA = await a.consultar(
    'INSERT INTO profesional (consultorio_id, nombre) VALUES ($1, $2) RETURNING id',
    [a.consultorioId, 'Dra. María López']
  );
  profesionalActivo = profA.rows[0].id;

  const profIn = await a.consultar(
    'INSERT INTO profesional (consultorio_id, nombre, activo) VALUES ($1, $2, false) RETURNING id',
    [a.consultorioId, 'Dr. Retirado']
  );
  profesionalInactivo = profIn.rows[0].id;

  const sillA = await a.consultar(
    'INSERT INTO sillon_box (consultorio_id, nombre) VALUES ($1, $2) RETURNING id',
    [a.consultorioId, 'Sillón 1']
  );
  sillonActivo = sillA.rows[0].id;

  const sillIn = await a.consultar(
    'INSERT INTO sillon_box (consultorio_id, nombre, activo) VALUES ($1, $2, false) RETURNING id',
    [a.consultorioId, 'Sillón Retirado']
  );
  sillonInactivo = sillIn.rows[0].id;

  await b.consultar('INSERT INTO profesional (consultorio_id, nombre) VALUES ($1, $2)', [
    b.consultorioId,
    'Dr. Externo',
  ]);
});

afterAll(async () => {
  await a.limpiar();
  await b.limpiar();
});

const idProfesionalDeB = async () => {
  const { rows } = await b.consultar(
    'SELECT id FROM profesional WHERE consultorio_id = $1',
    [b.consultorioId]
  );
  return rows[0].id;
};

describe('existeProfesional / existeSillonBox (interfaz de módulo para C05)', () => {
  it('recursos propios del consultorio → true, incluidos los inactivos', async () => {
    expect(await existeProfesional({ profesionalId: profesionalActivo, consultorioId: a.consultorioId })).toBe(true);
    expect(await existeProfesional({ profesionalId: profesionalInactivo, consultorioId: a.consultorioId })).toBe(true);
    expect(await existeSillonBox({ sillonBoxId: sillonActivo, consultorioId: a.consultorioId })).toBe(true);
    expect(await existeSillonBox({ sillonBoxId: sillonInactivo, consultorioId: a.consultorioId })).toBe(true);
  });

  it('recursos de otro consultorio o inexistentes → false, igual que para un inexistente', async () => {
    const ajeno = await idProfesionalDeB();
    expect(await existeProfesional({ profesionalId: ajeno, consultorioId: a.consultorioId })).toBe(false);
    expect(await existeProfesional({ profesionalId: randomUUID(), consultorioId: a.consultorioId })).toBe(false);
    expect(await existeSillonBox({ sillonBoxId: randomUUID(), consultorioId: a.consultorioId })).toBe(false);
  });

  it('identificadores malformados lanzan ApiError 400 DATOS_INVALIDOS', async () => {
    for (const malformado of ['no-es-uuid', '', '123']) {
      let errorProfesional;
      try {
        await existeProfesional({ profesionalId: malformado, consultorioId: a.consultorioId });
      } catch (err) {
        errorProfesional = err;
      }
      expect(errorProfesional, `profesionalId ${JSON.stringify(malformado)}`).toBeInstanceOf(ApiError);
      expect(errorProfesional.statusCode).toBe(400);
      expect(errorProfesional.code).toBe('DATOS_INVALIDOS');

      let errorSillon;
      try {
        await existeSillonBox({ sillonBoxId: malformado, consultorioId: a.consultorioId });
      } catch (err) {
        errorSillon = err;
      }
      expect(errorSillon, `sillonBoxId ${JSON.stringify(malformado)}`).toBeInstanceOf(ApiError);
      expect(errorSillon.statusCode).toBe(400);
      expect(errorSillon.code).toBe('DATOS_INVALIDOS');

      let errorConsultorio;
      try {
        await existeSillonBox({ sillonBoxId: sillonActivo, consultorioId: malformado });
      } catch (err) {
        errorConsultorio = err;
      }
      expect(errorConsultorio, `consultorioId ${JSON.stringify(malformado)}`).toBeInstanceOf(ApiError);
      expect(errorConsultorio.statusCode).toBe(400);
      expect(errorConsultorio.code).toBe('DATOS_INVALIDOS');
    }
  });

  it('un fallo de base se propaga al consumidor y el manejador central responde 500 ERROR_INTERNO sin filtrar internals', async () => {
    const fallo = new Error('connection refused 127.0.0.1:5432 (detalle sensible)');
    const repoQueFalla = {
      obtenerProfesionalPorId: async () => {
        throw fallo;
      },
    };

    // (a) La función de módulo PROPAGA el error al consumidor (no lo traga).
    await expect(
      existeProfesional(
        { profesionalId: profesionalActivo, consultorioId: a.consultorioId },
        { profesionalRepo: repoQueFalla }
      )
    ).rejects.toBe(fallo);

    // (b) Un consumidor HTTP con el manejador central de C00 responde 500
    //     con mensaje seguro (patrón de inyección de C00, design D9).
    const appConsumidora = express();
    appConsumidora.get('/turnos/chequeo', async (req, res, next) => {
      try {
        const existe = await existeProfesional(
          { profesionalId: profesionalActivo, consultorioId: a.consultorioId },
          { profesionalRepo: repoQueFalla }
        );
        res.json({ existe });
      } catch (error) {
        next(error);
      }
    });
    appConsumidora.use(manejadorErrores);

    const res = await request(appConsumidora).get('/turnos/chequeo');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: { code: 'ERROR_INTERNO', message: 'Error interno del servidor' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/connection refused|detalle sensible|stack/i);
  });
});

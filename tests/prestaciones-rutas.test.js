import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { manejadorErrores } from '../src/errores.js';
import { middlewareAutenticacion } from '../src/modules/auth/rutas.js';
import { crearRouterPrestaciones } from '../src/modules/catalogo/prestaciones/rutas.js';
import { crearServiciosPrestaciones } from '../src/modules/catalogo/prestaciones/servicios.js';
import { crearToken } from './helpers/tokens.js';

const CONSULTORIO_A = '00000000-0000-4000-8000-000000000001';
const CONSULTORIO_B = '00000000-0000-4000-8000-000000000002';
const PRESTACION_A = '00000000-0000-4000-8000-000000000011';
const PRESTACION_B = '00000000-0000-4000-8000-000000000012';

function crearRepositorioFalso() {
  const datos = [
    { id: PRESTACION_A, consultorioId: CONSULTORIO_A, nombre: 'Limpieza', duracionMin: 30, descripcion: null, activo: true, creadoEn: '2026-01-01T00:00:00.000Z' },
    { id: PRESTACION_B, consultorioId: CONSULTORIO_A, nombre: 'Consulta', duracionMin: 45, descripcion: null, activo: false, creadoEn: '2026-01-02T00:00:00.000Z' },
  ];

  function dto(prestacion) {
    if (!prestacion) return null;
    const { consultorioId, ...resultado } = prestacion;
    return resultado;
  }

  return {
    datos,
    async crear({ consultorioId, nombre, duracionMin, descripcion }) {
      if (datos.some((item) => item.consultorioId === consultorioId && item.nombre === nombre)) {
        throw { code: '23505' };
      }
      const prestacion = { id: '00000000-0000-4000-8000-000000000013', consultorioId, nombre, duracionMin, descripcion: descripcion ?? null, activo: true, creadoEn: '2026-01-03T00:00:00.000Z' };
      datos.push(prestacion);
      return dto(prestacion);
    },
    async listar({ consultorioId, activo }) {
      return datos
        .filter((item) => item.consultorioId === consultorioId && (activo === undefined || item.activo === activo))
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(dto);
    },
    async obtenerPorId({ consultorioId, prestacionId }) {
      return dto(datos.find((item) => item.consultorioId === consultorioId && item.id === prestacionId));
    },
    async actualizar({ consultorioId, prestacionId, cambios }) {
      const item = datos.find((prestacion) => prestacion.consultorioId === consultorioId && prestacion.id === prestacionId);
      if (!item) return null;
      if (cambios.nombre && datos.some((otro) => otro.consultorioId === consultorioId && otro.id !== prestacionId && otro.nombre === cambios.nombre)) {
        throw { code: '23505' };
      }
      Object.assign(item, cambios);
      return dto(item);
    },
  };
}

function crearAppDePrestaciones() {
  const repositorio = crearRepositorioFalso();
  const app = express();
  app.use(express.json());
  app.use('/api/prestaciones', middlewareAutenticacion, crearRouterPrestaciones({ servicios: crearServiciosPrestaciones({ repositorio }) }));
  app.use(manejadorErrores);
  return { app, repositorio };
}

function token(consultorioId = CONSULTORIO_A, rol = 'ADMIN_CONSULTORIO') {
  return crearToken({ consultorioId, rol });
}

describe('API de prestaciones', () => {
  it('POST crea una prestación válida y responde 201 con el DTO', async () => {
    const { app } = crearAppDePrestaciones();
    const res = await request(app).post('/api/prestaciones').set('Authorization', `Bearer ${token()}`).send({ nombre: 'Blanqueamiento', duracionMin: 60, descripcion: 'General' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Blanqueamiento', duracionMin: 60, descripcion: 'General', activo: true });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('creadoEn');
  });

  it.each([
    [{ nombre: 'Corta', duracionMin: 0 }],
    [{ nombre: 'Corta', duracionMin: 481 }],
    [{ nombre: 'Corta', duracionMin: 30.5 }],
    [{ nombre: 'Corta', duracionMin: '30' }],
    [{ nombre: 'x'.repeat(101), duracionMin: 30 }],
  ])('POST rechaza datos inválidos con 400', async (body) => {
    const { app } = crearAppDePrestaciones();
    const res = await request(app).post('/api/prestaciones').set('Authorization', `Bearer ${token()}`).send(body);

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.objectContaining({ code: 'DATOS_INVALIDOS' }));
  });

  it('POST rechaza duplicados en el consultorio con 409 y permite el mismo nombre en otro consultorio', async () => {
    const { app } = crearAppDePrestaciones();
    const body = { nombre: 'Limpieza', duracionMin: 30 };
    const duplicado = await request(app).post('/api/prestaciones').set('Authorization', `Bearer ${token()}`).send(body);
    const otroConsultorio = await request(app).post('/api/prestaciones').set('Authorization', `Bearer ${token(CONSULTORIO_B)}`).send(body);

    expect(duplicado.status).toBe(409);
    expect(otroConsultorio.status).toBe(201);
  });

  it('GET lista ordenado, aislado y filtra activas', async () => {
    const { app } = crearAppDePrestaciones();
    const listado = await request(app).get('/api/prestaciones').set('Authorization', `Bearer ${token()}`);
    const activas = await request(app).get('/api/prestaciones?activo=true').set('Authorization', `Bearer ${token()}`);
    const aislado = await request(app).get('/api/prestaciones').set('Authorization', `Bearer ${token(CONSULTORIO_B, 'RECEPCION')}`);

    expect(listado.status).toBe(200);
    expect(listado.body.map(({ nombre }) => nombre)).toEqual(['Consulta', 'Limpieza']);
    expect(activas.body).toEqual([expect.objectContaining({ nombre: 'Limpieza', activo: true })]);
    expect(aislado.body).toEqual([]);
  });

  it.each(['RECEPCION', 'ODONTOLOGO'])('GET permite lectura a %s y POST responde 403', async (rol) => {
    const { app } = crearAppDePrestaciones();
    const lectura = await request(app).get('/api/prestaciones').set('Authorization', `Bearer ${token(CONSULTORIO_A, rol)}`);
    const escritura = await request(app).post('/api/prestaciones').set('Authorization', `Bearer ${token(CONSULTORIO_A, rol)}`).send({ nombre: 'Nueva', duracionMin: 20 });

    expect(lectura.status).toBe(200);
    expect(escritura.status).toBe(403);
  });

  it.each(['RECEPCION', 'ODONTOLOGO'])('GET permite lectura y PUT no modifica para %s', async (rol) => {
    const { app, repositorio } = crearAppDePrestaciones();
    const antes = repositorio.datos.find(({ id }) => id === PRESTACION_A);

    const lectura = await request(app).get('/api/prestaciones').set('Authorization', `Bearer ${token(CONSULTORIO_A, rol)}`);
    const escritura = await request(app).put(`/api/prestaciones/${PRESTACION_A}`).set('Authorization', `Bearer ${token(CONSULTORIO_A, rol)}`).send({ duracionMin: 90 });

    expect(lectura.status).toBe(200);
    expect(escritura.status).toBe(403);
    expect(repositorio.datos.find(({ id }) => id === PRESTACION_A)).toEqual(antes);
  });

  it('PUT edita, rechaza duplicado, id ajeno y duración inválida, y aplica borrado lógico', async () => {
    const { app } = crearAppDePrestaciones();
    const editada = await request(app).put(`/api/prestaciones/${PRESTACION_A}`).set('Authorization', `Bearer ${token()}`).send({ duracionMin: 90 });
    const duplicada = await request(app).put(`/api/prestaciones/${PRESTACION_A}`).set('Authorization', `Bearer ${token()}`).send({ nombre: 'Consulta' });
    const ajena = await request(app).put(`/api/prestaciones/${PRESTACION_A}`).set('Authorization', `Bearer ${token(CONSULTORIO_B)}`).send({ duracionMin: 90 });
    const invalida = await request(app).put(`/api/prestaciones/${PRESTACION_A}`).set('Authorization', `Bearer ${token()}`).send({ duracionMin: 0 });
    const borrada = await request(app).put(`/api/prestaciones/${PRESTACION_A}`).set('Authorization', `Bearer ${token()}`).send({ activo: false });

    expect(editada.status).toBe(200);
    expect(editada.body.duracionMin).toBe(90);
    expect(duplicada.status).toBe(409);
    expect(ajena.status).toBe(404);
    expect(invalida.status).toBe(400);
    expect(borrada.status).toBe(200);
    expect(borrada.body.activo).toBe(false);
    expect((await request(app).get('/api/prestaciones').set('Authorization', `Bearer ${token()}`)).body).toEqual([
      expect.objectContaining({ id: PRESTACION_B, activo: false }),
      expect.objectContaining({ id: PRESTACION_A, activo: false }),
    ]);
  });
});

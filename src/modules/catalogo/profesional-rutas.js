// Capa de rutas del Profesional (módulo catalogo): ÚNICAMENTE parseo y
// validación HTTP + delegación en servicios (DD-13). Sin lógica de negocio
// ni SQL acá. El `consultorioId` sale SIEMPRE de `req.auth` (token, regla
// dura 2): nunca del cuerpo, la query ni los headers.
import { Router } from 'express';
import { ApiError } from '../../errores.js';
import { validarCuerpo, validarUuid } from './dominio.js';
import { actualizarProfesional, crearProfesional, listarProfesionales } from './profesional-servicios.js';

// Contrato de entrada (design D5): SOLO estos campos; todo lo demás → 422.
const ESQUEMA_ALTA = Object.freeze({
  nombre: { tipo: 'texto', requerido: true },
  matricula: { tipo: 'texto' },
  email: { tipo: 'texto' },
});

const ESQUEMA_ACTUALIZACION = Object.freeze({
  nombre: { tipo: 'texto' },
  matricula: { tipo: 'texto' },
  email: { tipo: 'texto' },
  activo: { tipo: 'booleano' },
});

/**
 * Router de `/api/profesionales`. `deps` inyecta repositorios (por defecto
 * los reales) para simular fallos de base sin mockear SQL (design D9).
 */
export function crearRouterProfesional(deps = {}) {
  const router = Router();

  // POST /api/profesionales — alta (spec "Alta de profesional").
  router.post('/', async (req, res, next) => {
    try {
      const campos = validarCuerpo(req.body, ESQUEMA_ALTA);
      const ficha = await crearProfesional(
        { consultorioId: req.auth.consultorioId, ...campos },
        deps
      );
      res.status(201).json(ficha);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/profesionales — listado de gestión: activos e inactivos con
  // `activo` y `usuarioId` (spec "Listados de gestión del catálogo"; la
  // guardia ADMIN_CONSULTORIO se aplica en rutas.js).
  router.get('/', async (req, res, next) => {
    try {
      const fichas = await listarProfesionales(
        { consultorioId: req.auth.consultorioId },
        deps
      );
      res.status(200).json(fichas);
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/profesionales/:id — actualización parcial y baja lógica por
  // `activo` (spec "Actualización y baja lógica del catálogo"). El `:id` se
  // valida ANTES que el cuerpo (design D6): malformado → 400.
  router.put('/:id', async (req, res, next) => {
    try {
      const id = validarUuid(req.params.id, 'id');
      const campos = validarCuerpo(req.body, ESQUEMA_ACTUALIZACION);
      if (Object.keys(campos).length === 0) {
        throw new ApiError(422, 'DATOS_INVALIDOS', 'Debe indicar al menos un campo para actualizar');
      }
      const ficha = await actualizarProfesional(
        { consultorioId: req.auth.consultorioId, id, ...campos },
        deps
      );
      res.status(200).json(ficha);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

// Capa de rutas del SillonBox (módulo catalogo): ÚNICAMENTE parseo y
// validación HTTP + delegación en servicios (DD-13). El `consultorioId`
// sale SIEMPRE de `req.auth` (token, regla dura 2).
import { Router } from 'express';
import { ApiError } from '../../errores.js';
import { validarCuerpo, validarUuid } from './dominio.js';
import { actualizarSillonBox, crearSillonBox, listarSillonBoxes } from './sillon-box-servicios.js';

// Contrato de entrada (design D5): SOLO estos campos; todo lo demás → 422.
const ESQUEMA_ALTA = Object.freeze({
  nombre: { tipo: 'texto', requerido: true },
  descripcion: { tipo: 'texto' },
});

const ESQUEMA_ACTUALIZACION = Object.freeze({
  nombre: { tipo: 'texto' },
  descripcion: { tipo: 'texto' },
  activo: { tipo: 'booleano' },
});

/**
 * Router de `/api/sillon-boxes`. `deps` inyecta repositorios (por defecto
 * los reales) para simular fallos de base sin mockear SQL (design D9).
 */
export function crearRouterSillonBox(deps = {}) {
  const router = Router();

  // POST /api/sillon-boxes — alta (spec "Alta de sillón o box").
  router.post('/', async (req, res, next) => {
    try {
      const campos = validarCuerpo(req.body, ESQUEMA_ALTA);
      const ficha = await crearSillonBox(
        { consultorioId: req.auth.consultorioId, ...campos },
        deps
      );
      res.status(201).json(ficha);
    } catch (error) {
      next(error);
    }
  });

  // GET /api/sillon-boxes — listado de gestión: activos e inactivos con
  // `activo` (spec "Listados de gestión del catálogo"; la guardia
  // ADMIN_CONSULTORIO se aplica en rutas.js).
  router.get('/', async (req, res, next) => {
    try {
      const fichas = await listarSillonBoxes(
        { consultorioId: req.auth.consultorioId },
        deps
      );
      res.status(200).json(fichas);
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/sillon-boxes/:id — actualización parcial y baja lógica por
  // `activo` (spec "Actualización y baja lógica del catálogo"). El `:id` se
  // valida ANTES que el cuerpo (design D6): malformado → 400.
  router.put('/:id', async (req, res, next) => {
    try {
      const id = validarUuid(req.params.id, 'id');
      const campos = validarCuerpo(req.body, ESQUEMA_ACTUALIZACION);
      if (Object.keys(campos).length === 0) {
        throw new ApiError(422, 'DATOS_INVALIDOS', 'Debe indicar al menos un campo para actualizar');
      }
      const ficha = await actualizarSillonBox(
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

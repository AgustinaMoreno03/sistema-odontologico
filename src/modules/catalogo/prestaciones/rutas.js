import { Router } from 'express';
import { ApiError } from '../../../errores.js';
import { middlewareAutenticacion } from '../../auth/rutas.js';
import { crearServiciosPrestaciones } from './servicios.js';

const CAMPOS_EDITABLES = new Set(['nombre', 'duracionMin', 'descripcion', 'activo']);

function cuerpoObjeto(req) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new ApiError(400, 'DATOS_INVALIDOS', 'El cuerpo debe ser un objeto JSON');
  }
  return req.body;
}

function cambiosPermitidos(cuerpo) {
  const cambios = Object.fromEntries(Object.entries(cuerpo).filter(([campo]) => CAMPOS_EDITABLES.has(campo)));
  if (Object.keys(cambios).length !== Object.keys(cuerpo).length) {
    throw new ApiError(400, 'DATOS_INVALIDOS', 'El cuerpo contiene campos no editables');
  }
  return cambios;
}

export function crearRouterPrestaciones({ servicios = crearServiciosPrestaciones() } = {}) {
  const router = Router();

  router.get('/', async (req, res) => {
    const activo = req.query.activo === undefined ? undefined : req.query.activo === 'true';
    const prestaciones = await servicios.listar({
      consultorioId: req.auth.consultorioId,
      rol: req.auth.rol,
      activo,
    });
    res.status(200).json(prestaciones);
  });

  router.post('/', async (req, res) => {
    const cuerpo = cuerpoObjeto(req);
    const prestacion = await servicios.crear({
      consultorioId: req.auth.consultorioId,
      rol: req.auth.rol,
      nombre: cuerpo.nombre,
      duracionMin: cuerpo.duracionMin,
      descripcion: cuerpo.descripcion,
    });
    res.status(201).json(prestacion);
  });

  router.put('/:id', async (req, res) => {
    const cambios = cambiosPermitidos(cuerpoObjeto(req));
    const prestacion = await servicios.editar({
      consultorioId: req.auth.consultorioId,
      rol: req.auth.rol,
      prestacionId: req.params.id,
      ...cambios,
    });
    if (!prestacion) {
      throw new ApiError(404, 'PRESTACION_NO_ENCONTRADA', 'Prestación no encontrada');
    }
    res.status(200).json(prestacion);
  });

  return router;
}

export const rutasPrestaciones = Router();
rutasPrestaciones.use(middlewareAutenticacion, crearRouterPrestaciones());

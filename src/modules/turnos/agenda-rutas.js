import { Router } from 'express';
import { middlewareAutenticacion } from '../auth/rutas.js';
import { validarParametrosAgenda } from './agenda-dominio.js';
import { consultarAgenda } from './agenda-servicios.js';

export function crearRouterAgenda() {
  const router = Router();
  router.use(middlewareAutenticacion);
  router.get('/', async (req, res) => {
    const parametros = validarParametrosAgenda(req.query);
    const agenda = await consultarAgenda({ parametros, contexto: req.auth });
    res.status(200).json(agenda);
  });
  return router;
}

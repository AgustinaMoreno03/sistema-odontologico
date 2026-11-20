import { Router } from 'express';
import { verificarSalud } from './servicios.js';

/**
 * Rutas de salud (spec development-environment + auth R2): `GET /health`
 * es la única ruta pública y queda SIEMPRE exenta de autenticación.
 *
 * Si el chequeo falla, `verificarSalud` lanza un ApiError que consume el
 * manejador centralizado → 503 con la forma única `{ error: { code, message } }`.
 *
 * @param {{chequearBase: () => Promise<void>}} dependencias chequeo inyectado.
 */
export function crearRouterSalud({ chequearBase }) {
  const router = Router();

  router.get('/', async (req, res) => {
    const estado = await verificarSalud(chequearBase);
    res.status(200).json(estado);
  });

  return router;
}

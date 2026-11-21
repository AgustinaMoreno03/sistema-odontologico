// Composición del router del módulo catalogo (design.md, decisión 4):
// monta los routers por entidad y contiene la guardia local de rol. Los
// únicos archivos que C04 tocará son este e `index.js`, con los bloques de
// extensión claramente marcados (un conflicto de merge trivial).
import { Router } from 'express';
import { ApiError } from '../../errores.js';
import { middlewareAutenticacion } from '../auth/rutas.js';
import { obtenerCatalogo } from './catalogo-servicios.js';
import { crearRouterProfesional } from './profesional-rutas.js';
import { crearRouterSillonBox } from './sillon-box-rutas.js';

/**
 * Guardia local por rol (design.md, decisión 7): altas, actualizaciones y
 * listados de gestión reservados a `ADMIN_CONSULTORIO`; `RECEPCION` y
 * `ODONTOLOGO` reciben 403 `SIN_PERMISO`. Vive en el módulo porque `auth`
 * pertenece a C01; cuando C01 centralice permisos, esta guardia se reemplaza
 * sin cambiar el comportamiento.
 */
export function requerirAdmin(req, res, next) {
  if (req.auth?.rol !== 'ADMIN_CONSULTORIO') {
    next(new ApiError(403, 'SIN_PERMISO', 'Permisos insuficientes para esta operación'));
    return;
  }
  next();
}

/**
 * Router completo del catálogo, montado bajo `/api` en `src/app.js`.
 * La autenticación es la de C00 (`middlewareAutenticacion`): sin identidad
 * válida responde el 401 uniforme `TOKEN_INVALIDO` y borra los headers
 * `x-tenant-*` del cliente (regla dura 2).
 */
export function crearRouterCatalogo(deps = {}) {
  const router = Router();

  router.use(middlewareAutenticacion);

  // Rutas de gestión del catálogo: identidad + guardia ADMIN_CONSULTORIO.
  router.use('/profesionales', requerirAdmin, crearRouterProfesional(deps));
  router.use('/sillon-boxes', requerirAdmin, crearRouterSillonBox(deps));

  // GET /api/catalogo — catálogo activo para turnos (C05): cualquier rol
  // autenticado lo lee (spec "Catálogo activo del consultorio para turnos").
  router.get('/catalogo', async (req, res, next) => {
    try {
      const catalogo = await obtenerCatalogo({ consultorioId: req.auth.consultorioId }, deps);
      res.status(200).json(catalogo);
    } catch (error) {
      next(error);
    }
  });

  // === INICIO BLOQUE DE EXTENSIÓN C04 (prestaciones) ===
  // router.use('/prestaciones', requerirAdmin, crearRouterPrestacion(deps));
  // === FIN BLOQUE DE EXTENSIÓN C04 ===

  return router;
}

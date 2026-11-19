import express from 'express';
import { manejadorErrores } from '../../src/errores.js';
import { middlewareAutenticacion } from '../../src/modules/auth/rutas.js';

/**
 * Arnés mínimo de tests para ejercitar el middleware de auth SIN meter rutas
 * de prueba en producción (C00 no tiene rutas protegidas reales: login es
 * C01). Monta el middleware real sobre un path de test y devuelve un echo
 * que permite afirmar el triple y si los headers x-tenant-* siguen presentes.
 *
 * Mismo estilo que tests/errores.test.js: la app se arma en el test, con el
 * manejador de errores centralizado (design D6) siempre al final.
 */
export function crearAppProtegida() {
  const app = express();

  app.use(express.json());

  const responder = (req, res) => {
    res.json({
      auth: req.auth ?? null,
      headersTenant: Object.keys(req.headers).filter((nombre) => nombre.startsWith('x-tenant-')),
    });
  };

  app.get('/protegido', middlewareAutenticacion, responder);
  app.post('/protegido', middlewareAutenticacion, responder);

  app.use(manejadorErrores);

  return app;
}

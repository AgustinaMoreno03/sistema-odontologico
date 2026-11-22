import express from 'express';
import { manejadorErrores } from './errores.js';
import { rutasPrestaciones } from './modules/catalogo/prestaciones/rutas.js';
import { chequearBase } from './salud/repositorios.js';
import { crearRouterSalud } from './salud/rutas.js';
import { rutasAuth, rutasUsuarios } from './modules/auth/rutas.js';
import { crearRouterCatalogo } from './modules/catalogo/index.js';

/**
 * Crea la instancia de la app Express 5 (JavaScript plano, sin TypeScript).
 *
 * Estructura por capas de cada módulo (DD-13 / knowledge-base/08):
 *   rutas → servicios → dominio → repositorios (SQL parametrizado)
 *
 * @param {{chequearBase?: () => Promise<void>}} [opciones]
 *   `chequearBase`: frontera de chequeo de la base inyectable (por defecto
 *   el chequeo real con `SELECT 1`). Los tests la sustituyen para simular
 *   la caída de la base (task 3.1); el resto de la app es la real.
 */
export function crearApp({ chequearBase: chequearInyectado = chequearBase } = {}) {
  const app = express();
  app.disable('x-powered-by');

  // Body JSON en todas las rutas (parseo HTTP puro; la validación de
  // entrada vive en la capa de rutas de cada módulo).
  app.use(express.json());

  app.use('/api/prestaciones', rutasPrestaciones);

  // Única ruta pública y exenta de autenticación (auth R2).
  app.use('/health', crearRouterSalud({ chequearBase: chequearInyectado }));
  app.use('/auth', rutasAuth);
  app.use('/usuarios', rutasUsuarios);

  // Módulo catalogo (C02): rutas bajo /api con la autenticación de C00.
  app.use('/api', crearRouterCatalogo());

  // Manejador de errores centralizado — SIEMPRE al final (design D6).
  app.use(manejadorErrores);

  return app;
}

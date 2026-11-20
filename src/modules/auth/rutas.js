import { Router } from 'express';
import { iniciarSesion, noAutorizado, verificarToken } from './servicios.js';

// Capa de rutas (módulo auth): únicamente parseo y validación HTTP.
// Sin lógica de negocio y sin SQL en esta capa (regla de capas DD-13).
// El router se monta en src/app.js cuando existan rutas reales (C01).
export const rutasAuth = Router();

rutasAuth.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    res.status(200).json(await iniciarSesion(email, password));
  } catch (err) {
    next(err);
  }
});

const PREFIJO_HEADER_TENANT = 'x-tenant-';
const ESQUEMA_BEARER = /^Bearer\s+(\S+)$/i;

/**
 * Middleware de autenticación (spec auth R1–R4, design D2).
 *
 * - Borra SIEMPRE los headers `x-tenant-*` del cliente antes de cualquier
 *   otra cosa: el tenant sale solo del token (regla dura 2).
 * - Exige `Authorization: Bearer <JWT>` y delega la verificación en la
 *   capa de servicios (HS256, sin distinguir causas).
 * - Éxito → `req.auth = { usuarioId, consultorioId, rol }` (solo del token).
 * - Cualquier fallo → 401 vía el manejador centralizado (D6), mensaje único.
 */
export function middlewareAutenticacion(req, res, next) {
  for (const nombre of Object.keys(req.headers)) {
    if (nombre.startsWith(PREFIJO_HEADER_TENANT)) {
      delete req.headers[nombre];
    }
  }

  const autorizacion = req.headers.authorization;
  const coincidencia =
    typeof autorizacion === 'string' ? autorizacion.match(ESQUEMA_BEARER) : null;
  if (!coincidencia) {
    // Sin header, con otro esquema o con contenido vacío: mismo 401 seguro.
    next(noAutorizado());
    return;
  }

  try {
    req.auth = verificarToken(coincidencia[1]);
    next();
  } catch (err) {
    next(err);
  }
}

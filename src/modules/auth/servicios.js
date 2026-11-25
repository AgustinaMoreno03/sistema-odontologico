// Capa de servicios (módulo auth): casos de uso que orquestan al dominio y
// a los repositorios. Sin HTTP (no importa express) y sin SQL directo.
// Lógica real en C00 §4 (verificación de token) y en C01 (login y usuarios).
import jwt from 'jsonwebtoken';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ApiError } from '../../errores.js';
import { claimsRequeridosCompletos, esRolValido, extraerContexto } from './dominio.js';
import {
  buscarCredencialesPorEmail,
  buscarUsuarioPorId,
  crearUsuario,
  listarUsuariosPorConsultorio,
} from './repositorios.js';

// Design D2: algoritmo fijo y explícito — `alg: "none"` o cualquier otro
// (RS256, HS512…) se rechaza en la verificación (spec auth R1).
const ALGORITMO_PERMITIDO = 'HS256';
const TIEMPO_TOKEN_SEGUNDOS = 8 * 60 * 60;
const LARGO_HASH = 64;
const scrypt = promisify(scryptCallback);
const SAL_FICTICIO = Buffer.from('fictitious-salt!').toString('base64url');
const HASH_FICTICIO = `scrypt$${SAL_FICTICIO}$${'00'.repeat(LARGO_HASH)}`;

/** Guarda una contraseña como scrypt con salt aleatorio propio de 16 bytes. */
export async function hashearPassword(password) {
  const salt = randomBytes(16);
  const derivado = await scrypt(password, salt, LARGO_HASH);
  return `scrypt$${salt.toString('base64url')}$${derivado.toString('hex')}`;
}

/** Compara una contraseña con el formato persistido por hashearPassword. */
export async function verificarPassword(password, passwordHash) {
  if (typeof password !== 'string' || typeof passwordHash !== 'string') return false;
  const [algoritmo, saltCodificado, claveHex, extra] = passwordHash.split('$');
  if (
    algoritmo !== 'scrypt' ||
    !saltCodificado ||
    !/^[\da-f]{128}$/i.test(claveHex ?? '') ||
    extra !== undefined
  ) {
    return false;
  }

  const salt = Buffer.from(saltCodificado, 'base64url');
  if (salt.length !== 16) return false;
  const esperada = Buffer.from(claveHex, 'hex');
  const actual = await scrypt(password, salt, LARGO_HASH);
  return timingSafeEqual(actual, esperada);
}

/** Autentica por email/contraseña y emite JWT de ocho horas. */
export async function iniciarSesion(email, password) {
  const usuario =
    typeof email === 'string' ? await buscarCredencialesPorEmail(email) : null;
  const coincide = await verificarPassword(
    typeof password === 'string' ? password : '',
    usuario?.password_hash ?? HASH_FICTICIO
  );

  if (!usuario || !coincide) {
    throw new ApiError(401, 'CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos');
  }

  const token = jwt.sign(
    {
      usuarioId: usuario.id,
      consultorioId: usuario.consultorio_id,
      rol: usuario.rol,
    },
    process.env.JWT_SECRET,
    { algorithm: ALGORITMO_PERMITIDO, expiresIn: TIEMPO_TOKEN_SEGUNDOS }
  );
  return { token };
}

function usuarioPublico(usuario) {
  return {
    usuarioId: usuario.id,
    consultorioId: usuario.consultorio_id,
    rol: usuario.rol,
    email: usuario.email,
  };
}

/** Alta tenant-scoped: el tenant sale del contexto confiable (HTTP o CLI interno). */
export async function crearUsuarioEnConsultorio(auth, datos, { cliente } = {}) {
  if (auth.rol !== 'ADMIN_CONSULTORIO') {
    throw new ApiError(403, 'ROL_NO_AUTORIZADO', 'No tiene permiso para administrar usuarios');
  }
  const email = typeof datos?.email === 'string' ? datos.email.trim() : '';
  const password = datos?.password;
  const rol = datos?.rol;
  if (!email || typeof password !== 'string' || password.length === 0 || !esRolValido(rol)) {
    throw new ApiError(400, 'SOLICITUD_INVALIDA', 'Email, contraseña y rol son obligatorios');
  }

  const passwordHash = await hashearPassword(password);
  try {
    const usuario = await crearUsuario({
      consultorioId: auth.consultorioId,
      rol,
      email,
      passwordHash,
    }, { cliente });
    return usuarioPublico(usuario);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'usuario_email_unique') {
      throw new ApiError(409, 'EMAIL_DUPLICADO', 'El email ya está registrado');
    }
    throw error;
  }
}

export async function listarUsuarios(auth) {
  return (await listarUsuariosPorConsultorio(auth.consultorioId)).map(usuarioPublico);
}

export async function obtenerUsuario(auth, usuarioId) {
  const usuario = await buscarUsuarioPorId(auth.consultorioId, usuarioId);
  if (!usuario) throw new ApiError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');
  return usuarioPublico(usuario);
}

/** 401 único y genérico (D6): jamás distingue firma / estructura / caducidad. */
export function noAutorizado() {
  return new ApiError(401, 'TOKEN_INVALIDO', 'No autorizado');
}

/**
 * Verifica un JWT con el secreto `JWT_SECRET` SOLO desde el entorno
 * (nunca default, regla dura 5) y devuelve el triple del token.
 *
 * Cualquier fallo de verificación lanza ApiError 401 con el MISMO mensaje
 * seguro, sin filtrar la causa ni el detalle interno de jsonwebtoken
 * (spec auth R1/R2; design D2/D6).
 *
 * @param {string} token token crudo extraído del encabezado Authorization
 * @returns {{usuarioId: unknown, consultorioId: unknown, rol: unknown}}
 * @throws {ApiError} 401 TOKEN_INVALIDO ante cualquier fallo
 */
export function verificarToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: [ALGORITMO_PERMITIDO],
    });
  } catch {
    // Firma inválida, expirado, malformado o algoritmo no permitido:
    // el mismo 401 seguro para todos, sin causa ni stack (spec auth R1/R2).
    throw noAutorizado();
  }

  // Conjunto cerrado de roles DD-17 (spec auth R3): cualquier otro valor
  // —p. ej. "PACIENTE" (DD-16) o variantes en minúsculas— rechaza el token.
  //
  // Claims requeridos (spec auth R1, escenario "Claims requeridos
  // faltantes", task 4.7): los tres claims deben existir y ser strings no
  // vacíos; ausentes, vacíos o no texto (p. ej. numéricos) → el MISMO 401
  // genérico D6, sin contexto adjunto.
  const contexto = extraerContexto(payload);
  if (!claimsRequeridosCompletos(contexto) || !esRolValido(contexto.rol)) {
    throw noAutorizado();
  }
  return contexto;
}

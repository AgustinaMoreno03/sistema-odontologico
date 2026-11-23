// Capa HTTP del módulo turnos (DD-13): parseo/validación de FORMA y
// guardia de rol ÚNICAMENTE — sin lógica de negocio ni SQL acá. El
// consultorio sale SIEMPRE de `req.auth` (regla dura 2): jamás del body,
// la query ni un header del cliente (el middleware de C00 además borra
// cualquier `x-tenant-*` que intente meter el cliente).
import { Router } from 'express';
import { ApiError } from '../../errores.js';
import { middlewareAutenticacion } from '../auth/rutas.js';
import { validarUuid, validarInicio } from './dominio.js';
import { crearTurno } from './servicios.js';

// Roles que crean turnos hoy (spec R1): RECEPCION y ADMIN_CONSULTORIO;
// ODONTOLOGO recibe 403. El flag "operar sin recepción" queda fuera de
// alcance (C06/C07 definirá su habilitación).
const ROLES_QUE_CREAN = ['RECEPCION', 'ADMIN_CONSULTORIO'];

/**
 * Router de turnos, montado bajo `/api/turnos` en `src/app.js`
 * (tarea 5.2). `POST /api/turnos` → 201 con el DTO del turno creado.
 *
 * @returns {import('express').Router}
 */
export function crearRouterTurnos() {
  const router = Router();

  // C00: sin identidad válida → 401 uniforme TOKEN_INVALIDO
  // (precedente: montaje en catalogo/rutas.js).
  router.use(middlewareAutenticacion);

  router.post('/', async (req, res, next) => {
    try {
      // Guardia local de rol (precedente: requerirAdmin de catalogo/rutas.js;
      // se reemplaza si C01 publica permisos centralizados).
      if (!ROLES_QUE_CREAN.includes(req.auth?.rol)) {
        throw new ApiError(
          403,
          'SIN_PERMISO',
          'Solo recepción y administración pueden crear turnos'
        );
      }

      // Validación de forma (sin negocio): los cuatro identificadores UUID
      // y `inicio` ISO 8601 con zona horaria explícita.
      const { pacienteId, profesionalId, sillonBoxId, prestacionId, inicio } = req.body ?? {};
      validarUuid(pacienteId, 'pacienteId');
      validarUuid(profesionalId, 'profesionalId');
      validarUuid(sillonBoxId, 'sillonBoxId');
      validarUuid(prestacionId, 'prestacionId');
      validarInicio(inicio);

      // El consultorio SIEMPRE del token, nunca del cliente.
      const turno = await crearTurno({
        pacienteId,
        profesionalId,
        sillonBoxId,
        prestacionId,
        inicio,
        consultorioId: req.auth.consultorioId,
      });

      // 201 con el DTO del turno (design D5: sin consultorioId — el
      // escenario S1 lo verifica en la Tanda D).
      const { consultorioId: _consultorioId, ...dto } = turno;
      res.status(201).json(dto);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

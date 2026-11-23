// Capa HTTP del módulo turnos (DD-13): parseo/validación de FORMA y
// guardia de rol ÚNICAMENTE — sin lógica de negocio ni SQL acá. El
// consultorio sale SIEMPRE de `req.auth` (regla dura 2): jamás del body,
// la query ni un header del cliente (el middleware de C00 además borra
// cualquier `x-tenant-*` que intente meter el cliente).
import { Router } from 'express';
import { ApiError } from '../../errores.js';
import { middlewareAutenticacion } from '../auth/rutas.js';
import { validarUuid, validarInicio } from './dominio.js';
import { crearTurno, reprogramarTurno } from './servicios.js';

// Roles que crean turnos hoy (spec R1): RECEPCION y ADMIN_CONSULTORIO;
// ODONTOLOGO recibe 403. Mismos roles para reprogramar (RN-AG-03, C07);
// el flag "operar sin recepción" queda fuera de alcance (C06).
const ROLES_QUE_CREAN = ['RECEPCION', 'ADMIN_CONSULTORIO'];

/**
 * Router de turnos, montado bajo `/api/turnos` en `src/app.js`
 * (tarea 5.2 de C05; C07 no toca el montaje). `POST /api/turnos` → 201
 * con el DTO del turno creado; `PATCH /api/turnos/:id/reprogramar` → 200
 * con el turno actualizado (C07).
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

  // C07 — reprogramación (design D4/D6): acá SOLO forma + guardia de rol.
  // Orden: 400 (forma) → 403 (rol) → servicio (404 → 409 → 409).
  router.patch('/:id/reprogramar', async (req, res, next) => {
    try {
      // Validación de forma ANTES que el rol (D4): `:id` UUID bien formado
      // e `inicio` ISO 8601 con zona horaria explícita.
      const { id } = req.params;
      const { inicio } = req.body ?? {};
      validarUuid(id, 'id');
      validarInicio(inicio);

      // Guardia de rol (RN-AG-03): mismos roles que crean. Sin acceso a
      // datos, un rol no permitido no puede sondear existencia de turnos.
      if (!ROLES_QUE_CREAN.includes(req.auth?.rol)) {
        throw new ApiError(
          403,
          'SIN_PERMISO',
          'Solo recepción y administración pueden reprogramar turnos'
        );
      }

      // El consultorio y el operador SIEMPRE del token (regla dura 2).
      const turno = await reprogramarTurno({
        turnoId: id,
        inicio,
        consultorioId: req.auth.consultorioId,
        usuarioId: req.auth.usuarioId,
      });

      // 200 con el mismo DTO que el POST + reprogramadoEn/reprogramadoPor
      // (S1), sin consultorioId.
      const { consultorioId: _consultorioId, ...dto } = turno;
      res.status(200).json(dto);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

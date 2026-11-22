import { Router } from 'express';
import { ApiError } from '../../errores.js';
import { middlewareAutenticacion } from '../auth/rutas.js';
import { crearPaciente, buscarPacientes } from './servicios.js';

const CAMPOS_ALTA = new Set(['nombre', 'apellido', 'telefono', 'email']);

function validarCuerpo(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw new ApiError(422, 'DATOS_INVALIDOS', 'Se requiere una ficha válida');
  }

  if (Object.keys(datos).some((campo) => !CAMPOS_ALTA.has(campo))) {
    throw new ApiError(422, 'DATOS_INVALIDOS', 'La ficha contiene campos no admitidos');
  }
}

export function crearRouterPacientes() {
  const router = Router();

  router.get('/', middlewareAutenticacion, async (req, res) => {
    const pacientes = await buscarPacientes({
      texto: req.query.q,
      contexto: req.auth,
    });
    res.status(200).json(pacientes);
  });

  router.post('/', middlewareAutenticacion, async (req, res) => {
    validarCuerpo(req.body);
    const paciente = await crearPaciente({
      datos: req.body,
      contexto: req.auth,
    });
    res.status(201).json(paciente);
  });

  return router;
}

import { ApiError } from '../../errores.js';
import { validarUuid } from './dominio.js';
import { obtenerNombresPacientes } from '../pacientes/index.js';
import { existeProfesional, profesionalDeUsuario } from '../catalogo/index.js';
import { leerAgenda } from './agenda-repositorio.js';

export async function consultarAgenda({ parametros, contexto }) {
  if (!['RECEPCION', 'ADMIN_CONSULTORIO', 'ODONTOLOGO'].includes(contexto?.rol)) {
    throw new ApiError(403, 'SIN_PERMISO', 'Agenda no autorizada');
  }
  const consultorioId = validarUuid(contexto.consultorioId, 'consultorioId');
  let profesionalId = parametros.profesionalId;
  if (contexto.rol === 'ODONTOLOGO') {
    const usuarioId = validarUuid(contexto.usuarioId, 'usuarioId');
    const ficha = await profesionalDeUsuario({ usuarioId, consultorioId });
    if (!ficha || (profesionalId && profesionalId.toLowerCase() !== ficha.id.toLowerCase())) {
      throw new ApiError(403, 'SIN_PERMISO', 'Agenda no autorizada');
    }
    profesionalId = ficha.id;
  } else if (profesionalId && !await existeProfesional({ profesionalId, consultorioId })) {
    throw new ApiError(404, 'PROFESIONAL_NO_ENCONTRADO', 'Profesional no encontrado');
  }
  const filas = await leerAgenda({ ...parametros, consultorioId, profesionalId });
  const pagina = filas.slice(0, parametros.limite);
  const pacientes = await obtenerNombresPacientes({
    consultorioId, pacienteIds: [...new Set(pagina.map((fila) => fila.pacienteId))],
  });
  const nombres = new Map(pacientes.map((paciente) => [paciente.id, paciente]));
  const turnos = pagina.map((turno) => {
    const paciente = nombres.get(turno.pacienteId);
    if (!paciente) throw new Error('Nombre de paciente no disponible en el contexto de agenda');
    return { ...turno, pacienteNombre: paciente.nombre, pacienteApellido: paciente.apellido ?? null };
  });
  const hayMas = filas.length > parametros.limite;
  return {
    desde: parametros.desde.toISOString(), hasta: parametros.hasta.toISOString(),
    zonaHoraria: 'America/Argentina/Buenos_Aires', turnos,
    hayMas, siguienteOffset: hayMas ? parametros.offset + turnos.length : null,
  };
}

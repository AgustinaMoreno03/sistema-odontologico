import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/errores.js';
import { crearServiciosPrestaciones } from '../src/modules/catalogo/prestaciones/servicios.js';

const CONSULTORIO = '00000000-0000-4000-8000-000000000001';
const PRESTACION = '00000000-0000-4000-8000-000000000002';

function crearRepositorioFalso() {
  return {
    crear: vi.fn().mockResolvedValue({ id: PRESTACION, nombre: 'Consulta', duracionMin: 30, activo: true }),
    listar: vi.fn().mockResolvedValue([]),
    obtenerPorId: vi.fn().mockResolvedValue(null),
    actualizar: vi.fn().mockResolvedValue({ id: PRESTACION, nombre: 'Consulta', duracionMin: 45, activo: true }),
    obtenerPrestacionParaTurno: vi.fn().mockResolvedValue(null),
  };
}

describe('servicios de prestaciones', () => {
  it('crea una prestación válida y delega el consultorio del contexto', async () => {
    const repositorio = crearRepositorioFalso();
    const servicios = crearServiciosPrestaciones({ repositorio });

    await servicios.crear({ consultorioId: CONSULTORIO, rol: 'ADMIN_CONSULTORIO', nombre: 'Consulta', duracionMin: 30 });

    expect(repositorio.crear).toHaveBeenCalledWith({
      consultorioId: CONSULTORIO,
      nombre: 'Consulta',
      duracionMin: 30,
      descripcion: undefined,
    });
  });

  it.each(['RECEPCION', 'ODONTOLOGO'])('rechaza escritura del rol %s sin tocar el repositorio', async (rol) => {
    const repositorio = crearRepositorioFalso();
    const servicios = crearServiciosPrestaciones({ repositorio });

    await expect(
      servicios.crear({ consultorioId: CONSULTORIO, rol, nombre: 'Consulta', duracionMin: 30 })
    ).rejects.toMatchObject({ statusCode: 403, code: 'PERMISO_DENEGADO' });
    expect(repositorio.crear).not.toHaveBeenCalled();
  });

  it('valida antes de persistir y no deja persistencia parcial', async () => {
    const repositorio = crearRepositorioFalso();
    const servicios = crearServiciosPrestaciones({ repositorio });

    await expect(
      servicios.crear({ consultorioId: CONSULTORIO, rol: 'ADMIN_CONSULTORIO', nombre: 'x'.repeat(101), duracionMin: 30 })
    ).rejects.toMatchObject({ statusCode: 400, code: 'DATOS_INVALIDOS' });
    expect(repositorio.crear).not.toHaveBeenCalled();
  });

  it('permite listar a RECEPCION y ODONTOLOGO y pasa el tenant al repositorio', async () => {
    const repositorio = crearRepositorioFalso();
    const servicios = crearServiciosPrestaciones({ repositorio });

    await servicios.listar({ consultorioId: CONSULTORIO, rol: 'RECEPCION', activo: true });
    await servicios.listar({ consultorioId: CONSULTORIO, rol: 'ODONTOLOGO' });

    expect(repositorio.listar).toHaveBeenNthCalledWith(1, { consultorioId: CONSULTORIO, activo: true });
    expect(repositorio.listar).toHaveBeenNthCalledWith(2, { consultorioId: CONSULTORIO, activo: undefined });
  });

  it('edita y puede marcar inactiva solo ADMIN_CONSULTORIO', async () => {
    const repositorio = crearRepositorioFalso();
    const servicios = crearServiciosPrestaciones({ repositorio });

    await servicios.editar({ consultorioId: CONSULTORIO, rol: 'ADMIN_CONSULTORIO', prestacionId: PRESTACION, activo: false });

    expect(repositorio.actualizar).toHaveBeenCalledWith({
      consultorioId: CONSULTORIO,
      prestacionId: PRESTACION,
      cambios: { activo: false },
    });
  });

  it('rechaza una edición inválida antes de tocar el repositorio', async () => {
    const repositorio = crearRepositorioFalso();
    const servicios = crearServiciosPrestaciones({ repositorio });

    await expect(
      servicios.editar({ consultorioId: CONSULTORIO, rol: 'ADMIN_CONSULTORIO', prestacionId: PRESTACION, duracionMin: 481 })
    ).rejects.toMatchObject({ statusCode: 400, code: 'DATOS_INVALIDOS' });
    expect(repositorio.actualizar).not.toHaveBeenCalled();
  });

  it('consulta por id con el tenant del contexto, sin permitir que el repositorio lo omita', async () => {
    const repositorio = crearRepositorioFalso();
    const servicios = crearServiciosPrestaciones({ repositorio });

    await servicios.obtenerPorId({ consultorioId: CONSULTORIO, rol: 'ADMIN_CONSULTORIO', prestacionId: PRESTACION });

    expect(repositorio.obtenerPorId).toHaveBeenCalledWith({ consultorioId: CONSULTORIO, prestacionId: PRESTACION });
  });

  it('convierte un duplicado del repositorio en ApiError 409', async () => {
    const repositorio = crearRepositorioFalso();
    repositorio.crear.mockRejectedValue({ code: '23505' });
    const servicios = crearServiciosPrestaciones({ repositorio });

    await expect(
      servicios.crear({ consultorioId: CONSULTORIO, rol: 'ADMIN_CONSULTORIO', nombre: 'Consulta', duracionMin: 30 })
    ).rejects.toEqual(new ApiError(409, 'PRESTACION_DUPLICADA', 'Ya existe una prestación con ese nombre'));
  });
});

describe('contrato de prestaciones para turnos', () => {
  it('devuelve la prestación activa del mismo consultorio', async () => {
    const repositorio = crearRepositorioFalso();
    repositorio.obtenerPrestacionParaTurno.mockResolvedValue({ id: PRESTACION, nombre: 'Consulta', duracionMin: 30, activo: true });
    const servicios = crearServiciosPrestaciones({ repositorio });

    await expect(servicios.obtenerPrestacionParaTurno({ prestacionId: PRESTACION, consultorioId: CONSULTORIO })).resolves.toEqual({
      id: PRESTACION,
      nombre: 'Consulta',
      duracionMin: 30,
      activo: true,
    });
  });

  it.each(['inexistente', 'otro consultorio', 'inactiva'])('devuelve null si la prestación es %s', async () => {
    const repositorio = crearRepositorioFalso();
    const servicios = crearServiciosPrestaciones({ repositorio });

    await expect(servicios.obtenerPrestacionParaTurno({ prestacionId: PRESTACION, consultorioId: CONSULTORIO })).resolves.toBeNull();
  });
});

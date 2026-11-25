import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NuevoTurno } from './NuevoTurno.jsx';

const json = (dato, status = 200) =>
  new Response(JSON.stringify(dato), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(implementacion) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(implementacion);
}

describe('cancelación del turno recién creado', () => {
  beforeEach(() => {
    sessionStorage.setItem('odontologia.jwt', 'jwt-ficticio');
    vi.restoreAllMocks();
  });

  const ids = {
    paciente: '11111111-1111-4111-8111-111111111111',
    profesional: '33333333-3333-4333-8333-333333333333',
    sillonBox: '44444444-4444-4444-8444-444444444444',
    prestacion: '55555555-5555-4555-8555-555555555555',
    turno: '99999999-9999-4999-8999-999999999999',
  };

  const turnoCreado = {
    id: ids.turno,
    pacienteId: ids.paciente,
    profesionalId: ids.profesional,
    sillonBoxId: ids.sillonBox,
    prestacionId: ids.prestacion,
    inicio: '2026-12-01T13:30:00.000Z',
    fin: '2026-12-01T14:00:00.000Z',
    duracionMin: 30,
    estado: 'PENDIENTE',
    creadoEn: '2026-11-25T12:00:00.000Z',
    reprogramadoEn: null,
    reprogramadoPor: null,
    canceladoEn: null,
    canceladoPor: null,
    solicitadoPor: null,
  };

  const turnoCancelado = {
    ...turnoCreado,
    estado: 'CANCELADO',
    canceladoEn: '2026-11-25T15:00:00.000Z',
    canceladoPor: 'usuario-uuid',
    solicitadoPor: 'CONSULTORIO',
  };

  function mockFlujo(respuestaCancelacion) {
    return mockFetch(async (url, opciones = {}) => {
      const u = String(url);
      if (u.startsWith('/api/pacientes')) {
        return json([{ id: ids.paciente, nombre: 'Lucía', apellido: 'Ficticia' }]);
      }
      if (u === '/api/catalogo') {
        return json({
          profesionales: [{ id: ids.profesional, nombre: 'Dra. Ficticia', matricula: 'MP-0001' }],
          sillonBoxes: [{ id: ids.sillonBox, nombre: 'Box 1', descripcion: null }],
        });
      }
      if (u === '/api/prestaciones?activo=true') {
        return json([{ id: ids.prestacion, nombre: 'Limpieza', duracionMin: 30, activo: true }]);
      }
      if (u === '/api/turnos' && opciones.method === 'POST') return json(turnoCreado, 201);
      if (u === `/api/turnos/${ids.turno}/cancelar` && opciones.method === 'PATCH') {
        return respuestaCancelacion;
      }
      return json([]);
    });
  }

  async function crearTurnoEnPantalla() {
    render(<NuevoTurno />);
    fireEvent.change(screen.getByLabelText('Buscar paciente'), { target: { value: 'lu' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lucía Ficticia' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Lucía Ficticia' }));
    fireEvent.change(screen.getByLabelText('Profesional'), { target: { value: ids.profesional } });
    fireEvent.change(screen.getByLabelText('Sillón / box'), { target: { value: ids.sillonBox } });
    fireEvent.change(screen.getByLabelText('Prestación'), { target: { value: ids.prestacion } });
    fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2026-12-01T10:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear turno' }));
    await waitFor(() => expect(screen.getByText(/Turno creado/i)).toBeInTheDocument());
  }

  it('cancela el turno del 201 con PATCH y solicitadoPor, mostrando auditoría en BA', async () => {
    const fetchMock = mockFlujo(json(turnoCancelado, 200));

    await crearTurnoEnPantalla();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));

    await waitFor(() => expect(screen.getByText(/CANCELADO/)).toBeInTheDocument());
    const cancelacion = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === 'PATCH');
    expect(String(cancelacion[0])).toBe(`/api/turnos/${ids.turno}/cancelar`);
    expect(JSON.parse(cancelacion[1].body)).toEqual({ solicitadoPor: 'CONSULTORIO' });
    expect(cancelacion[1].headers.Authorization).toBe('Bearer jwt-ficticio');
    expect(screen.getByText(/25\/11\/2026, 12:00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar turno' })).not.toBeInTheDocument();
  });

  it('muestra 409 TURNO_YA_CANCELADO real y no marca el turno como cancelado', async () => {
    const fetchMock = mockFlujo(
      json({ error: { code: 'TURNO_YA_CANCELADO', message: 'El turno ya está cancelado' } }, 409),
    );

    await crearTurnoEnPantalla();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '409 TURNO_YA_CANCELADO: El turno ya está cancelado',
      ),
    );
    expect(screen.getByText(/PENDIENTE/)).toBeInTheDocument();
    expect(screen.queryByText(/Estado: CANCELADO/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar turno' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, o]) => o?.method === 'PATCH')).toHaveLength(1);
  });

  it('muestra 404 TURNO_NO_ENCONTRADO real sin reintentar', async () => {
    const fetchMock = mockFlujo(
      json({ error: { code: 'TURNO_NO_ENCONTRADO', message: 'Turno no encontrado' } }, 404),
    );

    await crearTurnoEnPantalla();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('404 TURNO_NO_ENCONTRADO: Turno no encontrado'),
    );
    expect(screen.getByText(/PENDIENTE/)).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, o]) => o?.method === 'PATCH')).toHaveLength(1);
  });

  it('muestra 403 SIN_PERMISO real para ODONTOLOGO al cancelar', async () => {
    mockFlujo(
      json({ error: { code: 'SIN_PERMISO', message: 'Solo recepción y administración pueden cancelar turnos' } }, 403),
    );

    await crearTurnoEnPantalla();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '403 SIN_PERMISO: Solo recepción y administración pueden cancelar turnos',
      ),
    );
    expect(screen.getByText(/PENDIENTE/)).toBeInTheDocument();
  });

  it('muestra 400 VALIDACION, 409 ESTADO_INVALIDO y 409 TURNO_PASADO reales sin marcar cancelado', async () => {
    for (const [codigo, mensaje, status] of [
      ['VALIDACION', "'solicitadoPor' debe ser PACIENTE o CONSULTORIO", 400],
      ['ESTADO_INVALIDO', 'El estado del turno no permite cancelarlo', 409],
      ['TURNO_PASADO', 'No se puede cancelar un turno que ya comenzó', 409],
    ]) {
      vi.restoreAllMocks();
      mockFlujo(json({ error: { code: codigo, message: mensaje } }, status));
      await crearTurnoEnPantalla();
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar turno' }));
      await waitFor(() =>
        expect(screen.getByRole('alert')).toHaveTextContent(`${status} ${codigo}: ${mensaje}`),
      );
      expect(screen.getByText(/PENDIENTE/)).toBeInTheDocument();
      expect(screen.queryByText(/Estado: CANCELADO/)).not.toBeInTheDocument();
      cleanup();
    }
  });
});

describe('alta de turno en /turnos/nuevo', () => {
  beforeEach(() => {
    sessionStorage.setItem('odontologia.jwt', 'jwt-ficticio');
    vi.restoreAllMocks();
  });

  const ids = {
    paciente: '11111111-1111-4111-8111-111111111111',
    profesional: '33333333-3333-4333-8333-333333333333',
    sillonBox: '44444444-4444-4444-8444-444444444444',
    prestacion: '55555555-5555-4555-8555-555555555555',
  };

  function mockBase(respuestaTurno) {
    return mockFetch(async (url, opciones = {}) => {
      const u = String(url);
      if (u.startsWith('/api/pacientes')) {
        return json([{ id: ids.paciente, nombre: 'Lucía', apellido: 'Ficticia' }]);
      }
      if (u === '/api/catalogo') {
        return json({
          profesionales: [{ id: ids.profesional, nombre: 'Dra. Ficticia', matricula: 'MP-0001' }],
          sillonBoxes: [{ id: ids.sillonBox, nombre: 'Box 1', descripcion: null }],
        });
      }
      if (u === '/api/prestaciones?activo=true') {
        return json([{ id: ids.prestacion, nombre: 'Limpieza', duracionMin: 30, activo: true }]);
      }
      if (u === '/api/turnos' && opciones.method === 'POST') {
        return respuestaTurno;
      }
      return json([]);
    });
  }

  async function completarFormulario() {
    render(<NuevoTurno />);
    fireEvent.change(screen.getByLabelText('Buscar paciente'), { target: { value: 'lu' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lucía Ficticia' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Lucía Ficticia' }));
    fireEvent.change(screen.getByLabelText('Profesional'), { target: { value: ids.profesional } });
    fireEvent.change(screen.getByLabelText('Sillón / box'), { target: { value: ids.sillonBox } });
    fireEvent.change(screen.getByLabelText('Prestación'), { target: { value: ids.prestacion } });
    fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2026-12-01T10:30' } });
  }

  const turnoCreado = {
    id: '99999999-9999-4999-8999-999999999999',
    pacienteId: ids.paciente,
    profesionalId: ids.profesional,
    sillonBoxId: ids.sillonBox,
    prestacionId: ids.prestacion,
    inicio: '2026-12-01T13:30:00.000Z',
    fin: '2026-12-01T14:00:00.000Z',
    duracionMin: 30,
    estado: 'PENDIENTE',
    creadoEn: '2026-11-25T12:00:00.000Z',
    canceladoEn: null,
    canceladoPor: null,
    solicitadoPor: null,
  };

  it('envía el payload exacto y muestra el DTO 201 con fechas en Buenos Aires', async () => {
    const fetchMock = mockBase(json(turnoCreado, 201));

    await completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Crear turno' }));

    await waitFor(() => expect(screen.getByText(/Turno creado/i)).toBeInTheDocument());
    const alta = fetchMock.mock.calls.find(([, opciones]) => opciones?.method === 'POST');
    expect(String(alta[0])).toBe('/api/turnos');
    expect(JSON.parse(alta[1].body)).toEqual({
      pacienteId: ids.paciente,
      profesionalId: ids.profesional,
      sillonBoxId: ids.sillonBox,
      prestacionId: ids.prestacion,
      inicio: '2026-12-01T10:30:00-03:00',
    });
    expect(alta[1].headers.Authorization).toBe('Bearer jwt-ficticio');
    expect(screen.getByText(/PENDIENTE/)).toBeInTheDocument();
    expect(screen.getByText(/01\/12\/2026, 10:30/)).toBeInTheDocument();
    expect(screen.getByText(/01\/12\/2026, 11:00/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('conserva el formulario y muestra 409 SOLAPAMIENTO real sin crear turno', async () => {
    mockBase(json({ error: { code: 'SOLAPAMIENTO', message: 'El profesional ya tiene un turno en ese horario' } }, 409));

    await completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Crear turno' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '409 SOLAPAMIENTO: El profesional ya tiene un turno en ese horario',
      ),
    );
    expect(screen.queryByText(/Turno creado/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Buscar paciente')).toHaveValue('');
    expect(screen.getByLabelText('Profesional')).toHaveValue(ids.profesional);
    expect(screen.getByLabelText('Inicio')).toHaveValue('2026-12-01T10:30');
  });

  it('asocia 422 REFERENCIA_INVALIDA al campo indicado en el mensaje', async () => {
    mockBase(
      json(
        {
          error: {
            code: 'REFERENCIA_INVALIDA',
            message: "Referencia inválida: 'prestacionId' no existe, es de otro consultorio o está inactivo",
          },
        },
        422,
      ),
    );

    await completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Crear turno' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('422 REFERENCIA_INVALIDA: Referencia inválida'),
    );
    expect(screen.getByLabelText('Prestación')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Profesional')).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText(/Turno creado/i)).not.toBeInTheDocument();
  });

  it('muestra 400 VALIDACION real sin reintentar ni crear turno local', async () => {
    const fetchMock = mockBase(
      json(
        { error: { code: 'VALIDACION', message: "'inicio' debe ser una fecha ISO 8601 con zona horaria explícita" } },
        400,
      ),
    );

    await completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Crear turno' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        "400 VALIDACION: 'inicio' debe ser una fecha ISO 8601 con zona horaria explícita",
      ),
    );
    const altas = fetchMock.mock.calls.filter(([, opciones]) => opciones?.method === 'POST');
    expect(altas).toHaveLength(1);
    expect(screen.queryByText(/Turno creado/i)).not.toBeInTheDocument();
  });

  it('muestra 403 SIN_PERMISO real para ODONTOLOGO sin crear turno', async () => {
    mockBase(
      json({ error: { code: 'SIN_PERMISO', message: 'Solo recepción y administración pueden crear turnos' } }, 403),
    );

    await completarFormulario();
    fireEvent.click(screen.getByRole('button', { name: 'Crear turno' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '403 SIN_PERMISO: Solo recepción y administración pueden crear turnos',
      ),
    );
    expect(screen.queryByText(/Turno creado/i)).not.toBeInTheDocument();
  });
});

describe('selección de recursos en /turnos/nuevo', () => {
  beforeEach(() => {
    sessionStorage.setItem('odontologia.jwt', 'jwt-ficticio');
    vi.restoreAllMocks();
  });

  it('no llama al backend con menos de 2 caracteres y pide mínimo 2', async () => {
    const fetchMock = mockFetch(() => json([]));

    render(<NuevoTurno />);
    const busqueda = screen.getByLabelText('Buscar paciente');
    fireEvent.change(busqueda, { target: { value: 'a' } });

    await waitFor(() =>
      expect(screen.getByText(/mínimo 2 caracteres/i)).toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/pacientes'))).toHaveLength(0);
  });

  it('busca con q codificado y muestra resultados seleccionables', async () => {
    const fetchMock = mockFetch(async (url) => {
      if (String(url).startsWith('/api/pacientes')) {
        return json([
          { id: '11111111-1111-4111-8111-111111111111', nombre: 'Lucía', apellido: 'Ficticia' },
          { id: '22222222-2222-4222-8222-222222222222', nombre: 'Marcos', apellido: 'Ejemplo' },
        ]);
      }
      if (u === '/api/prestaciones?activo=true') {
        return json([]);
      }
      return json({ profesionales: [], sillonBoxes: [] });
    });

    render(<NuevoTurno />);
    fireEvent.change(screen.getByLabelText('Buscar paciente'), { target: { value: 'lu' } });

    await waitFor(() => expect(screen.getByText('Lucía Ficticia')).toBeInTheDocument());
    const llamada = fetchMock.mock.calls.find(([url]) => String(url).startsWith('/api/pacientes'));
    expect(String(llamada[0])).toBe('/api/pacientes?q=lu');
    expect(llamada[1].headers.Authorization).toBe('Bearer jwt-ficticio');
    expect(screen.getByText('Marcos Ejemplo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Lucía Ficticia' }));
    expect(screen.getByText(/Paciente seleccionado/i)).toHaveTextContent('Lucía Ficticia');
    expect(screen.queryByText('Marcos Ejemplo')).not.toBeInTheDocument();
  });

  it('codifica caracteres especiales en q y muestra el error real de búsqueda', async () => {
    const fetchMock = mockFetch(async (url) => {
      const u = String(url);
      if (u.startsWith('/api/pacientes')) {
        return json({ error: { code: 'TOKEN_INVALIDO', message: 'No autorizado' } }, 401);
      }
      if (u === '/api/catalogo') return json({ profesionales: [], sillonBoxes: [] });
      if (u === '/api/prestaciones?activo=true') return json([]);
      return json([]);
    });

    render(<NuevoTurno />);
    fireEvent.change(screen.getByLabelText('Buscar paciente'), { target: { value: 'ana pé' } });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('401 TOKEN_INVALIDO: No autorizado'),
    );
    const llamada = fetchMock.mock.calls.find(([url]) => String(url).startsWith('/api/pacientes'));
    expect(String(llamada[0])).toBe('/api/pacientes?q=ana+p%C3%A9');
    expect(screen.queryByRole('list', { name: 'Resultados de búsqueda' })).not.toBeInTheDocument();
  });

  it('carga profesionales, sillones/boxes y prestaciones activas en las rutas exactas', async () => {
    const fetchMock = mockFetch(async (url) => {
      const u = String(url);
      if (u === '/api/catalogo') {
        return json({
          profesionales: [{ id: '33333333-3333-4333-8333-333333333333', nombre: 'Dra. Ficticia', matricula: 'MP-0001' }],
          sillonBoxes: [{ id: '44444444-4444-4444-8444-444444444444', nombre: 'Box 1', descripcion: 'Sillón dental' }],
        });
      }
      if (u === '/api/prestaciones?activo=true') {
        return json([
          { id: '55555555-5555-4555-8555-555555555555', nombre: 'Limpieza', duracionMin: 30, activo: true },
        ]);
      }
      return json([]);
    });

    render(<NuevoTurno />);

    await waitFor(() =>
      expect(screen.getByRole('option', { name: /Dra. Ficticia/ })).toBeInTheDocument(),
    );
    expect(screen.getByRole('option', { name: /Box 1/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Limpieza/ })).toBeInTheDocument();

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toContain('/api/catalogo');
    expect(urls).toContain('/api/prestaciones?activo=true');
    for (const llamada of fetchMock.mock.calls) {
      expect(llamada[1].headers.Authorization).toBe('Bearer jwt-ficticio');
    }
  });

  it('muestra el error real de catálogo sin reintentar', async () => {
    const fetchMock = mockFetch(async (url) => {
      const u = String(url);
      if (u === '/api/catalogo') {
        return json({ error: { code: 'SIN_PERMISO', message: 'Permisos insuficientes para esta operación' } }, 403);
      }
      if (u === '/api/prestaciones?activo=true') {
        return json([]);
      }
      return json([]);
    });

    render(<NuevoTurno />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '403 SIN_PERMISO: Permisos insuficientes para esta operación',
      ),
    );
    expect(fetchMock.mock.calls.filter(([url]) => String(url) === '/api/catalogo')).toHaveLength(1);
  });
});

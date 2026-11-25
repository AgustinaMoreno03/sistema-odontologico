import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Agenda } from './Agenda.jsx';

const json = (dato, status = 200) =>
  new Response(JSON.stringify(dato), { status, headers: { 'Content-Type': 'application/json' } });

const CATALOGO = {
  profesionales: [{ id: '33333333-3333-4333-8333-333333333333', nombre: 'Dra. Ficticia', matricula: 'MP-0001' }],
  sillonBoxes: [{ id: '44444444-4444-4444-8444-444444444444', nombre: 'Box 1', descripcion: null }],
};

const PRESTACIONES = [
  { id: '55555555-5555-4555-8555-555555555555', nombre: 'Limpieza', duracionMin: 30, activo: true },
];

function baseTurno(sobrescritura = {}) {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    pacienteId: '11111111-1111-4111-8111-111111111111',
    pacienteNombre: 'Lucía',
    pacienteApellido: 'Ficticia',
    profesionalId: '33333333-3333-4333-8333-333333333333',
    sillonBoxId: '44444444-4444-4444-8444-444444444444',
    prestacionId: '55555555-5555-4555-8555-555555555555',
    inicio: '2026-12-01T13:30:00.000Z',
    fin: '2026-12-01T14:00:00.000Z',
    duracionMin: 30,
    estado: 'PENDIENTE',
    ...sobrescritura,
  };
}

function agendaRespuesta(turnos, extras = {}) {
  return {
    desde: '2026-12-01T03:00:00.000Z',
    hasta: '2026-12-02T03:00:00.000Z',
    zonaHoraria: 'America/Argentina/Buenos_Aires',
    turnos,
    hayMas: false,
    siguienteOffset: null,
    ...extras,
  };
}

function mockAgenda({ agenda, errorAgenda, paginas } = {}) {
  let pagina = 0;
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.startsWith('/api/agenda')) {
      if (errorAgenda) return errorAgenda;
      if (paginas) {
        const respuesta = paginas[Math.min(pagina, paginas.length - 1)];
        pagina += 1;
        return json(respuesta);
      }
      return json(agenda ?? agendaRespuesta([]));
    }
    if (u === '/api/catalogo') return json(CATALOGO);
    if (u === '/api/prestaciones?activo=true') return json(PRESTACIONES);
    return json([]);
  });
}

function paramsDeLlamada(fetchMock, indice = 0) {
  const llamadas = fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/agenda'));
  const [url] = llamadas[indice];
  return { params: new URLSearchParams(String(url).split('?')[1]), total: llamadas.length };
}

function totalAgenda(fetchMock) {
  return fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/agenda')).length;
}

describe('/agenda contra GET /api/agenda real', () => {
  beforeEach(() => {
    sessionStorage.setItem('odontologia.jwt', 'jwt-ficticio');
    window.history.pushState({}, '', '/agenda');
    vi.restoreAllMocks();
  });

  it('consulta con rango -03:00, limite=200 y offset=0 sin parámetros repetidos', async () => {
    const fetchMock = mockAgenda({
      agenda: agendaRespuesta([baseTurno()]),
    });

    render(<Agenda />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-12-01' } });
    await waitFor(() => expect(screen.getByText('Lucía Ficticia')).toBeInTheDocument());

    const { params, total } = paramsDeLlamada(fetchMock, totalAgenda(fetchMock) - 1);
    expect(total).toBe(2); // la inicial (hoy) y la del cambio de fecha
    expect(params.get('desde')).toBe('2026-12-01T00:00:00-03:00');
    expect(params.get('hasta')).toBe('2026-12-02T00:00:00-03:00');
    expect(params.get('limite')).toBe('200');
    expect(params.get('offset')).toBe('0');
    expect(params.getAll('desde')).toHaveLength(1);
    expect(params.getAll('limite')).toHaveLength(1);
    expect(params.has('profesionalId')).toBe(false);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-ficticio');
  });

  it('usa rango semanal de lunes a lunes+7 con -03:00', async () => {
    const fetchMock = mockAgenda();

    render(<Agenda />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-12-02' } });
    fireEvent.change(screen.getByLabelText('Rango'), { target: { value: 'semana' } });

    await waitFor(() => {
      const { params, total } = paramsDeLlamada(fetchMock, totalAgenda(fetchMock) - 1);
      expect(params.get('desde')).toBe('2026-11-30T00:00:00-03:00');
      expect(params.get('hasta')).toBe('2026-12-07T00:00:00-03:00');
      expect(params.get('limite')).toBe('200');
      expect(params.get('offset')).toBe('0');
      expect(total).toBeGreaterThan(0);
    });
  });

  it('muestra todos los estados incluido CANCELADO, nombres y catálogo resuelto, en BA', async () => {
    mockAgenda({
      agenda: agendaRespuesta([
        baseTurno(),
        baseTurno({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', estado: 'CANCELADO', pacienteNombre: 'Marcos', pacienteApellido: 'Ejemplo', inicio: '2026-12-01T15:00:00.000Z', fin: '2026-12-01T15:30:00.000Z' }),
        baseTurno({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', estado: 'ATENDIDO', pacienteNombre: 'Ana', pacienteApellido: null }),
      ]),
    });

    render(<Agenda />);
    await waitFor(() => expect(screen.getByText('Lucía Ficticia')).toBeInTheDocument());

    expect(screen.getByText('Marcos Ejemplo')).toBeInTheDocument();
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    expect(screen.getByText('PENDIENTE')).toBeInTheDocument();
    expect(screen.getByText('CANCELADO')).toBeInTheDocument();
    expect(screen.getByText('ATENDIDO')).toBeInTheDocument();
    // Nombres resueltos desde el catálogo (dentro de la tabla, no del select).
    const tabla = screen.getByRole('table');
    expect(within(tabla).getAllByText('Dra. Ficticia').length).toBeGreaterThan(0);
    expect(within(tabla).getAllByText('Box 1').length).toBeGreaterThan(0);
    expect(within(tabla).getAllByText('Limpieza').length).toBeGreaterThan(0);
    // Instantes UTC presentados en Buenos Aires: 13:30Z → 10:30.
    expect(within(tabla).getAllByText(/01\/12\/2026, 10:30/).length).toBeGreaterThan(0);
    // La agenda NO ofrece cancelación (spec: cancelar solo en /turnos/nuevo).
    expect(screen.queryByRole('button', { name: /cancelar/i })).not.toBeInTheDocument();
  });

  it('pagina con siguienteOffset, deduplica IDs y resetea a offset=0 en Recargar', async () => {
    const fetchMock = mockAgenda({
      paginas: [
        agendaRespuesta(
          [baseTurno(), baseTurno({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', pacienteNombre: 'Marcos' })],
          { hayMas: true, siguienteOffset: 2 },
        ),
        agendaRespuesta(
          [
            baseTurno({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', pacienteNombre: 'Marcos' }),
            baseTurno({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', pacienteNombre: 'Ana', pacienteApellido: null }),
          ],
          { hayMas: false, siguienteOffset: null },
        ),
        agendaRespuesta([baseTurno()]),
      ],
    });

    render(<Agenda />);
    await waitFor(() => expect(screen.getByText('Lucía Ficticia')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(screen.getByText('Ana')).toBeInTheDocument());
    // Deduplicado: Marcos aparece una sola vez pese a venir en ambas páginas.
    expect(screen.getAllByText(/Marcos/)).toHaveLength(1);
    const { params } = paramsDeLlamada(fetchMock, 1);
    expect(params.get('offset')).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: 'Recargar' }));
    await waitFor(() => {
      const ultima = paramsDeLlamada(fetchMock, paramsDeLlamada(fetchMock).total - 1);
      expect(ultima.params.get('offset')).toBe('0');
    });
    // Reset real: la página acumulada se descarta (Ana ya no está).
    await waitFor(() => expect(screen.queryByText('Ana')).not.toBeInTheDocument());
    expect(screen.getByText('Lucía Ficticia')).toBeInTheDocument();
  });

  it('resetea a offset=0 al cambiar profesional y filtra por profesionalId', async () => {
    const fetchMock = mockAgenda({
      paginas: [
        agendaRespuesta([baseTurno()], { hayMas: true, siguienteOffset: 1 }),
        agendaRespuesta([baseTurno({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })], { hayMas: true, siguienteOffset: 1 }),
        agendaRespuesta([]),
      ],
    });

    render(<Agenda />);
    await waitFor(() => expect(screen.getByText('Lucía Ficticia')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    await waitFor(() => expect(paramsDeLlamada(fetchMock).total).toBe(2));

    fireEvent.change(screen.getByLabelText('Profesional'), {
      target: { value: '33333333-3333-4333-8333-333333333333' },
    });

    await waitFor(() => {
      const { params } = paramsDeLlamada(fetchMock, totalAgenda(fetchMock) - 1);
      expect(params.get('offset')).toBe('0');
      expect(params.get('profesionalId')).toBe('33333333-3333-4333-8333-333333333333');
    });
  });

  it.each([
    [400, 'VALIDACION', 'Parámetros o rango inválidos'],
    [401, 'TOKEN_INVALIDO', 'No autorizado'],
    [403, 'SIN_PERMISO', 'Agenda no autorizada'],
    [404, 'PROFESIONAL_NO_ENCONTRADO', 'Profesional no encontrado'],
  ])('muestra el error real %i %s de la agenda', async (status, code, message) => {
    const fetchMock = mockAgenda({
      errorAgenda: json({ error: { code, message } }, status),
    });

    render(<Agenda />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(`${status} ${code}: ${message}`),
    );
    expect(screen.queryByText(/Lucía/)).not.toBeInTheDocument();
    // Sin reintentos: una única consulta al fallar.
    expect(totalAgenda(fetchMock)).toBe(1);
  });
});

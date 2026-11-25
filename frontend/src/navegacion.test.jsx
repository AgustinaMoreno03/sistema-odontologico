import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App.jsx';

const json = (dato, status = 200) =>
  new Response(JSON.stringify(dato), { status, headers: { 'Content-Type': 'application/json' } });

const AGENDA_VACIA = {
  desde: '2026-11-25T03:00:00.000Z',
  hasta: '2026-11-26T03:00:00.000Z',
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  turnos: [],
  hayMas: false,
  siguienteOffset: null,
};

function mockFetchGeneral() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const u = String(url);
    if (u.startsWith('/api/agenda')) return json(AGENDA_VACIA);
    if (u === '/api/catalogo') {
      return json({
        profesionales: [{ id: '33333333-3333-4333-8333-333333333333', nombre: 'Dra. Ficticia', matricula: 'MP-0001' }],
        sillonBoxes: [{ id: '44444444-4444-4444-8444-444444444444', nombre: 'Box 1', descripcion: null }],
      });
    }
    if (u === '/api/prestaciones?activo=true') {
      return json([{ id: '55555555-5555-4555-8555-555555555555', nombre: 'Limpieza', duracionMin: 30, activo: true }]);
    }
    if (u.startsWith('/api/pacientes')) {
      return json([{ id: '11111111-1111-4111-8111-111111111111', nombre: 'Lucía', apellido: 'Ficticia' }]);
    }
    if (u === '/auth/login') return json({ token: 'jwt-ficticio' });
    if (u === '/api/turnos') {
      return json(
        {
          id: '99999999-9999-4999-8999-999999999999',
          estado: 'PENDIENTE',
          inicio: '2026-12-01T13:30:00.000Z',
          fin: '2026-12-01T14:00:00.000Z',
        },
        201,
      );
    }
    return json([]);
  });
}

describe('navegación del área protegida', () => {
  beforeEach(() => {
    sessionStorage.setItem('odontologia.jwt', 'jwt-ficticio');
    vi.restoreAllMocks();
  });

  it('navega desde /inicio a /agenda y a /turnos/nuevo sin recargar', async () => {
    const fetchMock = mockFetchGeneral();

    window.history.pushState({}, '', '/inicio');
    render(<App />);
    expect(screen.getByText('Sesión iniciada')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Agenda' }));
    expect(window.location.pathname).toBe('/agenda');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Agenda' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('link', { name: 'Nuevo turno' }));
    expect(window.location.pathname).toBe('/turnos/nuevo');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Nuevo turno' })).toBeInTheDocument(),
    );
    // La agenda solo se consultó al entrar en /agenda, no antes.
    expect(fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/agenda'))).toHaveLength(1);
  });

  it('protege /agenda y /turnos/nuevo sin sesión, sin llamadas protegidas', () => {
    sessionStorage.clear();
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    window.history.pushState({}, '', '/agenda');
    const { unmount } = render(<App />);
    expect(screen.getByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    unmount();

    window.history.pushState({}, '', '/turnos/nuevo');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('la primera consulta de agenda tras crear un turno en /turnos/nuevo usa offset=0 (reset por remontaje)', async () => {
    const fetchMock = mockFetchGeneral();

    window.history.pushState({}, '', '/inicio');
    render(<App />);

    fireEvent.click(screen.getByRole('link', { name: 'Nuevo turno' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Nuevo turno' })).toBeInTheDocument(),
    );

    // Alta real del turno (task 3.5: reset tras alta).
    fireEvent.change(screen.getByLabelText('Buscar paciente'), { target: { value: 'lu' } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Lucía Ficticia' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Lucía Ficticia' }));
    fireEvent.change(screen.getByLabelText('Profesional'), { target: { value: '33333333-3333-4333-8333-333333333333' } });
    fireEvent.change(screen.getByLabelText('Sillón / box'), { target: { value: '44444444-4444-4444-8444-444444444444' } });
    fireEvent.change(screen.getByLabelText('Prestación'), { target: { value: '55555555-5555-4555-8555-555555555555' } });
    fireEvent.change(screen.getByLabelText('Inicio'), { target: { value: '2026-12-01T10:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear turno' }));
    await waitFor(() => expect(screen.getByText(/Turno creado/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('link', { name: 'Agenda' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Agenda' })).toBeInTheDocument());

    const llamadas = fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/agenda'));
    expect(llamadas).toHaveLength(1);
    expect(new URLSearchParams(String(llamadas[0][0]).split('?')[1]).get('offset')).toBe('0');
  });
});

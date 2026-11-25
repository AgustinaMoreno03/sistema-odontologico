import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App.jsx';

describe('autenticación y guardia de sesión', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/login');
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('envía exactamente email y password, guarda el token y habilita la ruta protegida', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ token: 'jwt-ficticio' }), { status: 200 }),
    );

    render(<App />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'recepcion@ejemplo.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(screen.getByText('Sesión iniciada')).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toBe('/auth/login');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ email: 'recepcion@ejemplo.test', password: 'clave-ficticia' }));
    expect(sessionStorage.getItem('odontologia.jwt')).toBe('jwt-ficticio');
  });

  it('conserva el formulario y muestra el error real de credenciales', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'CREDENCIALES_INVALIDAS', message: 'Usuario o contraseña incorrectos' } }), { status: 401 }),
    );

    render(<App />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'mal@ejemplo.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'incorrecta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('401 CREDENCIALES_INVALIDAS: Usuario o contraseña incorrectos'));
    expect(screen.getByDisplayValue('mal@ejemplo.test')).toBeInTheDocument();
  });

  it('redirige una ruta protegida a login sin llamar al backend cuando no hay sesión', () => {
    window.history.pushState({}, '', '/inicio');
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Ingresar' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('muestra TOKEN_INVALIDO y conserva el formulario cuando el 200 no incluye token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );

    render(<App />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'recepcion@ejemplo.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('200 TOKEN_INVALIDO: La respuesta del servidor no incluyó un token válido'));
    expect(screen.getByDisplayValue('recepcion@ejemplo.test')).toBeInTheDocument();
    expect(sessionStorage.getItem('odontologia.jwt')).toBeNull();
  });

  it('muestra TOKEN_INVALIDO ante un 200 con body vacío sin crashear', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));

    render(<App />);
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'recepcion@ejemplo.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'clave-ficticia' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('200 TOKEN_INVALIDO: La respuesta del servidor no incluyó un token válido'));
    expect(sessionStorage.getItem('odontologia.jwt')).toBeNull();
  });
});

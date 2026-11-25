import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, clearToken, setToken } from './http.js';

describe('cliente HTTP', () => {
  beforeEach(() => {
    clearToken();
    vi.restoreAllMocks();
  });

  it('envía JSON y Bearer únicamente cuando la request es protegida', async () => {
    setToken('jwt-ficticio');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );

    await apiFetch('/api/protegida', {
      method: 'POST',
      body: { nombre: 'Ejemplo' },
      protected: true,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/protegida', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-ficticio',
      },
      body: JSON.stringify({ nombre: 'Ejemplo' }),
    });
  });

  it('normaliza el error conservando status, code, message y field', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'VALIDACION', message: 'Dato inválido', field: 'email' } }), { status: 422 }),
    );

    await expect(apiFetch('/auth/login', { method: 'POST', body: { email: 'x', password: 'y' } }))
      .rejects.toMatchObject({ status: 422, code: 'VALIDACION', message: 'Dato inválido', field: 'email' });
  });

  it('no envía Authorization en peticiones públicas aunque haya un token guardado', async () => {
    setToken('jwt-ficticio');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ token: 'jwt-ficticio' }), { status: 200 }),
    );

    await apiFetch('/auth/login', {
      method: 'POST',
      body: { email: 'recepcion@ejemplo.test', password: 'clave-ficticia' },
    });

    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('normaliza un fallo de conexión sin exponer el mensaje nativo', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await apiFetch('/auth/login', { method: 'POST', body: { email: 'x', password: 'y' } })
      .catch((caught) => caught);

    expect(error).toMatchObject({ status: 0, code: 'ERROR_DE_CONEXION' });
    expect(error.message).toBe('No se pudo conectar con el servidor');
    expect(error.message).not.toContain('Failed to fetch');
  });

  it('devuelve null ante un 2xx con body vacío', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 200 }));

    await expect(apiFetch('/x')).resolves.toBeNull();
  });

  it('rechaza con RESPUESTA_INVALIDA ante un 2xx con body no-JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html>oops</html>', { status: 200 }));

    await expect(apiFetch('/x'))
      .rejects.toMatchObject({ status: 200, code: 'RESPUESTA_INVALIDA', message: 'El servidor devolvió una respuesta inválida' });
  });
});

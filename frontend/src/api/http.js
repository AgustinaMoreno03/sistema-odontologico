const TOKEN_KEY = 'odontologia.jwt';

export class ApiError extends Error {
  constructor({ status, code, message, field }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.message = message;
    this.field = field;
  }
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch(path, { body, protected: isProtected = false, ...options } = {}) {
  const headers = { ...(options.headers ?? {}) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (isProtected) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError({
      status: 0,
      code: 'ERROR_DE_CONEXION',
      message: 'No se pudo conectar con el servidor',
    });
  }

  const rawBody = await response.text().catch(() => '');
  let data = null;
  let invalidJson = false;
  if (rawBody.trim() !== '') {
    try {
      data = JSON.parse(rawBody);
    } catch {
      invalidJson = true;
    }
  }

  if (!response.ok) {
    const error = data?.error ?? {};
    throw new ApiError({
      status: response.status,
      code: error.code ?? 'ERROR_HTTP',
      message: error.message ?? 'No se pudo completar la solicitud',
      field: error.field,
    });
  }

  if (invalidJson) {
    throw new ApiError({
      status: response.status,
      code: 'RESPUESTA_INVALIDA',
      message: 'El servidor devolvió una respuesta inválida',
    });
  }

  return data;
}

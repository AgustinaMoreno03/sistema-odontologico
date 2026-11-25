import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../src/app.js';
import { verificarPassword } from '../src/modules/auth/servicios.js';
import { crearToken } from './helpers/tokens.js';

const URL_PRUEBA = 'postgresql://bootstrap.invalid/aislada';
const CONSULTORIO_NUEVO = '00000000-0000-4000-8000-000000000021';
const USUARIO_NUEVO = '00000000-0000-4000-8000-000000000022';
const EMAIL = 'bootstrap@example.invalid';
const PASSWORD = ' frase ficticia de bootstrap ';

let base;

// Sustituye únicamente pg.Client. Distingue autocommit (CLI anterior y alta
// HTTP) de filas pendientes en cada conexión. No simula el motor SQL.
vi.mock('pg', async (importOriginal) => {
  const pg = await importOriginal();
  const { EventEmitter } = await import('node:events');
  class Client extends EventEmitter {
    constructor(opciones) {
      super();
      this.opciones = opciones;
      this.eventos = [];
      this.conectado = false;
      this.pendientes = null;
      base.clientes.push(this);
    }

    async connect() {
      if (this.conectado) throw new Error('Ya conectado');
      this.conectado = true;
      this.eventos.push('connect');
    }

    async query(sql, valores) {
      if (!this.conectado) throw new Error('Cliente sin conexión');
      if (sql === 'BEGIN') {
        this.eventos.push('BEGIN');
        this.pendientes = { consultorios: [], usuarios: [] };
        return;
      }
      if (sql === 'COMMIT' || sql === 'ROLLBACK') {
        if (!this.pendientes) throw new Error('No hay transacción');
        this.eventos.push(sql);
        if (this.conexionPerdida) throw new Error('Conexión simulada no disponible');
        if (sql === 'COMMIT') {
          base.consultorios.push(...this.pendientes.consultorios);
          base.usuarios.push(...this.pendientes.usuarios);
        }
        this.pendientes = null;
        return;
      }
      const destino = this.pendientes ?? base;
      if (/^INSERT INTO consultorio\b/.test(sql)) {
        this.eventos.push('alta consultorio');
        const fila = { id: CONSULTORIO_NUEVO };
        destino.consultorios.push(fila);
        return { rows: [fila] };
      }
      if (/^INSERT INTO usuario\b/.test(sql)) {
        this.eventos.push('alta usuario');
        const [id, consultorioId, rol, email, passwordHash] = valores;
        if (base.cortarConexionAlEscribir) {
          const fallo = new Error('Conexión simulada interrumpida al escribir');
          this.conexionPerdida = true;
          // pg rechaza la consulta y también emite desde el socket. Registramos
          // si el segundo canal habría escapado como excepción no capturada.
          try {
            this.emit('error', fallo);
          } catch {
            base.eventoNoManejado = true;
          }
          throw fallo;
        }
        if (base.errorEscritura) throw base.errorEscritura;
        if (base.usuarios.some((usuario) => usuario.email === email)) {
          throw Object.assign(new Error('Email ya registrado en el doble'), {
            code: '23505',
            constraint: 'usuario_email_unique',
            detail: `Email en conflicto: ${email}`,
          });
        }
        const fila = {
          id: id ?? USUARIO_NUEVO,
          consultorio_id: consultorioId,
          rol,
          email,
          password_hash: passwordHash,
        };
        destino.usuarios.push(fila);
        return { rows: [fila] };
      }
      throw new Error('Consulta no prevista en el doble');
    }

    async end() {
      this.eventos.push('end');
      this.conectado = false;
      this.pendientes = null;
    }
  }
  return { ...pg, Client, default: { ...pg.default, Client } };
});

beforeEach(() => {
  base = { clientes: [], consultorios: [], usuarios: [] };
  vi.stubEnv('DATABASE_URL', URL_PRUEBA);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('CLI crear-consultorio', () => {
  let log;
  let error;
  let confirmadosAlInformar;
  let codigoAnterior;
  let argumentosAnteriores;

  beforeEach(() => {
    vi.stubEnv('BOOTSTRAP_ADMIN_EMAIL', ` ${EMAIL} `);
    vi.stubEnv('BOOTSTRAP_ADMIN_PASSWORD', PASSWORD);
    vi.stubEnv('JWT_SECRET', undefined);
    codigoAnterior = process.exitCode;
    process.exitCode = undefined;
    argumentosAnteriores = process.argv;
    process.argv = [process.execPath, 'scripts/crear-consultorio.js',
      '--email', 'alternativo@example.invalid', '--password', 'alternativa-ficticia',
      '--rol', 'RECEPCION', '--consultorioId', '00000000-0000-4000-8000-000000000033'];
    log = vi.spyOn(console, 'log').mockImplementation(() => {
      confirmadosAlInformar = [base.consultorios.length, base.usuarios.length];
    });
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = codigoAnterior;
    process.argv = argumentosAnteriores;
  });

  function esperarFalloSeguro() {
    expect(process.exitCode).toBe(1);
    expect(log.mock.calls.length).toBe(0);
    expect(error.mock.calls.length).toBe(1);
    const [argumentos] = error.mock.calls;
    expect(argumentos.length === 1 && argumentos[0] === 'No se pudo aprovisionar el consultorio.').toBe(true);
  }

  function esperarRollbackEnClienteUnico(eventosDeAlta) {
    expect(base.clientes).toHaveLength(1);
    expect(base.clientes[0].eventos).toEqual(['connect', 'BEGIN', ...eventosDeAlta, 'ROLLBACK', 'end']);
  }

  it('Aprovisionamiento operativo: confirma el consultorio y su primer administrador juntos', async () => {
    await import('../scripts/crear-consultorio.js');

    expect(base.consultorios).toEqual([{ id: CONSULTORIO_NUEVO }]);
    expect(base.usuarios, 'Falta el administrador confirmado del nuevo consultorio').toHaveLength(1);
    const { password_hash: hash, ...admin } = base.usuarios[0];
    expect(admin).toEqual({
      id: USUARIO_NUEVO,
      consultorio_id: CONSULTORIO_NUEVO,
      rol: 'ADMIN_CONSULTORIO',
      email: EMAIL,
    });
    expect(hash !== PASSWORD).toBe(true);
    expect(await verificarPassword(PASSWORD, hash)).toBe(true);
    expect(await verificarPassword(PASSWORD.trim(), hash)).toBe(false);

    expect(base.clientes).toHaveLength(1);
    expect(base.clientes[0].opciones.connectionString === URL_PRUEBA).toBe(true);
    expect(base.clientes[0].eventos).toEqual([
      'connect', 'BEGIN', 'alta consultorio', 'alta usuario', 'COMMIT', 'end',
    ]);
    expect(confirmadosAlInformar).toEqual([1, 1]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0].length === 1 &&
      log.mock.calls[0][0] === `Consultorio aprovisionado: ${CONSULTORIO_NUEVO}`).toBe(true);
    expect(error.mock.calls.length).toBe(0);
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('Email duplicado de otro consultorio: revierte el alta y preserva las filas existentes', async () => {
    const consultorioExistente = { id: '00000000-0000-4000-8000-000000000031' };
    const usuarioExistente = {
      id: '00000000-0000-4000-8000-000000000032',
      consultorio_id: consultorioExistente.id,
      rol: 'ADMIN_CONSULTORIO',
      email: EMAIL,
      password_hash: 'hash-ficticio-preexistente',
    };
    base.consultorios.push({ ...consultorioExistente });
    base.usuarios.push({ ...usuarioExistente });

    await import('../scripts/crear-consultorio.js');

    expect(base.consultorios).toEqual([consultorioExistente]);
    expect(base.usuarios).toEqual([usuarioExistente]);
    esperarRollbackEnClienteUnico(['alta consultorio', 'alta usuario']);
    esperarFalloSeguro();
  });

  it.each([
    ['email ausente', 'BOOTSTRAP_ADMIN_EMAIL', undefined],
    ['email vacío', 'BOOTSTRAP_ADMIN_EMAIL', ''],
    ['email en blanco', 'BOOTSTRAP_ADMIN_EMAIL', ' \t '],
    ['contraseña ausente', 'BOOTSTRAP_ADMIN_PASSWORD', undefined],
    ['contraseña vacía', 'BOOTSTRAP_ADMIN_PASSWORD', ''],
  ])('Configuración inválida: %s no provisiona ni toma argumentos alternativos', async (_caso, clave, valor) => {
    vi.stubEnv(clave, valor);

    await import('../scripts/crear-consultorio.js');

    expect(base.consultorios).toHaveLength(0);
    expect(base.usuarios).toHaveLength(0);
    esperarRollbackEnClienteUnico(['alta consultorio']);
    esperarFalloSeguro();
  });

  it.each([
    ['ausente', undefined],
    ['vacía', ''],
    ['en blanco', ' \t '],
  ])('Configuración inválida: DATABASE_URL %s no abre conexión', async (_caso, url) => {
    vi.stubEnv('DATABASE_URL', url);

    await import('../scripts/crear-consultorio.js');

    expect(base.clientes, 'No debe construir un cliente ni depender del fallback de pg').toHaveLength(0);
    expect(base.consultorios).toHaveLength(0);
    expect(base.usuarios).toHaveLength(0);
    esperarFalloSeguro();
  });

  it('Fallo inesperado al escribir el administrador: revierte y no expone detalles', async () => {
    base.errorEscritura = Object.assign(new Error(`Destino de prueba: ${URL_PRUEBA}`), {
      detail: 'Detalle interno ficticio de escritura',
    });

    await import('../scripts/crear-consultorio.js');

    expect(base.consultorios).toHaveLength(0);
    expect(base.usuarios).toHaveLength(0);
    esperarRollbackEnClienteUnico(['alta consultorio', 'alta usuario']);
    esperarFalloSeguro();
  });

  it('Fallo inesperado por desconexión: intenta revertir y cierra sin propagar el evento de pg', async () => {
    base.cortarConexionAlEscribir = true;

    await import('../scripts/crear-consultorio.js');

    expect(base.eventoNoManejado ?? false, 'El evento error de pg no debe escapar al proceso').toBe(false);
    expect(base.consultorios).toHaveLength(0);
    expect(base.usuarios).toHaveLength(0);
    esperarRollbackEnClienteUnico(['alta consultorio', 'alta usuario']);
    esperarFalloSeguro();
  });
});

describe('Compatibilidad HTTP C01', () => {
  const TENANT_AUTENTICADO = '00000000-0000-4000-8000-000000000041';
  const OTRO_TENANT = '00000000-0000-4000-8000-000000000042';
  const altaUsuario = {
    consultorioId: OTRO_TENANT,
    email: 'recepcion@example.invalid',
    password: 'contraseña ficticia para alta HTTP',
    rol: 'RECEPCION',
  };

  function altaConToken(rol) {
    const token = crearToken({ consultorioId: TENANT_AUTENTICADO, rol });
    return request(crearApp()).post('/usuarios').set('Authorization', `Bearer ${token}`).send(altaUsuario);
  }

  it('POST /consultorios devuelve 404 sin acceso a base', async () => {
    const respuesta = await request(crearApp()).post('/consultorios').send({});

    expect(respuesta.status).toBe(404);
    expect(base.clientes).toHaveLength(0);
  });

  it('POST /usuarios sin autenticación devuelve 401 sin acceso a base', async () => {
    const respuesta = await request(crearApp()).post('/usuarios').send(altaUsuario);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error?.code).toBe('TOKEN_INVALIDO');
    expect(base.clientes).toHaveLength(0);
  });

  it('POST /usuarios con rol no administrador devuelve 403 sin acceso a base', async () => {
    const respuesta = await altaConToken('RECEPCION');

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error?.code).toBe('ROL_NO_AUTORIZADO');
    expect(base.clientes).toHaveLength(0);
  });

  it('POST /usuarios con administrador devuelve 201 y usa el tenant del token y cliente propio', async () => {
    const respuesta = await altaConToken('ADMIN_CONSULTORIO');

    expect(respuesta.status).toBe(201);
    expect(Object.keys(respuesta.body).sort()).toEqual(['consultorioId', 'email', 'rol', 'usuarioId']);
    expect(respuesta.body.consultorioId).toBe(TENANT_AUTENTICADO);
    expect(respuesta.body.usuarioId).toBe(USUARIO_NUEVO);
    expect(base.clientes).toHaveLength(1);
    expect(base.clientes[0].eventos).toEqual(['connect', 'alta usuario', 'end']);
    expect(base.usuarios).toHaveLength(1);
    expect(base.usuarios[0].consultorio_id).toBe(TENANT_AUTENTICADO);
    expect(base.usuarios[0].rol).toBe('RECEPCION');
  });
});

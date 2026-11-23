import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { crearToken } from './tokens.js';

// Fixtures FICTICIOS de turnos (task 1.2 de C05; regla dura 1: jamás datos
// reales). Vive SOLO en tests/, nunca en producción.
//
// Patrón idéntico a catalogo-fixtures.js:
// - Cada fixture crea SU consultorio (y sus recursos) con UUIDs distintos por
//   test (crypto.randomUUID), para que la suite corra en paralelo sin pisarse.
// - La limpieza es ordenada por FKs (turno → paciente → prestación →
//   sillón/box → profesional → usuario → consultorio), filtrada por
//   identificador y SIN DELETE globales ni TRUNCATE: cada test limpia lo suyo.
// - `limpiar()` es idempotente y cierra la conexión del fixture.
// - El borrado de `turno` va protegido con to_regclass: antes de que exista la
//   migración 050 la tabla no existe y el helper sigue funcionando; después
//   limpia los turnos creados por el test.

/**
 * Ejecuta `funcion({ fixture, token })` con un fixture propio (consultorio +
 * paciente + profesional + sillón/box + prestación ficticios) y un token
 * ficticio para ese consultorio, y limpia al final. Cada test queda
 * autocontenido (UUIDs distintos por test, regla dura 1).
 *
 * @param {(ctx: {fixture: Awaited<ReturnType<typeof crearFixtureTurnos>>, token: string}) => Promise<any>} funcion
 * @param {object} [opciones]
 * @param {string} [opciones.rol] rol del token ficticio
 *   (default ADMIN_CONSULTORIO; RECEPCION y ADMIN_CONSULTORIO crean turnos).
 * @returns {Promise<any>} el resultado de `funcion`
 */
export async function conFixtureTurnos(funcion, { rol = 'ADMIN_CONSULTORIO' } = {}) {
  const fixture = await crearFixtureTurnos({ rol });
  try {
    // El token referencia al USUARIO FICTICIO creado por el fixture (C07
    // task 1.2): la FK `reprogramado_por → usuario(id)` de la 070 exige que
    // ese id exista en la base (design D5).
    const token = crearToken({
      usuarioId: fixture.usuarioId,
      consultorioId: fixture.consultorioId,
      rol,
    });
    return await funcion({ fixture, token });
  } finally {
    await fixture.limpiar();
  }
}

/**
 * Crea un consultorio ficticio propio con los recursos que un turno necesita:
 * paciente, profesional, sillón/box y prestación (todos ficticios y activos),
 * más un `usuario` ficticio cuyo id es el que firma el token del fixture.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.rol] rol del usuario ficticio (default
 *   ADMIN_CONSULTORIO); debe coincidir con el rol del token firmado.
 * @returns {Promise<{
 *   consultorioId: string,
 *   usuarioId: string,
 *   pacienteId: string,
 *   profesionalId: string,
 *   sillonBoxId: string,
 *   prestacionId: string,
 *   consultar: (sql: string, params?: unknown[]) => Promise<import('pg').QueryResult>,
 *   limpiar: () => Promise<void>,
 * }>}
 */
export async function crearFixtureTurnos({ rol = 'ADMIN_CONSULTORIO' } = {}) {
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();

  const consultorioId = randomUUID();
  const usuarioId = randomUUID();
  const pacienteId = randomUUID();
  const profesionalId = randomUUID();
  const sillonBoxId = randomUUID();
  const prestacionId = randomUUID();
  let cerrado = false;

  try {
    await cliente.query('INSERT INTO consultorio (id) VALUES ($1)', [consultorioId]);

    // Usuario FICTICIO del fixture (C07 task 1.2): es al que el token
    // apunta y el que la FK reprogramado_por acepta. El rol del token lo
    // decide cada test vía `conFixtureTurnos({ rol })`; acá se persiste el
    // mismo valor para que fila y token no se contradigan.
    await cliente.query('INSERT INTO usuario (id, consultorio_id, rol) VALUES ($1, $2, $3)', [
      usuarioId,
      consultorioId,
      rol,
    ]);

    // Paciente ficticio: nombre con no-espacios + un contacto (CHECK de la 030).
    await cliente.query(
      'INSERT INTO paciente (id, consultorio_id, nombre, telefono) VALUES ($1, $2, $3, $4)',
      [pacienteId, consultorioId, 'Paciente Ficticio C05', '11-5555-0000']
    );

    await cliente.query(
      'INSERT INTO profesional (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
      [profesionalId, consultorioId, 'Profesional Ficticio C05']
    );

    await cliente.query(
      'INSERT INTO sillon_box (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
      [sillonBoxId, consultorioId, 'Box Ficticio C05']
    );

    // Prestación ficticia activa con duración válida (CHECK 1..480 de la 040).
    await cliente.query(
      'INSERT INTO prestacion (id, consultorio_id, nombre, duracion_min) VALUES ($1, $2, $3, $4)',
      [prestacionId, consultorioId, 'Prestacion Ficticia C05', 30]
    );
  } catch (error) {
    // Creación fallida: no dejar conexiones ni filas huérfanas detrás.
    await cliente.end().catch(() => {});
    throw error;
  }

  return {
    consultorioId,
    usuarioId,
    pacienteId,
    profesionalId,
    sillonBoxId,
    prestacionId,

    /** Consulta arbitraria sobre la conexión del fixture (para armar y verificar). */
    consultar(sql, params = []) {
      return cliente.query(sql, params);
    },

    /**
     * Limpia SOLO lo de este fixture, en orden de FKs, y cierra la conexión.
     * Idempotente: una segunda llamada no hace nada.
     */
    async limpiar() {
      if (cerrado) return;
      try {
        // La tabla `turno` recién existe con la migración 050 (C05).
        const { rows } = await cliente.query("SELECT to_regclass('turno') AS tabla");
        if (rows[0]?.tabla) {
          await cliente.query('DELETE FROM turno WHERE consultorio_id = $1', [consultorioId]);
        }
        await cliente.query('DELETE FROM paciente WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM prestacion WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM sillon_box WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM profesional WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM usuario WHERE consultorio_id = $1', [consultorioId]);
        await cliente.query('DELETE FROM consultorio WHERE id = $1', [consultorioId]);
      } finally {
        cerrado = true;
        await cliente.end().catch(() => {});
      }
    },
  };
}

// Columnas del DTO de turno que devuelve crearTurnoPartida (espejo de
// mapearTurno en producción; acá vive SOLO en tests, regla dura 1).
const COLUMNAS_TURNO = [
  'id',
  'consultorio_id',
  'paciente_id',
  'profesional_id',
  'sillon_box_id',
  'prestacion_id',
  'inicio',
  'fin',
  'duracion_min',
    'estado',
    'creado_en',
    'cancelado_en',
    'cancelado_por',
    'solicitado_por',
];

// Columnas con VALOR en el INSERT (`id` y `creado_en` nacen solos en la 050).
const COLUMNAS_INSERCION = [
  'consultorio_id',
  'paciente_id',
  'profesional_id',
  'sillon_box_id',
  'prestacion_id',
  'inicio',
  'fin',
  'duracion_min',
];

/**
 * Crea un turno de PARTIDA para los tests de reprogramación (C07 task 1.2),
 * directamente por SQL (sin pasar por la API: es estado/fijación de
 * escenario, no comportamiento bajo prueba).
 *
 * - Por defecto: recursos del fixture, `PENDIENTE`, 2026-12-01T10:00Z y
 *   duración 30 min (fin = inicio + 30).
 * - `estado: 'CANCELADO' | 'ATENDIDO'` se fija por SQL directa (solo en
 *   tests; la API de estados es C06).
 * - `crearRecursos: true` inserta un paciente, un profesional y un sillón
 *   FICTICIOS nuevos (los usa el turno) para aislar qué recurso dispara un
 *   conflicto — las FKs de la 050 exigen filas reales.
 * - `pacienteId` / `profesionalId` / `sillonBoxId` / `prestacionId` pueden
 *   sobrescribirse puntualmente (siempre con filas que existan).
 *
 * @param {Awaited<ReturnType<typeof crearFixtureTurnos>>} fixture
 * @param {object} [overrides]
 * @param {string} [overrides.inicio] ISO 8601 con timezone (default
 *   '2026-12-01T10:00:00Z')
 * @param {string} [overrides.fin] si se omite: `inicio + duracionMin`
 * @param {number} [overrides.duracionMin] default 30
 * @param {string} [overrides.estado] estado directo en la base (tests)
 * @param {boolean} [overrides.crearRecursos] crear recursos ficticios nuevos
 * @param {string} [overrides.pacienteId]
 * @param {string} [overrides.profesionalId]
 * @param {string} [overrides.sillonBoxId]
 * @param {string} [overrides.prestacionId]
 * @returns {Promise<object>} el turno creado (DTO camelCase)
 */
export async function crearTurnoPartida(fixture, overrides = {}) {
  const {
    inicio = '2026-12-01T10:00:00Z',
    fin,
    duracionMin = 30,
    estado,
    crearRecursos = false,
  } = overrides;

  let pacienteId = overrides.pacienteId ?? fixture.pacienteId;
  let profesionalId = overrides.profesionalId ?? fixture.profesionalId;
  let sillonBoxId = overrides.sillonBoxId ?? fixture.sillonBoxId;
  const prestacionId = overrides.prestacionId ?? fixture.prestacionId;

  if (crearRecursos) {
    pacienteId = randomUUID();
    profesionalId = randomUUID();
    sillonBoxId = randomUUID();
    await fixture.consultar(
      'INSERT INTO paciente (id, consultorio_id, nombre, telefono) VALUES ($1, $2, $3, $4)',
      [pacienteId, fixture.consultorioId, 'Paciente Ficticio C07', '11-5555-0100']
    );
    await fixture.consultar(
      'INSERT INTO profesional (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
      [profesionalId, fixture.consultorioId, 'Profesional Ficticio C07']
    );
    await fixture.consultar(
      'INSERT INTO sillon_box (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
      [sillonBoxId, fixture.consultorioId, 'Box Ficticio C07']
    );
  }

  const inicioDate = new Date(inicio);
  const finDate = fin ? new Date(fin) : new Date(inicioDate.getTime() + duracionMin * 60_000);

  // Columnas a INSERTAR: `estado` solo si el override lo trae (si no, la
  // 050 lo pone en PENDIENTE por default). El RETURNING siempre lo incluye.
  const columnas = [...COLUMNAS_INSERCION];
  const valores = [
    fixture.consultorioId,
    pacienteId,
    profesionalId,
    sillonBoxId,
    prestacionId,
    inicioDate,
    finDate,
    duracionMin,
  ];
  if (estado !== undefined) {
    columnas.push('estado');
    valores.push(estado);
  }
  const parametros = valores.map((_, i) => `$${i + 1}`).join(', ');

  const { rows } = await fixture.consultar(
    `INSERT INTO turno (${columnas.join(', ')}) VALUES (${parametros}) RETURNING ${COLUMNAS_TURNO.join(', ')}`,
    valores
  );

  const fila = rows[0];
  return {
    id: fila.id,
    consultorioId: fila.consultorio_id,
    pacienteId: fila.paciente_id,
    profesionalId: fila.profesional_id,
    sillonBoxId: fila.sillon_box_id,
    prestacionId: fila.prestacion_id,
    inicio: fila.inicio,
    fin: fila.fin,
    duracionMin: fila.duracion_min,
    estado: fila.estado,
    creadoEn: fila.creado_en,
    canceladoEn: fila.cancelado_en,
    canceladoPor: fila.cancelado_por,
    solicitadoPor: fila.solicitado_por,
  };
}

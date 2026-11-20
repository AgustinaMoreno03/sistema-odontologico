import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app.js';
import { chequearBase } from '../src/salud/repositorios.js';
import { obtenerUrlAdmin, obtenerUrlBaseTest } from './setup/urls.js';

/**
 * Spec schema-migrations — escenarios R1 y R2 automatizados con
 * DIRECTORIOS DE MIGRACIÓN TEMPORALES y una base scratch dedicada
 * (`odontologia_runner_test`), nunca se toca `db/migrations/` ni la BD
 * de la suite. Cubre los cinco puntos de knowledge-base/10:
 *   1. numeración/orden      → test "002 pendiente tras 010"
 *   2. aplicación base vacía → cada test arranca dropeando la scratch
 *   3. fallo                 → test "SQL inválido"
 *   4. repetición            → test "re-ejecución sin pendientes"
 *   5. conexión estilo Neon  → test "cadena estilo Neon"
 */

const raiz = process.cwd();
const bin = path.join(raiz, 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js');
const dirTemporal = path.join(os.tmpdir(), 'opencode', 'odontologia-runner-tests');
const NOMBRE_SCRATCH = 'odontologia_runner_test';

function urlScratch() {
  const url = new URL(obtenerUrlBaseTest());
  url.pathname = `/${NOMBRE_SCRATCH}`;
  return url.toString();
}

/** Crea la base scratch desde cero (base vacía) para cada escenario. */
async function crearBaseScratchVacia() {
  const admin = new pg.Client({ connectionString: obtenerUrlAdmin() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${NOMBRE_SCRATCH}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${NOMBRE_SCRATCH}"`);
  } finally {
    await admin.end().catch(() => {});
  }
}

/** Directorio temporal limpio por escenario (sin polucionar db/migrations/). */
function crearDirTemporal(nombre) {
  const dir = path.join(dirTemporal, nombre);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Ejecuta el runner tal cual lo hace `npm run migrate` (misma config), con la URL dada. */
function ejecutarRunner(url, dir) {
  return spawnSync(
    process.execPath,
    [bin, 'up', '--migrations-dir', dir, '--advisory-lock-mode', 'wait'],
    {
      cwd: raiz,
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, DATABASE_URL: url },
    }
  );
}

async function consultas(url, sql) {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    const res = await cliente.query(sql);
    return res.rows;
  } finally {
    await cliente.end().catch(() => {});
  }
}

const historial = (url) => consultas(url, 'SELECT name FROM pgmigrations ORDER BY run_on, id').then(
  (filas) => filas.map((f) => f.name)
);
const tablas = (url) =>
  consultas(
    url,
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  ).then((filas) => filas.map((f) => f.table_name));

describe('runner de migraciones (schema-migrations)', () => {
  it('SQL inválido → exit ≠ 0, transacción revocada y sin registro en el historial', async () => {
    await crearBaseScratchVacia();
    const dir = crearDirTemporal('sql-invalido');
    fs.writeFileSync(
      path.join(dir, '001_invalida.sql'),
      'CREATE TABLE antes_de_fallar (id integer PRIMARY KEY);\nCREATE TABLE rota (id integer;\n'
    );

    const res = ejecutarRunner(urlScratch(), dir);
    const salida = `${res.stdout ?? ''}${res.stderr ?? ''}`;

    expect(res.status).not.toBe(0); // fallo visible, exit ≠ 0
    expect(await historial(urlScratch())).toEqual([]); // sin registro
    const creadas = await tablas(urlScratch());
    expect(creadas).not.toContain('antes_de_fallar'); // rollback, sin objetos a medias
    expect(creadas).not.toContain('rota');
    expect(salida).not.toMatch(new URL(urlScratch()).password); // mensaje seguro, sin credenciales
  }, 60_000);

  it('002 pendiente tras 010 aplicado → fallo visible con exit ≠ 0, sin aplicarla fuera de orden ni ignorarla', async () => {
    await crearBaseScratchVacia();
    const dir = crearDirTemporal('fuera-de-orden');
    fs.writeFileSync(path.join(dir, '001_ok.sql'), 'CREATE TABLE t_001 (id integer PRIMARY KEY);\n');
    fs.writeFileSync(path.join(dir, '010_ok.sql'), 'CREATE TABLE t_010 (id integer PRIMARY KEY);\n');

    const primera = ejecutarRunner(urlScratch(), dir);
    expect(primera.status).toBe(0); // base vacía: aplica 001 y 010 en orden

    // Rama paralela: aparece un archivo de rango bajo (002) ya aplicado el 010.
    fs.writeFileSync(path.join(dir, '002_pendiente.sql'), 'CREATE TABLE t_002 (id integer PRIMARY KEY);\n');
    const segunda = ejecutarRunner(urlScratch(), dir);
    const salida = `${segunda.stdout ?? ''}${segunda.stderr ?? ''}`;

    expect(segunda.status).not.toBe(0); // fallo visible con exit ≠ 0
    expect(salida).toContain('002_pendiente'); // reporta VISIBLEMENTE 002
    expect(await historial(urlScratch())).toEqual(['001_ok', '010_ok']); // 002 no registrada
    expect(await tablas(urlScratch())).not.toContain('t_002'); // no aplicada fuera de orden
  }, 60_000);

  it('re-ejecución sin pendientes → exit 0, esquema sin cambios e historial sin duplicados', async () => {
    await crearBaseScratchVacia();
    const dir = crearDirTemporal('re-ejecucion');
    fs.writeFileSync(path.join(dir, '001_a.sql'), 'CREATE TABLE t_a (id integer PRIMARY KEY);\n');
    fs.writeFileSync(path.join(dir, '002_b.sql'), 'CREATE TABLE t_b (id integer PRIMARY KEY);\n');

    const primera = ejecutarRunner(urlScratch(), dir);
    expect(primera.status).toBe(0);
    const tablas1 = await tablas(urlScratch());
    const historial1 = await historial(urlScratch());
    expect(historial1).toEqual(['001_a', '002_b']); // orden ascendente, una entrada por versión

    const segunda = ejecutarRunner(urlScratch(), dir);
    const salida = `${segunda.stdout ?? ''}${segunda.stderr ?? ''}`;

    expect(segunda.status).toBe(0);
    expect(salida).toContain('No migrations to run'); // informa que no hay pendientes
    expect(await tablas(urlScratch())).toEqual(tablas1); // esquema sin cambios
    const historial2 = await historial(urlScratch());
    expect(historial2).toEqual(historial1); // sin duplicados
    expect(new Set(historial2).size).toBe(historial2.length);
  }, 60_000);

  it('cadena estilo Neon (sslmode + parámetros extra) aceptada por el runner y por la API', async () => {
    await crearBaseScratchVacia();
    const dir = crearDirTemporal('neon');
    fs.writeFileSync(path.join(dir, '001_neon.sql'), 'CREATE TABLE t_neon (id integer PRIMARY KEY);\n');

    // Formato Neon: sslmode + parámetros de query extra, solo DATABASE_URL (sin vars por entorno).
    const urlNeon = `${urlScratch()}?sslmode=require&channel_binding=require&uselibpqcompat=true`;
    const sslActivo = (await consultas(urlScratch(), 'SHOW ssl'))[0].ssl === 'on';

    const res = ejecutarRunner(urlNeon, dir);
    const salida = `${res.stdout ?? ''}${res.stderr ?? ''}`;

    if (sslActivo) {
      // Aceptación completa: conecta con TLS estilo Neon y aplica la migración.
      expect(res.status).toBe(0);
      expect(await historial(urlScratch())).toEqual(['001_neon']);

      // El proceso de la API también acepta la misma cadena (health 200, sin reinicio).
      const app = crearApp({ chequearBase: () => chequearBase(urlNeon) });
      const health = await request(app).get('/health');
      expect(health.status).toBe(200);
    } else {
      // Servidor local sin TLS: la cadena igual se INTERPRETA (sslmode=require
      // intenta SSL contra el host/DB indicado) y no se rechaza ni se cae a
      // otra variable de entorno.
      expect(res.status).not.toBe(0);
      expect(salida).toMatch(/SSL/i);
      expect(salida).not.toMatch(/missing|Invalid URL|DATABASE_URL/);
    }

    // Nunca filtra credenciales en la salida (spec R2: mensaje seguro).
    expect(salida).not.toContain(new URL(urlScratch()).password);
  }, 60_000);
});

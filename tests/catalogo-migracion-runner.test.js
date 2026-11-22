import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { obtenerUrlAdmin, obtenerUrlBaseTest } from './setup/urls.js';

/**
 * C02 — verificación de la migración `020_catalogo.sql` con el runner OFICIAL
 * (`npm run migrate`, node-pg-migrate + migrations.config.js), tal como pide
 * design.md (Migration Plan): base vacía con todas las migraciones, base
 * existente con solo la `001` ya aplicada, y segunda ejecución no-op sin
 * perder datos. Usa una base scratch propia (`odontologia_c02_runner_test`),
 * nunca la base de la suite ni `db/migrations/`.
 */

const raiz = process.cwd();
const bin = path.join(raiz, 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js');
const NOMBRE_SCRATCH = 'odontologia_c02_runner_test';
const dirTemporal = path.join(os.tmpdir(), 'opencode', 'odontologia-c02-runner');

function urlScratch() {
  const url = new URL(obtenerUrlBaseTest());
  url.pathname = `/${NOMBRE_SCRATCH}`;
  return url.toString();
}

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

/** Ejecuta el runner tal cual `npm run migrate` (mismo bin y config real). */
function ejecutarRunnerTodasLasMigraciones() {
  return spawnSync(
    process.execPath,
    [bin, 'up', '--config-file', 'migrations.config.js', '--advisory-lock-mode', 'wait'],
    {
      cwd: raiz,
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, DATABASE_URL: urlScratch() },
    }
  );
}

/** Ejecuta el runner sobre un directorio de migraciones puntual (para la 001 aislada). */
function ejecutarRunnerConDir(dir) {
  return spawnSync(
    process.execPath,
    [bin, 'up', '--migrations-dir', dir, '--advisory-lock-mode', 'wait'],
    {
      cwd: raiz,
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, DATABASE_URL: urlScratch() },
    }
  );
}

async function consultas(sql) {
  const cliente = new pg.Client({ connectionString: urlScratch() });
  await cliente.connect();
  try {
    return (await cliente.query(sql)).rows;
  } finally {
    await cliente.end().catch(() => {});
  }
}

const historial = () =>
  consultas('SELECT name FROM pgmigrations ORDER BY run_on, id').then((f) => f.map((x) => x.name));

const tablasCatalogo = () =>
  consultas(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' " +
      "AND table_name IN ('profesional', 'sillon_box')"
  ).then((f) => f.map((x) => x.table_name).sort());

describe('020_catalogo aplicada por el runner oficial (schema-migrations)', () => {
  it('base vacía + runner con todas las migraciones → crea el esquema completo del catálogo', async () => {
    await crearBaseScratchVacia();

    const res = ejecutarRunnerTodasLasMigraciones();

    expect(res.status, `${res.stdout ?? ''}${res.stderr ?? ''}`).toBe(0);
    expect(await tablasCatalogo()).toEqual(['profesional', 'sillon_box']);
    expect(await historial()).toContain('020_catalogo');
  }, 60_000);

  it('base existente con solo la 001 → el runner aplica la 020 sin renumerar nada', async () => {
    await crearBaseScratchVacia();

    // Simula una base que ya venía con el esquema compartido de C00 aplicado.
    const dirSolo001 = path.join(dirTemporal, 'solo-001');
    fs.rmSync(dirSolo001, { recursive: true, force: true });
    fs.mkdirSync(dirSolo001, { recursive: true });
    fs.copyFileSync(
      path.join(raiz, 'db', 'migrations', '001_esquema_inicial.sql'),
      path.join(dirSolo001, '001_esquema_inicial.sql')
    );

    const primera = ejecutarRunnerConDir(dirSolo001);
    expect(primera.status, `${primera.stdout ?? ''}${primera.stderr ?? ''}`).toBe(0);
    expect(await tablasCatalogo()).toEqual([]);

    const segunda = ejecutarRunnerTodasLasMigraciones();
    expect(segunda.status, `${segunda.stdout ?? ''}${segunda.stderr ?? ''}`).toBe(0);
    expect(await tablasCatalogo()).toEqual(['profesional', 'sillon_box']);
    expect((await historial()).filter((nombre) =>
      ['001_esquema_inicial', '020_catalogo', '040_prestaciones'].includes(nombre)
    )).toEqual(['001_esquema_inicial', '020_catalogo', '040_prestaciones']);
  }, 60_000);

  it('la segunda ejecución del runner es no-op y no pierde los datos existentes', async () => {
    await crearBaseScratchVacia();
    expect(ejecutarRunnerTodasLasMigraciones().status).toBe(0);

    // Datos ficticios previos (regla dura 1) que el re-run no debe tocar.
    const insertar = await consultas(
      "INSERT INTO consultorio (id) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') RETURNING id"
    );
    expect(insertar).toHaveLength(1);
    await consultas(
      "INSERT INTO profesional (consultorio_id, nombre) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Dra. Rita Núñez')"
    );

    const reEjecucion = ejecutarRunnerTodasLasMigraciones();
    expect(reEjecucion.status, `${reEjecucion.stdout ?? ''}${reEjecucion.stderr ?? ''}`).toBe(0);

    const datos = await consultas('SELECT nombre FROM profesional ORDER BY nombre');
    expect(datos).toEqual([{ nombre: 'Dra. Rita Núñez' }]);
    expect((await historial()).filter((nombre) =>
      ['001_esquema_inicial', '020_catalogo', '040_prestaciones'].includes(nombre)
    )).toEqual(['001_esquema_inicial', '020_catalogo', '040_prestaciones']);
  }, 60_000);
});

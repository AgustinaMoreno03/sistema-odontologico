import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { obtenerUrlAdmin, obtenerUrlBaseTest } from './setup/urls.js';

const raiz = process.cwd();
const bin = path.join(raiz, 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js');
const nombreBase = 'odontologia_c04_migration_test';
const migraciones = path.join(os.tmpdir(), 'opencode', 'odontologia-c04-migrations');

function ejecutar(url) {
  return spawnSync(process.execPath, [bin, 'up', '--migrations-dir', migraciones, '--advisory-lock-mode', 'wait'], {
    cwd: raiz,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: url },
  });
}

async function consultar(url, sql) {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    return (await cliente.query(sql)).rows;
  } finally {
    await cliente.end();
  }
}

describe('migracion 040 de prestaciones', () => {
  it('aplica desde cero y puede reejecutarse sin duplicar tabla ni historial', async () => {
    const admin = new pg.Client({ connectionString: obtenerUrlAdmin() });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${nombreBase}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${nombreBase}"`);
    await admin.end();

    fs.rmSync(migraciones, { recursive: true, force: true });
    fs.mkdirSync(migraciones, { recursive: true });
    fs.copyFileSync(path.join(raiz, 'db/migrations/001_esquema_inicial.sql'), path.join(migraciones, '001_esquema_inicial.sql'));
    fs.copyFileSync(path.join(raiz, 'db/migrations/040_prestaciones.sql'), path.join(migraciones, '040_prestaciones.sql'));

    const url = new URL(obtenerUrlBaseTest());
    url.pathname = `/${nombreBase}`;
    const primera = ejecutar(url.toString());
    expect(primera.status).toBe(0);
    const segunda = ejecutar(url.toString());
    expect(segunda.status).toBe(0);

    expect(await consultar(url.toString(), "SELECT table_name FROM information_schema.tables WHERE table_name = 'prestacion'")).toHaveLength(1);
    expect(await consultar(url.toString(), "SELECT name FROM pgmigrations WHERE name = '040_prestaciones'")).toHaveLength(1);
  }, 60_000);
});

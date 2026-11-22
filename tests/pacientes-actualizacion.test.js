import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { expect, it } from 'vitest';
import { obtenerUrlAdmin, obtenerUrlBaseTest } from './setup/urls.js';

it('C03 aplica 030 sobre C00 existente y repetir el runner conserva datos e historial', async () => {
  const nombreBase = `odontologia_c03_${randomUUID().replaceAll('-', '')}_test`;
  const directorio = fs.mkdtempSync(path.join(os.tmpdir(), 'c03-migraciones-'));
  const url = new URL(obtenerUrlBaseTest());
  url.pathname = `/${nombreBase}`;
  const bin = path.join(
    process.cwd(), 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js'
  );
  const admin = new pg.Client({ connectionString: obtenerUrlAdmin() });
  let baseCreada = false;
  let cliente;

  function ejecutarRunner() {
    const resultado = spawnSync(
      process.execPath,
      [bin, 'up', '--migrations-dir', directorio, '--advisory-lock-mode', 'wait'],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: url.toString() },
        encoding: 'utf8',
        timeout: 60_000,
      }
    );
    expect(resultado.status, 'El runner debe finalizar correctamente').toBe(0);
  }

  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${nombreBase}"`);
    baseCreada = true;

    fs.copyFileSync(
      'db/migrations/001_esquema_inicial.sql',
      path.join(directorio, '001_esquema_inicial.sql')
    );
    ejecutarRunner();

    cliente = new pg.Client({ connectionString: url.toString() });
    await cliente.connect();
    const consultorioId = randomUUID();
    const pacienteId = randomUUID();

    await cliente.query(
      'INSERT INTO consultorio (id) VALUES ($1)',
      [consultorioId]
    );

    fs.copyFileSync(
      'db/migrations/030_pacientes.sql',
      path.join(directorio, '030_pacientes.sql')
    );
    ejecutarRunner();

    await cliente.query(
      `INSERT INTO paciente (id, consultorio_id, nombre, telefono)
       VALUES ($1, $2, $3, $4)`,
      [pacienteId, consultorioId, 'Paciente ficticio de actualización', '1100000000']
    );

    ejecutarRunner();

    const paciente = await cliente.query(
      'SELECT nombre FROM paciente WHERE id = $1 AND consultorio_id = $2',
      [pacienteId, consultorioId]
    );
    expect(paciente.rows).toEqual([
      { nombre: 'Paciente ficticio de actualización' },
    ]);

    const consultorio = await cliente.query(
      'SELECT id FROM consultorio WHERE id = $1',
      [consultorioId]
    );
    expect(consultorio.rows).toEqual([{ id: consultorioId }]);

    const historial = await cliente.query('SELECT name FROM pgmigrations ORDER BY name');
    expect(historial.rows.map((fila) => fila.name)).toEqual([
      '001_esquema_inicial',
      '030_pacientes',
    ]);
  } finally {
    try {
      if (cliente) await cliente.end().catch(() => {});
      if (baseCreada) {
        await admin.query(`DROP DATABASE "${nombreBase}" WITH (FORCE)`);
      }
    } finally {
      await admin.end().catch(() => {});
      for (const nombreArchivo of ['001_esquema_inicial.sql', '030_pacientes.sql']) {
        const archivo = path.join(directorio, nombreArchivo);
        if (fs.existsSync(archivo)) fs.unlinkSync(archivo);
      }
      fs.rmdirSync(directorio);
    }
  }
}, 120_000);

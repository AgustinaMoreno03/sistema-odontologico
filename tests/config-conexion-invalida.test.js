import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { obtenerUrlBaseTest } from './setup/urls.js';

/**
 * Task 5.3 / spec schema-migrations — escenario "Cadena malformada o
 * credenciales inválidas": el runner sale con código distinto de cero y su
 * mensaje NO contiene la contraseña ni la cadena de conexión completa.
 */
const raiz = process.cwd();
const bin = path.join(raiz, 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js');

// Contraseña ficticia con marcador reconocible: si aparece en la salida, hay filtración.
const MARCADOR = 'ClaveFicticiaQueNoDebeFiltrarse';

function urlConClaveFalsa() {
  const url = new URL(obtenerUrlBaseTest());
  url.password = MARCADOR;
  return url.toString();
}

function ejecutarRunner(url) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'conexion-invalida-'));
  fs.writeFileSync(path.join(dir, '001_x.sql'), 'CREATE TABLE t_x (id integer PRIMARY KEY);\n');
  try {
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
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const casos = [
  {
    nombre: 'cadena malformada (puerto inválido)',
    url: () => `postgresql://usuario:${MARCADOR}@localhost:puerto-invalido/odontologia`,
  },
  {
    nombre: 'credenciales inválidas (contraseña incorrecta)',
    url: urlConClaveFalsa,
  },
];

describe('conexión inválida (spec schema-migrations, "Cadena malformada o credenciales inválidas")', () => {
  for (const caso of casos) {
    it(`${caso.nombre} → exit ≠ 0 y el mensaje no filtra la contraseña ni la cadena completa`, () => {
      const url = caso.url();

      const res = ejecutarRunner(url);
      const salida = `${res.stdout ?? ''}${res.stderr ?? ''}`;

      expect(typeof res.status).toBe('number');
      expect(res.status).not.toBe(0); // fallo visible
      expect(salida.trim().length).toBeGreaterThan(0); // dice algo, no falla en silencio
      expect(salida).not.toContain(MARCADOR); // sin contraseña
      expect(salida).not.toContain(url); // sin la cadena completa
    }, 60_000);
  }
});
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { obtenerUrlAdmin, obtenerUrlBaseTest, redactarCredenciales } from './urls.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Global setup de Vitest (spec development-environment):
 * crea la base de test DESDE CERO (drop + create) y le aplica las
 * migraciones con el mismo runner configurado que `npm run migrate`.
 *
 * Si la base de test no es alcanzable, lanza un error claro → la suite
 * termina con código distinto de cero (sin falso verde, regla: nunca un
 * "verde" sin base real).
 */
export default async function prepararBaseDeTest() {
  const urlTest = obtenerUrlBaseTest();
  const nombre = new URL(urlTest).pathname.replace(/^\//, '');

  if (!/^[a-z0-9_]+$/i.test(nombre) || !nombre.endsWith('_test')) {
    throw new Error(
      `Nombre de base de test inválido o sin sufijo "_test": "${redactarCredenciales(nombre)}". ` +
        'La suite solo dropea bases terminadas en _test (protección contra la BD de desarrollo).'
    );
  }

  // 1) Crear la base de test desde cero (admin sobre la base `postgres`).
  const admin = new pg.Client({ connectionString: obtenerUrlAdmin() });
  try {
    await admin.connect();
  } catch (error) {
    throw new Error(
      `Base de test inaccesible: no se pudo conectar a la instancia de PostgreSQL para prepararla ` +
        `(${redactarCredenciales(error.message)}). Verificá que Docker/PostgreSQL esté levantado.`
    );
  }
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${nombre}"`);
  } finally {
    await admin.end().catch(() => {});
  }

  // 2) Aplicar las migraciones desde cero con el runner oficial
  //    (mismo comando y config que `npm run migrate`, apuntando a la BD de test).
  const bin = path.join(raiz, 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js');
  const resultado = spawnSync(process.execPath, [bin, 'up', '--config-file', 'migrations.config.js'], {
    cwd: raiz,
    env: { ...process.env, DATABASE_URL: urlTest },
    encoding: 'utf8',
  });

  if (resultado.status !== 0) {
    throw new Error(
      'Falló la aplicación de migraciones en la base de test (desde cero):\n' +
        redactarCredenciales(`${resultado.stdout ?? ''}\n${resultado.stderr ?? ''}`)
    );
  }
}

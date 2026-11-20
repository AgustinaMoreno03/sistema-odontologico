import { spawn } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Task 5.3 / spec development-environment — escenario "Variable de entorno
 * requerida ausente": sin DATABASE_URL el proceso NO arranca, sale con
 * código distinto de cero y un mensaje claro que nombra la variable, sin
 * stack ni cadenas de conexión. Misma técnica que la task 4.6.
 */
const RUTA_SERVIDOR = path.resolve(process.cwd(), 'src/server.js');
const TIMEOUT_MS = 5000;

function lanzarServidorSinDatabaseUrl() {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    env.PORT = String(38000 + Math.floor(Math.random() * 2000));

    const hijo = spawn(process.execPath, [RUTA_SERVIDOR], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let salida = '';
    hijo.stdout.on('data', (dato) => {
      salida += dato;
    });
    hijo.stderr.on('data', (dato) => {
      salida += dato;
    });

    let matadoPorTimeout = false;
    const reloj = setTimeout(() => {
      matadoPorTimeout = true;
      hijo.kill();
    }, TIMEOUT_MS);

    hijo.on('error', (err) => {
      clearTimeout(reloj);
      resolve({ codigo: null, salida: `${salida}${err.message}`, matadoPorTimeout: false });
    });
    hijo.on('exit', (codigo) => {
      clearTimeout(reloj);
      resolve({ codigo, salida, matadoPorTimeout });
    });
  });
}

describe('fail-fast de DATABASE_URL (spec development-environment, "Variable de entorno requerida ausente")', () => {
  it('DATABASE_URL ausente → exit ≠ 0, mensaje que nombra la variable, sin stack ni cadenas de conexión', async () => {
    const { codigo, salida, matadoPorTimeout } = await lanzarServidorSinDatabaseUrl();

    expect(matadoPorTimeout).toBe(false); // salió solo, no quedó colgado
    expect(typeof codigo).toBe('number');
    expect(codigo).not.toBe(0);
    expect(salida).not.toMatch(/API escuchando/);
    expect(salida).toMatch(/DATABASE_URL/); // nombra la variable faltante
    expect(salida).not.toMatch(/at .*\.js:\d+|node:internal/); // sin stack
    expect(salida).not.toContain('postgresql://'); // sin cadenas de conexión
  }, 15000);
});
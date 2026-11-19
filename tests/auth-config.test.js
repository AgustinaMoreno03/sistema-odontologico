import { spawn } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Task 4.6 / spec development-environment — escenario "Secreto del JWT
 * ausente o vacío": el proceso NO arranca sin `JWT_SECRET` (ni con él
 * vacío), sale con código distinto de cero, mensaje claro que nombra la
 * variable, sin stack ni secreto por defecto.
 *
 * Técnica: se lanza `node src/server.js` como proceso hijo con el entorno
 * manipulado (el padre lo trae desde `--env-file=.env`; acá se elimina o
 * vacía JWT_SECRET). Guardia de colgado: timeout + kill.
 * La misma técnica la reutiliza la task 5.3 para DATABASE_URL.
 */
const RUTA_SERVIDOR = path.resolve(process.cwd(), 'src/server.js');
const TIMEOUT_MS = 5000;

function lanzarServidor({ sinJwtSecret, jwtSecretVacio } = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    if (sinJwtSecret) delete env.JWT_SECRET;
    if (jwtSecretVacio) env.JWT_SECRET = '';
    // Puerto libre y aleatorio: si el proceso llegara a escuchar (RED), no
    // choca con ningún otro servicio y el kill del timeout lo limpia.
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

function expectFailFastSeguro({ codigo, salida, matadoPorTimeout }, variable) {
  // No quedó colgado ni arrancó a medias: salió solo, rápido y con error.
  expect(matadoPorTimeout).toBe(false);
  expect(typeof codigo).toBe('number');
  expect(codigo).not.toBe(0);
  expect(salida).not.toMatch(/API escuchando/);
  // Mensaje claro que nombra la variable, sin stack trace…
  expect(salida).toMatch(new RegExp(variable));
  expect(salida).not.toMatch(/at .*\.js:\d+|node:internal/);
  // …y jamás un secreto por defecto ni el valor de ningún secreto.
  expect(salida).not.toMatch(/secreto-de-pruebas|JWT_SECRET=/i);
}

describe('fail-fast de JWT_SECRET (spec development-environment, "Secreto del JWT ausente o vacío")', () => {
  it('JWT_SECRET ausente → el proceso termina con código distinto de cero, sin arrancar', async () => {
    const resultado = await lanzarServidor({ sinJwtSecret: true });

    expectFailFastSeguro(resultado, 'JWT_SECRET');
  }, 15000);

  it('JWT_SECRET vacío ("") → el proceso termina con código distinto de cero, sin arrancar', async () => {
    const resultado = await lanzarServidor({ jwtSecretVacio: true });

    expectFailFastSeguro(resultado, 'JWT_SECRET');
  }, 15000);
});

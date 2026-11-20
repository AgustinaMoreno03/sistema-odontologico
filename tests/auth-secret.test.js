import { spawn } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Task 4.8 / spec development-environment — escenario "Secreto del JWT
 * demasiado corto": `JWT_SECRET` definido con menos de 32 caracteres → el
 * proceso NO arranca, termina con código distinto de cero, con un error
 * claro que menciona el mínimo de 32 caracteres y SIN imprimir el valor.
 *
 * Misma técnica de spawn que tests/auth-config.test.js (task 4.6): se lanza
 * `node src/server.js` como proceso hijo con `JWT_SECRET` manipulado en el
 * entorno. Diferencia: acá se DISTINGUE "arrancó y quedó escuchando →
 * matado por el guardia" de "salió solo con error de configuración", más la
 * guardia de colgado (timeout + kill).
 *
 * Los secretos de PRUEBA son sintéticos y ficticios (regla dura 1); se
 * construyen por repetición y JAMÁS se registran en salidas: el test afirma
 * además que la salida capturada NO contiene el valor.
 */
const RUTA_SERVIDOR = path.resolve(process.cwd(), 'src/server.js');
const TIMEOUT_MS = 5000;

// Secretos sintéticos SOLO de test (nunca el real de .env). Se definen acá
// para poder afirmar su AUSENCIA en la salida; no se imprimen en ningún log.
const SECRETO_31 = 'x'.repeat(31);
const SECRETO_32 = 'y'.repeat(32);

/**
 * Lanza el servidor con un `JWT_SECRET` determinado y observa su salida.
 * @returns {Promise<{estado: 'arrancado'|'salio'|'timeout'|'error',
 *   codigo: number|null, salida: string}>}
 *   - 'arrancado': vio "API escuchando" → lo mató el guardia (superó el chequeo)
 *   - 'salio': salió SOLO (error de configuración → exit ≠ 0)
 *   - 'timeout': ni arrancó ni salió → lo mató el guardia de colgado
 */
function lanzarServidorConSecreto(jwtSecret) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    env.JWT_SECRET = jwtSecret;
    // Puerto libre y aleatorio: si el proceso llegara a escuchar (RED), no
    // choca con ningún otro servicio y el kill del guardia lo limpia.
    env.PORT = String(40000 + Math.floor(Math.random() * 2000));

    const hijo = spawn(process.execPath, [RUTA_SERVIDOR], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let salida = '';
    let estado = 'en-ejecucion';

    const reloj = setTimeout(() => {
      estado = 'timeout';
      hijo.kill();
    }, TIMEOUT_MS);

    hijo.stdout.on('data', (dato) => {
      salida += dato;
      if (estado === 'en-ejecucion' && salida.includes('API escuchando')) {
        // Superó el chequeo de configuración: lo detenemos ya.
        estado = 'arrancado';
        clearTimeout(reloj);
        hijo.kill();
      }
    });
    hijo.stderr.on('data', (dato) => {
      salida += dato;
    });

    hijo.on('error', (err) => {
      clearTimeout(reloj);
      resolve({ estado: 'error', codigo: null, salida: `${salida}${err.message}` });
    });
    hijo.on('exit', (codigo) => {
      clearTimeout(reloj);
      if (estado === 'en-ejecucion') {
        // Salió por su cuenta (sin que el guardia lo matara).
        estado = 'salio';
      }
      resolve({ estado, codigo, salida });
    });
  });
}

describe('fail-fast de JWT_SECRET corto (spec development-environment, "Secreto del JWT demasiado corto")', () => {
  it('JWT_SECRET de 31 caracteres → NO arranca: exit ≠ 0, mensaje del mínimo 32 y sin el valor del secreto', async () => {
    const resultado = await lanzarServidorConSecreto(SECRETO_31);

    // Salió solo con error de configuración (hoy, en RED, arranca → falla acá).
    expect(resultado.estado).toBe('salio');
    expect(typeof resultado.codigo).toBe('number');
    expect(resultado.codigo).not.toBe(0);
    // Error claro que nombra la variable y menciona el mínimo de 32 caracteres…
    expect(resultado.salida).toMatch(/JWT_SECRET/);
    expect(resultado.salida).toMatch(/mínimo 32/);
    expect(resultado.salida).not.toMatch(/API escuchando/);
    expect(resultado.salida).not.toMatch(/at .*\.js:\d+|node:internal/);
    // …y NUNCA el valor del secreto (afirmación de ausencia, no de presencia).
    expect(resultado.salida).not.toContain(SECRETO_31);
    expect(resultado.salida).not.toMatch(/JWT_SECRET=/i);
  }, 15000);

  it('JWT_SECRET de exactamente 32 caracteres → supera el chequeo de configuración y arranca', async () => {
    const resultado = await lanzarServidorConSecreto(SECRETO_32);

    expect(resultado.estado).toBe('arrancado');
    expect(resultado.salida).toMatch(/API escuchando/);
    expect(resultado.salida).not.toMatch(/Error de configuración/);
    expect(resultado.salida).not.toContain(SECRETO_32);
  }, 15000);
});

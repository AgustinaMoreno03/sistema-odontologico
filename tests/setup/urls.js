/**
 * Derivación de la base de TEST desde la configuración (design D4):
 * base separada de la de desarrollo (`odontologia_test`), jamás se apunta
 * la suite a la BD de dev.
 *
 * `TEST_DATABASE_URL` es un override opcional SOLO para pruebas de
 * fail-fast del setup (p. ej. simular una base inacesible); en uso normal
 * no existe y se deriva de `DATABASE_URL`.
 */

/** Base de test: el último segmento del path de DATABASE_URL → `odontologia_test`. */
export function obtenerUrlBaseTest() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = '/odontologia_test';
  return url.toString();
}

/** Base administrativa (`postgres`) para crear/dropear la base de test. */
export function obtenerUrlAdmin() {
  const url = new URL(obtenerUrlBaseTest());
  url.pathname = '/postgres';
  return url.toString();
}

/** Quita credenciales de una cadena antes de mostrarla en un mensaje de error. */
export function redactarCredenciales(cadena) {
  return String(cadena).replace(/\/\/[^/@]+@/g, '//***@');
}

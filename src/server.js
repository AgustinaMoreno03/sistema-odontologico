import { crearApp } from './app.js';

// ---------------------------------------------------------------------------
// Fail-fast de configuración (spec development-environment, "Variable de
// entorno requerida ausente"): sin DATABASE_URL el proceso NO arranca a
// medias. Sale con código distinto de cero, mensaje seguro que nombra la
// variable faltante y SIN stack trace.
// ---------------------------------------------------------------------------
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || !databaseUrl.trim()) {
  console.error(
    'Error de configuración: falta la variable de entorno requerida DATABASE_URL. ' +
      'Creá el archivo .env a partir de .env.example y completá su valor antes de iniciar la API.'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Fail-fast de auth (spec development-environment, "Secreto del JWT ausente
// o vacío" + "Secreto del JWT demasiado corto"): sin JWT_SECRET — o con él
// vacío — el proceso NO arranca ni cae a un secreto por defecto (design D2,
// regla dura 5); con menos de 32 caracteres TAMPOCO (task 4.8). Sale con
// código distinto de cero, mensaje claro que nombra la variable y menciona
// el mínimo de 32 caracteres, SIN imprimir el valor y SIN stack trace.
// Mensaje único para los tres casos para no fragmentar el fail-fast.
// ---------------------------------------------------------------------------
const MINIMO_LARGO_SECRETO = 32;
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || !jwtSecret.trim() || jwtSecret.length < MINIMO_LARGO_SECRETO) {
  console.error(
    'Error de configuración: la variable de entorno requerida JWT_SECRET falta, está vacía o tiene menos de 32 caracteres (mínimo 32). ' +
      'Generá un secreto de al menos 32 caracteres y completalo en .env (a partir de .env.example) antes de iniciar la API.'
  );
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 3000;

const app = crearApp();

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});

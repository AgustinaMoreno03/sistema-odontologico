import { obtenerUrlBaseTest } from './urls.js';
import { SECRETO_TEST } from '../helpers/tokens.js';

// Se ejecuta en cada worker ANTES de los archivos de test: toda la suite
// (app, chequeos de salud, tests de esquema) corre contra la base de TEST,
// nunca contra la de desarrollo (D4).
process.env.DATABASE_URL = obtenerUrlBaseTest();

// Ídem para el secreto JWT: la suite firma y verifica con el secreto de
// PRUEBAS (design D2: distinto del real de .env); ningún test usa el
// secreto real ni valores por defecto.
process.env.JWT_SECRET = SECRETO_TEST;

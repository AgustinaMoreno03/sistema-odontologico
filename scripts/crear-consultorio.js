import pg from 'pg';
import { crearUsuarioEnConsultorio } from '../src/modules/auth/servicios.js';
import { crearConsultorio } from '../src/modules/consultorios/repositorios.js';

const rol = 'ADMIN_CONSULTORIO';
let cliente;
let transaccionActiva = false;

try {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString?.trim()) throw new Error('DATABASE_URL requerida');

  cliente = new pg.Client({ connectionString });
  // pg también emite errores del socket fuera de las promesas. La consulta
  // actual o siguiente se rechaza y llega al manejo seguro de abajo.
  cliente.on('error', () => {});
  await cliente.connect();
  await cliente.query('BEGIN');
  transaccionActiva = true;

  const consultorio = await crearConsultorio({ cliente });
  await crearUsuarioEnConsultorio(
    { consultorioId: consultorio.id, rol },
    { email: process.env.BOOTSTRAP_ADMIN_EMAIL, password: process.env.BOOTSTRAP_ADMIN_PASSWORD, rol },
    { cliente }
  );

  await cliente.query('COMMIT');
  transaccionActiva = false;
  console.log(`Consultorio aprovisionado: ${consultorio.id}`);
} catch {
  if (transaccionActiva) await cliente.query('ROLLBACK').catch(() => {});
  console.error('No se pudo aprovisionar el consultorio.');
  process.exitCode = 1;
} finally {
  if (cliente) await cliente.end().catch(() => {});
}

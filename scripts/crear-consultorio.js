import { crearConsultorio } from '../src/modules/consultorios/repositorios.js';

try {
  const consultorio = await crearConsultorio();
  console.log(`Consultorio aprovisionado: ${consultorio.id}`);
} catch {
  console.error('No se pudo aprovisionar el consultorio.');
  process.exitCode = 1;
}

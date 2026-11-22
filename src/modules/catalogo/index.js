// Interfaz pública del módulo `catalogo` (design.md, decisión 8): lo que
// consumen C05 (obtenerCatalogo, existeProfesional, existeSillonBox) y C01
// (vincularUsuario, desvincularUsuario, profesionalDeUsuario) más el router
// HTTP que monta `src/app.js`. El contrato detallado vive en README.md.
export { crearRouterCatalogo } from './rutas.js';
export { obtenerCatalogo } from './catalogo-servicios.js';
export {
  desvincularUsuario,
  existeProfesional,
  profesionalDeUsuario,
  vincularUsuario,
} from './profesional-servicios.js';
export { existeSillonBox } from './sillon-box-servicios.js';

// === INICIO BLOQUE DE EXTENSIÓN C04 (prestaciones) ===
// export { ... } from './prestacion-servicios.js';
// === FIN BLOQUE DE EXTENSIÓN C04 ===

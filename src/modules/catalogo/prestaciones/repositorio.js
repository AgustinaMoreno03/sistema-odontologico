import pg from 'pg';

function mapearPrestacion(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    duracionMin: fila.duracion_min,
    descripcion: fila.descripcion,
    activo: fila.activo,
    creadoEn: fila.creado_en,
  };
}

/**
 * Acceso persistente al catálogo de prestaciones.
 * Todas las operaciones reciben el consultorio y lo aplican en SQL.
 */
export function crearRepositorioPrestaciones({ cliente = new pg.Client({ connectionString: process.env.DATABASE_URL }) }) {
  const administrarCliente = !cliente._connected;

  async function conCliente(operacion) {
    if (administrarCliente) await cliente.connect();
    try {
      return await operacion(cliente);
    } finally {
      if (administrarCliente) await cliente.end().catch(() => {});
    }
  }

  return {
    async crear({ consultorioId, nombre, duracionMin, descripcion = null }) {
      return conCliente(async (conexion) => {
        const resultado = await conexion.query(
          `INSERT INTO prestacion (consultorio_id, nombre, duracion_min, descripcion)
           VALUES ($1, $2, $3, $4)
           RETURNING id, nombre, duracion_min, descripcion, activo, creado_en`,
          [consultorioId, nombre, duracionMin, descripcion]
        );
        return mapearPrestacion(resultado.rows[0]);
      });
    },

    async obtenerPrestacionParaTurno({ prestacionId, consultorioId }) {
      return conCliente(async (conexion) => {
        const resultado = await conexion.query(
          `SELECT id, nombre, duracion_min, activo
           FROM prestacion
           WHERE id = $1 AND consultorio_id = $2 AND activo = TRUE`,
          [prestacionId, consultorioId]
        );
        const fila = resultado.rows[0];
        return fila
          ? { id: fila.id, nombre: fila.nombre, duracionMin: fila.duracion_min, activo: fila.activo }
          : null;
      });
    },
  };
}

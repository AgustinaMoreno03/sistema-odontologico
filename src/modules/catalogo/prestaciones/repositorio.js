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

function mapearPrestaciones(filas) {
  return filas.map(mapearPrestacion);
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

    async listar({ consultorioId, activo }) {
      return conCliente(async (conexion) => {
        const filtros = ['consultorio_id = $1'];
        const valores = [consultorioId];
        if (activo !== undefined) {
          filtros.push(`activo = $${valores.length + 1}`);
          valores.push(activo);
        }
        const resultado = await conexion.query(
          `SELECT id, nombre, duracion_min, descripcion, activo, creado_en
           FROM prestacion
           WHERE ${filtros.join(' AND ')}
           ORDER BY nombre ASC`,
          valores
        );
        return mapearPrestaciones(resultado.rows);
      });
    },

    async obtenerPorId({ consultorioId, prestacionId }) {
      return conCliente(async (conexion) => {
        const resultado = await conexion.query(
          `SELECT id, nombre, duracion_min, descripcion, activo, creado_en
           FROM prestacion
           WHERE id = $1 AND consultorio_id = $2`,
          [prestacionId, consultorioId]
        );
        return mapearPrestacion(resultado.rows[0]);
      });
    },

    async actualizar({ consultorioId, prestacionId, cambios }) {
      return conCliente(async (conexion) => {
        const columnas = { nombre: 'nombre', duracionMin: 'duracion_min', descripcion: 'descripcion', activo: 'activo' };
        const entradas = Object.entries(cambios);
        const asignaciones = entradas.map(([campo], indice) => `${columnas[campo]} = $${indice + 1}`);
        const valores = entradas.map(([, valor]) => valor);
        valores.push(prestacionId, consultorioId);
        const resultado = await conexion.query(
          `UPDATE prestacion
           SET ${asignaciones.join(', ')}, actualizado_en = CURRENT_TIMESTAMP
           WHERE id = $${valores.length - 1} AND consultorio_id = $${valores.length}
           RETURNING id, nombre, duracion_min, descripcion, activo, creado_en`,
          valores
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

import pg from 'pg';
import { describe, expect, it } from 'vitest';

/**
 * C02 — migración `db/migrations/020_catalogo.sql` (rango reservado 020–029).
 *
 * Spec catálogo: esquema de `profesional` y `sillon_box` (RN-TEN-03) contra la
 * base REAL (sin mock de SQL). Verifica columnas, FKs, la función
 * `clave_unicidad()` y los índices únicos que garantizan la unicidad por
 * consultorio. Todos los datos son ficticios (regla dura 1) y este archivo
 * solo consulta metadatos: no escribe filas de negocio.
 *
 * Regla dura 9: la migración es aditiva y forward-only; la `001` sigue
 * intacta (verificado por `git diff` fuera de la suite).
 */

async function conCliente(funcion) {
  const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await cliente.connect();
  try {
    return await funcion(cliente);
  } finally {
    await cliente.end().catch(() => {});
  }
}

/** Atributos de columna que exige el diseño (design.md, decisión 2). */
const COLUMNAS_ESPERADAS = {
  profesional: {
    id: { data_type: 'uuid', is_nullable: 'NO' },
    consultorio_id: { data_type: 'uuid', is_nullable: 'NO' },
    nombre: { data_type: 'text', is_nullable: 'NO' },
    matricula: { data_type: 'text', is_nullable: 'YES' },
    email: { data_type: 'text', is_nullable: 'YES' },
    usuario_id: { data_type: 'uuid', is_nullable: 'YES' },
    activo: { data_type: 'boolean', is_nullable: 'NO' },
    creado_en: { data_type: 'timestamp with time zone', is_nullable: 'NO' },
  },
  sillon_box: {
    id: { data_type: 'uuid', is_nullable: 'NO' },
    consultorio_id: { data_type: 'uuid', is_nullable: 'NO' },
    nombre: { data_type: 'text', is_nullable: 'NO' },
    descripcion: { data_type: 'text', is_nullable: 'YES' },
    activo: { data_type: 'boolean', is_nullable: 'NO' },
    creado_en: { data_type: 'timestamp with time zone', is_nullable: 'NO' },
  },
};

async function columnasDe(cliente, tabla) {
  const { rows } = await cliente.query(
    'SELECT column_name, data_type, is_nullable FROM information_schema.columns ' +
      "WHERE table_schema = 'public' AND table_name = $1",
    [tabla]
  );
  return rows;
}

/** Definiciones de índices de una tabla, con espacios normalizados. */
async function indicesDe(cliente, tabla) {
  const { rows } = await cliente.query(
    "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = $1",
    [tabla]
  );
  return rows.map((fila) => ({
    nombre: fila.indexname,
    definicion: fila.indexdef.replace(/\s+/g, ' ').trim(),
  }));
}

const esUnica = (indice) => /^CREATE UNIQUE INDEX\b/.test(indice.definicion);

describe('migración 020_catalogo: esquema de profesional y sillon_box', () => {
  it('las tablas profesional y sillon_box existen con exactamente sus columnas', async () => {
    await conCliente(async (cliente) => {
      for (const [tabla, esperadas] of Object.entries(COLUMNAS_ESPERADAS)) {
        const columnas = await columnasDe(cliente, tabla);
        expect(columnas.length, `la tabla ${tabla} debe existir con sus columnas`).toBeGreaterThan(0);

        const porNombre = new Map(columnas.map((c) => [c.column_name, c]));
        expect([...porNombre.keys()].sort()).toEqual(Object.keys(esperadas).sort());
        for (const [nombre, atributos] of Object.entries(esperadas)) {
          const columna = porNombre.get(nombre);
          expect(columna.data_type, `${tabla}.${nombre} tipo`).toBe(atributos.data_type);
          expect(columna.is_nullable, `${tabla}.${nombre} nulabilidad`).toBe(atributos.is_nullable);
        }
      }
    });
  });

  it('id usa DEFAULT gen_random_uuid(), creado_en es timestamptz y activo nace en true', async () => {
    await conCliente(async (cliente) => {
      for (const tabla of Object.keys(COLUMNAS_ESPERADAS)) {
        const { rows } = await cliente.query(
          'SELECT column_name, column_default FROM information_schema.columns ' +
            "WHERE table_schema = 'public' AND table_name = $1 AND column_name IN ('id', 'creado_en', 'activo')",
          [tabla]
        );
        const porNombre = new Map(rows.map((c) => [c.column_name, c.column_default ?? '']));
        expect(porNombre.get('id'), `${tabla}.id DEFAULT gen_random_uuid()`).toMatch(
          /gen_random_uuid\(\)/
        );
        expect(porNombre.get('creado_en'), `${tabla}.creado_en DEFAULT now()`).toMatch(/now\(\)/);
        expect(porNombre.get('activo'), `${tabla}.activo DEFAULT true`).toMatch(/true/i);
      }
    });
  });

  it('FKs: profesional → consultorio(id) y usuario(id); sillon_box → consultorio(id)', async () => {
    await conCliente(async (cliente) => {
      const { rows } = await cliente.query(
        "SELECT tc.table_name, kcu.column_name, ccu.table_name AS tabla_referenciada, " +
          'ccu.column_name AS columna_referenciada ' +
          'FROM information_schema.table_constraints tc ' +
          'JOIN information_schema.key_column_usage kcu ' +
          '  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema ' +
          'JOIN information_schema.constraint_column_usage ccu ' +
          '  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema ' +
          "WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'"
      );
      const claves = rows.map(
        (f) => `${f.table_name}.${f.column_name} -> ${f.tabla_referenciada}.${f.columna_referenciada}`
      );
      expect(claves).toContain('profesional.consultorio_id -> consultorio.id');
      expect(claves).toContain('profesional.usuario_id -> usuario.id');
      expect(claves).toContain('sillon_box.consultorio_id -> consultorio.id');
    });
  });

  it('profesional tiene índice ÚNICO parcial sobre usuario_id (WHERE usuario_id IS NOT NULL)', async () => {
    await conCliente(async (cliente) => {
      const indices = await indicesDe(cliente, 'profesional');
      const parcial = indices.find(
        (i) =>
          esUnica(i) &&
          i.definicion.includes('usuario_id') &&
          /WHERE \(usuario_id IS NOT NULL\)/.test(i.definicion)
      );
      expect(parcial, 'índice único parcial del vínculo 1:1 usuario_id').toBeDefined();
    });
  });

  it('RN-TEN-03: índices únicos (consultorio_id, clave_unicidad(nombre)) en ambas tablas', async () => {
    await conCliente(async (cliente) => {
      for (const tabla of ['profesional', 'sillon_box']) {
        const indices = await indicesDe(cliente, tabla);
        const unicoNombre = indices.find(
          (i) =>
            esUnica(i) &&
            i.definicion.includes('consultorio_id') &&
            i.definicion.includes('clave_unicidad(nombre)') &&
            !/WHERE/.test(i.definicion)
        );
        expect(unicoNombre, `${tabla}: UNIQUE (consultorio_id, clave_unicidad(nombre))`).toBeDefined();
      }
    });
  });

  it('RN-TEN-03: índice único (consultorio_id, clave_unicidad(email)) parcial en profesional', async () => {
    await conCliente(async (cliente) => {
      const indices = await indicesDe(cliente, 'profesional');
      const unicoEmail = indices.find(
        (i) =>
          esUnica(i) &&
          i.definicion.includes('consultorio_id') &&
          i.definicion.includes('clave_unicidad(email)') &&
          /WHERE \(email IS NOT NULL\)/.test(i.definicion)
      );
      expect(unicoEmail, 'UNIQUE (consultorio_id, clave_unicidad(email)) WHERE email IS NOT NULL').toBeDefined();
    });
  });

  it('la función clave_unicidad(text) es IMMUTABLE y STRICT', async () => {
    await conCliente(async (cliente) => {
      const { rows } = await cliente.query(
        "SELECT provolatile, proisstrict FROM pg_proc p " +
          "JOIN pg_namespace n ON n.oid = p.pronamespace " +
          "WHERE p.proname = 'clave_unicidad' AND n.nspname = 'public'"
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].provolatile).toBe('i'); // IMMUTABLE
      expect(rows[0].proisstrict).toBe(true); // STRICT
    });
  });
});

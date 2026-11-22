import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { obtenerUrlBaseTest } from './setup/urls.js';

describe('migración C01: credenciales de usuario', () => {
  it('agrega email y hash de contraseña a usuario con email único', async () => {
    const cliente = new pg.Client({ connectionString: obtenerUrlBaseTest() });
    await cliente.connect();
    try {
      const columnas = await cliente.query(
        `SELECT column_name, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'usuario'
           AND column_name IN ('email', 'password_hash')
         ORDER BY column_name`
      );
      expect(columnas.rows.map((fila) => fila.column_name)).toEqual(['email', 'password_hash']);
      expect(columnas.rows.every((fila) => fila.is_nullable === 'YES')).toBe(true);

      const emailUnico = await cliente.query(
        `SELECT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conrelid = 'public.usuario'::regclass
             AND contype = 'u'
             AND pg_get_constraintdef(oid) = 'UNIQUE (email)'
         ) AS existe`
      );
      expect(emailUnico.rows[0].existe).toBe(true);
    } finally {
      await cliente.end();
    }
  });
});

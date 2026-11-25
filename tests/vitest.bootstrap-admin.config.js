import { defineConfig } from 'vitest/config';
import { SECRETO_TEST } from './helpers/tokens.js';

// Configuración independiente: sin archivos .env ni setup de PostgreSQL.
export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    include: ['tests/auth.test.js', 'tests/crear-consultorio.test.js'],
    env: { JWT_SECRET: SECRETO_TEST },
  },
});

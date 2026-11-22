import { defineConfig } from 'vitest/config';

// Única puerta de integración: `npm test`.
// - globalSetup: crea la base de test desde cero y aplica migraciones.
// - setupFiles: redirige DATABASE_URL a la base de test en cada worker.
export default defineConfig({
  test: {
    globalSetup: './tests/setup/global-setup.js',
    setupFiles: ['./tests/setup/setup.js'],
    fileParallelism: false,
  },
});

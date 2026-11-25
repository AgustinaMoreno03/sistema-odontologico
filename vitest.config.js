import { defineConfig } from 'vitest/config';

// Puerta de integración del backend: `npm test`.
// - globalSetup: crea la base de test desde cero y aplica migraciones.
// - setupFiles: redirige DATABASE_URL a la base de test en cada worker.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    globalSetup: './tests/setup/global-setup.js',
    setupFiles: ['./tests/setup/setup.js'],
    fileParallelism: false,
  },
});

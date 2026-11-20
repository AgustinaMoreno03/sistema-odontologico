/**
 * Configuración del runner de migraciones (design D1 — c00-base-del-proyecto).
 *
 * La lee `npm run migrate` vía `--config-file migrations.config.js`
 * (node-pg-migrate v9; sin sección `db` en el objeto, usa las claves de
 * primer nivel tal cual).
 *
 * - `migrations-dir`: los SQL numerados y forward-only viven en
 *   `db/migrations/` (primera `001_*.sql`; rango reservado de C00: 001–009).
 * - `advisory-lock-mode: 'wait'`: el lock de migración de node-pg-migrate es
 *   por INSTANCIA de PostgreSQL, no por base (docs v9, `advisoryLockMode`).
 *   Con el default `fail`, un `npm test` (setup de la BD de test) solapado
 *   con un `npm run migrate` (BD de dev) en la misma instancia fallaría
 *   confundentemente; con `wait` espera el lock en lugar de fallar.
 * - La cadena de conexión sale SIEMPRE de `DATABASE_URL` (env), sin valores
 *   por entorno: misma configuración para Docker local y Neon (DD-12).
 */
export default {
  'migrations-dir': 'db/migrations',
  'advisory-lock-mode': 'wait',
};

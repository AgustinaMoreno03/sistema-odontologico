# DevOps Local y Docker

## Entorno objetivo de C00

- Node.js y npm para la API Express 5 y las pruebas con `npm test`. El spec de C00 fija la versión de Node compatible con las dependencias.
- PostgreSQL 18 mediante `docker compose`. Si Docker falla, se usa PostgreSQL 18 instalado localmente.
- React 19 y Vite se incorporan en C09. El frontend se inicia y compila por separado.
- Los pasos son requisitos del roadmap. El README de C00 registrará los comandos y puertos que funcionen al verificar la implementación.

## Arranque previsto

1. Instalar las dependencias con el gestor documentado en el README y preparar `.env` a partir de `.env.example`.
2. Levantar PostgreSQL con Compose, configurar `DATABASE_URL` y ejecutar el comando de migración documentado por C00.
3. Levantar la API, comprobar salud y ejecutar `npm test` contra PostgreSQL con datos ficticios.
4. A partir de C09, iniciar Vite y permitir su origen configurado en CORS.

## Migraciones

Archivos SQL numerados en `db/migrations/`. La primera migración de C00 usa el prefijo `001`. Una migración mergeada se conserva y todo ajuste se agrega con una versión nueva del rango del change correspondiente. El runner debe registrar lo aplicado, serializar ejecuciones concurrentes y fallar de forma visible. No se modifica el esquema a mano.

C00 evaluará `node-pg-migrate` para aprovechar su historial, transacciones y bloqueo. La verificación debe abarcar el orden de archivos y la incorporación de rangos reservados en olas paralelas. [Implementación del runner](https://github.com/salsita/node-pg-migrate/blob/main/src/runner.ts)

## Paso a nube

Tras verificar el MVP local, C10 publica en Vercel, Render y Neon. Se aplican las mismas migraciones sobre PostgreSQL 18 y se verifica el flujo con datos ficticios. Los secretos se cargan como variables de entorno y el repositorio contiene únicamente el ejemplo sin valores reales.

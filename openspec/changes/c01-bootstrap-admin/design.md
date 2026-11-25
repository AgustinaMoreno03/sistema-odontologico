# Diseño: aprovisionamiento atómico por CLI

## Context

Ver [propuesta](proposal.md) y [delta](specs/consultorio-user-management/spec.md). Hoy `scripts/crear-consultorio.js` solo llama a `crearConsultorio()`. Los repositorios de `consultorios` y `auth` abren y cierran un `pg.Client` propio por operación, así que hoy no pueden compartir una transacción. No hay un helper transaccional genérico reutilizable en `src/`: `turnos` delimita sus transacciones localmente, y `turnos` y `catalogo/prestaciones` ya tienen el patrón de cliente externo que el repositorio no conecta ni cierra.

## Goals / Non-Goals

**Goals:** compartir una sola transacción entre las dos escrituras y reutilizar `crearUsuarioEnConsultorio` sin duplicar reglas de negocio. Mantener los `INSERT` parametrizados en los repositorios dueños de cada tabla y los cambios de firma compatibles con sus llamadores actuales.

**Non-Goals:** introducir un gestor genérico de transacciones, mover SQL de negocio al script, redefinir validación de credenciales, agregar rutas o reparar consultorios preexistentes.

## Decisions

1. **Propiedad de la conexión.** El script será dueño de un único `pg.Client`, creado con `DATABASE_URL` explícita. Hará `BEGIN`, llamará a `crearConsultorio({ cliente })` y al servicio de alta con el mismo cliente, y hará `COMMIT` solo después de ambas escrituras. Cada punto de escritura admite un cliente opcional; con cliente externo usa `query` sin conectarlo ni cerrarlo. Sin ese argumento conserva su camino actual. El servicio solo propaga `{ cliente }` como opción interna al repositorio de `auth`. El script solo agrega control transaccional; el SQL de las tablas no cambia. Dos conexiones o un borrado compensatorio dejarían una ventana de inconsistencia.
2. **Contexto operativo cerrado.** El comando invocará `crearUsuarioEnConsultorio` con un contexto interno de dos campos: `consultorioId` devuelto por el alta aún no confirmada y `rol` fijo `ADMIN_CONSULTORIO`; el nuevo usuario recibe ese mismo rol fijo. Hoy el servicio solo consulta esos dos campos del contexto, no `usuarioId`. El CLI no simula una sesión, no genera JWT ni fabrica un `usuarioId`. Esta construcción queda en el script operativo; `POST /usuarios` sigue llamando con `req.auth` autenticado, sin opción de cliente ni cambios en la guarda de rol. Si reusar el servicio requiere cambiar ese contrato, relajar la guarda o modificar otras capas, detener Apply y explicar el bloqueo antes de ampliar el alcance.
3. **Entrada y salida.** Se proponen `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` (mayúsculas y prefijo específico, consistente con las claves de entorno actuales). Solo el servicio interpreta estas credenciales: recorta el email y exige que no quede vacío; exige una contraseña no vacía sin recortarla y deriva su hash scrypt con sal aleatoria. No se añade validación de formato o complejidad. La restricción `usuario_email_unique` vigente sigue siendo global. El CLI rechaza `DATABASE_URL` ausente o en blanco antes de abrir cliente para evitar el fallback de `pg`. Ante un error antes de confirmar, intenta `ROLLBACK` si inició la transacción y cierra el cliente en `finally`. Conserva un mensaje genérico de fallo en stderr con `exitCode = 1`, sin interpolar la excepción, y solo imprime el ID después de `COMMIT`.
4. **Punto de prueba propuesto para aprobación.** `tests/crear-consultorio.test.js` ejecutará el módulo CLI real mediante importación dinámica con el entorno y la salida aislados. Se sustituye solo `pg.Client` con un doble que representa la conexión, los registros pendientes y la confirmación o descarte; servicio, repositorios, validación y scrypt son reales. El doble acepta también el camino actual de inserción sin transacción, de modo que el primer RED demuestre la ausencia del administrador y no una falla del arnés. Se verifica el hash capturado con `verificarPassword`, el ID de tenant con el ID devuelto al insertar el consultorio, y que no quede nada confirmado cuando falla el alta. Restaurar módulo, variables, código de salida y consola por caso. Esta evidencia cubre la coordinación del CLI, no el comportamiento de PostgreSQL.
5. **Runner enfocado.** El `npm test` vigente lee `.env` y su configuración siempre ejecuta el `globalSetup` que recrea y migra una base, incluso con un filtro de archivo. Para la verificación sin PostgreSQL, usar el Vitest local vía npm con `--config tests/vitest.bootstrap-admin.config.js`: configuración acotada a este archivo y `tests/auth.test.js`, sin los setup de BD, sin cargar archivos de entorno y con `SECRETO_TEST` del helper para la regresión de auth. Seleccionar de ese archivo solo los casos de aislamiento R4; el caso de `/health` usa base real. Los tests nuevos seguirán siendo descubribles por `npm test` en la verificación habitual del proyecto; no se modifica su configuración por defecto.

## Risks / Trade-offs

- [El admin falla en una conexión distinta y queda el tenant] → Compartir el mismo cliente y comprobar ambas escrituras dentro de una única transacción, éxito después de `COMMIT` y ausencia de registros confirmados al fallar.
- [Una excepción de `pg` puede traer email, URL o detalles sensibles] → No imprimir `message`, `detail`, `stack` ni la excepción cruda, incluso si falla la limpieza. El fallo de cierre no debe ocultar el resultado de la operación. Si se pierde la respuesta de `COMMIT`, informar fallo genérico sin reintentar automáticamente; el operador debe verificar el estado en el destino antes de repetir.
- [El doble no verifica FK, aislamiento, unicidad ni rollback del motor] → Ejercitar la reacción de la app ante el error de unicidad y la coordinación en un único cliente; no reportar integración con PostgreSQL. `tests/usuarios.test.js`, `tests/repositorios-c01.test.js` y `tests/auth-login.test.js` dependen de la base y quedan fuera de esta verificación aislada.

## Migration Plan

1. Sin migración nueva. Para uso operativo posterior, usar Node compatible con `package.json`, instalar dependencias y configurar `DATABASE_URL` hacia la base autorizada con `001_esquema_inicial.sql` y `010_credenciales_usuario.sql` ya aplicadas por el runner existente (`npm run migrate` según el procedimiento del entorno).
2. Configurar las dos variables `BOOTSTRAP_ADMIN_*` por el canal privado del entorno. El lanzador `npm run crear-consultorio` actual usa `--env-file=.env`, así que conserva ese requisito de archivo para invocar el alias. Con las tres variables ya inyectadas en el proceso, se puede usar `node scripts/crear-consultorio.js` sin archivo. El bootstrap no requiere `JWT_SECRET`; el inicio de la API para el login normal sí mantiene su configuración habitual.
3. Documentar las claves sin valores en `.env.example` y actualizar las instrucciones en `README.md` durante Apply. Revertir código, si hiciera falta, no requiere revertir esquema ni borrar consultorios o usuarios aprovisionados correctamente.

## UI Mockups

- Decision: no (no UI)

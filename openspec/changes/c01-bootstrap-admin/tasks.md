# Tareas de implementación

Ejecutar solo después de la aprobación explícita del [delta](specs/consultorio-user-management/spec.md) y del punto de prueba descrito en [diseño](design.md). Registrar el comando y el motivo de cada RED/GREEN; marcar solo lo ejecutado y verificado. No conectarse a PostgreSQL local ni ejecutar el comando de aprovisionamiento contra una base en este trabajo.

Comandos focalizados previstos, desde la raíz (PowerShell):

```powershell
npm.cmd exec --offline -- vitest run --config tests/vitest.bootstrap-admin.config.js tests/auth.test.js -t 'spec auth R4'
npm.cmd exec --offline -- vitest run --config tests/vitest.bootstrap-admin.config.js tests/crear-consultorio.test.js
```

El primer comando cubre la regresión existente de aislamiento sin el caso de `/health`; el segundo corre el nuevo archivo. Para iterar, filtrar el segundo con `-t` por caso. No usar un filtro sobre la configuración por defecto de `npm test`: igual ejecutaría el setup de PostgreSQL.

## 1. Red de seguridad previa

- [x] 1.1 Crear `tests/vitest.bootstrap-admin.config.js` sin setup de BD ni archivos de entorno, con el secreto ficticio del helper y el alcance descrito en el diseño. Ejecutar el primer comando antes de tocar código de producción y registrar el baseline de `tests/auth.test.js` (R4). Detenerse si falla y distinguir regresiones de problemas de configuración. Los archivos existentes de alta HTTP, repositorios y login de C01 requieren PostgreSQL; documentar que no se ejecutaron.

## 2. Bootstrap CLI y triangulación

- [x] 2.1 **RED inicial.** Agregar primero el caso «Aprovisionamiento operativo» en `tests/crear-consultorio.test.js`: usar el CLI actual y un `pg.Client` simulado que soporte el alta actual. Ejecutar el caso y confirmar que falla porque se crea el consultorio pero falta su administrador, no por un error de importación o del doble.
- [x] 2.2 **GREEN mínimo.** Reutilizar `crearUsuarioEnConsultorio`; propagar el cliente opcional a los dos puntos de escritura, mantener los caminos sin cliente externo e integrar el ciclo transaccional del CLI. Volver a ejecutar el caso feliz: un cliente y una confirmación para ambas escrituras, rol fijo, tenant recién generado, contraseña hasheada y comprobable, y éxito solo tras `COMMIT`, sin credenciales ni tokens. Si aparece una incompatibilidad que exige ampliar alcance, detenerse antes de implementarla y explicar el bloqueo.
- [x] 2.3 **Error de negocio.** Simular el rechazo de `usuario_email_unique` para un email de otro consultorio y ejecutar el caso. Verificar que las filas preexistentes no cambian, la nueva alta se revierte, se cierra la conexión y solo hay un mensaje seguro con salida no cero. Si el caso requiere ajuste, demostrar RED y luego GREEN con el cambio mínimo.
- [x] 2.4 **Bordes de configuración.** Agregar y ejecutar casos para cada variable de credenciales ausente, email vacío o en blanco, contraseña vacía y `DATABASE_URL` ausente o en blanco. Verificar que no se confirma ninguna fila, no se usan valores alternativos y sin URL no se intenta conectar. Ejecutar antes de añadir cualquier comportamiento faltante y volver a ejecutar después.
- [x] 2.5 **Fallo inesperado.** Inyectar un error de escritura con detalles ficticios sensibles y ejecutar el caso. Verificar `ROLLBACK` en el mismo cliente, cierre, cero altas confirmadas y ausencia de esos detalles en la salida. Si falla, registrar RED y reejecutar tras la corrección mínima.
- [x] 2.6 **Compatibilidad HTTP.** Con el mismo aislamiento, ejecutar el caso de `POST /consultorios` → 404 y la regresión focalizada de `POST /usuarios`: sin autenticación → 401, rol no administrador → 403 y administrador → 201 con tenant derivado del token aunque el body indique otro. Mantener la ruta y el servicio reales; comprobar que el alta HTTP sin cliente externo conserva la conexión propia del repositorio.
- [x] 2.7 Actualizar `README.md` y documentar las dos claves vacías en `.env.example`. Verificar las instrucciones contra `package.json` y las migraciones existentes, incluida la forma de ejecutar con entorno ya inyectado, sin invocar el CLI ni el runner de migraciones.

## 3. Verificación de la entrega

- [x] 3.1 Ejecutar ambos comandos focalizados completos y `openspec.cmd validate c01-bootstrap-admin --strict`. Revisar que el diff no toque rutas, migraciones ni C09; informar resultados RED/GREEN, cobertura simulada, comando futuro y cualquier comprobación que quede pendiente con PostgreSQL.

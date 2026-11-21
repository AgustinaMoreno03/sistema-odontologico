# Design

## Context

La motivación y el alcance están en `proposal.md`; el comportamiento normativo está en `specs/catalogo/spec.md`. Este documento decide el "cómo".

Estado observado del repositorio (2026-11-21):

- C00 está entregado y archivado: `db/migrations/001_esquema_inicial.sql` crea `consultorio` y `usuario`; `src/modules/auth/rutas.js` exporta `middlewareAutenticacion` (borra los headers `x-tenant-*` y entrega `req.auth = { usuarioId, consultorioId, rol }`); `src/errores.js` define `ApiError` y el manejador central con la forma única `{ error: { code, message } }`; `tests/setup/` recrea la base de test desde cero y aplica todas las migraciones de `db/migrations/`.
- `src/modules/catalogo/` existe vacío (`.gitkeep`). `tests/helpers/tokens.js` (`crearToken`) y `tests/helpers/appProtegida.js` sirven de referencia para las pruebas HTTP.
- `tests/esquema.test.js` actual tolera migraciones de otros changes (solo exige que la `001` exista y sea la primera, y limpia únicamente su fixture) — verificado por lectura.
- Sin dependencias nuevas: `package.json`, `migrations.config.js` y `tests/setup/` no se tocan (coordinación de la ola 1).
- Convención de capas (DD-13): rutas → servicios → dominio → repositorios con SQL parametrizado, JavaScript plano con ES modules.

Restricciones que condicionan el diseño: el `consultorioId` se resuelve solo del token (regla dura 2); toda lectura y mutación filtra por `consultorio_id` (RN-TEN-01/02); las migraciones solo avanzan (regla dura 9); todos los datos de prueba son ficticios (regla dura 1).

## Goals / Non-Goals

**Goals:**

- CRUD dentro del tenant de `Profesional` y `SillonBox`, con baja lógica por `activo`.
- Unicidad RN-TEN-03 garantizada por PostgreSQL (no solo por la aplicación), incluyendo el escenario del spec en el que "Dr. Juan Pérez" y "dr. juan perez" colisionan.
- Interfaz pública estable para C05 (`obtenerCatalogo`, `existeProfesional`, `existeSillonBox`) y para C01 (`vincularUsuario`, `desvincularUsuario`, `profesionalDeUsuario`).
- Migración autocontenida en el rango reservado 020–029 que convive con los rangos de C01/C03/C04 sin renumerar ni editar archivos previos.
- Cobertura de todos los escenarios del spec contra PostgreSQL real, con aislamiento entre consultorios verificado.

**Non-Goals:**

- Login, alta de usuarios ni validación de pertenencia del usuario al consultorio: `usuario` pertenece a C01 (DD-13).
- Endpoints HTTP de vinculación identidad–ficha: la vinculación es solo interfaz de módulo.
- Prestaciones (C04), turnos (C05) y frontend (C09).
- Paginación, filtrado u ordenamiento elegible en los listados; borrado físico; auditoría o historial de cambios.

## Decisions

### 1. Vínculo Profesional ↔ Usuario: 1:1 opcional, sin acoplarse a C01

**Decisión**: la tabla `profesional` lleva `usuario_id UUID NULL REFERENCES usuario(id)`, con un índice único parcial `WHERE usuario_id IS NOT NULL` que garantiza el 1:1. El vínculo se crea, resuelve y elimina SOLO mediante la interfaz de módulo (`vincularUsuario`, `desvincularUsuario`, `profesionalDeUsuario`); no hay endpoint HTTP para él. El módulo `catalogo` **nunca lee la tabla `usuario`** (sin JOINs ni consultas sobre ella): la validación de que el usuario existe y pertenece al consultorio la hace el consumidor dueño de `usuario` (C01). La pertenencia del `profesional` al consultorio sí se valida dentro del módulo.

Esto resuelve el riesgo registrado en CHANGES.md ("definir si `Profesional` se vincula a `Usuario` ODONTOLOGO para no acoplar con C01") por acoplamiento laxo: la columna es opcional y nullable, `Profesional` funciona sin `Usuario`, y C02 no depende de la implementación de C01. No se exige rol `ODONTOLOGO` para el vínculo porque RN-AU-02 separa la condición profesional de la administración (el spec lo exige explícitamente: un usuario `ADMIN_CONSULTORIO` sí puede vincularse).

Semántica de la interfaz (acotada siempre al `consultorioId` recibido):

- `vincularUsuario({ profesionalId, usuarioId, consultorioId })` → `Promise<boolean>`. `false` si el profesional no pertenece al consultorio (sin cambios, como pide el spec). Lanza `ApiError` 409 `RECURSO_DUPLICADO` si el usuario ya está vinculado a otra ficha (escenario del spec) **o** si el profesional ya está vinculado a otro usuario; el primer vínculo se conserva y hay que `desvincularUsuario` antes. Revincular la misma pareja es idempotente y devuelve `true`. La ejecución es un `UPDATE ... WHERE usuario_id IS NULL` condicional (sin carrera) más el índice único parcial como red de seguridad; su violación se traduce igualmente a 409.
- `desvincularUsuario({ profesionalId, consultorioId })` → `Promise<boolean>`. `true` si el profesional pertenece al consultorio (vínculo a `NULL`, idempotente); `false` si no.
- `profesionalDeUsuario({ usuarioId, consultorioId })` → `Promise<object|null>`. Devuelve la ficha completa del profesional vinculado o `null`. Devuelve también fichas inactivas: resuelve identidad, no disponibilidad.

**Alternativas descartadas**: FK obligatoria + restricción de rol `ODONTOLOGO` (acopla C02 a C01 y contradice RN-AU-02); referencia blanda sin FK (permite identificadores colgantes); tabla puente `profesional_usuario` (innecesaria para una relación 1:1); exponer la vinculación por HTTP (el spec la reserva a la interfaz de módulo).

Un `usuarioId` inexistente viola la FK (`23503`) y se traduce a `ApiError` 422 `DATOS_INVALIDOS` con mensaje seguro, porque el contrato dice que el consumidor garantiza la existencia del usuario; cualquier otro fallo de base se propaga al manejador central (500 `ERROR_INTERNO`).

### 2. Migración autocontenida `020_catalogo.sql` (rango 020–029)

**Decisión**: una única migración `db/migrations/020_catalogo.sql`, primera del rango reservado 020–029 de C02 (CHANGES.md, "Rangos reservados de migraciones"), forward-only y sin marcadores `down` (regla dura 9). Hoy existe solo `001_esquema_inicial.sql`; no se renumera ni se edita nada existente. Si a futuro hiciera falta corregir el esquema, la corrección va en una migración nueva del mismo rango (o al final de la secuencia si el rango ya se cerró, según CHANGES.md).

Esquema propuesto (nombres en singular, snake_case, como la `001`):

| Tabla | Columnas |
|---|---|
| `profesional` | `id UUID PK DEFAULT gen_random_uuid()`, `consultorio_id UUID NOT NULL REFERENCES consultorio(id)`, `nombre TEXT NOT NULL`, `matricula TEXT NULL`, `email TEXT NULL`, `usuario_id UUID NULL REFERENCES usuario(id)`, `activo BOOLEAN NOT NULL DEFAULT TRUE`, `creado_en TIMESTAMPTZ NOT NULL DEFAULT now()` |
| `sillon_box` | `id UUID PK DEFAULT gen_random_uuid()`, `consultorio_id UUID NOT NULL REFERENCES consultorio(id)`, `nombre TEXT NOT NULL`, `descripcion TEXT NULL`, `activo BOOLEAN NOT NULL DEFAULT TRUE`, `creado_en TIMESTAMPTZ NOT NULL DEFAULT now()` |

Restricciones e índices (todos los de unicidad compuestos CON `consultorio_id`, RN-TEN-03):

- `clave_unicidad(TEXT) RETURNS TEXT IMMUTABLE STRICT` — función SQL propia (sin extensiones) que devuelve `lower(translate(btrim($1), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))`: recorta espacios exteriores, pliega los acentos del español y pasa a minúsculas. Ver decisión 3.
- `UNIQUE (consultorio_id, clave_unicidad(nombre))` en `profesional` y en `sillon_box`.
- `UNIQUE (consultorio_id, clave_unicidad(email))` parcial `WHERE email IS NOT NULL` en `profesional`: el email nulo no participa de la unicidad (escenario del spec).
- `UNIQUE (usuario_id)` parcial `WHERE usuario_id IS NOT NULL` en `profesional` (1:1).
- `INDEX (consultorio_id)` en ambas tablas para los listados del tenant.

El UUID lo genera la base (`DEFAULT gen_random_uuid()`, igual que la `001`) y los repositorios usan `RETURNING`. `creado_en` es `timestamptz` y se serializa como ISO 8601 UTC.

**Alternativas descartadas**: extender la `001` (prohíbe la regla dura 9); una migración compartida de la ola (rompe el "un dueño por archivo" del rango propio); columna normalizada mantenida por la aplicación para la unicidad (la garantía depende de que todo escritor la pueble; el índice de expresión la garantiza solo).

### 3. Unicidad RN-TEN-03 con clave normalizada que pliega acentos

**Decisión**: la comparación de unicidad de `nombre` (y de `email`) no distingue mayúsculas, espacios exteriores **ni acentos**, mediante `clave_unicidad()` en PostgreSQL.

El requisito del spec textualmente pide "sin distinguir mayúsculas ni espacios exteriores", pero su escenario "Nombre repetido con distinta caja en el mismo consultorio" exige que "Dr. Juan Pérez" y "dr. juan perez" colisionen con 409: esas cadenas difieren además en la tilde. Como los escenarios son los criterios de aceptación, la clave única pliega acentos además de caja y espacios; es un superconjunto que ningún escenario contradice ("Sillón 1" / "SILLÓN 1" y "juan@example.com" / " JUAN@EXAMPLE.COM " también colisionan). El valor **guardado** conserva la escritura original recortada ("Dra. Ana Ruiz", como pide el spec): la normalización es solo para comparar.

`translate()` es inmutable en PostgreSQL, a diferencia de `unaccent()` (que C03 ya descartó declarar inmutable artificialmente), así que la expresión sirve en un índice único sin extensiones ni triggers. El conjunto plegado es el de los acentos del español (MVP); nombres con diacríticos fuera de ese conjunto conservarían su distinción.

La aplicación normaliza antes de escribir (recortar; email en minúsculas; vacíos → `NULL`) y la unicidad la garantiza el índice: una violación (`23505`) se traduce en `ApiError` 409 `RECURSO_DUPLICADO` sin pre-check previo, lo que además cierra la carrera entre altas simultáneas. Un `UPDATE` hacia un nombre duplicado aborta y el registro queda sin cambios (escenario del spec).

**Alternativas descartadas**: solo `lower(btrim(...))` (el escenario literal del spec quedaría en rojo); `unaccent()` en el índice (no es inmutable); pre-check en el servicio como único control (corre en carrera y duplica la regla).

### 4. Organización del módulo por entidad, con archivos de composición mínimos

**Decisión**: `src/modules/catalogo/` separa los archivos **por entidad** con el sufijo de capa, para que C04 agregue `Prestacion` sin pisar los archivos de C02 en la ola paralela:

```
src/modules/catalogo/
  index.js                     # interfaz pública del módulo (exports) + crearRouterCatalogo
  rutas.js                     # composición del router: monta los routers por entidad
  dominio.js                   # helpers puros compartidos (normalización, validación de UUID)
  conexion.js                  # frontera de conexión (pool perezoso de pg)
  catalogo-servicios.js        # obtenerCatalogo (agrega activos de ambas entidades)
  profesional-dominio.js       # reglas puras del Profesional
  profesional-servicios.js     # casos de uso (CRUD + vínculo de usuario)
  profesional-repositorios.js  # SQL de profesional
  profesional-rutas.js         # /api/profesionales
  sillon-box-dominio.js        # reglas puras del SillonBox
  sillon-box-servicios.js      # casos de uso (CRUD)
  sillon-box-repositorios.js   # SQL de sillon_box
  sillon-box-rutas.js          # /api/sillon-boxes
```

`rutas.js` e `index.js` son los únicos archivos que C04 tocará, y llevan un bloque de extensión claramente marcado (una línea para registrar el router de prestaciones y una para exportar su interfaz), con lo que el conflicto de merge es trivial y coordinable. `dominio.js` y `conexion.js` son de solo lectura para C04 (reutiliza sus helpers y el pool). El montaje en `src/app.js` es una línea (`app.use('/api', crearRouterCatalogo())`) en el bloque de montaje ya coordinado con C03; al montar el router del módulo bajo `/api`, C04 no vuelve a tocar `app.js`.

**Alternativas descartadas**: los cuatro archivos de capa compartidos (`rutas.js`, `servicios.js`, `dominio.js`, `repositorios.js` con todo adentro) — cada entidad de C04 editaría todos, conflicto garantizado; subcarpetas por entidad — más separación pero se aleja de la convención plana observada en `auth` y `salud`.

### 5. Validación estricta de cuerpos sin dependencias nuevas

**Decisión**: validadores hechos a mano en la capa de rutas (p. ej. `esUuid`, `esTexto`, `esBooleano` en `dominio.js`), porque no se puede agregar Zod/Joi sin tocar `package.json`, que está fuera del alcance de C02 por coordinación de la ola.

Contrato de entrada (spec "Contrato de entrada de los cuerpos HTTP"): los cuerpos admiten **solo** los campos documentados; cualquier clave desconocida —incluidos `consultorioId` y `usuarioId`— o valor de tipo inválido responde 422 `DATOS_INVALIDOS` sin escribir nada. Campos:

- `POST /api/profesionales`: `nombre` (texto no vacío), `matricula?`, `email?`.
- `PUT /api/profesionales/:id`: cualquier subconjunto de `nombre`, `matricula`, `email`, `activo`; al menos un campo debe estar presente.
- `POST /api/sillon-boxes`: `nombre`, `descripcion?`.
- `PUT /api/sillon-boxes/:id`: cualquier subconjunto de `nombre`, `descripcion`, `activo`; al menos un campo.

Normalización de dominio antes de escribir: `nombre`, `matricula` y `descripcion` se recortan y los vacíos resultantes se guardan como `NULL` en los opcionales; `email` se recorta, se pasa a minúsculas y el vacío se guarda como `NULL`. Un `nombre` vacío o compuesto solo por espacios es 422.

### 6. Contrato HTTP y códigos de error

Recursos: `GET|POST /api/profesionales`, `PUT /api/profesionales/:id`, `GET|POST /api/sillon-boxes`, `PUT /api/sillon-boxes/:id`, `GET /api/catalogo`. El `PUT` actualiza parcialmente y conserva los campos no enviados (escenario del spec); no hay DELETE (la baja es lógica por `activo`). El `:id` se valida antes que el cuerpo. Los parámetros de query y los headers `x-tenant-*` nunca determinan el operante: los headers los borra el middleware de C00 y la query se ignora; el `consultorioId` del cuerpo responde 422 (RN-TEN-01).

Fichas devueltas:

- Profesional: `{ id, consultorioId, nombre, matricula, email, usuarioId, activo, creadoEn }` (`creadoEn` ISO 8601 UTC).
- Sillón/box: `{ id, consultorioId, nombre, descripcion, activo, creadoEn }`.
- Proyección del catálogo activo: `{ profesionales: [{ id, nombre, matricula }], sillonBoxes: [{ id, nombre, descripcion }] }`, ordenados por nombre e id para respuesta determinista.

Mapeo de errores (forma única `{ error: { code, message } }` de C00):

| Caso | Status | code |
|---|---|---|
| Cuerpo con campos desconocidos, `consultorioId`, `usuarioId` o tipos inválidos | 422 | `DATOS_INVALIDOS` |
| `nombre` vacío o solo espacios; PUT sin campos | 422 | `DATOS_INVALIDOS` |
| `:id` malformado o UUID malformado en funciones de módulo | 400 | `DATOS_INVALIDOS` |
| `:id` válido inexistente o de otro consultorio | 404 | `RECURSO_NO_ENCONTRADO` |
| Nombre/email duplicado dentro del consultorio (alta, actualización o vínculo) | 409 | `RECURSO_DUPLICADO` |
| Operación reservada a `ADMIN_CONSULTORIO` | 403 | `SIN_PERMISO` |
| Token ausente o inválido (C00) | 401 | `TOKEN_INVALIDO` |
| Fallo inesperado de base o del servidor | 500 | `ERROR_INTERNO` |

### 7. Autorización con el middleware de C00 y guardia local por rol

**Decisión**: cada ruta monta `middlewareAutenticacion` de `src/modules/auth/rutas.js` sin modificarlo, y una guardia local `requerirAdmin` (en `rutas.js` del módulo) que exige `req.auth.rol === 'ADMIN_CONSULTORIO'` para altas, actualizaciones y listados de gestión; responde 403 `SIN_PERMISO` para `RECEPCION` y `ODONTOLOGO`. `GET /api/catalogo` solo exige identidad válida (los tres roles lo leen). Sin identidad se responde el 401 uniforme de C00.

La guardia vive en el módulo y no en `auth` porque `auth` pertenece a C01 y el proposal de C02 no lo toca; cuando C01 centralice permisos, la guardia local se reemplaza sin cambiar el comportamiento.

### 8. Interfaz pública para C05 y C01

Exportada desde `src/modules/catalogo/index.js` (firmas exactas en la decisión 1):

- `obtenerCatalogo({ consultorioId })` → `{ profesionales, sillonBoxes }` con la proyección mínima y solo activos.
- `existeProfesional({ profesionalId, consultorioId })` e `existeSillonBox({ sillonBoxId, consultorioId })` → `Promise<boolean>`.
- `vincularUsuario(...)`, `desvincularUsuario(...)`, `profesionalDeUsuario(...)` → para C01.

**Semántica de `existe*`: existencia dentro del consultorio, incluidos los inactivos** (`true` si la fila existe en el tenant, sea o no activa; `false` si no existe o pertenece a otro consultorio — igual que "inexistente" para el consumidor). Es lo que piden el nombre de la función y los escenarios ("comprobaciones de existencia"); la disponibilidad la define el catálogo activo. En consecuencia, **C05 debe exigir que el recurso figure en `obtenerCatalogo` (activo) al reservar**, y usar `existe*` solo como comprobación de pertenencia al tenant. Esta semántica se confirma al publicar el contrato (riesgo registrado más abajo).

Todos los identificadores malformados en estas funciones lanzan `ApiError` 400 `DATOS_INVALIDOS` (spec); los fallos de base se propagan al manejador central (500 `ERROR_INTERNO`). El `consultorioId` de estas funciones lo aporta siempre el consumidor desde su contexto autenticado, nunca el cliente final.

### 9. Conexión a la base: pool perezoso del módulo e inyección para fallos

**Decisión**: `conexion.js` crea un `pg.Pool` perezoso sobre `DATABASE_URL` (pooling exigido por los estándares; el patrón de `Client` por llamada de `salud` no escala para CRUD). Se queda dentro del módulo para no crear un archivo compartido sin dueño en la ola 1; si al integrar la ola aparece un `src/db.js` común, este módulo lo adopta sin cambios de comportamiento.

Siguiendo el patrón de inyección de C00 (`crearApp({ chequearBase })`), los servicios y `crearRouterCatalogo` aceptan dependencias inyectables (repositorios por defecto reales) para poder simular un fallo de base sin mockear SQL dentro de la suite. Los repositorios usan SQL parametrizado, proyectan solo las columnas necesarias (sin `SELECT *`) y siempre filtran `consultorio_id`.

### 10. Pruebas contra PostgreSQL real con fixtures ficticios propios

**Decisión**: suite en `tests/catalogo*.test.js` (Vitest + supertest), sin mock de la capa SQL, contra la base de test real que `tests/setup/` crea y migra desde cero. Cada test o grupo crea sus propios consultorios ficticios con UUIDs distintos y limpia solo lo suyo: primero `profesional`/`sillon_box`, luego `usuario` y `consultorio` del fixture (orden que exige la FK de `usuario_id`), con filtros por identificador y sin `DELETE` globales ni `TRUNCATE`. Los tokens salen de `tests/helpers/tokens.js` (`crearToken`); el secreto de pruebas ya lo inyecta `tests/setup/setup.js`.

Cobertura: todos los escenarios del spec (feliz, error de negocio y borde por requisito), incluidos los de aislamiento entre consultorios (RN-TEN-01/02), más pruebas unitarias de dominio para las reglas puras (normalización, validación de UUID). Para el escenario "Fallo de base durante la comprobación" se inyecta un repositorio que falla y se verifica la propagación al 500 `ERROR_INTERNO`. La duplicación secuencial basta para la unicidad (la garantía concurrente la da el índice; igual que decidió C03).

## Risks / Trade-offs

- [El pliegue de acentos en la unicidad es más amplio que el texto literal del requisito] → Ningún escenario lo contradice y el escenario "dr. juan perez" lo exige; si el equipo prefiere solo caja y espacios, el cambio es acotado (una expresión de índice y el helper), pero ese escenario del spec debería corregirse primero.
- [Rango de migraciones de ola paralela: C01 puede integrar `010_*.sql` después de tener `020` aplicado] → Seguir la pauta de CHANGES.md: verificar en base vacía y en base con el último esquema compartido; si el runner exige orden ascendente, integrar los rangos en orden aunque el desarrollo siga en paralelo. Nunca renumerar ni editar migraciones (regla dura 9).
- [Conflicto de archivos con C04 dentro de `catalogo`] → Archivos por entidad (decisión 4) y bloques de extensión marcados en `index.js`/`rutas.js`; un solo dueño por archivo dentro de la ola y coordinación del bloque de montaje de `app.js` con C03.
- [La semántica de `existe*` (incluye inactivos) puede no ser la que C05 espera] → Decidida como existencia; se confirma al publicar el contrato al líder de C05. Si se exigiera activo, el cambio es una cláusula `WHERE activo` y una línea en el spec.
- [`usuarioId` inexistente viola la FK de `usuario`] → Traducción a 422 `DATOS_INVALIDOS` (decisión 1); la pertenencia del usuario al consultorio la garantiza C01, como fija el spec.
- [El vocabulario de códigos de error difiere entre changes de la ola (C02 usa `DATOS_INVALIDOS`, la planificación de C03 menciona `VALIDACION`)] → C02 sigue su spec; la armonización se propone al integrar la ola (Open Questions). No afecta el alcance.
- [Diferencia de criterio de unicidad entre nombre y email si algún escritor escapa al módulo] → El índice de expresión protege igualmente: toda escritura, aunque no pase por el servicio, cumple RN-TEN-03.

## Migration Plan

1. Con el spec y el diseño aprobados, contrastar el diseño con el código integrado de C00 (imports de `middlewareAutenticacion`, `ApiError`, helpers de tests) antes de implementar.
2. Crear `db/migrations/020_catalogo.sql` en el rango 020–029, autocontenida y forward-only, con `clave_unicidad()`, las dos tablas, sus FKs e índices. No tocar `001_esquema_inicial.sql`.
3. Aplicar con el runner oficial (`npm run migrate` / el setup de tests) y verificar tanto una base vacía con todas las migraciones como una base existente con lo ya integrado; una segunda ejecución debe ser no-op.
4. Ejecutar `npm test` completo y comprobar la coexistencia con los tests de C00 y los fixtures de otros changes.
5. Si una migración ya integrada necesita corrección, agregar una migración posterior preservando la anterior y los datos (regla dura 9).

Rollback: como la migración es aditiva (tablas nuevas sin consumidores aún), revertir un despliegue fallido consiste en desplegar el código anterior; el esquema nuevo puede conservarse. Un `DROP` correctivo, si hiciera falta, iría en una migración nueva y coordinada, nunca editando `020`.

## Open Questions

- ¿Armonizar el vocabulario de `code` de error entre los changes de la ola (`DATOS_INVALIDOS` vs `VALIDACION` de C03, por ejemplo)? No cambia el alcance ni la implementación de C02, que sigue su spec; se resuelve al integrar la ola 1.
- ¿Listados de gestión con paginación o filtrado por `activo` cuando crezca el catálogo? No aplica en el MVP y no cambia este diseño (los contratos actuales ya admiten agregar query params sin romper nada).

## UI Mockups

Decision: no (no UI) — change backend sin componentes visuales (el frontend es C09).

# Exploración C05 — Crear turno sin solapamientos por profesional y por sillón/box

> Stance: **thinking partner / solo lectura** (skill `openspec-explore`). Sin implementación, sin
> artefactos de change, sin avanzar a Propose. Fecha: 2026-11-22 (domingo). Entrega: lunes 2026-11-23.
> Rama: `feature/C05-crear-turno` (sin diff respecto de `main`; el change C05 aún no existe en `openspec/changes/`).

---

## 1. Textos literales de las reglas de negocio

Los IDs pedidos **existen todos** en `knowledge-base/05_reglas_de_negocio.md`, sección "## Agenda"
(líneas 13–24). Citas VERBATIM (palabra por palabra, incluidos los IDs):

**`knowledge-base/05_reglas_de_negocio.md`, línea 15:**

> - **RN-AG-01**. Un paciente no puede tener dos turnos solapados dentro de su consultorio.

**`knowledge-base/05_reglas_de_negocio.md`, línea 16:**

> - **RN-AG-02**. Se impide transaccionalmente el solapamiento por profesional o por sillón/box dentro del mismo consultorio, también ante solicitudes simultáneas.

**`knowledge-base/05_reglas_de_negocio.md`, línea 19:**

> - **RN-AG-05**. Una reserva requiere disponibilidad. Si se incorporan bloqueos, impiden reservas sobre el intervalo bloqueado del profesional.

**`knowledge-base/05_reglas_de_negocio.md`, línea 20:**

> - **RN-AG-06**. Los intervalos son `[inicio, fin)`; los turnos contiguos son válidos. Guardar instantes en UTC con `timestamptz` y presentar hora argentina.

**`knowledge-base/05_reglas_de_negocio.md`, línea 21:**

> - **RN-AG-07**. La duración positiva de la prestación determina el fin del turno.

Reglas adyacentes que también condicionan el scope de C05 (mismo archivo):

- Línea 17: `- **RN-AG-03**. Recepción crea, reprograma y cancela turnos. Administración gestiona todas las agendas de su consultorio. El profesional ve su propia agenda y solo crea turnos si está habilitado por operar sin recepción.`
- Línea 24: `- **RN-AG-10**. Confirmación, asistencia, ausencias y bloqueos se priorizan después del flujo base. Estados previstos: `PENDIENTE`, `CONFIRMADO`, `ATENDIDO`, `AUSENTE` y `CANCELADO`. El spec define las transiciones habilitadas.`

Regla dura equivalente en `AGENTS.md`, línea 88:

> 4. NUNCA crear turnos solapados por profesional ni por sillón/box dentro del mismo tenant → validar transaccionalmente; turnos contiguos (uno empieza justo cuando termina otro) SÍ son válidos.

Alcance en `CHANGES.md` (líneas 151–153, entrada "### C05"):

> - **Módulos y archivos:** `turnos` y sus migraciones SQL. Consumir las interfaces de `auth`, `consultorios`, `catalogo` y `pacientes`. Intervalos `[inicio, fin)` en UTC con `timestamptz`. Recepción y admin crean turnos. El profesional habilitado cuando no hay recepción puede hacerlo en su propia agenda.
> - **Alcance:** validar reglas RN-AG-01, RN-AG-02 y RN-AG-05 a RN-AG-07. Rechazar solapamientos por profesional y box de forma transaccional, también ante solicitudes simultáneas. Evaluar restricciones de exclusión en `design.md`. Usar duración de la prestación y el consultorio autenticado.
> - **Ciclo OPSX completo:** spec aprobado, implementación, `npm test`, verificación y archivo. Cubrir reserva válida, conflictos por profesional y por box, turnos contiguos, concurrencia y aislamiento entre consultorios.

Modelo de datos relacionado — `knowledge-base/04_modelo_de_datos.md`, líneas 105–112 (entidad Turno):
atributos `id, consultorioId, profesionalId, sillonBoxId (opcional), prestacionId, pacienteId, inicio, fin (derivado de la duración), estado, creadoEn, canceladoEn, ...`; línea 111:

> - Constraints: **sin solapamientos dentro del mismo tenant** — ni por profesional ni por sillón/box (RN-AG-02); un turno que empieza justo cuando termina otro **es válido** (no es solapamiento, RN-AG-06).

Flujo — `knowledge-base/07_flujos_principales.md`, líneas 7–20: la creación resuelve paciente,
profesional, box y prestación del consultorio, luego una **transacción** verifica disponibilidad y
solapamientos; "Dos solicitudes simultáneas que compiten por el mismo horario no pueden confirmar
ambas. Los turnos contiguos son válidos."

---

## 2. Interfaces reales de C02 y C04 en el código

### 2.1 C02 — profesionales y sillones/boxes (EXISTE EN CÓDIGO ✅)

Interfaz pública consolidada en **`src/modules/catalogo/index.js`** (comentario de cabecera: "lo que
consumen C05 (obtenerCatalogo, existeProfesional, existeSillonBox)"):

```js
export { crearRouterCatalogo } from './rutas.js';
export { obtenerCatalogo } from './catalogo-servicios.js';
export { desvincularUsuario, existeProfesional, profesionalDeUsuario, vincularUsuario } from './profesional-servicios.js';
export { existeSillonBox } from './sillon-box-servicios.js';
```

| Función | Archivo:línea | Firma exacta | Devuelve / lanza |
|---|---|---|---|
| `existeProfesional` | `src/modules/catalogo/profesional-servicios.js:57` | `export async function existeProfesional({ profesionalId, consultorioId }, deps = {})` | `Promise<boolean>` — `true` si la fila existe **dentro del consultorio, incluso inactiva**; `false` si no existe o es de otro consultorio. Identificadores malformados → `ApiError` 400 `DATOS_INVALIDOS` (vía `validarUuid`). Fallos de DB se propagan sin transformar. |
| `existeSillonBox` | `src/modules/catalogo/sillon-box-servicios.js:53` | `export async function existeSillonBox({ sillonBoxId, consultorioId }, deps = {})` | `Promise<boolean>` — misma semántica que la anterior. |
| `obtenerCatalogo` | `src/modules/catalogo/catalogo-servicios.js:19` | `export async function obtenerCatalogo({ consultorioId }, deps = {})` | `Promise<{ profesionales, sillonBoxes }>` — catálogo **activo** con proyección mínima `{ id, nombre, matricula | descripcion }`, ordenado; tenant vacío → `{ profesionales: [], sillonBoxes: [] }`. |

Contrato documentado: **`src/modules/catalogo/README.md`** (líneas 14–67), con la instrucción clave
para C05 (líneas 52–54):

> **C05 debe exigir que el recurso figure en `obtenerCatalogo()` (activo) al reservar**, y usar `existe*` solo como comprobación de pertenencia al tenant (design.md, decisión 8).

Spec vigente: **`openspec/specs/catalogo/spec.md`**, "Requirement: Comprobaciones de existencia para
turnos" (líneas 190–210): resultado `Promise<boolean>`, malformados → `ApiError` 400 `DATOS_INVALIDOS`,
fallos de base → 500 `ERROR_INTERNO` por el manejador central.

**Ejemplo de import REAL en código existente** (import cruzado módulo→módulo; hoy el único import
cruzado en producción es el middleware de auth):

- `src/modules/catalogo/rutas.js:7` → `import { middlewareAutenticacion } from '../auth/rutas.js';`
- `src/modules/catalogo/prestaciones/rutas.js:3` → `import { middlewareAutenticacion } from '../../auth/rutas.js';`

**Ejemplo de import previsto para C05** (documentado, todavía SIN consumidor real — C05 será el
primero; `src/modules/catalogo/README.md:19`):

```js
import { obtenerCatalogo, existeProfesional, existeSillonBox } from '../catalogo/index.js';
```

⚠️ Flag: no existe todavía NINGÚN código que consuma `existeProfesional`/`existeSillonBox`/
`obtenerCatalogo` desde otro módulo — el contrato está probado desde adentro de `catalogo`
(`tests/catalogo-existencia.test.js`, `tests/catalogo-activo.test.js`) pero el import cruzado es
nuevo en C05.

### 2.2 C04 — prestaciones con duración (EXISTE EN CÓDIGO ✅, pero NO publicado en `index.js` ⚠️)

| Función | Archivo:línea | Firma | Devuelve |
|---|---|---|---|
| `obtenerPrestacionParaTurno` (export libre) | `src/modules/catalogo/prestaciones/servicios.js:66` | `export function obtenerPrestacionParaTurno({ prestacionId, consultorioId })` | `Promise<{ id, nombre, duracionMin, activo } \| null>` |
| mismo, método del servicio | `src/modules/catalogo/prestaciones/servicios.js:58` | `obtenerPrestacionParaTurno({ prestacionId, consultorioId })` | delega al repositorio |
| SQL | `src/modules/catalogo/prestaciones/repositorio.js:98` | `WHERE id = $1 AND consultorio_id = $2 AND activo = TRUE` | fila mapeada o `null` |

`null` cubre los tres casos (inexistente, de otro consultorio, inactiva) — verificado en
`openspec/specs/prestaciones/spec.md:99` (Requirement: "Publicar el contrato de duración para C05")
y en `openspec/changes/archive/2026-11-20-c04-prestaciones-duracion-variable/design.md:37`.

**Ejemplo de import real** de este router (otro módulo importa desde `prestaciones` directamente) —
`src/app.js:3`:

```js
import { rutasPrestaciones } from './modules/catalogo/prestaciones/rutas.js';
```

⚠️ **Flag — lo acordado vs. lo que existe:**
- El contrato **existe** en `prestaciones/servicios.js`, pero **NO está re-exportado desde
  `src/modules/catalogo/index.js`**: las líneas 15–17 de ese archivo son un placeholder comentado:
  `// === INICIO BLOQUE DE EXTENSIÓN C04 (prestaciones) === // export { ... } from './prestacion-servicios.js';`
  (y la ruta indicada `./prestacion-servicios.js` ni siquiera es la real: es `./prestaciones/servicios.js`).
- Igual en `src/modules/catalogo/rutas.js:53-55` (mount de `/prestaciones` comentado; en su lugar
  `app.js:27` monta `rutasPrestaciones` en `/api/prestaciones`).
- **Consecuencia para Propose:** C05 puede importar desde `../catalogo/prestaciones/servicios.js`
  (precedente: `app.js` importa rutas de `prestaciones` sin pasar por `index.js`), **o** pedir al
  dueño de `catalogo` que descomente/abra el export en `index.js`. Es una decisión de design.

### 2.3 C03 — pacientes (ACORDADO EN DOCS, NO EXISTE EN CÓDIGO ❌)

Contrato acordado (leer, no modificar — change en progreso 0/20):
- `openspec/changes/c03-pacientes/design.md:118-131` (§7 "Interfaz pública prioritaria para C05"):
  `existePaciente({ pacienteId, consultorioId })` → `Promise<boolean>`; exportado desde
  **`src/modules/pacientes/index.js`**; UUID malformado → `new ApiError(400, 'VALIDACION', 'Identificadores inválidos')`
  importando `ApiError` desde `src/errores.js`; `true` si existe fila con ambos ids; paciente ajeno o
  inexistente → `false`; fallo de conexión → se propaga (500 `ERROR_INTERNO`).
- `openspec/changes/c03-pacientes/tasks.md:15` (tarea 2.3, pendiente): confirma el mismo contrato.

Realidad en el repo (verificado con git):
- Solo existe **`src/modules/pacientes/.gitkeep`** en `main` (`git ls-tree -r main`). **Ningún `.js`.**
- **No existe migración `030_*`**: `db/migrations/` tiene solo `001_esquema_inicial.sql`, `020_catalogo.sql`, `040_prestaciones.sql` → **no existe la tabla `paciente`**.
- El PR #3 de C03 (`afe46a8 Merge pull request #3 from Lean-52139/feature/C03-pacientes`) fue
  **solo documentación** (commits `docs:`: propone/ajusta/precisa) — no implementó código.
- `openspec/changes/c03-pacientes/tasks.md`: 0/20 tareas marcadas.

⚠️ Inconsistencia de código de error a alinear en Propose: C02 usa 400 **`DATOS_INVALIDOS`** para UUID
malformado; C03 acordó 400 **`VALIDACION`**. C05 no debería depender del `code` exacto entre módulos
(o conviene pedir alineación).

### 2.4 C01 — consultorios/login (NO ESTÁ EN MAIN ❌; pero auth de C00 SÍ funciona ✅)

Hechos verificados (no supuestos):
- `src/modules/auth/` (de C00) provee: `middlewareAutenticacion` en `src/modules/auth/rutas.js:22`
  (borra headers `x-tenant-*`, exige `Authorization: Bearer`, setea `req.auth = { usuarioId, consultorioId, rol }`),
  `verificarToken` en `src/modules/auth/servicios.js:29` (HS256, secreto solo de env, 401 genérico),
  `noAutorizado`, y dominio (`extraerContexto`, `esRolValido`, `claimsRequeridosCompletos`).
- **No existe endpoint de login en ningún lado** (grep `login|/api/auth` → solo comentarios). El spec lo confirma —
  `openspec/specs/auth/spec.md:4`: "En C00 cubre el middleware de verificación; el helper de tokens es
  soporte de implementación de la suite (sin requisito propio en este spec) y **login y usuarios los agrega C01**."
- C01 no tiene commits ni PRs en `main` (`git log main --grep=C01` → solo el commit de C00).
- El middleware **no está montado globalmente** en `src/app.js`; cada router lo monta
  (`catalogo/rutas.js:36` `router.use(middlewareAutenticacion);`; `prestaciones/rutas.js:66`
  `rutasPrestaciones.use(middlewareAutenticacion, crearRouterPrestaciones());`). → **el router de turnos deberá montarlo él mismo.**
- **Cómo corre todo sin C01:** los tests firman sus propios JWT con
  **`tests/helpers/tokens.js` → `crearToken({ usuarioId, consultorioId, rol, ... })`** (HS256 con
  `SECRETO_TEST` inyectado por `tests/setup/setup.js`; rol por defecto `RECEPCION`), patrón usado por
  `tests/helpers/catalogo-fixtures.js` (`conFixtureConAdmin`). El spec auth cubre verificación de token,
  no login. **Conclusión: C05 puede implementarse y testearse al 100% sin C01.** Lo único que C01
  aporta después es conveniencia manual (emitir tokens vía login, alta de usuarios/consultorio por UI).

---

## 3. Cómo tratar C03 y C01 mientras no están en main (stub)

### 3.1 Hechos que condicionan la estrategia

1. `src/modules/pacientes/` está vacío salvo `.gitkeep`; **la ruta acordada `src/modules/pacientes/index.js`
   pertenece a C03** (su task 2.3). Escribirla desde C05 crea conflicto de merge con el trabajo paralelo de C03.
2. **La tabla `paciente` no existe** → la migración 050 de C05 **no puede declarar
   `paciente_id UUID NOT NULL REFERENCES paciente(id)`** hoy. Y peor: si 050 se aplica antes de que
   exista la 030, cuando la 030 llegue el runner rechaza la orden inversa (spec schema-migrations,
   scenario "Versión inferior pendiente tras una superior aplicada" → falla visible). `CHANGES.md:228`
   exige integrar/aplicar rangos en orden ascendente.
3. C01 no bloquea nada: el middleware y el helper de tokens ya existen (ver §2.4).
4. Interfaces ya disponibles en main: `existeProfesional`, `existeSillonBox`, `obtenerCatalogo` (C02) y
   `obtenerPrestacionParaTurno` (C04, con el flag de export de §2.2).

### 3.2 Estrategia propuesta para `existePaciente` (recomendación a confirmar)

**Costura (seam) por inyección de dependencias + adaptador fino en el módulo `turnos`:**

- El servicio de turnos recibe `{ existePaciente }` entre sus `deps` inyectables (mismo patrón ya
  usado en el repo: `crearServiciosPrestaciones({ repositorio = ... })`, `repoDe(deps)` en
  `profesional-servicios.js:15`). Default resuelto desde un archivo adaptador propio de turnos,
  p. ej. `src/modules/turnos/integracion/pacientes.js` (nombre a definir en Propose).
- El adaptador hace **import dinámico con fallback explícito y acotado**:

```js
// PSEUDOCÓDIGO — no implementado (stance explore)
// try { real = await import('../pacientes/index.js'); }
// catch (e) { if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; real = null; }
// Solo ERR_MODULE_NOT_FOUND del specifier exacto activa el stub;
// cualquier otro error (sintaxis, runtime) se propaga — el stub NO tapa bugs.
```

- El stub **respeta el contrato acordado al milímetro**: valida `pacienteId` y `consultorioId` como
  UUID y, si alguno está malformado, lanza `new ApiError(400, 'VALIDACION', 'Identificadores inválidos')`
  (importado de `src/errores.js`); devuelve `Promise<boolean>`.
- **Decisión pendiente (ir a "Preguntas para la usuaria"):** sin tabla `paciente`, el stub no puede
  responder existencia real por tenant. Opciones:
  - **(a) optimista:** UUIDs válidos → `true` (provisional, marcado con TODO/`STUB ACTIVO` visible);
    los tests de C05 inyectan un fake para cubrir `false` y el lanzamiento de `VALIDACION`.
    Riesgo: un `pacienteId` inexistente pasaría el chequeo de aplicación — y sin FK (tabla inexistente)
    el INSERT dejaría un `paciente_id` colgante. Mitigación: aceptar solo hasta que C03 llegue + test que
    documente el comportamiento provisional.
  - **(b) rígido:** stub lanza `ApiError(503, 'MODULO_NO_DISPONIBLE', ...)` → el happy path E2E queda
    bloqueado hasta C03 (malo para la demo del lunes).
  - **(c) NO recomendado:** crear `src/modules/pacientes/index.js` desde C05 (pisa la ruta de C03).
- **Alternativa preferida si C03 aterriza antes del apply:** no strearear nada — el spec de C05 se
  escribe contra el contrato ya publicado (design.md §7 / tasks 2.3) y la implementación espera a que
  C03 publique `index.js`. `CHANGES.md:148` permite arrancar por interfaces; el bloqueante real es la
  FK/migración, no el JS.

### 3.3 Migración / FK — el verdadero bloqueo de C03

Opciones (a decidir en Propose; (iii) está prohibida por la regla dura 10):
1. **(i) Secuenciar C05 para mergear después de C03** (limpia: 030 < 050 en orden ascendente, FK
   directo en 050). Recomendada si C03 se resuelve en los próximos días.
2. **(ii) 050 crea `turno` sin FK a `paciente` + una migración posterior del rango 050–059
   (`ALTER TABLE turno ADD CONSTRAINT ... FOREIGN KEY`) cuando C03 esté en main.** Nunca editar 050
   ya mergeada (regla dura 9).
3. **(iii) PROHIBIDO:** que C05 cree la tabla `paciente` (regla dura 10: un módulo no toca las tablas
   de otro módulo).

### 3.4 Qué cambia exactamente cuando C03 y C01 mergearn

**Al merge de C03:**
- Borrar el stub: eliminar el fallback del adaptador `src/modules/turnos/integracion/pacientes.js`
  (o reducirlo a un re-export de `../pacientes/index.js`) **y/o** borrar la fake por defecto.
- Actualizar imports en servicios/rutas de turnos si se optó por import directo.
- Tests: reemplazar los fakes inyectados por fixtures reales con datos ficticios de pacientes
  (seguir el patrón de `tests/helpers/catalogo-fixtures.js`: consultorio propio por test con
  `randomUUID()`, limpieza ordenada por FKs y filtrada, sin DELETE globales); agregar escenarios
  reales de aislamiento (paciente de otro consultorio → `false` → rechazo).
- Si se eligió opción (ii): crear la migración NUEVA 05x con la FK y testearla sobre base vacía y
  base existente.
- Coordinar con la dueña de C03 los tests que ella toca (`tests/esquema.test.js` ya fue corregido en
  main por el PR #6).

**Al merge de C01:**
- **Nada es obligatorio** para que C05 funcione (middleware + helper de tokens ya operan; el contrato
  `{ usuarioId, consultorioId, rol }` y los roles cerrados no cambian — DD-17/DD-18).
- Opcional: si C01 centraliza permisos, reemplazar la guardia local `requerirAdmin`
  (`src/modules/catalogo/rutas.js:19`) y la de `prestaciones`; para turnos, usar la guardia/permisos
  que C01 publique (RN-AG-03: recepción/admin crean; odontólogo solo su agenda).
- Manual/E2E: probar con login real en lugar de tokens minteados a mano.

---

## 4. Opciones para impedir solapamientos de forma transaccional, con riesgos

Contexto verificado: `turno` es tabla **nueva** en C05 (rango 050–059); columnas `inicio`/`fin`
`timestamptz`; `tstzrange(inicio, fin)` por defecto es `[)` = exactamente el intervalo medio abierto
de RN-AG-06 (contiguos NO solapan → válidos ✓). Se necesitan **2 restricciones por RN-AG-02**
(profesional y sillón/box) **+ 1 por RN-AG-01** (paciente) = 3 en total. `sillon_box_id` es opcional
(KB línea 37: "opcional según turno") y en exclusion constraints **los NULLs nunca chocan** → la
opcionalidad queda natural.

### (a) Check-then-insert en transacción con aislamiento por defecto (READ COMMITTED)
- **Pros:** simple, mensajes de error amigables, cumple "multi-write en una transacción".
- **Contras/riesgos:** **NO es seguro ante concurrencia** — dos transacciones simultáneas leen
  "sin conflicto" (lecturas fantasma bajo READ COMMITTED) e INSERTan ambas → solapamiento creado.
  Rompe literalmente "también ante solicitudes simultáneas" (RN-AG-02) y el test de concurrencia que
  C05 debe cubrir. Solo sirve como base combinada con (c), (d) o (e).

### (b) Aislamiento SERIALIZABLE + reintento
- **Pros:** corrección sin tocar esquema ni extensiones; SSI detecta el conflicto lectura-escritura y
  aborta una de las dos.
- **Contras/riesgos:** hay que manejar SQLSTATE `40001` (`serialization_failure`) y `40P01` (deadlock)
  con loop de reintento (2–3 intentos); toda la transacción debe vivir en un único `pg.Client`;
  comportamiento no determinista difícil de testear; más abortos = menor throughput; riesgo de que
  caminos futuros (C07 reprogramar) olviden el reintento. Complejidad media-alta.

### (c) `SELECT ... FOR UPDATE` sobre las filas de recursos (profesional / sillón / paciente)
- **Pros:** sin extensiones, serialización explícita y mentalidad simple; permite el chequeo amigable
  antes del INSERT dentro de la misma transacción.
- **Contras/riesgos:** hay que bloquear **siempre en el mismo orden** (p. ej. profesional → sillón →
  paciente, o por UUID) porque dos turnos que compiten por profesional A+sillón X y sillón
  X+profesional B tomarían los locks en orden distinto → **deadlock (40P01)**; serializa TODA la agenda
  de un profesional aunque los horarios no se solapen (un solo writer por recurso); no protege escrituras
  hechas fuera de la aplicación; exige tratar "fila recurso inexistente".

### (d) Advisory locks (`pg_advisory_xact_lock`)
- **Pros:** sin cambios de esquema; la variante `xact` se libera sola al terminar la transacción;
  clave por (consultorio, recurso).
- **Contras/riesgos:** es **solo de aplicación** — no hay garantía en la base (si otro proceso escribe
  directo, no se entera); se necesitan 2 claves por turno (profesional + sillón) → el mismo cuidado de
  orden de adquisición que en (c) para evitar deadlocks; colisión de hash = serialización extra (inofensiva)
  pero opaca; no se puede expresar como constraint testeable en la DB.

### (e) Constraint de exclusión `EXCLUDE USING gist` (la que C05 está obligado a evaluar — CHANGES.md:152)

**Extensión necesaria:** `btree_gist`. GiST nativo indexa rangos, pero para que columnas `uuid` (y
`consultorio_id`) participen igual que B-tree en el índice/exclusion constraint hace falta el opclass
de `btree_gist`. Sin ella, "overlap exclusion constraints cannot be enforced at the database level"
para tipos escalares (palabras de la propia doc de Neon).

**Disponibilidad VERIFICADA (no asumida):**
- **Neon (nube):** VERIFICADA — https://neon.com/docs/extensions/pg-extensions (última actualización
  2026-11-20) lista `btree_gist` soportado para **PG18 = versión 1.8**; página dedicada
  https://neon.com/docs/extensions/btree_gist documenta `CREATE EXTENSION IF NOT EXISTS btree_gist;`
  y menciona explícitamente su uso para "exclusion constraints that combine B-tree types with range
  overlap operators". Instalable desde el SQL Editor de Neon o psql.
- **Docker local stock:** VERIFICADA empíricamente — contenedor en marcha `odontologia-postgres-1`,
  imagen `postgres:18` (PostgreSQL 18.7):
  `SELECT name, default_version FROM pg_available_extensions WHERE name='btree_gist'` → `btree_gist|1.8`.
  Hoy solo `plpgsql` está instalado (`pg_extension`); `CREATE EXTENSION` quedaría para la migración 050.
- **Opclass `uuid` de btree_gist:** documentado en la doc oficial de btree_gist, **no ejecutado acá**
  (instalar la extensión sería una escritura, fuera del stance explore) → marcar como
  "documentado, verificar en Apply con un INSERT de prueba".

**Modelo de rangos:** guardar `inicio`, `fin` (`timestamptz`) y usar `(tstzrange(inicio, fin)) WITH &&`
en el constraint; el `[)` por defecto ya hace válidos a los contiguos. Ejemplo (no ejecutar, para design):

```sql
ALTER TABLE turno ADD CONSTRAINT turno_profesional_sin_solape
  EXCLUDE USING gist (consultorio_id WITH =, profesional_id WITH =,
                      (tstzrange(inicio, fin)) WITH &&)
  WHERE (estado <> 'CANCELADO');
```

(repetir para `sillon_box_id` y `paciente_id`). El `WHERE` parcial soportado por los exclusion
constraints permite que los turnos `CANCELADO` no bloqueen (RN-AG-08: "Cancelar libera el horario")
— requiere que la columna `estado` nazca en 050 (ver preguntas). **Además hace falta
`CHECK (fin > inicio)`**: un rango vacío (`fin = inicio`) no solapa con nada y evadiría la restricción.

**Mapeo de error:** la violación de exclusion constraint es SQLSTATE **`23P01` (`exclusion_violation`)**
— **NO 23505** (ese es `unique_violation`, el que el repo ya traduce a 409 en
`traducirViolacionUnica`/`traducirErrorPersistencia`). En node-pg: `err.code === '23P01'` → traducir a
409 con un code estable (p. ej. `SOLAPAMIENTO`), mensaje seguro.

**Migración sobre datos existentes:** sin riesgo acá — la restricción nace junto con la tabla nueva
050 en el mismo archivo (cero filas). Sí sería riesgo si se agregara después a una tabla poblada
(los datos actuales la violarían y la migración fallaría).

**Contras:** overhead de mantenimiento de índice GiST por INSERT (despreciable a volumen MVP);
protege solo vía INSERT/UPDATE de esta app (correcto: toda escritura pasa por el servicio);
coordinar quién es dueño de `CREATE EXTENSION btree_gist` (precedente: C03 se quedó `unaccent`).

### Recomendación (⚠️ decisión de diseño — a confirmar por la usuaria antes de Propose)

**Recomiendo (e) exclusion constraints (las 3: paciente, profesional, sillón) + una sola transacción
que hace los chequeos de pertenencia/activitud e INSERT, mapeando `23P01` → 409, con un pre-check
SELECT dentro de la misma transacción solo para devolver mensajes detallados.**
Por qué: es la única opción que da garantía **en la base** ante concurrencia sin loops de reintento ni
riesgo de deadlock; el código de aplicación queda simple; la extensión está verificada en **ambos**
entornos objetivo (Neon y Docker, verificado arriba); y `CHANGES.md:152` pide evaluar justamente esto.
Plan B si la usuaria rechaza la extensión: (c) `FOR UPDATE` con orden determinista de locks, documentando
el orden en design.md. (b) SERIALIZABLE queda como tercera opción.

---

## 5. Preguntas abiertas y supuestos que NO vienen de la KB

### Preguntas que afectan directamente el spec de Propose

1. **¿Cuántas restricciones exactamente?** RN-AG-01 (paciente) + RN-AG-02 (profesional Y sillón/box)
   = ¿3 restricciones de exclusión, o el alcance de C05 se limita a las 2 de RN-AG-02 y RN-AG-01 queda
   para después? `CHANGES.md:152` dice "validar reglas RN-AG-01, RN-AG-02 y RN-AG-05 a RN-AG-07" →
   por texto, **las 3 entran**. Confirmar.
2. **Estado del turno al crearlo:** ¿qué valor tiene `estado` en 050 (`PENDIENTE`? ¿aparece una
   "disponible/ocupado"?) y quién lo crea? RN-AG-10 dice "Estados previstos… El spec define las
   transiciones" y C06 agregará `CANCELADO`. El `WHERE (estado <> 'CANCELADO')` del constraint depende
   de que `estado` nazca ya en 050. **Confirmar modelo de estados para C05.**
3. **¿Un turno `CANCELADO` solapa?** RN-AG-08 dice que cancelar libera el horario → asumo que NO
   bloquea; pero si C05 nace antes que C06, aún no hay cancelación en runtime — confirmar que el
   constraint debe prever `CANCELADO` desde el día uno.
4. **Mismo profesional en dos box a la vez:** RN-AG-02 lo prohíbe (restricción por profesional
   independiente de la de sillón) → asumo **NO permitido**, aun con sillones distintos. Confirmar.
5. **Sillón/box ¿obligatorio o opcional en C05?** KB: `sillonBoxId` "opcional según turno" (línea 37);
   `CHANGES.md:151` lo menciona en el flujo de creación. ¿La API lo exige siempre o acepta `null`?
6. **"El profesional habilitado cuando no hay recepción" (CHANGES.md:151, RN-AG-03):** no existe
   ningún flag/columna para "operar sin recepción" en el esquema actual. ¿Se implementa ese flag en
   C05 (¿qué tabla? ¿la toca turnos o consultorios/auth?) o se difiere del MVP de C05?
7. **RN-AG-05 "disponibilidad":** en C05 ¿solo se validan solapamientos + existencia de recursos
   activos, o también horarios de `AgendaSlot` (KB línea 100: "El spec de C05 define cómo se consulta
   la disponibilidad")? `CHANGES.md:152` solo lista solapamientos → asumo que **bloqueos/AgendaSlot
   quedan fuera** (RN-AG-05 es condicional: "Si se incorporan bloqueos"). Confirmar.
8. **FK de `paciente_id` vs. C03** (ver §3.3): ¿se espera C03 antes de mergear C05, o 050 nace sin FK
   con una 05x posterior? Este punto además fija el orden de integración de rangos 030 < 050.
9. **Contrato HTTP de error de solapamiento:** status/code/mensajes exactos (¿409 `SOLAPAMIENTO`?)
   y si el pre-check devuelve profesional/sillón en conflicto (¿información sensible para recepción?).
10. **Qué devuelve la API si `obtenerPrestacionParaTurno` da `null`** (inexistente, ajena o inactiva):
    ¿400, 404 o 422? El spec de C04 solo dice "rechaza la creación" (`prestaciones/spec.md:111-114`).
11. **Código de error por UUID malformado** entre módulos: `DATOS_INVALIDOS` (C02) vs `VALIDACION`
    (C03 acordado) — ¿C05 unifica o simplemente propaga el del módulo invocado?
12. **`turno` como dueño de la validación reutilizable por C07:** `CHANGES.md:172` pide "reusar la
    interfaz de validación de C05, no copiarla" → el spec de C05 debe publicar esa interfaz de
    validación desde el inicio. ¿forma? (servicio reutilizable vs. constraint + servicio).

### Supuestos que hago (marcados como supuestos, a confirmar)

- **A1 (supuesto):** turnos contiguos válidos se logran con `tstzrange(...)` `[)` por defecto — sin
  lógica extra. (Fundado en RN-AG-06, pero es una decisión de modelado.)
- **A2 (supuesto):** `fin` siempre se deriva como `inicio + duracionMin` (RN-AG-07); la prestación
  garantiza duración ≥ 1 (`040_prestaciones.sql:8` `CHECK (duracion_min BETWEEN 1 AND 480)`), o sea
  `fin > inicio` siempre — aún así conviene un `CHECK` explícito en `turno`.
- **A3 (supuesto):** el solapamiento se valida **siempre dentro del mismo `consultorio_id`** (tenant)
  y nunca global (RN-AG-02 lo dice explícitamente).
- **A4 (supuesto):** para exigir recursos **activos** se usa `obtenerCatalogo()` (instrucción del
  README de catalogo) distinguiéndolo de `existe*` (solo pertenencia al tenant).
- **A5 (supuesto):** los tests de C05 montan el router con `middlewareAutenticacion` real y tokens de
  `tests/helpers/tokens.js` (patrón de `appProtegida.js` y `catalogo-fixtures.js`), sin login.
- **A6 (supuesto):** fixtures propias por test con UUIDs aleatorios y limpieza por FK ordenada
  (patrón `catalogo-fixtures.js`); datos siempre ficticios (regla dura 1).
- **A7 (supuesto):** rango de migración de C05 = **050–059** (`CHANGES.md:221`) y, si se usa
  `btree_gist`, la `CREATE EXTENSION` va en la 050 con un solo responsable (precedente `unaccent`/C03).

### Hecho de baseline (corrido con `npm test` en esta rama, 2026-11-22 10:57)

- **203/205 en verde; 2 fallas preexistentes** en `tests/catalogo-migracion-runner.test.js`
  (líneas 117 y 138): esperan historial exacto `['001_esquema_inicial', '020_catalogo']` pero aparece
  también `040_prestaciones`. El branch no tiene diff vs `main` → **la falla está en main** (C02 se
  mergeó después de C04 y su test quedó desactualizado). No es de C05, pero el gate "tests en verde"
  la hereda: conviene avisar a los responsables de C02/C04 antes del merge de C05.

---

## Preguntas para la usuaria (necesarias antes de Propose)

1. ¿Vale la recomendación de **exclusion constraints (3×) + transacción + 409 `23P01→SOLAPAMIENTO`**
   (§4), o preferís Plan B (`FOR UPDATE` con orden de locks) / SERIALIZABLE?
2. ¿Cuántas restricciones en C05: las 3 (paciente + profesional + sillón) o solo las 2 de RN-AG-02?
3. ¿Estado inicial del turno y modelo de estados para 050 (nace `estado` con `PENDIENTE` y el
   constraint ya excluye `CANCELADO`)?
4. ¿Sillón/box obligatorio u opcional en el alta de turno?
5. ¿Se implementa en C05 el flag "profesional habilitado sin recepción" o se difiere?
6. ¿Bloqueos/`AgendaSlot` entran en C05 o quedan para después (asumo que no)?
7. ¿Secuencia con C03: esperar a que C03 mergear para la FK (030 < 050) o crear `turno` sin FK con
   una migración 05x posterior? Relacionado: ¿el stub optimista (opción a) del §3.2 es aceptable hasta
   entonces, o preferís que C05 no arranque el código hasta que C03 publique `existePaciente`?
8. ¿Código de error HTTP para solapamiento (¿409 `SOLAPAMIENTO`?) y para `obtenerPrestacionParaTurno = null`?
9. ¿Publicamos `obtenerPrestacionParaTurno` desde `catalogo/index.js` (descomentar/arreglar el bloque
   C04) o C05 importa directo de `catalogo/prestaciones/servicios.js`?

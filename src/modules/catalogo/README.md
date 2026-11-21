# Módulo `catalogo` — contrato de la interfaz pública

Catálogo de **profesionales** y **sillones/boxes** del consultorio (C02).
Arquitectura por capas (DD-13): `*-rutas.js` (HTTP) → `*-servicios.js`
(casos de uso) → `*-dominio.js`/`dominio.js` (reglas puras) →
`*-repositorios.js` (SQL parametrizado, `conexion.js`).

El `consultorioId` lo aporta SIEMPRE el consumidor desde su contexto
autenticado (token JWT), nunca el cliente final (regla dura 2 / RN-TEN-01).
Todo acceso está filtrado por `consultorio_id` (RN-TEN-01/02) y la unicidad
es por consultorio (RN-TEN-03, garantizada por índices únicos de expresión
en PostgreSQL; una violación es `23505` traducida a 409).

## Interfaz para C05 (turnos)

Importar desde `src/modules/catalogo/index.js`:

```js
import { obtenerCatalogo, existeProfesional, existeSillonBox } from '../catalogo/index.js';
```

### `obtenerCatalogo({ consultorioId })` → `Promise<{ profesionales, sillonBoxes }>`

Catálogo **activo** del consultorio, con la proyección mínima (sin `activo`,
`usuarioId`, `email` ni `creadoEn`), ordenado por nombre e id:

```js
await obtenerCatalogo({ consultorioId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
// → {
//   profesionales: [{ id: '…uuid…', nombre: 'Dra. María López', matricula: 'MN-1234' }],
//   sillonBoxes: [{ id: '…uuid…', nombre: 'Sillón 1', descripcion: 'Box de ortodoncia' }],
// }
```

Un consultorio sin recursos devuelve `{ profesionales: [], sillonBoxes: [] }`.

### `existeProfesional({ profesionalId, consultorioId })` → `Promise<boolean>`

### `existeSillonBox({ sillonBoxId, consultorioId })` → `Promise<boolean>`

**Semántica de `existe*`: existencia DENTRO del consultorio, incluidos los
inactivos.** `true` si la fila existe en el tenant, sea o no activa; `false`
si no existe o pertenece a otro consultorio (igual que "inexistente" para el
consumidor). No confundir con disponibilidad: la disponibilidad la define el
catálogo activo.

```js
await existeProfesional({ profesionalId: '…uuid…', consultorioId: '…uuid…' }); // true (activo o inactivo)
await existeSillonBox({ sillonBoxId: '…otro-uuid…', consultorioId: '…uuid…' }); // false si es de otro consultorio
```

> **C05 debe exigir que el recurso figure en `obtenerCatalogo()` (activo) al
> reservar**, y usar `existe*` solo como comprobación de pertenencia al
> tenant (design.md, decisión 8).

### Errores

| Caso | Resultado |
|---|---|
| Identificador malformado (no UUID) | lanza `ApiError` 400 `DATOS_INVALIDOS` |
| Recurso de otro consultorio o inexistente (`existe*`) | `false` |
| Fallo de base | el error se propaga al consumidor tal cual; un manejador HTTP central de C00 responde 500 `ERROR_INTERNO` con mensaje seguro (sin filtrar internals) |

Ejemplos verificados contra los tests:
`tests/catalogo-activo.test.js` (proyección, activos, aislamiento, vacío) y
`tests/catalogo-existencia.test.js` (semántica `existe*`, 400, propagación
de fallos).

## Interfaz para C01 (usuarios): vínculo identidad–ficha 1:1 opcional

Importar desde `src/modules/catalogo/index.js`:

```js
import { vincularUsuario, desvincularUsuario, profesionalDeUsuario } from '../catalogo/index.js';
```

**Solo interfaz de módulo: NO hay endpoints HTTP para el vínculo.** Un
`usuarioId` en el cuerpo de cualquier request se rechaza con 422
`DATOS_INVALIDOS` (el vínculo se hace únicamente por acá). El módulo
`catalogo` **nunca lee la tabla `usuario`** (DD-13): solo su columna propia
`profesional.usuario_id`. C01 —dueño de `usuario`— debe garantizar antes
que el usuario existe y pertenece al consultorio.

El vínculo es 1:1 opcional dentro del consultorio y se permite sin
restricción de rol (RN-AU-02): un usuario `ADMIN_CONSULTORIO` también puede
estar vinculado a una ficha profesional.

### `vincularUsuario({ profesionalId, usuarioId, consultorioId })` → `Promise<boolean>`

- `true` → el vínculo quedó guardado; revincular la MISMA pareja es
  idempotente.
- `false` → el profesional no pertenece al consultorio (sin cambios).
- `ApiError` 409 `RECURSO_DUPLICADO` → el profesional ya está vinculado a
  otro usuario, o el usuario a otra ficha. Se conserva el primer vínculo:
  hay que `desvincularUsuario` antes.
- `ApiError` 422 `DATOS_INVALIDOS` → el `usuarioId` no existe (FK violada;
  el consumidor garantizaba la existencia).
- `ApiError` 400 `DATOS_INVALIDOS` → identificadores malformados.

```js
await vincularUsuario({
  profesionalId: '…uuid del profesional…',
  usuarioId: '…uuid del usuario…',
  consultorioId: '…uuid del consultorio…',
}); // → true
```

### `desvincularUsuario({ profesionalId, consultorioId })` → `Promise<boolean>`

- `true` → el profesional pertenece al consultorio y queda sin vínculo
  (idempotente); **el profesional sigue publicado en el catálogo**.
- `false` → el profesional no es de este consultorio (sin cambios).

### `profesionalDeUsuario({ usuarioId, consultorioId })` → `Promise<object | null>`

Devuelve la **ficha completa** del profesional vinculado al usuario dentro
del consultorio (`{ id, consultorioId, nombre, matricula, email, usuarioId,
activo, creadoEn }`) o `null` si no hay vínculo. Devuelve también fichas
**inactivas**: resuelve identidad, no disponibilidad.

```js
await profesionalDeUsuario({ usuarioId: '…uuid…', consultorioId: '…uuid…' });
// → { id: '…uuid…', consultorioId: '…uuid…', nombre: 'Dra. Vinculada Uno',
//     matricula: null, email: null, usuarioId: '…uuid…', activo: true,
//     creadoEn: '2026-11-21T12:00:00.000Z' }
```

Ejemplos verificados contra `tests/catalogo-vinculacion.test.js`
(vinculación, idempotencia, 409/422/400, desvinculación y fichas
inactivas).

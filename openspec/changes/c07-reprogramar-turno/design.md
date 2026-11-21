# Design

## Context

La motivación y el alcance están en proposal.md. El comportamiento esperado está en specs/turnos/spec.md.

C07 depende de C05 (crear turno sin solapamientos), que **todavía no existe**: no hay change de C05 y `src/modules/turnos/` solo contiene `.gitkeep`. Únicamente existe la migración `001_esquema_inicial.sql` de C00 (tablas `consultorio` y `usuario`). Por lo tanto, C07 planifica sobre el contrato que **deberá** publicar C05, no sobre código actual.

Estado actual verificado:

- Specs main existentes: `auth`, `development-environment`, `schema-migrations` (ninguno cubre turnos).
- Módulos con código: `auth`, `consultorios`, `catalogo`, `pacientes`; `turnos` vacío.
- C03 (en curso) publica `existePaciente` como interfaz para C05 — mismo patrón de contrato entre módulos.
- El rango de migración reservado para C07 es 070–079; el comportamiento pedido no requiere esquema nuevo.

Dependencias de diseño: la interfaz de validación de disponibilidad de C05 (no implementada), el middleware de C00 y las tablas de turno que definirá C05.

## Goals / Non-Goals

**Goals:**

- Mover la fecha y hora de un turno existente revalidando todas las reglas de solapamiento sobre el nuevo rango, de forma transaccional y con conservación del horario ante fallos (RN-AG-09).
- Reutilizar la validación de C05 sin duplicar lógica de dominio.
- Autorizar solo recepción y administración, con el consultorio resuelto desde el token.
- Mantener el módulo `turnos` organizado por capas y coordinado con C06 y C08.

**Non-Goals:**

- Crear, cancelar, confirmar ni asistir turnos (C05, C06, C10/estados posteriores).
- Cambiar profesional, sillón/box, paciente o prestación al reprogramar: solo fecha y hora (asumption registrada abajo).
- Definir el comportamiento ante turnos en estado `CANCELADO` — los estados los gobierna C06; ver Supuestos.
- Frontend (C09) y migraciones nuevas (rango 070–079 queda reservado sin usar).

## Decisions

### 1. Reutilizar la interfaz de validación de C05, no duplicarla

C07 NO implementa su propia comprobación de solapamientos. Consumirá una función pública que C05 publicará desde `src/modules/turnos/index.js` (mismo patrón que `existePaciente` de C03 hacia C05).

Contrato propuesto para acordar con Agustina (dueña de C05):

```js
verificarDisponibilidad({
  consultorioId,      // UUID, SIEMPRE del contexto autenticado
  profesionalId,
  sillonBoxId,        // opcional
  pacienteId,
  inicio,             // timestamptz
  fin,                // calculado con la duración de la prestación
  excluirTurnoId      // UUID opcional: turno exento de la comparación
}) // → Promise<void>; lanza ApiError(409, 'SOLAPAMIENTO', ...) si hay conflicto
```

- La función encapsula RN-AG-01, RN-AG-02 y RN-AG-06 y el manejo transaccional/concurrencia que C05 defina (restricción de exclusión, `SELECT ... FOR UPDATE` o bloqueo de filas — decisión de C05, no de C07).
- C07 solo la invoca dentro de su transacción de reprogramación. Si al aplicar este change C05 todavía no publicó la función, el trabajo se detiene: **no se implementa una validación paralela** (riesgo explícito de CHANGES.md §C07).
- Alternativa considerada y descartada: copiar la consulta de solapamientos de C05 → duplica reglas de negocio, puede divergir (RN-AG-01/02/06) y viola la regla de coordinación del roadmap.

**Dependencia registrada:** Apply de C07 requiere C05 aprobado e integrado en main con `verificarDisponibilidad` publicada y probada.

### 2. Excluir el turno que se está moviendo

La llamada recibe `excluirTurnoId = id` del turno en reprogramación. Sin exclusión, el turno se compararía consigo mismo y fallaría siempre (su intervalo viejo intersecta el nuevo cuando el movimiento es parcial) o daría falsos negativos.

- La exclusión se aplica **solo** a ese identificador dentro del consultorio autenticado; nunca elimina el filtro `consultorio_id`.
- Alternativa descartada: borrar y reinsertar el turno para "liberar" su horario — pierde id, historial y no es transaccionalmente simple.

### 3. Atomicidad: una sola transacción, conservar el horario ante fallo (RN-AG-09)

El servicio de reprogramación ejecuta en **una** transacción:

1. Leer el turno por `id` **y** `consultorio_id` del token (bloqueo de fila).
2. Calcular `fin = inicio + duración de la prestación` (dominio, RN-AG-07).
3. Invocar `verificarDisponibilidad(..., excluirTurnoId)` dentro de la misma transacción.
4. `UPDATE turno SET inicio = ..., fin = ... WHERE id = ... AND consultorio_id = ...`.
5. Commit. Ante cualquier error (solapamiento, error de base): rollback y respuesta de error; el turno queda con su intervalo original.

Sin escrituras fuera de la transacción y sin validación previa "por las dudas" en otra conexión: la validación y el movimiento son indivisibles, lo que cubre también solicitudes simultáneas (RN-AG-02). La semántica de concurrencia exacta (exclusión a nivel de base vs. bloqueo) la aporta C05 con su mecanismo; C07 la respeta al participar de su interfaz.

### 4. Matriz de autorización (RN-AG-03)

| Rol (desde el token) | Reprogramar |
|---|---|
| `RECEPCION` | ✔ permitido |
| `ADMIN_CONSULTORIO` | ✔ permitido |
| `ODONTOLOGO` | ✘ 403 |
| sin token / token inválido | ✘ 401 (contrato de C00) |

- La autorización se resuelve en la capa de servicio a partir de `req.auth.rol`, después de autenticar (mismo patrón que C03 con `pacientes`); no se modifica el spec `auth`.
- Se verifica **antes** de tocar la base: un odontólogo no debe recibir 404 ni 409, sino 403.
- El permiso "profesional habilitado para crear turnos sin recepción" (RN-AG-03, fin de agenda) **no** se extiende a reprogramación: solo recepción y administración (US-004).

### 5. Aislamiento multi-tenant (RN-TEN-01/02)

- `consultorioId` sale exclusivamente de `req.auth` (token JWT firmado); se descartan `consultorioId` de body, query y encabezados `x-tenant-*` (el middleware de C00 ya los elimina).
- Toda lectura y el `UPDATE` filtran por `consultorio_id`. Un turno ajeno o inexistente produce el mismo resultado: 404, sin distinguir si el id existe en otro consultorio (evita enumeración).
- Las pruebas incluyen escenarios de aislamiento con dos consultorios ficticios.

### 6. Contrato HTTP propuesto

```
PATCH /api/turnos/:id/reprogramar
Authorization: Bearer <JWT>
{ "inicio": "2026-12-01T18:00:00Z" }   // instante UTC ISO 8601; el fin nunca se recibe
```

| Estado | Causa |
|---|---|
| 200 | Turno actualizado (inicio nuevo y fin recalculado) |
| 401 | Sin token / token inválido (contrato C00) |
| 403 | Rol sin permiso (ODONTOLOGO u otro) |
| 404 | Turno inexistente o de otro consultorio |
| 409 | Solapamiento en el nuevo rango (RN-AG-01/02/06) |
| 422 | `inicio` ausente, malformado o fin inválido provisto por el cliente |
| 500 | Error interno, mensaje seguro (manejador central) |

`PATCH` refleja un cambio parcial de horario; si el equipo prefiere `PUT /api/turnos/:id`, se ajusta en Apply sin tocar los requisitos del spec.

### 7. Estructura del código y coordinación con C06/C08

C07 agrega sus archivos **dentro** de `src/modules/turnos/` sin reescribir los de C05:

```
src/modules/turnos/
  index.js                 ← publica verificarDisponibilidad (C05) — NO se edita en C07
  rutas.js                 ← C05 crea el archivo base; C07 registra su endpoint (coordinar merge)
  servicio/reprogramar.js  ← caso de uso propio de C07
  dominio/reprogramacion.js← cálculo de fin y validación de entrada de C07
  repositorio/reprogramar.sql.js ← UPDATE parametrizado con filtro de consultorio
```

- Cada change de ola 3 (C05, C06, C07, C08) es una rama `feature/C07-...`; los conflictos en `rutas.js` se resuelven registrando rutas independientes, sin reordenar las de otros.
- Los módulos no tocan tablas de otros módulos: C07 solo escribe en `turno`, tabla del módulo `turnos`.
- Comunicar el contrato `verificarDisponibilidad` al equipo (Agustina, Lucía) antes de implementar, como hizo C03 con `existePaciente`.

## Risks / Trade-offs

- **C05 no existe aún** → Apply queda bloqueado hasta que C05 publique `verificarDisponibilidad`; el contrato propuesto en este design debe acordarse con Agustina. No se adelanta implementación con stubs de validación propios.
- **Duplicar la lógica de C05 por urgencia** → regla de este change: si la interfaz no está, se detiene; code review busca consultas de solapamiento duplicadas fuera de la función de C05.
- **Conflictos de archivo con C06/C08 en `turnos`** → archivos de reprogramación propios, rutas registradas sin reordenar, rama por change y coordinación con la líder.
- **Semántica de concurrencia definida por C05** → C07 no inventa su propio mecanismo; si C05 resuelve concurrencia con exclusiones/transacciones, C07 participa vía su interfaz y su transacción. Verificar con test de solicitudes simultáneas.
- **Estado `CANCELADO` del turno** → los estados los gobierna C06 (ola 3, en paralelo). Si al integrar la tabla de C05 el turno tiene estado, reprogramar un turno cancelado se rechazará con 409 en coordinación con C06; C07 no define ese comportamiento en su spec para no crear una dependencia de C06.
- **Formato de hora** → el API trabaja en UTC (`timestamptz`); la presentación en hora argentina es responsabilidad de la agenda (C08/C09).

## Supuestos

1. **Alcance de movimiento:** solo fecha y hora. Cambiar profesional, sillón/box, paciente o prestación al reprogramar queda fuera de C07 (CHANGES.md: "mover horario/fecha").
2. **Sin migración nueva:** las tablas de turno las crea C05; C07 no usa el rango 070–079 salvo necesidad real surgida en Apply.
3. **Interfaz de C05:** el contrato de `verificarDisponibilidad` es una propuesta de este plan, sujeta al acuerdo con la dueña de C05; cualquier cambio se refleja en este design antes de Apply.
4. **Id de turno:** el endpoint identifica el turno por UUID en la ruta; un UUID malformado responde 422.

## Migration Plan

1. Aprobado el spec, acordar con Agustina el contrato `verificarDisponibilidad` y confirmar C05 integrado en main.
2. Verificar el código real de C05 (imports, transacción, manejo de `ApiError`) contrastándolo con este design.
3. Implementar servicio, dominio, repositorio y ruta de reprogramación dentro del módulo `turnos`.
4. Ejecutar `npm test` con PostgreSQL y datos ficticios; verificar escenarios felices, de negocio y borde del spec, más aislamiento y concurrencia.
5. Sin migración que aplicar: comprobar que la suite de esquema no espera cambios en `db/migrations/`.
6. Rollback: el cambio es una capa nueva sobre la API; retirar el endpoint no afecta datos persistidos.

## UI Mockups

Decision: no (no UI)

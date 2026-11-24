# Proposal

## Why

C05 permite crear turnos y C07 ya permite reprogramarlos, pero todavía no hay una consulta de agenda para recepción y profesionales. C08 entrega esa lectura y un contrato estable para C09, respetando el aislamiento y los permisos de la KB.

## What Changes

- Consultar `GET /api/agenda` por intervalo explícito de hasta siete días, para las vistas diaria y semanal de C09.
- Recepción y administración consultan todas las agendas de su consultorio o filtran por profesional; el odontólogo consulta exclusivamente la ficha vinculada a su identidad.
- Incluir turnos que intersectan el rango, sus estados y el nombre del paciente, con orden estable y paginación sin truncamiento silencioso.
- Resolver nombres mediante una interfaz del módulo pacientes y la identidad profesional mediante la interfaz existente de catálogo; no cruzar tablas entre módulos.
- Probar aislamiento entre consultorios, entre profesionales y ante intentos de sustituir el consultorio autenticado.
- Conservar C05/C07 y los archivos compartidos; no añadir transiciones de estado, bloqueos ni UI.

## Capabilities

### New Capabilities

- `agenda`: consulta diaria y semanal de turnos por rango, con permisos, contrato HTTP y lectura mínima de pacientes.

### Modified Capabilities

Ninguna. La creación y reprogramación de `turnos` y los contratos existentes de catálogo y pacientes se conservan.

## Impact

- Archivos nuevos `src/modules/turnos/agenda-{rutas,servicios,dominio,repositorio}.js`, pruebas y documentación propias de C08.
- Interfaz nueva de nombres mínimos en pacientes, implementada en archivos propios y exportada desde `src/modules/pacientes/index.js` (Leandro mantiene C03).
- Solo dos líneas añadidas a `src/app.js`: import y montaje de `/api/agenda` antes del manejador de errores.
- Sin cambios a `package.json`, configuración, tests/setup, helpers compartidos ni migraciones existentes.
- La 050 ya contiene el índice `(consultorio_id, profesional_id, inicio)`. C08 no propone migraciones ni DDL sobre turno. El rango reservado de C08 es exclusivamente 080–089; permanece sin usar.
- Contrato aprobado mediante PR #22 y Apply autorizado por Agustina el 24/11/2026, después del RED de aislamiento y la suite de la base final. C05 está archivado; main incorpora C06 con 071 y no contiene la 110.
- Base histórica exacta: `666dbc721c7d8046383f299689853bcf491ca50a`, con C07 y sin C06/110. Sus 421 tests no sustituyen la verificación previa a Apply de la base final aprobada.

# Design

## Context

La motivación y el alcance están en proposal.md. El comportamiento esperado está en specs/pacientes/spec.md.

C00 ya está integrado desde upstream/main. Su suite base pasó 47 tests en esta máquina. El login y la emisión de tokens corresponden a C01.

Las tablas usan nombres en singular e identificadores UUID. La tabla consultorio existe desde la migración 001 de C00.

## Goals / Non-Goals

El diseño organiza el módulo por capas, define una ficha mínima y permite integrar pacientes con turnos mediante una interfaz pública acotada al consultorio autenticado.

La entrega de C03 comprende el backend y sus pruebas. Las funciones clínicas, de cobros y de sucursales corresponden a etapas posteriores.

## Decisions

### 1. Capas del módulo pacientes

Organizar src/modules/pacientes/ en archivos separados para rutas HTTP, servicios, dominio y repositorios SQL.

Las rutas reciben la petición y traducen el resultado a HTTP. Los servicios coordinan permisos y operaciones. El dominio valida los datos básicos. Los repositorios ejecutan SQL parametrizado sobre paciente.

Esta división sigue la arquitectura acordada y permite que turnos utilice una interfaz pública del módulo.

### 2. Autenticación y permisos

Cada ruta de pacientes incorpora middlewareAutenticacion, importado desde src/modules/auth/rutas.js. C00 no lo monta globalmente.

El middleware entrega req.auth = { usuarioId, consultorioId, rol }. Pacientes utiliza exclusivamente ese consultorio para operar.

C00 valida JWT HS256 y los tres campos obligatorios. Ante token ausente o inválido responde 401 con el cuerpo acordado:

```json
{
  "error": {
    "code": "TOKEN_INVALIDO",
    "message": "No autorizado"
  }
}
```

Pacientes conserva ese comportamiento y aplica sus permisos después de autenticar, según knowledge-base/03_actores_y_roles.md.

- ADMIN_CONSULTORIO y RECEPCION pueden dar de alta pacientes.
- ADMIN_CONSULTORIO, RECEPCION y ODONTOLOGO pueden buscar fichas básicas.
- Una identidad válida sin permiso para la operación recibe 403.

El middleware elimina encabezados x-tenant-* e ignora la selección de consultorio del cliente. Los repositorios reciben consultorioId desde el contexto validado y lo incluyen en cada consulta.

### 3. Tabla paciente y datos mínimos

Proponer los siguientes campos para la migración de C03:

| Campo SQL | Tipo y regla |
|---|---|
| id | UUID, clave primaria |
| consultorio_id | UUID obligatorio, referencia consultorio(id) |
| nombre | Texto obligatorio |
| apellido | Texto opcional |
| telefono | Texto opcional |
| email | Texto opcional |
| creado_en | timestamptz, instante de creación |

Separar nombre y apellido facilita la búsqueda por ambos campos que pidió Agustina. El apellido queda opcional porque el alta mínima exige nombre y contacto.

Recortar espacios exteriores. Convertir los contactos vacíos a NULL y rechazar nombres vacíos. Exigir teléfono o email tanto en la validación del dominio como en las restricciones de la tabla.

Generar el UUID del paciente en el servicio con la función estándar de Node.js. Las referencias a consultorio utilizan el UUID autenticado.

### 4. Normalización de contactos y unicidad

Recortar espacios exteriores del email y guardarlo en minúsculas. PostgreSQL garantiza la unicidad mediante un índice único sobre (consultorio_id, lower(btrim(email))). Los contactos ausentes se guardan como NULL.

La normalización del servicio mantiene los valores consistentes y el índice protege la unicidad incluso ante escrituras que usen otras mayúsculas. Traducir su violación a 409.

Para teléfono, quitar espacios, guiones y paréntesis. Conservar los dígitos y un único signo + inicial cuando esté informado. Rechazar caracteres ajenos al formato. Si quedan únicamente separadores permitidos y ningún dígito, normalizar a NULL. El alta requiere entonces un email válido como contacto. Un contacto compuesto solo por espacios se trata como ausente antes de validar.

Ejemplo ficticio: "+54 (11) 0000-0000" se guarda como "+541100000000". Un teléfono local conserva sus dígitos. Agregar país o área requiere una regla posterior acordada. +541100000000 y 1100000000 se consideran teléfonos diferentes para la búsqueda.

Aplicar las mismas normalizaciones en la búsqueda por contacto.

### 5. Contrato HTTP propuesto

POST /api/pacientes recibe nombre, apellido opcional, telefono y email. Devuelve 201 con la ficha básica creada.

GET /api/pacientes?q=texto busca fichas básicas dentro del consultorio autenticado y devuelve 200 con una lista.

Proponer estas respuestas adicionales para revisión:

- 422 para datos obligatorios ausentes, tipos inválidos o búsqueda vacía.
- 409 para email duplicado dentro del consultorio.
- 403 para una operación que el rol autenticado no permite.
- 401 según el contrato de C00.

El cuerpo de alta admite únicamente los campos de la ficha indicados. Un identificador de consultorio enviado en el cuerpo se rechaza como campo ajeno al contrato. Los valores de query o encabezados jamás determinan el consultorio de operación.

### 6. Búsqueda con unaccent y límite de resultados

Utilizar unaccent e ILIKE para comparar nombres y apellidos por coincidencia parcial, conservando su escritura original.

La documentación oficial de Neon consultada durante Explore incluye unaccent 1.1 para PostgreSQL 18. La comprobación documental está realizada. Su habilitación y funcionamiento en la base del proyecto se verifican durante Apply.

https://neon.com/docs/extensions/pg-extensions

unaccent no es inmutable. Para el MVP, aplicar la función en la consulta y usar un índice ordinario por consultorio_id para acotar los candidatos. La búsqueda parcial con comodín inicial tampoco se beneficia de un índice B-tree ordinario sobre nombre. El volumen inicial permite este enfoque. LIMIT 50 acota la respuesta, aunque la base puede examinar más filas.

Si el volumen exige optimización, evaluar columnas normalizadas y un índice adecuado mediante una decisión posterior. El diseño inicial conserva las funciones reales de PostgreSQL y evita declarar artificialmente inmutable a unaccent.

Buscar teléfono por coincidencia completa normalizada. Comparar email mediante lower(btrim(email)) = lower(btrim($parametro)), con un parámetro SQL, usando la misma expresión del índice único. Una consulta textual para nombres debe seguir funcionando aunque su contenido no sea un teléfono válido.

Agrupar todas las alternativas bajo el filtro obligatorio consultorio_id. Utilizar parámetros SQL y escapar comodines para interpretar literalmente el texto buscado.

Devolver un máximo fijo de 50 resultados mediante LIMIT 50, ordenados por apellido ASC NULLS LAST, nombre ASC e id ASC. Rechazar texto de búsqueda vacío con 422. Los parámetros del cliente no pueden ampliar el máximo.

### 7. Interfaz pública prioritaria para C05

Exportar existePaciente desde src/modules/pacientes/index.js.

Contrato propuesto para revisión:
existePaciente({ pacienteId, consultorioId }) devuelve Promise<boolean>.

pacienteId es el UUID del paciente. consultorioId es el UUID obtenido del contexto autenticado por el módulo consumidor. Ambos son obligatorios. Los identificadores malformados lanzan new ApiError(400, 'VALIDACION', 'Identificadores inválidos'), importando ApiError desde src/errores.js.

Devuelve true si existe una fila de paciente con ambos identificadores y false cuando no existe. Un paciente ajeno y uno inexistente producen false. Un fallo de conexión o consulta se propaga al manejador central de C00, que responde 500 con code ERROR_INTERNO y un mensaje seguro.

El repositorio de pacientes realiza la consulta parametrizada usando id y consultorio_id. C05 consume esta interfaz pública.

Publicar este contrato al equipo tras actualizar los documentos, antes de implementar. La implementación de la interfaz y su prueba se priorizan inmediatamente después de la migración.

### 8. Pruebas

Cubrir cada escenario del spec mediante npm test y PostgreSQL con datos ficticios de dos consultorios.

Probar alta válida, validación de nombre y contacto, email duplicado, búsqueda parcial con tildes y mayúsculas, búsqueda por contacto, permisos y aislamiento.

C00 proporciona tests/helpers/tokens.js, que exporta crearToken({ ... }). Permite indicar usuarioId, consultorioId y rol para representar diferentes usuarios y consultorios. Su rol predeterminado es RECEPCION.

Para comprobar rechazos, el helper permite expirado: true, omitir claims, cambiar el secreto o seleccionar otro algoritmo. El secreto de pruebas lo inyecta tests/setup/setup.js.

Usar tests/helpers/appProtegida.js como referencia para conectar middlewareAutenticacion. Las pruebas HTTP de pacientes deben ejercer sus propias rutas con el middleware real.

La lectura de C00 en upstream/main confirma que tests/setup/global-setup.js recrea la base de test y ejecuta node-pg-migrate up con migrations.config.js, configurado sobre todo db/migrations/. tests/setup permanece bajo responsabilidad de Agustina. Durante Apply se verifica la ejecución con la migración de C03.

La restricción de unicidad permanece garantizada en PostgreSQL. Para priorizar la entrega, las pruebas de C03 cubren el duplicado secuencial y prescinden de una prueba específica de altas concurrentes.

## Risks / Trade-offs

- Cambios posteriores en C00. Revisar compatibilidad al integrar nuevas versiones de main.
- Disponibilidad local de unaccent. Verificar su creación mediante el runner y una búsqueda con datos ficticios.
- Emails equivalentes por mayúsculas. Normalizar en el servicio y garantizar unicidad con el índice de PostgreSQL.
- Consultas parciales costosas con crecimiento de datos. Mantener el alcance inicial y evaluar paginación e índices cuando se conozca el volumen.
- Cruce de consultorios por una condición OR mal agrupada. Verificar aislamiento buscando por cada campo y por identificador.
- Migraciones de changes paralelos. Coordinar con la líder el orden de integración y respetar el rango reservado.

## Migration Plan

1. Después de la aprobación del spec y de C00 integrado en main, contrastar este diseño con el código y las convenciones reales de C00.
2. Crear una migración SQL en el rango 030–039 de C03. Coordinar la habilitación de unaccent para que tenga un único responsable.
3. Crear paciente, sus restricciones y los índices de negocio que incluyan consultorio_id.
4. Aplicar mediante el runner acordado y verificar tanto una base vacía con todas las migraciones como una base existente de desarrollo.
5. Ejecutar las pruebas y comprobar el comportamiento de alta y búsqueda.
6. Si una migración ya integrada requiere corrección, agregar una migración posterior preservando la anterior y los datos.

## UI Mockups

Decision: no (no UI)
## Verificaciones de integración con C00

La migración 001 no habilita unaccent. La migración propia de C03 debe ejecutar CREATE EXTENSION IF NOT EXISTS unaccent antes de usar la función.

Cada test o grupo de tests de C03 crea consultorios ficticios propios con UUID distintos. La limpieza elimina primero sus pacientes y después sus consultorios, siempre filtrando por sus identificadores. Evitar DELETE global y TRUNCATE sobre tablas compartidas.

La versión integrada de tests/esquema.test.js ya admite más migraciones y consulta y limpia únicamente su fixture. Pasó junto con las pruebas de pacientes. tests/setup permanece bajo responsabilidad de C00.

El cierre documental del setup se basa en lectura del código publicado. La verificación ejecutable con paciente y unaccent corresponde a Apply.

## Resultado del primer bloque de Apply

La migración 030 habilita unaccent y crea paciente con los campos del spec. Cada contacto informado debe contener un carácter distinto de espacio. La restricción conjunta exige al menos un contacto. El servicio normalizará los contactos ausentes a NULL.

Se eliminó activo por carecer de un caso de uso en C03 y el índice por nombre que no favorecía la búsqueda parcial. El UUID lo genera el servicio. La base conserva el índice único de email normalizado y el índice por consultorio y teléfono.

La disponibilidad de unaccent 1.1 en Neon PostgreSQL 18 fue verificada únicamente en la documentación oficial. Su funcionamiento en Neon queda pendiente del primer despliegue. Localmente, la extensión se creó mediante la migración y la prueba de tildes pasó.

La suite completa pasó 58 tests: 47 de C00 y 11 del esquema de pacientes. Los tres tests agregados por contactos en blanco y eliminación de activo fallaron primero y pasaron tras corregir la migración.

## Verify final de C03

Verificado el 22/11/2026, después de integrar upstream/main ff01d6c con C01, C02 y C04 (commit de integración 9b7d1fb).

Dos ejecuciones consecutivas finales de la suite completa mediante npm.cmd test, con reportero JSON, aprobaron 283 de 283 tests en 41 archivos cada una. Los reportes registran fecha y duración reales. Las dos ejecuciones anteriores con C02 y C04 habían aprobado 265 tests, antes de integrar C01.

### Cobertura revisada

- C03 aporta 60 tests, incluidos 11 de migración, 8 de existencia, 19 de alta, 21 de búsqueda y 1 de actualización de una base con C00 existente y reejecución del runner.
- El alta cubre cada rol según knowledge-base/03_actores_y_roles.md. ADMIN_CONSULTORIO y RECEPCION reciben 201 y ODONTOLOGO recibe 403.
- La búsqueda cubre nombres y apellidos parciales sin tildes ni mayúsculas, contactos normalizados, límite fijo de 50 y caracteres literales.
- El aislamiento cubre pacientes de otro consultorio y selección de consultorio por body, query y encabezados. Los repositorios reciben el consultorio autenticado y usan SQL parametrizado.
- La interfaz existePaciente comprueba pertenencia mediante ambos UUID, devuelve false ante paciente ajeno o inexistente y lanza ApiError 400 VALIDACION para identificadores inválidos.
- Los fixtures usan consultorios propios. Se revisaron los filtros de limpieza y el rollback. La suite con C02 y C04 pasó con archivos concurrentes; la verificación final con C01 pasó con fileParallelism: false, configuración incorporada por main.
- La documentación está en src/modules/pacientes/README.md. La interfaz fue publicada al equipo y su código está en la rama feature/C03-pacientes del fork de Leandro.

### Integración y archivos compartidos

El conflicto en src/app.js se resolvió conservando catálogo, prestaciones y pacientes. Frente al main integrado, C03 agrega exclusivamente su import y su app.use antes del manejador de errores.

La primera ejecución integrada detectó dos fallos de C02. tests/catalogo-migracion-runner.test.js esperaba únicamente 001 y 020 aunque ejecutaba todas las migraciones. Con autorización expresa de Leandro, se cambió la expectativa para cotejar el historial completo con los archivos SQL presentes. Se conservaron las verificaciones de datos, esquema y repetición. Las dos ejecuciones posteriores quedaron en verde.

package.json, package-lock.json, tests/setup y los helpers existentes coinciden con el main integrado. La revisión de formato mediante git diff --check pasó.

### Evidencias

- docs/evidencias/c03/migracion-rojo-original.txt
- docs/evidencias/c03/busqueda-rojo-original.txt
- docs/evidencias/c03/npm-test-final.txt, ejecución histórica de 107 tests antes de integrar C02 y C04.
- docs/evidencias/c03/integracion-main-1.json, diagnóstico inicial con dos fallos.
- docs/evidencias/c03/integracion-main-verificada-1.json
- docs/evidencias/c03/integracion-main-verificada-2.json
- docs/evidencias/c03/integracion-c01-verificada-1.json
- docs/evidencias/c03/integracion-c01-verificada-2.json
- docs/evidencias/c03/verify-integracion.txt, resumen fechado de las ejecuciones aprobadas.

### Hallazgos y límites

La auditoría recibida el 21/11/2026 informó tres vulnerabilidades moderadas en node-pg-migrate y sus dependencias glob y minimatch. Ese reporte no informó vulnerabilidades altas ni críticas. El tratamiento corresponde coordinarlo con el equipo responsable de C00. C03 conserva las dependencias acordadas.

unaccent 1.1 para PostgreSQL 18 en Neon está verificado solo en documentación. Su ejecución en Neon se comprobará durante el primer despliegue. Las pruebas de PostgreSQL local sí ejecutan la extensión.

Esta verificación corresponde al backend local. El PR requiere revisión de Agustina antes de la integración a main. El archivado del change queda para el cierre posterior del flujo.

# Tasks

Apply autorizado expresamente por Agustina el 24/11/2026 tras el RED y la suite base 458/458 sobre 5e0f581. Contrato de PR #22 incorporado en 7dcdcd1 (solo documentación respecto de esa base). C05 archivado y C06 con 071, sin 110. Los 421 tests de 666dbc7 se conservan solo como historia. No se agregan migraciones.

## 1. Base y dominio de agenda

- [x] 1.1 Confirmar C05 archivado y su spec final en main, el revert integrado y la ausencia de la 110. Reconciliar C08 y obtener aprobación de Agustina antes de Apply; después actualizar la rama y ejecutar npm.cmd test. Guardar reporte con fecha y SHA completo y verificar todos los tests de la base final, sin fijar la cantidad histórica de 421.
- [x] 1.2 Tras aprobación y base verificada, escribir primero el test HTTP de aislamiento y sus fixtures ficticios de dos consultorios en PostgreSQL real, con tokens válidos. Ejecutarlo esperando 200 y guardar RED genuino por 404 del endpoint inexistente ANTES de implementar la consulta; comprobar que falla por ese motivo y no por setup o autenticación.
- [x] 1.3 Escribir primero los tests de parámetros de agenda en tests/agenda-ruta.test.js y observar fallos genuinos por HTTP. Implementar validación de rango, fechas reales con zona, UUID y paginación en agenda-dominio.js; verificar los tests de fechas inválidas, límites y duración máxima.
- [x] 1.4 Iniciar src/modules/turnos/AGENDA.md con parámetros, ejemplos diarios/semanales y errores del dominio. Verificar que cada ejemplo coincide con un caso probado.

## 2. Interfaz mínima de pacientes

- [x] 2.1 Escribir tests con PostgreSQL real para obtenerNombresPacientes en tests/pacientes-agenda-lectura.test.js: array vacío, nombres propios, IDs ajenos/inexistentes, duplicados, UUID inválido y máximo de 200 IDs. Guardar el fallo inicial antes de implementar.
- [x] 2.2 Implementar la interfaz en archivos agenda-lectura.js y agenda-repositorio.js del módulo pacientes y exportarla por index.js. Verificar los tests del punto anterior, el filtro de consultorio y la ausencia de contactos en los resultados.
- [x] 2.3 Documentar firma, límites y resultado de la interfaz en AGENDA.md. Verificar que los ejemplos reproducen la respuesta real y que existePaciente mantiene sus tests originales.

## 3. Lectura de turnos y permisos

- [x] 3.1 Reutilizar los fixtures ficticios propios del RED inicial en tests/fixtures/agenda.js sin editar tests/helpers. Verificar por test que limpiar A conserva los registros de B y que la limpieza borra únicamente IDs propios.
- [x] 3.2 Escribir escenarios de repositorio y HTTP para rango diario/semanal, extremos [), cruce de medianoche, estados y paginación. Implementar agenda-repositorio.js sobre turno con parámetros y verificar resultados ordenados y páginas sin pérdida con datos estables.
- [x] 3.3 Escribir tests por rol y por vínculo profesional. Implementar agenda-servicios.js usando profesionalDeUsuario y existeProfesional de catálogo, con los nombres desde pacientes; verificar agenda propia, filtro ajeno/inexistente, ficha inactiva y odontólogo sin vínculo.
- [x] 3.4 Documentar en AGENDA.md el DTO, el orden y la limitación de paginación ante escrituras concurrentes. Verificar los ejemplos con los escenarios implementados.

## 4. HTTP y aislamiento

- [x] 4.1 Implementar crearRouterAgenda en agenda-rutas.js con el middleware real C00 y montarlo con solo dos líneas en app.js. Verificar mediante Supertest el 200 real, el 401 uniforme y el formato central de errores.
- [x] 4.2 Sobre el test de aislamiento con RED registrado en 1.2, comprobar GREEN con resultados propios no vacíos y exclusión mutua de nombres e IDs de ambos consultorios, más la separación de profesionales del mismo consultorio. No usar mocks ni datos de personas reales.
- [x] 4.3 Probar sustitución de consultorio y usuario por query, body y headers, parámetros repetidos y fallos inesperados. Verificar respuestas 400/403/404/500 acordadas, ausencia de datos ajenos y ninguna modificación de turnos por GET.
- [x] 4.4 Completar AGENDA.md con respuesta plana y pacienteApellido null, autenticación y códigos HTTP; comprobar PROFESIONAL_NO_ENCONTRADO en la tabla del README de turnos. Verificar el contrato contra el spec aprobado y comunicarlo a C09, sin presentar un borrador como congelado.

## 5. Verify integrado

- [x] 5.1 Ejecutar npm.cmd test completo sobre el main integrado y guardar evidencia roja y verde original de C08. Verificar cero fallos y registrar fecha, cantidad real, base y archivos modificados.
- [x] 5.2 Ejecutar openspec.cmd validate c08-consulta-agenda --strict y git diff --check. Verificar que C08 solo añade dos líneas a app.js, no añade migraciones ni DDL sobre turno y conserva package.json, tests/setup, helpers y migraciones ajenas frente al main integrado; 080–089 permanece sin usar.
- [x] 5.3 Revisar escenario por escenario el spec y documentar Verify en design.md. Verificar que cada requisito tiene evidencia y dejar explícita cualquier limitación antes del PR de implementación.

## Workflow follow-up

- Solicitar revisión del spec antes de Apply; compartir con Gero el contrato aprobado de C08 para C09.
- Preparar commits convencionales y PR de implementación tras tests en verde, con la autorización de publicación del usuario.
- Agustina revisa e integra por PR; no mergear automáticamente a main.
- Archivar el change mediante OpenSpec tras la verificación y revisión correspondientes, sincronizando únicamente agenda.
- No archivar ni cambiar los estados de C03 o C05 como efecto lateral de C08.

# C08 — Preparación autorizada del RED

Main exacto: 5e0f581846c241bd25c5e242ac881be81264bb44
Rama local: feature/C08-red-aislamiento
C05 archivado en openspec/changes/archive/2026-11-24-c05-crear-turno-sin-solapamientos/.
Esquema: 001, 010, 020, 030, 040, 050, 070 y 071; sin 110.

## Suite base, antes de escribir el test C08

Inicio: 2026-11-24 19:51:42 -03:00
Resultado: 458/458 tests aprobados, 49 archivos, cero fallos.
Comando: npm.cmd test -- --reporter=json --outputFile=<reporte temporal>
Reporte original: main-previo-red-5e0f581.json
La rama estaba limpia y HEAD era el main indicado al ejecutar la suite.

## RED genuino posterior

Inicio: 2026-11-24 19:54:37 -03:00
Test: tests/agenda-aislamiento.test.js
SHA256 del test: 51FCD35819CF277D58C0BE6E3055D6AAE959F9D94981C2D8140C38BECE08D7A7
Comando: npm.cmd test -- tests/agenda-aislamiento.test.js --reporter=verbose --reporter=json --outputFile.json=docs/evidencias/c08/aislamiento-red.json
Exit de Vitest: 1. Resultado: un test fallido.

Preparación: dos consultorios persistidos en PostgreSQL real de test, cada uno con usuario, paciente, profesional, box, prestación y turno ficticios. Los helpers existentes se importan sin modificarse y limpian únicamente sus fixtures en finally.
Validación previa HTTP de tokens y datos: GET /api/pacientes devuelve [200,200], con el paciente propio en cada respuesta.
Consultas HTTP de agenda realizadas para AMBOS consultorios: [404,404].
Aserción del contrato: esperaba [200,200] y recibió [404,404]. No se espera 404 para convertir el test en verde.
Las aserciones siguientes exigen resultados propios no vacíos y exclusión de los nombres e IDs ajenos para el futuro GREEN.
Salida original: aislamiento-red.txt. Reporte original: aislamiento-red.json.

## Límite de autorización

Solo se escribió el test y se guardó evidencia. No se implementó la consulta, no se alteró src/app.js, producción, migraciones, tests/setup ni helpers. No se afirma GREEN ni Verify de C08. La suite base pasó antes del test nuevo; al agregar este test la suite contiene intencionalmente un fallo pendiente.
Test y evidencia nuevos se mantienen locales, sin commit ni push en esta etapa. No mergear un RED como funcionalidad terminada. Falta autorización expresa de Agustina para implementar la consulta.
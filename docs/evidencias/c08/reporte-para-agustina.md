# C08 — RED y GREEN originales para revisión

Apply autorizado por Agustina el 24/11/2026. Main integrado: 7dcdcd1304bec09079206cacb8731ce9627ee466. Suite previa al commit con implementación local: 505/505 tests, 54 archivos, cero fallos. Salida completa en suite-completa-green.txt y JSON homónimo. El SHA del commit resultante y su verificación se entregan en el PR.

El test de aislamiento original no se modificó: SHA256 51FCD35819CF277D58C0BE6E3055D6AAE959F9D94981C2D8140C38BECE08D7A7. No se modificaron aserciones para conseguir GREEN. Antes del RED válido de tanda 1 se corrigió solo un dato de preparación del test nuevo: se eliminó un crearRecursos innecesario que repetía un nombre único. Se conserva ese diagnóstico original en tanda1-red.txt y su JSON.

Las secciones siguientes son salidas crudas, sin sustituir resultados. Los datos y UUID de fixtures son ficticios. Archive y merge a main quedan pendientes de revisión.

## Tanda 1 — RED válido

```text

> odontologia-api@0.1.0 test
> node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/agenda-ruta.test.js tests/agenda-aislamiento.test.js tests/pacientes-agenda-lectura.test.js --reporter=verbose --reporter=json --outputFile.json=docs/evidencias/c08/tanda1-red-valido.json


 RUN  v5.1.1 C:/Users/Tecno booster/Desktop/sistema-odontologico

 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > devuelve el contrato vacío y los límites UTC 259ms
   → expected 404 to be 200 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin hasta 12ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin desde 7ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin zona 7ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza día imposible 6ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza mes imposible 6ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza hora imposible 6ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza rango vacío 5ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza rango invertido 7ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza más de 168 horas 5ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza UUID inválido 8ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza parámetro ajeno 5ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza fecha repetida 7ms
   → expected 404 to be 400 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza fecha estructurada 5ms
   → expected 404 to be 400 // Object.is equality
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token ausente con el error uniforme 7ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token expirado con el error uniforme 5ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token forjado con el error uniforme 6ms
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > aplica intersección [) y conserva turno cruzando medianoche 122ms
   → expected 404 to be 200 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > acepta la semana y omite el turno del lunes siguiente 204ms
   → expected 404 to be 200 // Object.is equality
 × tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > incluye cancelados y muestra el nuevo horario tras reprogramar 193ms
   → expected 404 to be 200 // Object.is equality
 × tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > resuelve vacío, deduplica y devuelve solo nombres con apellido null 229ms
   → obtenerNombresPacientes is not a function
 × tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > omite pacientes ajenos e inexistentes 161ms
   → obtenerNombresPacientes is not a function
 × tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 1ms
   → obtenerNombresPacientes is not a function
 × tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 1ms
   → obtenerNombresPacientes is not a function
 × tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 0ms
   → obtenerNombresPacientes is not a function
 × tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 0ms
   → obtenerNombresPacientes is not a function
stdout | tests/agenda-aislamiento.test.js > C08: dos consultorios consultan su agenda por HTTP sin compartir turnos ni nombres
C08 aislamiento: {"consultoriosPersistidos":2,"pacientesHTTP":[200,200],"agendaHTTP":[404,404]}

 × tests/agenda-aislamiento.test.js > C08: dos consultorios consultan su agenda por HTTP sin compartir turnos ni nombres 427ms
   → Agenda debe existir para ambos consultorios: expected [ 404, 404 ] to deeply equal [ 200, 200 ]

⎯⎯⎯⎯⎯⎯ Failed Tests 24 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/agenda-aislamiento.test.js > C08: dos consultorios consultan su agenda por HTTP sin compartir turnos ni nombres
AssertionError: Agenda debe existir para ambos consultorios: expected [ 404, 404 ] to deeply equal [ 200, 200 ]

- Expected
+ Received

  [
-   200,
-   200,
+   404,
+   404,
  ]

 ❯ rol tests/agenda-aislamiento.test.js:66:10
     64|       // Esperar el contrato final (200), no 404: el fallo es genuino.
     65|       expect([agendaA.status, agendaB.status], 'Agenda debe existir pa…
     66|         .toEqual([200, 200]);
       |          ^
     67|       expect(agendaA.body.turnos).toEqual([expect.objectContaining({
     68|         id: turnoA.id,
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ rol tests/agenda-aislamiento.test.js:11:5
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ tests/agenda-aislamiento.test.js:10:3

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/9]⎯

 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > devuelve el contrato vacío y los límites UTC
AssertionError: expected 404 to be 200 // Object.is equality

- Expected
+ Received

- 200
+ 404

 ❯ tests/agenda-ruta.test.js:15:26
     13|     await conFixtureTurnos(async ({ token }) => {
     14|       const res = await consultar(rango, token);
     15|       expect(res.status).toBe(200);
       |                          ^
     16|       expect(res.body).toEqual({
     17|         desde: '2026-12-01T03:00:00.000Z', hasta: '2026-12-02T03:00:00…
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ tests/agenda-ruta.test.js:13:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/9]⎯

 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin hasta
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin desde
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin zona
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza día imposible
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza mes imposible
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza hora imposible
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza rango vacío
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza rango invertido
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza más de 168 horas
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza UUID inválido
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza parámetro ajeno
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza fecha repetida
 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza fecha estructurada
AssertionError: expected 404 to be 400 // Object.is equality

- Expected
+ Received

- 400
+ 404

 ❯ tests/agenda-ruta.test.js:39:24
     37|   ])('rechaza %s', async (_caso, query) => {
     38|     const res = await consultar(query);
     39|     expect(res.status).toBe(400);
       |                        ^
     40|     expect(res.body.error.code).toBe('VALIDACION');
     41|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/9]⎯

 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > aplica intersección [) y conserva turno cruzando medianoche
AssertionError: expected 404 to be 200 // Object.is equality

- Expected
+ Received

- 200
+ 404

 ❯ tests/agenda-ruta.test.js:64:26
     62|       await crearTurnoPartida(fixture, { inicio: '2026-12-02T03:00:00Z…
     63|       const res = await consultar(rango, token);
     64|       expect(res.status).toBe(200);
       |                          ^
     65|       expect(res.body.turnos.map(({ id }) => id)).toEqual([cruza.id]);
     66|     });
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ tests/agenda-ruta.test.js:55:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/9]⎯

 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > acepta la semana y omite el turno del lunes siguiente
AssertionError: expected 404 to be 200 // Object.is equality

- Expected
+ Received

- 200
+ 404

 ❯ tests/agenda-ruta.test.js:74:26
     72|       await crearTurnoPartida(fixture, { inicio: '2026-12-07T03:00:00Z…
     73|       const res = await consultar({ desde: '2026-11-30T00:00:00-03:00'…
     74|       expect(res.status).toBe(200);
       |                          ^
     75|       expect(res.body.turnos.map(({ id }) => id)).toEqual([dentro.id]);
     76|     });
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ tests/agenda-ruta.test.js:70:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/9]⎯

 FAIL  tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > incluye cancelados y muestra el nuevo horario tras reprogramar
AssertionError: expected 404 to be 200 // Object.is equality

- Expected
+ Received

- 200
+ 404

 ❯ tests/agenda-ruta.test.js:87:26
     85|       expect(cambio.status).toBe(200);
     86|       const res = await consultar(rango, token);
     87|       expect(res.status).toBe(200);
       |                          ^
     88|       expect(res.body.turnos).toEqual([
     89|         expect.objectContaining({ id: cancelado.id, estado: 'CANCELADO…
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ tests/agenda-ruta.test.js:80:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/9]⎯

 FAIL  tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > resuelve vacío, deduplica y devuelve solo nombres con apellido null
TypeError: obtenerNombresPacientes is not a function
 ❯ tests/pacientes-agenda-lectura.test.js:10:30
      8|     await conFixtureTurnos(async ({ fixture }) => {
      9|       const contexto = { consultorioId: fixture.consultorioId };
     10|       expect(await pacientes.obtenerNombresPacientes({ ...contexto, pa…
       |                              ^
     11|       const filas = await pacientes.obtenerNombresPacientes({
     12|         ...contexto, pacienteIds: [fixture.pacienteId, fixture.pacient…
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:18
 ❯ tests/pacientes-agenda-lectura.test.js:8:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/9]⎯

 FAIL  tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > omite pacientes ajenos e inexistentes
TypeError: obtenerNombresPacientes is not a function
 ❯ tests/pacientes-agenda-lectura.test.js:21:39
     19|     await conFixtureTurnos(async ({ fixture: a }) => {
     20|       await conFixtureTurnos(async ({ fixture: b }) => {
     21|         const filas = await pacientes.obtenerNombresPacientes({
       |                                       ^
     22|           consultorioId: a.consultorioId, pacienteIds: [a.pacienteId, …
     23|         });
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:18
 ❯ tests/pacientes-agenda-lectura.test.js:20:7
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ tests/pacientes-agenda-lectura.test.js:19:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/9]⎯

 FAIL  tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos
 FAIL  tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos
 FAIL  tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos
 FAIL  tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos
TypeError: obtenerNombresPacientes is not a function
 ❯ tests/pacientes-agenda-lectura.test.js:35:28
     33|     { consultorioId: randomUUID(), pacienteIds: Array.from({ length: 2…
     34|   ])('rechaza parámetros inválidos', async (parametros) => {
     35|     await expect(pacientes.obtenerNombresPacientes(parametros))
       |                            ^
     36|       .rejects.toMatchObject({ statusCode: 400, code: 'VALIDACION' });
     37|   });

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/9]⎯


 Test Files  3 failed (3)
      Tests  24 failed | 3 passed (27)
   Start at  20:02:32
   Duration  5.39s (tests 52%, import 29%, setup 12%, transform 6%, worker 1%)

    Isolate  3 workers spawned · ~208ms startup each (spawn + environment, per file)
             at least ~416ms faster with isolate: false — reuses workers across files instead of one per file

JSON report written to C:/Users/Tecno booster/Desktop/sistema-odontologico/docs/evidencias/c08/tanda1-red-valido.json

```

## Tanda 1 — GREEN

```text

> odontologia-api@0.1.0 test
> node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/agenda-ruta.test.js tests/agenda-aislamiento.test.js tests/pacientes-agenda-lectura.test.js --reporter=verbose --reporter=json --outputFile.json=docs/evidencias/c08/tanda1-green.json


 RUN  v5.1.1 C:/Users/Tecno booster/Desktop/sistema-odontologico

 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > devuelve el contrato vacío y los límites UTC 303ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin hasta 13ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin desde 9ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin zona 6ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza día imposible 7ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza mes imposible 6ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza hora imposible 7ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza rango vacío 6ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza rango invertido 9ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza más de 168 horas 6ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza UUID inválido 9ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza parámetro ajeno 9ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza fecha repetida 15ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza fecha estructurada 11ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token ausente con el error uniforme 10ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token expirado con el error uniforme 14ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token forjado con el error uniforme 8ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > aplica intersección [) y conserva turno cruzando medianoche 346ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > acepta la semana y omite el turno del lunes siguiente 194ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > incluye cancelados y muestra el nuevo horario tras reprogramar 376ms
stdout | tests/agenda-aislamiento.test.js > C08: dos consultorios consultan su agenda por HTTP sin compartir turnos ni nombres
C08 aislamiento: {"consultoriosPersistidos":2,"pacientesHTTP":[200,200],"agendaHTTP":[200,200]}

 ✓ tests/agenda-aislamiento.test.js > C08: dos consultorios consultan su agenda por HTTP sin compartir turnos ni nombres 681ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > resuelve vacío, deduplica y devuelve solo nombres con apellido null 155ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > omite pacientes ajenos e inexistentes 202ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 3ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 0ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 0ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 0ms

 Test Files  3 passed (3)
      Tests  27 passed (27)
   Start at  20:03:53
   Duration  6.15s (tests 60%, import 24%, setup 9%, transform 6%, worker 1%)

    Isolate  3 workers spawned · ~206ms startup each (spawn + environment, per file)
             at least ~412ms faster with isolate: false — reuses workers across files instead of one per file

JSON report written to C:/Users/Tecno booster/Desktop/sistema-odontologico/docs/evidencias/c08/tanda1-green.json

```

## Tanda 2 — RED

```text

> odontologia-api@0.1.0 test
> node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/agenda-permisos.test.js --reporter=verbose --reporter=json --outputFile.json=docs/evidencias/c08/tanda2-red.json


 RUN  v5.1.1 C:/Users/Tecno booster/Desktop/sistema-odontologico

 × tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > RECEPCION ve todas sus agendas y puede filtrar 665ms
   → expected [ …(2) ] to deeply equal [ Array(1) ]
 × tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > ADMIN_CONSULTORIO ve todas sus agendas y puede filtrar 761ms
   → expected [ …(2) ] to deeply equal [ Array(1) ]
 × tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > filtro administrativo ajeno o inexistente da el mismo 404 360ms
   → expected [ 200, 200 ] to deeply equal [ 404, 404 ]
 × tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > odontólogo usa profesionalDeUsuario y ve solo su agenda, también inactiva 196ms
   → expected 403 to be 200 // Object.is equality
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > odontólogo no puede consultar otra ficha propia, ajena o inexistente 307ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > odontólogo sin vínculo recibe 403 286ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > ignora contexto de body/headers y rechaza suplantación por query 519ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > limpiar A conserva consultorio y turnos de B 269ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > un fallo de la interfaz de pacientes no filtra detalles ni datos parciales 329ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 4 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > RECEPCION ve todas sus agendas y puede filtrar
AssertionError: expected [ …(2) ] to deeply equal [ Array(1) ]

- Expected
+ Received

  [
+   "e2335e46-57ba-49aa-af79-8dd98f529e9a",
    "e4e58b06-f6a7-4569-8db1-6001ddccac1d",
  ]

 ❯ rolA.rolA tests/agenda-permisos.test.js:35:56
     33|       const filtrada = await consultar(tokenA, { profesionalId: segund…
     34|       expect(filtrada.status).toBe(200);
     35|       expect(filtrada.body.turnos.map(({ id }) => id)).toEqual([segund…
       |                                                        ^
     36|       await a.consultar('UPDATE profesional SET activo = FALSE WHERE i…
     37|         [segundo.id, a.consultorioId]);
 ❯ rol tests/fixtures/agenda.js:15:7
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ rol tests/fixtures/agenda.js:6:5
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ conDosAgendas tests/fixtures/agenda.js:5:3
 ❯ tests/agenda-permisos.test.js:24:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > ADMIN_CONSULTORIO ve todas sus agendas y puede filtrar
AssertionError: expected [ …(2) ] to deeply equal [ Array(1) ]

- Expected
+ Received

  [
+   "4b0f84ce-10e1-426d-87d1-f5c06da6342b",
    "bfdb493b-45a1-40e9-bb33-d219f5447d0a",
  ]

 ❯ rolA.rolA tests/agenda-permisos.test.js:35:56
     33|       const filtrada = await consultar(tokenA, { profesionalId: segund…
     34|       expect(filtrada.status).toBe(200);
     35|       expect(filtrada.body.turnos.map(({ id }) => id)).toEqual([segund…
       |                                                        ^
     36|       await a.consultar('UPDATE profesional SET activo = FALSE WHERE i…
     37|         [segundo.id, a.consultorioId]);
 ❯ rol tests/fixtures/agenda.js:15:7
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ rol tests/fixtures/agenda.js:6:5
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ conDosAgendas tests/fixtures/agenda.js:5:3
 ❯ tests/agenda-permisos.test.js:24:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > filtro administrativo ajeno o inexistente da el mismo 404
AssertionError: expected [ 200, 200 ] to deeply equal [ 404, 404 ]

- Expected
+ Received

  [
-   404,
-   404,
+   200,
+   200,
  ]

 ❯ tests/agenda-permisos.test.js:48:46
     46|       const ajena = await consultar(tokenA, { profesionalId: b.profesi…
     47|       const ausente = await consultar(tokenA, { profesionalId: randomU…
     48|       expect([ajena.status, ausente.status]).toEqual([404, 404]);
       |                                              ^
     49|       expect(ajena.body.error.code).toBe('PROFESIONAL_NO_ENCONTRADO');
     50|       expect(ajena.body).toEqual(ausente.body);
 ❯ rol tests/fixtures/agenda.js:15:7
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ rol tests/fixtures/agenda.js:6:5
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ conDosAgendas tests/fixtures/agenda.js:5:3
 ❯ tests/agenda-permisos.test.js:45:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > odontólogo usa profesionalDeUsuario y ve solo su agenda, también inactiva
AssertionError: expected 403 to be 200 // Object.is equality

- Expected
+ Received

- 200
+ 403

 ❯ rolA tests/agenda-permisos.test.js:65:30
     63|         for (const extra of [{}, { profesionalId: a.profesionalId }]) {
     64|           const res = await consultar(tokenA, extra);
     65|           expect(res.status).toBe(200);
       |                              ^
     66|           expect(res.body.turnos.map(({ id }) => id)).toEqual([turnoA.…
     67|         }
 ❯ rol tests/fixtures/agenda.js:15:7
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ rol tests/fixtures/agenda.js:6:5
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ conDosAgendas tests/fixtures/agenda.js:5:3
 ❯ tests/agenda-permisos.test.js:56:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯


 Test Files  1 failed (1)
      Tests  4 failed | 5 passed (9)
   Start at  20:06:46
   Duration  6.28s (tests 83%, import 10%, transform 4%, setup 3%)

JSON report written to C:/Users/Tecno booster/Desktop/sistema-odontologico/docs/evidencias/c08/tanda2-red.json

```

## Tanda 2 — GREEN

```text

> odontologia-api@0.1.0 test
> node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/agenda-permisos.test.js tests/agenda-ruta.test.js tests/agenda-aislamiento.test.js tests/pacientes-agenda-lectura.test.js --reporter=verbose --reporter=json --outputFile.json=docs/evidencias/c08/tanda2-green.json


 RUN  v5.1.1 C:/Users/Tecno booster/Desktop/sistema-odontologico

 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > RECEPCION ve todas sus agendas y puede filtrar 842ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > ADMIN_CONSULTORIO ve todas sus agendas y puede filtrar 878ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > filtro administrativo ajeno o inexistente da el mismo 404 184ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > odontólogo usa profesionalDeUsuario y ve solo su agenda, también inactiva 582ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > odontólogo no puede consultar otra ficha propia, ajena o inexistente 415ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > odontólogo sin vínculo recibe 403 293ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > ignora contexto de body/headers y rechaza suplantación por query 500ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > limpiar A conserva consultorio y turnos de B 274ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > un fallo de la interfaz de pacientes no filtra detalles ni datos parciales 345ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > devuelve el contrato vacío y los límites UTC 183ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin hasta 7ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin desde 8ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin zona 5ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza día imposible 21ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza mes imposible 6ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza hora imposible 7ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza rango vacío 6ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza rango invertido 7ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza más de 168 horas 11ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza UUID inválido 7ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza parámetro ajeno 5ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza fecha repetida 6ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza fecha estructurada 5ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token ausente con el error uniforme 7ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token expirado con el error uniforme 4ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token forjado con el error uniforme 4ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > aplica intersección [) y conserva turno cruzando medianoche 192ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > acepta la semana y omite el turno del lunes siguiente 293ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > incluye cancelados y muestra el nuevo horario tras reprogramar 286ms
stdout | tests/agenda-aislamiento.test.js > C08: dos consultorios consultan su agenda por HTTP sin compartir turnos ni nombres
C08 aislamiento: {"consultoriosPersistidos":2,"pacientesHTTP":[200,200],"agendaHTTP":[200,200]}

 ✓ tests/agenda-aislamiento.test.js > C08: dos consultorios consultan su agenda por HTTP sin compartir turnos ni nombres 618ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > resuelve vacío, deduplica y devuelve solo nombres con apellido null 178ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > omite pacientes ajenos e inexistentes 237ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 3ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 1ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 0ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 0ms

 Test Files  4 passed (4)
      Tests  36 passed (36)
   Start at  20:07:22
   Duration  10.98s (tests 74%, import 16%, setup 6%, transform 3%)

    Isolate  4 workers spawned · ~219ms startup each (spawn + environment, per file)
             at least ~657ms faster with isolate: false — reuses workers across files instead of one per file

JSON report written to C:/Users/Tecno booster/Desktop/sistema-odontologico/docs/evidencias/c08/tanda2-green.json

```

## Tanda 3 — RED

```text

> odontologia-api@0.1.0 test
> node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/agenda-paginacion.test.js --reporter=verbose --reporter=json --outputFile.json=docs/evidencias/c08/tanda3-red.json


 RUN  v5.1.1 C:/Users/Tecno booster/Desktop/sistema-odontologico

 × tests/agenda-paginacion.test.js > C08 tanda 3: paginación > recorre páginas con orden estable, sin duplicados y con metadata exacta 350ms
   → expected [ …(3) ] to deeply equal [ …(2) ]
 × tests/agenda-paginacion.test.js > C08 tanda 3: paginación > usa 100 por defecto y permite máximo 200 sin perder la fila adicional 408ms
   → expected [ …(100) ] to deeply equal [ …(200) ]
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"limite":"0"} 7ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"limite":"201"} 6ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"limite":"1.5"} 9ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"limite":"texto"} 5ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"offset":"-1"} 5ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"offset":"0.5"} 5ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"offset":"10001"} 6ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"limite":["1","2"]} 5ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"offset":["0","1"]} 4ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/agenda-paginacion.test.js > C08 tanda 3: paginación > recorre páginas con orden estable, sin duplicados y con metadata exacta
AssertionError: expected [ …(3) ] to deeply equal [ …(2) ]

- Expected
+ Received

  [
    "aaaaaaaa-0000-4000-8000-000000000001",
    "bbbbbbbb-0000-4000-8000-000000000002",
+   "cccccccc-0000-4000-8000-000000000003",
  ]

 ❯ tests/agenda-paginacion.test.js:38:55
     36|       const pagina1 = await consultar(token, { limite: '2' });
     37|       expect(pagina1.status).toBe(200);
     38|       expect(pagina1.body.turnos.map(({ id }) => id)).toEqual([ids[1],…
       |                                                       ^
     39|       expect(pagina1.body.hayMas).toBe(true);
     40|       expect(pagina1.body.siguienteOffset).toBe(2);
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ tests/agenda-paginacion.test.js:29:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  tests/agenda-paginacion.test.js > C08 tanda 3: paginación > usa 100 por defecto y permite máximo 200 sin perder la fila adicional
AssertionError: expected [ …(100) ] to deeply equal [ …(200) ]

- Expected
+ Received

@@ -97,106 +97,6 @@
    "857c8332-f10f-49e4-9408-50b13e00a381",
    "85e24e7f-5371-4a7e-8e72-edd334f2ef44",
    "87f85179-16a5-4c3c-b3fe-2444c4607bb0",
    "8858d0ef-0dad-4d5e-af6e-85031be8f9f1",
    "88a3b949-9ac4-4e75-b15f-158bcf12a3e3",
-   "88e1061d-41dc-4539-8d5f-d70bccdb1a12",
-   "893b9130-82b2-458b-82e5-d4772f241464",
-   "89737ef0-34fd-4aa0-96ff-1bfdf89ee903",
-   "8c2459f1-fdcf-48e3-b0e7-a47c7e03b2e9",
-   "8cb67c41-1b55-4ff7-8274-b3c10acfb82e",
-   "8ed10756-b324-4a8c-a243-ec3c4f2ae091",
-   "911ecb28-3757-4359-9de9-11e8fd9eb416",
-   "916fb340-314b-4524-a496-060f5ca58186",
-   "93b7f1eb-4c8f-4f12-a9da-cf828e767cf3",
-   "94173341-705e-4f1c-b9e5-dd46c76a607e",
-   "941f9212-2ecc-4a39-b842-de3c1b74e894",
-   "95c75ade-5396-4add-a271-6c3b52e705ed",
-   "95dd5b52-0ba0-44e7-8c2e-a9b370730f39",
-   "95f588b9-86f4-47d4-9393-8a9aa24d14f0",
-   "96d9be11-1f5b-4850-bc6a-34e39d9ad730",
-   "98cf7fa5-ca85-4278-a71c-ad0468f96b19",
-   "9977ad0d-6cc8-4a0c-beee-7dd444d33f33",
-   "9a020869-0125-4ba6-91a2-0333774b7f19",
-   "9a02bb59-b965-48d4-8f6c-a22e37d9ebdf",
-   "9a3d89f0-bd42-46ed-a082-b008242f64e2",
-   "9a6b0dc1-0e5f-4c3f-ab98-6a7e007f5ac2",
-   "9c721c38-8692-4f9b-894b-a1dddac8d7e0",
-   "9cbdde9c-b2cb-4bb7-a5b1-82b7a930f49f",
-   "9e65dcfb-fbd8-4bc4-83ea-6ed0e729904a",
-   "9eaff625-4563-4fdf-93ab-695d71d07269",
-   "a189a175-2718-43a5-87d5-8e6836a49487",
-   "a284eb8c-c7bd-4b8d-8fdd-46f37739c294",
-   "a28bf604-ce27-47fe-bdb3-0ba8862799f4",
-   "a4d77a6f-473e-4285-a2d1-95a180431664",
-   "a62ed74a-8c45-4191-95dc-2bb69d959ae5",
-   "a681786d-dd27-45b9-ac0a-23ac6e925e84",
-   "a6ae75cb-ccc9-4991-97a0-8583158d5c2f",
-   "a71685ba-a1fe-46d0-99d2-1e61dc504e25",
-   "a8c8c36a-5396-4c7b-96e1-9d4a385b9a12",
-   "adbf9477-db31-411f-bd14-5e9c45f293a7",
-   "ae31523c-4184-4384-89fd-e4bf4fbd675b",
-   "ae3e0631-5264-43bd-9b03-f0a472a284b8",
-   "b0d3c4ee-89e9-4e91-8ecc-759990440276",
-   "b16cd326-05f2-400a-8a60-147f13940f83",
-   "b35e85c3-6f8d-4f47-bca3-f564a103df0a",
-   "b374691e-f12d-415b-a31a-b9b499fb132c",
-   "b59b3f88-1e0e-4001-beb1-b0c025b5f944",
-   "b6d9c65c-331c-4250-a7ff-db2d435ccb1b",
-   "b7af1813-852d-4d68-90b3-477a88037e7e",
-   "b9656161-462d-4e32-9cdc-20c9e4227aad",
-   "b9dcd616-2f03-42c6-94b2-ee0231d81783",
-   "ba34f5b3-477a-414d-9a9e-986a1db9fe40",
-   "bb1bdc10-3c4d-4e52-a0c5-4f592e399eb4",
-   "bc4c12e9-1813-41a4-98df-38f4f6631d7d",
-   "bcf9f6e5-6349-440e-a21d-b248101fc6cb",
-   "beb3ef40-b49a-4d02-9ba2-116335bada6a",
-   "bec336b9-d0e0-4406-a47b-12a268b34def",
-   "bf121245-890f-43b9-a5d2-54c592c035fb",
-   "c0400b85-0035-46bc-905b-ef404eaa40e2",
-   "c0501ae9-d5d1-44ef-859a-7675b52d8fd7",
-   "c0fdda22-79e3-4719-9e41-5ac2fbb7221d",
-   "c2d2d05b-f063-4bea-9b59-cd03e1af285b",
-   "c36bfab1-bb23-41a6-84b5-3ac6e047d3f4",
-   "c84737a7-506f-4b0a-91ab-d174e6adbadd",
-   "c87313fc-1a3f-486f-8427-5b9fc7072733",
-   "ca051c87-c1b4-46c6-8c0c-bf00f94fbc8a",
-   "cbdaa0ad-4394-4ca8-aacb-a99d04b66b60",
-   "cef9a31e-6e79-47b6-9039-1797f74fd727",
-   "d08b3d86-dd29-4628-aa9f-38fcd7a21326",
-   "d1053621-8a59-40a0-8349-92d6f25567e6",
-   "d511f145-cb36-4275-b4a3-9e16ea48f2ac",
-   "d7494cf6-583f-456f-90fe-8af92882637b",
-   "d8ad9dce-b715-4f79-94c7-a6b2a667c5b8",
-   "db5f3d17-79fd-48a1-97bf-6fe902d6e84f",
-   "db616619-22ad-4911-90aa-698b02527c3d",
-   "dbb4b283-adb1-4db3-b995-5fae0d0b1a61",
-   "dde8e18f-7836-482c-af71-5bb09004f6a6",
-   "ddec43e0-7f31-4efb-a116-4c7fdf183316",
-   "e08c8dc4-d42e-49f8-ad9c-03786f7a139d",
-   "e25e2697-09a0-43a3-8df1-d72253c17dde",
-   "e35edf00-88b7-40c1-b919-52b726b8f5ed",
-   "e3732ee5-2af9-41e0-b530-10a0ae09556d",
-   "e67481bf-2842-4250-9064-8d1f8f1fe721",
-   "e7c06067-5e93-4b14-8167-83059ac2bf51",
-   "e9733ca8-28c0-44a6-bd82-d61970b4219d",
-   "eacc31b9-2387-47c4-aa02-a528889d29d9",
-   "eb6db186-ab78-4cb5-bcf9-a05a0c3f505a",
-   "ebb08412-379e-4b4e-ba16-62ffc7bd9ae8",
-   "ef1ed24f-3924-4a92-bb43-740352c01a24",
-   "f09e654a-77e3-4705-81b5-ae3430765845",
-   "f108d632-284f-44a3-8566-b90090090793",
-   "f1520186-970d-4097-a42a-043d24fd6204",
-   "f24bf49e-ea4d-4296-9c29-547fe844ffcd",
-   "f2f4722c-0bea-468a-9450-2e270f13bb66",
-   "f3d0a33e-c5bb-42f9-9bfd-2673d42fc549",
-   "f5d3bfee-ad5a-4ed4-8145-3e996c3d2978",
-   "f661e567-e652-4eda-83d8-73a9573ce244",
-   "f66bcdb2-db0a-4128-9f5b-5c9cf1032c9f",
-   "f73dc222-9158-47b2-84e7-1d22306a71ca",
-   "f75b6825-f2fd-4b01-8cb7-1eae92bb48fe",
-   "f771d631-30de-4786-bd81-34915f156c4f",
-   "f7c78333-94bc-41cc-8c40-e7c0eadcf310",
-   "f8aff287-acc3-48a3-aaa5-9eccff01b1ec",
-   "fa70e384-c3b5-4012-a0a6-c5313836e4da",
-   "fb3892f5-35c5-44ad-b311-9999dc093eca",
  ]

 ❯ tests/agenda-paginacion.test.js:64:54
     62|       const maxima = await consultar(token, { limite: '200' });
     63|       expect(maxima.status).toBe(200);
     64|       expect(maxima.body.turnos.map(({ id }) => id)).toEqual([...ids].…
       |                                                      ^
     65|       expect(maxima.body.hayMas).toBe(true);
     66|       expect(maxima.body.siguienteOffset).toBe(200);
 ❯ conFixtureTurnos tests/helpers/turnos-fixtures.js:42:12
 ❯ tests/agenda-paginacion.test.js:55:5

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯


 Test Files  1 failed (1)
      Tests  2 failed | 9 passed (11)
   Start at  20:08:51
   Duration  3.28s (tests 51%, import 28%, transform 11%, setup 9%, worker 1%)

JSON report written to C:/Users/Tecno booster/Desktop/sistema-odontologico/docs/evidencias/c08/tanda3-red.json

```

## Tanda 3 — GREEN

```text

> odontologia-api@0.1.0 test
> node --env-file=.env ./node_modules/vitest/vitest.mjs run tests/agenda-ruta.test.js tests/agenda-aislamiento.test.js tests/agenda-permisos.test.js tests/agenda-paginacion.test.js tests/pacientes-agenda-lectura.test.js --reporter=verbose --reporter=json --outputFile.json=docs/evidencias/c08/tanda3-green.json


 RUN  v5.1.1 C:/Users/Tecno booster/Desktop/sistema-odontologico

 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > recorre páginas con orden estable, sin duplicados y con metadata exacta 632ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > usa 100 por defecto y permite máximo 200 sin perder la fila adicional 609ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"limite":"0"} 10ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"limite":"201"} 8ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"limite":"1.5"} 10ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"limite":"texto"} 7ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"offset":"-1"} 6ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"offset":"0.5"} 6ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"offset":"10001"} 6ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"limite":["1","2"]} 6ms
 ✓ tests/agenda-paginacion.test.js > C08 tanda 3: paginación > rechaza paginación inválida {"offset":["0","1"]} 5ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > RECEPCION ve todas sus agendas y puede filtrar 835ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > ADMIN_CONSULTORIO ve todas sus agendas y puede filtrar 924ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > filtro administrativo ajeno o inexistente da el mismo 404 189ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > odontólogo usa profesionalDeUsuario y ve solo su agenda, también inactiva 739ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > odontólogo no puede consultar otra ficha propia, ajena o inexistente 185ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > odontólogo sin vínculo recibe 403 167ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > ignora contexto de body/headers y rechaza suplantación por query 278ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > limpiar A conserva consultorio y turnos de B 270ms
 ✓ tests/agenda-permisos.test.js > C08 tanda 2: roles y contexto autenticado > un fallo de la interfaz de pacientes no filtra detalles ni datos parciales 235ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > devuelve el contrato vacío y los límites UTC 297ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin hasta 9ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin desde 8ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza sin zona 6ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza día imposible 6ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza mes imposible 5ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza hora imposible 5ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza rango vacío 5ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza rango invertido 5ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza más de 168 horas 5ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza UUID inválido 6ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza parámetro ajeno 5ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza fecha repetida 6ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza fecha estructurada 5ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token ausente con el error uniforme 4ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token expirado con el error uniforme 7ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > rechaza token forjado con el error uniforme 4ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > aplica intersección [) y conserva turno cruzando medianoche 321ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > acepta la semana y omite el turno del lunes siguiente 290ms
 ✓ tests/agenda-ruta.test.js > C08 tanda 1: ruta y parámetros > incluye cancelados y muestra el nuevo horario tras reprogramar 386ms
stdout | tests/agenda-aislamiento.test.js > C08: dos consultorios consultan su agenda por HTTP sin compartir turnos ni nombres
C08 aislamiento: {"consultoriosPersistidos":2,"pacientesHTTP":[200,200],"agendaHTTP":[200,200]}

 ✓ tests/agenda-aislamiento.test.js > C08: dos consultorios consultan su agenda por HTTP sin compartir turnos ni nombres 725ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > resuelve vacío, deduplica y devuelve solo nombres con apellido null 167ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > omite pacientes ajenos e inexistentes 420ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 3ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 1ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 1ms
 ✓ tests/pacientes-agenda-lectura.test.js > C08: interfaz mínima de nombres de pacientes > rechaza parámetros inválidos 0ms

 Test Files  5 passed (5)
      Tests  47 passed (47)
   Start at  20:09:18
   Duration  13.22s (tests 73%, import 18%, setup 6%, transform 2%)

    Isolate  5 workers spawned · ~215ms startup each (spawn + environment, per file)
             at least ~859ms faster with isolate: false — reuses workers across files instead of one per file

JSON report written to C:/Users/Tecno booster/Desktop/sistema-odontologico/docs/evidencias/c08/tanda3-green.json

```
# Tasks

Apply requiere la aprobación de Agustina y C00 integrado en main. El comportamiento está definido en specs/pacientes/spec.md y las decisiones técnicas en design.md.

## 1. Integración con C00

- [ ] 1.1 Contrastar el contrato de auth con C00 integrado. Verificar el import de middlewareAutenticacion, req.auth y los helpers mediante una prueba de autenticación con crearToken.
- [ ] 1.2 Confirmar por lectura y ejecución que la preparación de tests de C00 aplica todas las migraciones de db/migrations/. Conservar tests/setup bajo responsabilidad de C00 y comunicar cualquier incompatibilidad a Agustina.
- [ ] 1.3 Preparar rutas, servicios, dominio y repositorios de pacientes. Verificar sus imports y el montaje explícito del middleware en las rutas.

## 2. Migración e interfaz prioritaria para C05

- [ ] 2.1 Crear la migración de paciente en el rango 030–039 con los campos del spec, UUID y referencia a consultorio(id). Garantizar nombre y contacto obligatorios y un índice único por consultorio_id y lower(btrim(email)). Verificar restricciones con PostgreSQL de test.
- [ ] 2.2 Habilitar unaccent mediante CREATE EXTENSION IF NOT EXISTS unaccent en la migración propia de C03. Verificar su funcionamiento con tildes y que una base de test recién creada contiene paciente y las migraciones de C03.
- [ ] 2.3 Exportar existePaciente({ pacienteId, consultorioId }) desde src/modules/pacientes/index.js con resultado Promise<boolean>. Verificar paciente propio, paciente ajeno, identificador inexistente, ApiError 400 con code VALIDACION para UUID malformados y propagación de errores de base al manejador central.

## 3. Alta y normalización

- [ ] 3.1 Implementar alta con UUID generado en el servicio, limpieza de espacios, email en minúsculas y normalización de teléfono según el spec. Verificar alta con teléfono, alta con email, contactos vacíos, nombre vacío y teléfono inválido.
- [ ] 3.2 Implementar POST /api/pacientes con permisos basados en knowledge-base/03_actores_y_roles.md. Verificar 201, 422, 403 y el 401 uniforme de C00 mediante pruebas HTTP.
- [ ] 3.3 Traducir el email duplicado a 409. Verificar duplicados con diferentes mayúsculas en el mismo consultorio y el mismo email en consultorios diferentes.

## 4. Búsqueda y aislamiento

- [ ] 4.1 Implementar búsqueda parcial por nombre y apellido con unaccent e ILIKE y filtro de consultorio. Verificar José Álvarez encontrado por ALVAR, conservación de la escritura original y ausencia de coincidencias.
- [ ] 4.2 Implementar búsqueda exacta por teléfono normalizado y email recortado y en minúsculas. Verificar contactos con separadores, email con mayúsculas y que una búsqueda de nombre siga funcionando aunque no sea un teléfono válido.
- [ ] 4.3 Aplicar LIMIT 50 y orden por apellido ASC NULLS LAST, nombre e id. Verificar que 51 coincidencias devuelvan únicamente las primeras 50 y que el cliente no amplíe el máximo.
- [ ] 4.4 Implementar GET /api/pacientes?q=texto con permisos según la KB. Verificar acceso de recepción, administración y odontólogo, búsqueda vacía y solicitud sin autenticación.
- [ ] 4.5 Verificar mediante pruebas HTTP y de repositorio el aislamiento al buscar por cada campo y al enviar otro consultorio en body, query o encabezados. Comprobar también que los comodines se interpretan literalmente.

## 5. Documentación del módulo

- [ ] 5.1 Documentar alta, búsqueda y existePaciente en un único documento del módulo, incluyendo normalización, límite, permisos, errores y ejemplos ficticios. Verificar que los ejemplos coinciden con las pruebas y el contrato publicado para C05.

## 6. Verificación integrada

- [ ] 6.1 Ejecutar npm test y comprobar que todos los escenarios del spec pasan con PostgreSQL y datos ficticios.
- [ ] 6.2 Verificar las migraciones sobre una base vacía y una base con C00 aplicado. Comprobar que una segunda ejecución del runner conserva datos y reconoce las migraciones aplicadas.
- [ ] 6.3 Revisar el diff completo y registrar la evidencia de verificación para el PR de implementación.

## 7. Compatibilidad con la suite compartida

- [ ] 7.1 Coordinar con Agustina la corrección de tests/esquema.test.js para admitir todas las migraciones presentes y consultar y limpiar únicamente sus fixtures. Verificar el diff acordado y que el test pasa junto con las pruebas de pacientes.
- [ ] 7.2 Crear fixtures de C03 con consultorios ficticios propios y UUID distintos. Limpiar sus pacientes antes de sus consultorios mediante filtros específicos. Verificar que al limpiar un fixture se conservan los datos de otro consultorio.

## Workflow follow-up

- Publicar al equipo el contrato existePaciente({ pacienteId, consultorioId }) -> Promise<boolean> inmediatamente después de actualizar la planificación, para que C05 pueda preparar su integración.
- Enviar a Agustina el spec completo y solicitar revisión del PR actualizado antes de Apply.
- Presentar la implementación para revisión una vez verificada.
- Archivar el change mediante OpenSpec cuando se cumplan los requisitos del proyecto.

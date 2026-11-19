# Tasks

Apply requiere la aprobación de Agustina y C00 integrado en main. El comportamiento está definido en specs/pacientes/spec.md y las decisiones técnicas en design.md.

## 1. Integración con la base C00

- [ ] 1.1 Contrastar el contrato acordado con C00 integrado, comprobando el import de middlewareAutenticacion, req.auth, la conexión a PostgreSQL y los helpers de pruebas. Verificar mediante una prueba de autenticación con crearToken.
- [ ] 1.2 Preparar los archivos de rutas, servicios, dominio y repositorios del módulo pacientes. Verificar que sus imports funcionan y que las rutas protegidas montan el middleware.

## 2. Migración y datos

- [ ] 2.1 Crear la migración de paciente dentro del rango 030–039, con UUID, referencia a consultorio(id), campos mínimos, restricciones de nombre y contacto, unicidad de email por consultorio e índices acordados. Verificar su aplicación sobre PostgreSQL de test y el rechazo de datos que violen las restricciones.
- [ ] 2.2 Coordinar y habilitar unaccent mediante migración. Verificar su funcionamiento con texto ficticio que contenga tildes.
- [ ] 2.3 Comprobar que el setup de pruebas aplica la migración de C03 además de 001. Verificar que una base de test recién creada contiene paciente, sus restricciones y unaccent.

## 3. Alta de pacientes

- [ ] 3.1 Implementar la validación y el alta con UUID generado en el servicio, limpieza de espacios y contactos vacíos como NULL. Verificar con pruebas el alta con teléfono, el alta con email y los rechazos por nombre vacío o ausencia de contacto.
- [ ] 3.2 Implementar POST /api/pacientes con los permisos y respuestas del diseño. Verificar 201, 422, 403 y el 401 uniforme de C00 mediante pruebas HTTP con el middleware real.
- [ ] 3.3 Gestionar el email duplicado mediante la restricción de base y la respuesta 409. Verificar duplicados dentro del consultorio, el mismo email en consultorios diferentes y dos altas concurrentes.
- [ ] 3.4 Documentar el cuerpo y las respuestas del alta en la documentación del módulo. Verificar que los ejemplos con datos ficticios coinciden con las pruebas HTTP.

## 4. Búsqueda de pacientes

- [ ] 4.1 Implementar búsqueda parcial por nombre y apellido sin distinguir mayúsculas ni tildes, conservando la escritura original. Verificar José Álvarez encontrado por ALVAR y una búsqueda sin coincidencias.
- [ ] 4.2 Implementar búsqueda por teléfono o email completos, con SQL parametrizado, filtro de consultorio y orden estable. Verificar coincidencias por ambos contactos, comodines literales y exclusión de pacientes de otro consultorio.
- [ ] 4.3 Implementar GET /api/pacientes?q=texto con los permisos y respuestas del diseño. Verificar búsquedas por recepción, administración y odontólogo, rechazo de búsqueda vacía y rechazo de solicitudes sin autenticación.
- [ ] 4.4 Documentar los parámetros y respuestas de búsqueda. Verificar los ejemplos contra las pruebas HTTP.

## 5. Interfaz para turnos y aislamiento

- [ ] 5.1 Exponer la comprobación de existencia de paciente dentro del consultorio autenticado. Verificar un paciente propio y que un identificador ajeno produzca el mismo resultado negativo que uno inexistente.
- [ ] 5.2 Comprobar intentos de seleccionar otro consultorio mediante body, query y encabezados. Verificar que ninguna operación lea o escriba datos de ese otro consultorio.
- [ ] 5.3 Documentar la interfaz pública para C05 y comunicarla al equipo. Verificar que el contrato incluye identidad de paciente, contexto de consultorio y resultado esperado.

## 6. Verificación integrada

- [ ] 6.1 Ejecutar npm test y comprobar que todos los escenarios del spec pasan con PostgreSQL y datos ficticios.
- [ ] 6.2 Verificar las migraciones sobre una base vacía y sobre una base con C00 aplicado. Comprobar que una segunda ejecución del runner conserva datos y reconoce las migraciones aplicadas.
- [ ] 6.3 Revisar el diff completo de C03 y registrar la evidencia de verificación para el PR de implementación.

## Workflow follow-up

- Solicitar revisión del PR de planificación antes de Apply.
- Presentar la implementación para revisión una vez verificada.
- Archivar el change mediante OpenSpec cuando se cumplan los requisitos del proyecto.

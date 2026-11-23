# Spec Delta

## Purpose

Permitir consultar turnos para una agenda diaria o semanal, con nombres mínimos de pacientes y acceso limitado al consultorio autenticado y a la agenda autorizada para cada rol.

## ADDED Requirements

### Requirement: Consulta diaria y semanal por rango explícito

El sistema SHALL exponer `GET /api/agenda` con `desde` y `hasta` obligatorios en ISO 8601 con zona explícita. SHALL aceptar intervalos positivos de hasta 168 horas y seleccionar turnos que intersecten `[desde, hasta)`. SHALL devolver instantes UTC y `zonaHoraria: "America/Argentina/Buenos_Aires"` para que C09 presente el día o semana local (RN-AG-06).

#### Scenario: Agenda de un día argentino
- **GIVEN** recepción autenticada y un turno ficticio del 1 de diciembre de 2026 a las 10:00 de Buenos Aires
- **WHEN** consulta desde `2026-12-01T00:00:00-03:00` hasta `2026-12-02T00:00:00-03:00`
- **THEN** recibe 200 con el turno, su inicio UTC a las 13:00 y la zona horaria indicada

#### Scenario: Semana completa
- **WHEN** administración consulta desde el lunes `2026-11-30T00:00:00-03:00` hasta el lunes `2026-12-07T00:00:00-03:00`
- **THEN** recibe únicamente los turnos que intersectan esa semana y no el que comienza exactamente en el límite superior

#### Scenario: Turnos que cruzan medianoche
- **GIVEN** un turno que comienza antes de desde y termina después de desde, otro que termina exactamente en desde y otro que comienza exactamente en hasta
- **WHEN** consulta el rango válido
- **THEN** incluye solo el primer turno de esos tres, sin duplicarlo dentro de la página

### Requirement: Validación de parámetros de consulta

El sistema SHALL responder 400 `VALIDACION` ante fechas inexistentes, fechas sin zona, rango vacío, invertido o mayor a 168 horas, UUID profesional inválido y parámetros admitidos repetidos o estructurados. SHALL aceptar solo `desde`, `hasta`, `profesionalId`, `limite` y `offset`. Otros parámetros SHALL recibir 400; no SHALL modificar datos.

#### Scenario: Fechas y rangos inválidos
- **WHEN** consulta sin hasta, con `2026-02-30T00:00:00Z`, sin zona, hasta igual o anterior a desde, o un rango de ocho días
- **THEN** recibe 400 `VALIDACION` sin datos de agenda

#### Scenario: Parámetros ambiguos
- **WHEN** envía dos valores de desde, una fecha como arreglo, profesionalId malformado o un parámetro desconocido
- **THEN** recibe 400 `VALIDACION` y ningún turno se modifica

### Requirement: Acceso de recepción y administración

Según KB 03 y RN-AG-03, `RECEPCION` y `ADMIN_CONSULTORIO` SHALL consultar todas las agendas de su consultorio o filtrar por `profesionalId`. Una ficha profesional inactiva SHALL conservar su historial visible. Un filtro inexistente o ajeno SHALL recibir la misma respuesta 404 `PROFESIONAL_NO_ENCONTRADO`, sin revelar existencia externa.

#### Scenario: Un caso por rol administrativo
- **WHEN** recepción o administración consulta sin filtro y luego con un profesional propio
- **THEN** la primera respuesta contiene las agendas del consultorio y la segunda solo los turnos del profesional indicado

#### Scenario: Filtro ajeno o inexistente
- **WHEN** recepción consulta un profesional de otro consultorio o un UUID inexistente
- **THEN** ambos casos reciben el mismo 404 `PROFESIONAL_NO_ENCONTRADO`

#### Scenario: Historial de profesional inactivo
- **GIVEN** una ficha propia inactiva con turnos históricos
- **WHEN** administración filtra por esa ficha
- **THEN** puede consultar sus turnos, sin reactivar recursos

### Requirement: Odontólogo limitado a su propia agenda

El sistema SHALL resolver la ficha vinculada al usuario y consultorio del token. `ODONTOLOGO` SHALL consultar exclusivamente esa agenda, esté activa o inactiva. Sin vínculo SHALL recibir 403 `SIN_PERMISO`. Un filtro distinto a su ficha SHALL recibir el mismo 403 sin consultar la existencia del profesional solicitado. Ser administrador no SHALL imponer esta limitación (KB 03, RN-AU-02).

#### Scenario: Agenda propia
- **GIVEN** un odontólogo vinculado a P1 y un segundo profesional P2 en el mismo consultorio
- **WHEN** consulta sin profesionalId o con profesionalId igual a P1
- **THEN** solo recibe turnos de P1

#### Scenario: Otra agenda o ausencia de vínculo
- **WHEN** el odontólogo solicita P2, un profesional ajeno o inexistente, o no tiene ficha vinculada
- **THEN** recibe 403 `SIN_PERMISO` sin turnos de ninguna agenda no autorizada

### Requirement: Aislamiento y autenticación

Toda lectura SHALL filtrar por el consultorio del token validado, incluyendo la resolución de nombres. Sin autenticación válida SHALL responder el 401 uniforme de C00. Query, body y encabezados del cliente no SHALL sustituir consultorioId ni usuarioId. Los errores inesperados SHALL producir el 500 genérico del manejador central sin SQL ni secretos (RN-TEN-01/02).

#### Scenario: A no ve los turnos ni nombres de B
- **GIVEN** dos consultorios ficticios con turnos en el mismo rango
- **WHEN** un usuario de A consulta su agenda
- **THEN** no recibe identificadores, nombres ni turnos de B

#### Scenario: Suplantación del contexto
- **WHEN** un usuario de A intenta seleccionar B por query, por body de GET o por encabezados x-tenant-* y x-consultorio-id
- **THEN** la query no admitida recibe 400 y los cuerpos y encabezados no cambian el contexto; ninguna respuesta contiene datos de B

#### Scenario: Token ausente o inválido
- **WHEN** consulta sin token o con token expirado o forjado
- **THEN** recibe 401 con `{ error: { code: "TOKEN_INVALIDO", message: "No autorizado" } }`

#### Scenario: Fallo inesperado de base
- **WHEN** una lectura de agenda o nombres falla por un error inesperado de base
- **THEN** recibe 500 `ERROR_INTERNO` sin resultados parciales ni detalles internos

### Requirement: Respuesta mínima y estados preservados

La respuesta 200 SHALL contener `{ desde, hasta, zonaHoraria, turnos, hayMas, siguienteOffset }`. Cada turno SHALL contener `id`, `pacienteId`, `pacienteNombre`, `pacienteApellido`, `profesionalId`, `sillonBoxId`, `prestacionId`, `inicio`, `fin`, `duracionMin`, `estado`. SHALL incluir también cancelados y conservar todos los estados almacenados, sin contactos, historia clínica ni auditoría interna.

#### Scenario: Nombre del paciente y lista vacía
- **WHEN** consulta un rango con turnos ficticios o un rango sin turnos
- **THEN** recibe el DTO definido con nombre y apellido, o turnos `[]` con hayMas false y siguienteOffset null

#### Scenario: Cancelación y reprogramación reflejadas
- **GIVEN** un turno CANCELADO y otro turno reprogramado mediante C07
- **WHEN** consulta sus rangos actuales
- **THEN** ve el cancelado identificado como tal y el reprogramado en su horario actual; consultar no cambia ningún estado

### Requirement: Paginación explícita y orden estable

El sistema SHALL ordenar por inicio ascendente e id ascendente. `limite` SHALL ser entero entre 1 y 200 (por defecto 100) y `offset` entero entre 0 y 10000 (por defecto 0). `hayMas` SHALL indicar filas adicionales y siguienteOffset SHALL ser offset más los turnos devueltos cuando haya más; en otro caso SHALL ser null. Superar el máximo de offset SHALL producir 400, nunca omitirlo silenciosamente.

#### Scenario: Más turnos que el límite
- **GIVEN** al menos tres turnos con orden conocido, algunos con el mismo inicio
- **WHEN** consulta con limite 2 y continúa con siguienteOffset
- **THEN** recibe páginas ordenadas sin duplicados ni pérdidas mientras no cambien los datos, con hayMas y siguienteOffset correctos

#### Scenario: Límites inválidos
- **WHEN** envía limite 0, 201, decimal o no numérico, u offset negativo, decimal o mayor a 10000
- **THEN** recibe 400 `VALIDACION`

# Tasks

Apply requiere C05 integrado en main con su interfaz `verificarDisponibilidad` publicada y el spec de este change aprobado. El comportamiento está definido en specs/turnos/spec.md y las decisiones técnicas en design.md.

## 1. Dependencia con C05 y contrato de validación

- [ ] 1.1 Verificar que el change de C05 existe, está aprobado e integrado en main, y leer su spec para confirmar que publica `verificarDisponibilidad({ consultorioId, profesionalId, sillonBoxId, pacienteId, inicio, fin, excluirTurnoId })` desde `src/modules/turnos/index.js`. Verificación: evidencia de lectura del spec/código de C05; si la interfaz no existe o difiere, detener el apply y actualizar design.md con el contrato real antes de continuar.
- [ ] 1.2 Acordar con Agustina el contrato exacto (firma, errores `ApiError(409, 'SOLAPAMIENTO', ...)`, transacción) y contrastarlo con design.md §1. Verificación: design.md refleja el contrato acordado y el equipo lo confirma por escrito.
- [ ] 1.3 Verificar que C00 sigue exponiendo `middlewareAutenticacion` y `req.auth = { usuarioId, consultorioId, rol }`, y que el helper `tests/helpers/tokens.js` permite crear tokens por rol y consultorio. Verificación: prueba de autenticación con `crearToken` que resuelve el triple en una ruta protegida.

## 2. Estructura y dominio de reprogramación

- [ ] 2.1 Crear `dominio/reprogramacion.js` con el cálculo `fin = inicio + duración de la prestación` (RN-AG-07) y la validación de entrada del nuevo inicio (UUID de turno válido, instante ISO 8601 UTC, ausencia/ignoración del fin del cliente). Verificación: tests unitarios del dominio que cubren inicio válido, fin calculado, `inicio` ausente o malformado → error de validación, y fin provisto por el cliente ignorado.
- [ ] 2.2 Preparar `repositorio/reprogramar.sql.js` con SELECT por `id` y `consultorio_id` y UPDATE parametrizado de `inicio`/`fin` filtrado por `consultorio_id`. Verificación: test de repositorio con PostgreSQL que confirma UPDATE sobre el turno propio y cero filas afectadas ante un turno de otro consultorio.

## 3. Servicio transaccional (RN-AG-09)

- [ ] 3.1 Implementar `servicio/reprogramar.js`: en UNA transacción leer el turno del consultorio autenticado, calcular el fin, invocar `verificarDisponibilidad(..., excluirTurnoId)` y ejecutar el UPDATE; ante cualquier error, rollback. Verificación: test de servicio — reprogramación válida devuelve el turno con el horario nuevo (feliz).
- [ ] 3.2 Verificar la conservación del horario ante fallo: cuando `verificarDisponibilidad` lanza `ApiError(409)` o la base falla, el turno conserva su intervalo anterior y el error se propaga al manejador central (500 con `ERROR_INTERNO` y mensaje seguro). Verificación: tests de negocio — solapamiento por profesional y por sillón/box rechazados con el turno en su horario original, y fallo de base → 500 sin cambio persistido.
- [ ] 3.3 Agregar el test de exclusión del turno en movimiento: la llamada recibe `excluirTurnoId` y no se compara consigo mismo. Verificación: test que un turno existente reprogramado dentro de su propio intervalo no produce `SOLAPAMIENTO` por su propia fila.

## 4. Ruta HTTP, autorización y aislamiento

- [ ] 4.1 Registrar `PATCH /api/turnos/:id/reprogramar` en `rutas.js` con `middlewareAutenticacion` y resolución de permisos en el servicio: `RECEPCION` y `ADMIN_CONSULTORIO` → permitido; `ODONTOLOGO` u otro rol → 403 **antes** de tocar la base; sin token → 401. Verificación: tests HTTP con `crearToken` para recepción (200), administración (200), odontólogo (403, turno intacto) y sin token (401).
- [ ] 4.2 Aplicar el aislamiento: `consultorioId` solo desde `req.auth`, descartando cualquier `consultorioId` de body/query/headers. Verificación: tests — turno inexistente → 404; turno de otro consultorio → 404 con el turno ajeno intacto (escenario "turno inexistente de otro consultorio"); intento de enviar consultorio B en el body opera igual sobre A.
- [ ] 4.3 Implementar las respuestas del contrato: 200 con turno actualizado, 409 por solapamiento, 422 por `inicio` ausente/malformado, 404, 403, 401, 500 seguro. Verificación: test de contrato HTTP por cada estado listado en design.md §6.

## 5. Escenarios borde de disponibilidad

- [ ] 5.1 Test de turnos contiguos válidos (RN-AG-06): reprogramar a un rango que empieza exactamente cuando termina otro turno del mismo profesional y box → permitido. Verificación: test pasa con `[inicio, fin)` contiguo.
- [ ] 5.2 Test de reprogramación al mismo horario actual: mover un turno a su propio inicio no se rechaza por solapamiento consigo mismo y conserva el intervalo. Verificación: test borde pasa.
- [ ] 5.3 Test de solapamiento del paciente (RN-AG-01): reprogramar un segundo turno del mismo paciente a un rango que intersecta el primero → 409 y horario anterior conservado. Verificación: test de negocio pasa.
- [ ] 5.4 Test de concurrencia (RN-AG-02): dos solicitudes simultáneas que compiten por el mismo rango del mismo profesional → exactamente una gana. Verificación: test con promesas simultáneas sobre PostgreSQL real deja un solo turno en el rango.

## 6. Verificación integrada

- [ ] 6.1 Ejecutar `npm test` completo con PostgreSQL y datos ficticios (nunca datos reales de pacientes — regla dura 1) y comprobar que todos los escenarios del spec pasan, junto con las suites existentes. Verificación: suite en verde.
- [ ] 6.2 Confirmar que C07 no creó migraciones nuevas ni editó ninguna migración mergeada (regla dura 9) y que solo escribe en la tabla `turno` del módulo `turnos` (regla dura 10). Verificación: revisión del diff contra `db/migrations/` y de los queries del repositorio.
- [ ] 6.3 Revisar el diff completo buscando lógica de solapamiento duplicada fuera de `verificarDisponibilidad` de C05 (riesgo principal) y registrar la evidencia de verificación para el PR. Verificación: diff revisado, sin consultas de solapamiento propias en C07.

## Workflow follow-up

- Publicar al equipo el endpoint `PATCH /api/turnos/:id/reprogramar` y su contrato de estados en el PR de planificación, para que C09 (contratos de API) lo consuma.
- Enviar a Agustina el spec completo y solicitar revisión antes de Apply.
- Presentar la implementación para revisión una vez verificada.
- Archivar el change mediante OpenSpec cuando se cumplan los requisitos del proyecto.

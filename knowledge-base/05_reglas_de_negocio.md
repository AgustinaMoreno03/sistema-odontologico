# Reglas de Negocio

## Identidad y consultorios

- **RN-AU-01**. Los usuarios se autentican a través de `auth`. El módulo valida el token y devuelve `{ usuarioId, consultorioId, rol }`.
- **RN-AU-02**. Los permisos de administración y la condición de profesional son independientes. Las reglas de agenda se aplican en el servidor.
- **RN-AU-03**. El administrador gestiona usuarios de su consultorio.
- **RN-TEN-01**. El identificador de consultorio se toma del contexto autenticado. No se acepta desde el cliente.
- **RN-TEN-02**. Toda consulta de negocio filtra por `consultorio_id`. Se prueba que un usuario no pueda leer ni modificar datos de otro consultorio.
- **RN-TEN-03**. La unicidad y los índices de negocio se acotan al consultorio.
- **RN-TEN-04**. El alta inicial del consultorio es una operación interna mediante seed o comando.

## Agenda

- **RN-AG-01**. Un paciente no puede tener dos turnos solapados dentro de su consultorio.
- **RN-AG-02**. Se impide transaccionalmente el solapamiento por profesional o por sillón/box dentro del mismo consultorio, también ante solicitudes simultáneas.
- **RN-AG-03**. Recepción crea, reprograma y cancela turnos. Administración gestiona todas las agendas de su consultorio. El profesional ve su propia agenda y solo crea turnos si está habilitado por operar sin recepción.
- **RN-AG-04**. Para la entrega base, el paciente pide la cancelación al consultorio por teléfono o WhatsApp. La eventual auto-reserva tendrá reglas propias.
- **RN-AG-05**. Una reserva requiere disponibilidad. Si se incorporan bloqueos, impiden reservas sobre el intervalo bloqueado del profesional.
- **RN-AG-06**. Los intervalos son `[inicio, fin)`; los turnos contiguos son válidos. Guardar instantes en UTC con `timestamptz` y presentar hora argentina.
- **RN-AG-07**. La duración positiva de la prestación determina el fin del turno.
- **RN-AG-08**. Cancelar libera el horario y conserva el registro. Guardar el estado, la fecha UTC, el usuario que operó y si solicitó la cancelación el paciente o el consultorio.
- **RN-AG-09**. Reprogramar reutiliza la validación de disponibilidad y conserva el horario anterior si la operación falla.
- **RN-AG-10**. Confirmación, asistencia, ausencias y bloqueos se priorizan después del flujo base. Estados previstos: `PENDIENTE`, `CONFIRMADO`, `ATENDIDO`, `AUSENTE` y `CANCELADO`. El spec define las transiciones habilitadas.

## Pacientes

- **RN-PAC-01**. Se requiere nombre y al menos un contacto.
- **RN-PAC-02**. La ficha MVP contiene datos básicos y la búsqueda se limita al mismo consultorio.

## Etapas posteriores

- **RN-HC-01**. En el escenario de un profesional, el acceso a historia clínica en la aplicación corresponde al odontólogo. Ser administrador o recepción por sí solo no da acceso clínico.
- **RN-HC-02**. Las correcciones se agregan con autor y fecha y conservan el registro original. Validar requisitos de acceso y conservación antes de diseñar el módulo.
- **RN-COB-01**. El módulo de cobros usará centavos enteros o `NUMERIC`, con idempotencia para evitar dobles envíos.
- **RN-EX-01**. Historia clínica, cobros, contabilidad y sucursales quedan fuera del MVP.
- **RN-EX-02**. Todo dato de paciente en desarrollo, pruebas y demostración es ficticio.

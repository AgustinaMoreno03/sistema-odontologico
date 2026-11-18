# Preguntas Abiertas

| Tema | Estado y momento de decisión |
|---|---|
| Autenticación | El módulo aislado y su interfaz están acordados. C00/C01 definen el mecanismo mínimo de token, expiración, alta inicial y configuración. |
| Runner SQL | Propuesta de usar `node-pg-migrate` con archivos SQL. C00 debe comprobar numeración, aplicación a base vacía, repetición, fallo y compatibilidad con la conexión de Neon antes de adoptarlo. Los rangos del roadmap reservan numeración por change. |
| Solapamientos | C05 evalúa una restricción de exclusión de PostgreSQL y debe proteger reservas concurrentes por profesional y sillón/box. |
| Estados y bloqueos | El flujo base prioriza crear, consultar, reprogramar y cancelar. Confirmación, asistencia, ausencia y bloqueos son extensiones de agenda si queda tiempo. Sus transiciones, permisos y política ante turnos ya ocupados se definen en el spec. |
| Profesional sin recepción | El permiso excepcional de creación en su propia agenda está definido. El spec elige cómo se habilita y comprueba. |
| Auto-reserva | Fuera de los seis días de base. Si se aborda después, decidir vigencia del enlace de cancelación y antelación mínima. Las 24 horas son una referencia. |
| Sucursales | Fuera del MVP. Definir su relación con el consultorio antes de incorporar multi-sede. |
| Cobros y contabilidad | Etapa posterior. Definir representación monetaria, registro y política de idempotencia al abrir ese módulo. |
| Historia clínica | Etapa posterior. La Ley 26.529, art. 13, exige preservar la integridad e inalterabilidad de la historia informatizada. Las correcciones fechadas, con autor y sin sobrescribir el original son una convención del proyecto. Revisar requisitos de acceso, copia, conservación y uso de datos reales antes de implementar. [Ley 26.529, arts. 12–19](https://www.argentina.gob.ar/normativa/nacional/ley-26529-160432/actualizacion) |
| Despliegue y entrega académica | Verificar límites de Vercel, Render y Neon al desplegar. Confirmar cómo se evalúa el alcance multi-tenant y si la cátedra requiere un change por integrante. |
| Integraciones futuras | Evaluar WhatsApp Business y email al definir recordatorios. Confirmar si el módulo de cobros incluirá comprobantes fiscales. |

## Aclaraciones cerradas

- IN-01. El SaaS aísla consultorios desde el MVP. IN-02. Historia clínica y cobros siguen en etapas posteriores. IN-03. La auto-reserva queda fuera de la entrega base.

- El equipo informó que la cátedra autorizó el nuevo stack y amplió la modalidad a un máximo de seis integrantes. El equipo actual es de cinco.
- El equipo informó que probó PostgreSQL 18 con Neon. La versión objetivo es 18 en ambos entornos.
- Backend y frontend usan JavaScript. Admin y dueño son el mismo rol. La cancelación del paciente pasa por el consultorio durante la entrega base.

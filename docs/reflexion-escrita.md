# Reflexión escrita — Sistema de Gestión Odontológica

> Compilación editorial de las respuestas proporcionadas por el equipo el 25/11/2026, incluida su valoración consensuada de la pregunta 4. Pendiente de lectura, corrección y aprobación de sus autores. La consigna exige una reflexión propia de una a dos páginas. La IA ayudó a ordenar estos relatos; no realizó las experiencias ni reemplaza la autoría y validación humanas.

## 1. ¿Qué información del Discovery resultó incorrecta, no verificable o inventada por el agente? ¿Cómo lo detectaron?

La revisión de fuentes del 25/11, registrada en los hallazgos del Discovery, detectó tres problemas. Para Dentalink, el informe afirmaba precios de USD 35/50/75 mensuales, pero la página argentina consultada pedía cotización y no publicaba esos valores. Se cambió la afirmación por «No evidenciado (cotización a pedido al 25/11)». Para Odonthia, los ARS 74.500/153.700 del informe no coincidían con la fuente citada, que publicaba un plan pago de ARS 157.300 con IVA; se corrigió según esa fuente. En Dentaly, el agente había incorporado un rango en dólares sin indicar tipo de cambio: la información aportada por el equipo estaba en pesos, ARS 35.000/100.000. Se eliminó aquella conversión y se aclaró la limitación del fetch estático para una web que renderiza mediante JavaScript.

La detección surgió de abrir y comparar las fuentes con cada afirmación, no de aceptar la redacción del informe. Los [hallazgos de verificación](discovery/hallazgos-discovery.md) y el [informe corregido](discovery/informe-discovery.md) ya están en el repositorio. El registro distingue esa revisión externa de la comprobación personal de al menos cinco fuentes que exige la consigna; no debe darse esta última por cumplida sin su evidencia. Una diferencia de precio se registra como dato incorrecto o no respaldado; la conversión sin tipo de cambio fue una inferencia inventada. Agustina también detectó secciones B, C y D faltantes y pidió corregirlas antes de cerrar el Discovery.

## 2. ¿En qué etapa usaron Ajustar, qué estaba mal y qué habría pasado si hubieran apretado Continuar?

En la fundación, Agustina recortó historia clínica y cobros para evitar un alcance que no podían terminar. En C05 exigió especificar conflictos tanto por profesional como por sillón, incluyendo que dos turnos contiguos sí son válidos. Sin esos ajustes podían entregar más funcionalidades a medias y una agenda que aceptara reservas incompatibles.

En C03, la revisión encontró que un contacto de solo espacios podía guardarse cuando el otro era válido. Se agregaron restricciones individuales y pruebas. En C06, la 070 de C07 ya estaba aplicada: Lucía rechazó desactivar el control de orden que proponía el agente. El intento con 110 llegó al PR #17; avisó y Agustina lo revirtió mediante #18, preservando el trabajo funcional. Finalmente acordaron 071. El orden fue C05, C07, C06 inicial y su reversión, archivo de C05 y C06 corregido. Continuar sin revisar habría debilitado el control de migraciones o dejado una numeración incompatible con lo acordado.

En C08, #23 se integró antes de la revisión final porque las pruebas estaban verdes. Después se verificaron el diff y el hash del test de aislamiento, se amplió la documentación de paginación en #24 y se archivó en #25. El equipo registró que un verde no sustituye la revisión previa. En C09, el login fallaba porque faltaba el primer administrador; Gero preparó el bootstrap oficial de C01 en un worktree y lo separó en #26. Así pudieron probar la integración real sin ocultar el problema con datos simulados.

## 3. ¿Qué diferencia notaron entre implementar con una especificación aprobada y pedir código con un prompt suelto?

En el trabajo realizado, la especificación aprobada fijó qué se podía construir y cómo verificarlo: permisos, aislamiento, errores, campos y escenarios. Eso permitió que C05 consumiera interfaces acordadas y que el frontend utilizara los contratos del backend. También permitió interpretar el RED de agenda como la ausencia esperada de una ruta, e implementar hasta obtener GREEN sin cambiar las aserciones originales del aislamiento.

Un pedido suelto deja esas decisiones implícitas y facilita que el agente complete huecos por su cuenta. El ejemplo observado fue la propuesta de desactivar el control de orden de migraciones, que Lucía rechazó. Esta comparación se apoya en los episodios relatados por el equipo; no se realizó un experimento controlado de dos implementaciones equivalentes. Los autores deben confirmar que esta explicación representa su experiencia.

## 4. ¿Qué parte de la fundación aportó más valor al ciclo OPSX y cuál menos?

Según la valoración consensuada, lo más útil fueron las reglas duras y el roadmap. AGENTS.md sirvió como límite para las propuestas del agente: conservar migraciones ya integradas, resolver el consultorio desde el token y respetar las interfaces entre módulos. Esas reglas orientaron decisiones que luego se comprobaron con pruebas; no sustituyeron su verificación. CHANGES.md permitió coordinar a los cinco integrantes mediante dependencias, olas de trabajo, stubs y rangos reservados. El conflicto 070/071 mostró que también había que contrastarlo con lo realmente aplicado en las bases.

Lo menos útil fueron las secciones teóricas y genéricas de la KB inicial sobre historia clínica compleja, odontograma y pasarelas de pago, que estaban fuera del MVP. El equipo relata que, durante el trabajo diario, los agentes se guiaban principalmente por los contratos, las reglas y los escenarios del spec. Esa documentación extensa aportaba ruido y podía inducir ampliaciones de alcance, por lo que hubo que ajustarla. La crítica se refiere a esas secciones, no a la información de dominio necesaria para definir roles y reglas de agenda.

## 5. ¿Qué hizo cada integrante y en qué etapa?

- **Agustina:** C00 y C05; coordinación, recorte del MVP, aprobación de contratos, ajustes, revisiones e integración. Coordinó las correcciones del Discovery y la recuperación de C06.
- **Lucía:** C01 original y C06; autenticación/usuarios y cancelación. Detectó y comunicó el problema de orden de migraciones, rechazó desactivar su control y coordinó la solución 071.
- **Kevin:** C02 y C07; catálogo de profesionales/sillones y reprogramación, reutilizando la validación de solapamientos de C05. Aportó la reconstrucción del orden de merges y la coordinación de migraciones.
- **Gero:** C04, C09 y ajuste de C01; prestaciones, frontend React y bootstrap del primer administrador en #26. Probó el recorrido funcional y el aislamiento con un segundo consultorio. Documentó 42 pruebas del frontend y una ejecución de 505 del backend, como verificaciones separadas.
- **Leandro Tarditi (Lea), legajo 52139:** actualización de KB y roadmap, C03 pacientes y C08 agenda diaria/semanal. Implementación, pruebas, documentación y evidencia RED/GREEN de aislamiento y paginación. La suite histórica al cierre de C08 aprobó 505 tests. Lea y Leandro son la misma persona.

El uso de agentes acompañó la planificación, implementación y documentación. La revisión de resultados, el rechazo de propuestas incorrectas y la aprobación de cada decisión fueron responsabilidades humanas. Antes de entregar, cada integrante debe releer y corregir esta compilación y validar que representa su experiencia.

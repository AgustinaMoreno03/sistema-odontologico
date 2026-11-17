# Plan de ejecución: sistema de turnos para consultorios odontológicos (SaaS multi-tenant)

> **Para OpenCode / Active Stack.** Leer este archivo completo antes de generar o ajustar la knowledge-base, `CHANGES.md` o cualquier spec.
> Fecha del plan: 2026-11-17. Guardar en el repo como `docs/plan-ejecucion.md`.

---

## 0. Reglas para el agente

1. Este plan **reemplaza** las decisiones anteriores donde diga "CAMBIA" en la sección 2.
2. **No aprobar en automático.** Al final de cada etapa, preguntar Continuar / Ajustar / Parar acá y esperar la respuesta de la líder.
3. **No inventar.** Todo dato sin respaldo va a `knowledge-base/preguntas-abiertas` como "No evidenciado".
4. **Datos ficticios siempre.** Nunca datos reales de pacientes en el repo, en ejemplos, tests ni capturas.
5. Si este plan contradice algo ya generado (KB, roadmap), **no lo resuelvas en silencio**: avisá la contradicción y proponé Ajustar.
6. Registrar cada decisión nueva en `knowledge-base/decisiones` y en Engram.

---

## 1. Estado actual del flujo

- Fundación en curso con `/active-orchestrator`. Fase `kb` lista, política visual del design-system = `deferred`.
- Falta: roadmap (`CHANGES.md`), skills y reglas del agente, y el ciclo OPSX.
- La KB se generó **antes** de las decisiones nuevas (sección 2). Hay que actualizarla (sección 3) **antes** de dar por bueno el roadmap.
- Si `CHANGES.md` ya se generó con el criterio anterior (un solo consultorio, sin tenant), usar **Ajustar** y re-generarlo con este plan.

---

## 2. Decisiones vigentes

| Tema | Antes | Ahora |
|---|---|---|
| Escala | Un solo consultorio, sin noción de tenant | **CAMBIA:** SaaS multi-tenant (varios consultorios aislados) |
| Ejecución | Local, con Docker opcional | **CAMBIA:** todo local hasta terminar el MVP; después se despliega |
| Despliegue | No definido (pregunta abierta de infraestructura) | **CAMBIA:** Vercel (frontend), Render (backend), Neon (base de datos), todos en plan gratuito |
| Arquitectura | Monolito Spring Boot que sirve el frontend | **CAMBIA:** monolito modular en el backend + frontend estático separado (ver 4) |
| Base de datos | No definida | **CAMBIA:** PostgreSQL (en Docker local y Neon en la nube, para que sean iguales) |
| Backend | Spring Boot con Gradle | Sin cambio |
| Frontend | TypeScript vanilla | Sin cambio (mínimo, fuera del primer change) |
| Alcance del MVP | Agenda + turnos con registro mínimo de paciente | Sin cambio. Sin historia clínica ni cobros |
| Equipo | 5 integrantes, la líder conduce | Sin cambio |
| Prioridad de calidad | Mantenibilidad, costo cero | Sin cambio |
| Design-system | `deferred` | Sin cambio |

---

## 3. Impacto en la knowledge-base (pedir Ajustar)

Actualizar estos archivos de `knowledge-base/` para que reflejen las decisiones nuevas:

- **decisiones:** registrar el paso a multi-tenant, el despliegue y la separación frontend/backend, con fecha y motivo.
- **arquitectura:** diagrama de la sección 4, tenant en cada capa y política de despliegue.
- **modelos de datos:** `tenant_id` en todas las tablas de negocio; entidad `Consultorio` (tenant); entidades `Profesional`, `SillonBox`, `Prestacion`, `Paciente` (mínimo) y `Turno`.
- **reglas de negocio:** las de agenda (duración de prestaciones, sillones o boxes, prevención de solapamientos) **dentro de cada tenant**; aislamiento entre tenants.
- **actores:** sumar roles del sistema (sección 5.2).
- **features:** el MVP sigue siendo agenda y turnos; sumar alta mínima de consultorio y de usuarios.
- **preguntas abiertas:** sumar las de la sección 12.

---

## 4. Arquitectura objetivo

```
Navegador
   |
   +--> Vercel: frontend estático (TypeScript vanilla)
   |        |
   |        |  HTTPS + CORS (solo el dominio del frontend)
   |        v
   +--> Render: backend Spring Boot (Gradle, monolito modular, API REST)
            |
            v
         Neon: PostgreSQL (esquema compartido, tenant_id en cada tabla)
```

**Desarrollo local (mismas piezas):** frontend servido localmente + Spring Boot + PostgreSQL en Docker (`docker compose`). Si Docker genera errores, se puede usar PostgreSQL instalado directo en la máquina. Lo importante es que **siempre sea PostgreSQL**.

**Monolito modular (backend):** un solo proyecto, un solo deploy, pero con paquetes por módulo con límites claros: `tenancy`, `identidad`, `catalogo` (profesionales, sillones/boxes, prestaciones), `pacientes`, `turnos`. Cada módulo expone una interfaz y no toca las tablas de otro.

### Multi-tenant: estrategia

- **Esquema compartido con `tenant_id`** en todas las tablas de negocio. Es lo más simple y encaja con el plan gratuito de Neon (una sola base).
- El `tenant_id` **sale del usuario autenticado** (token), **nunca** de un parámetro que mande el cliente.
- Filtrado automático por tenant en la capa de persistencia (por ejemplo, filtro de Hibernate o un repositorio base), no a mano en cada consulta.
- Restricciones únicas e índices siempre **incluyen** `tenant_id`.
- Migraciones con Flyway (o Liquibase) versionadas en el repo, para aplicarlas igual en local y en Neon.
- Tests obligatorios de aislamiento: un usuario del tenant A **no** puede ver ni modificar datos del tenant B.
- Fuera del MVP: planes de suscripción, cobros y facturación de los consultorios.

---

## 5. Roles

### 5.1 Roles del equipo (se mantienen)

| Integrante | Rol |
|---|---|
| Agustina | **Líder:** conduce la fundación y el ciclo OPSX, crea el repo, maneja la rama principal y controla los PR, define secuencia y paralelismo de los changes |
| Lucia, Kevin, Lea, Gero | Integrantes: cada uno con su rama, sus commits y sus changes asignados |

Todos tienen que tener commits propios, hablar en el video y figurar en la reflexión.

### 5.2 Roles del sistema (supuesto: confirmar con la líder)

- `ADMIN_CONSULTORIO`: administra su consultorio y usuarios.
- `ODONTOLOGO`: ve y gestiona su propia agenda.
- `RECEPCION`: crea, cancela y reprograma turnos de su consultorio.
- Un rol interno de plataforma (`SUPERADMIN`) solo para dar de alta consultorios; en el MVP puede ser un seed o script, sin pantalla.

---

## 6. Flujo de trabajo en GitHub

- Rama principal protegida: no se sube directo, solo por Pull Request con **al menos 1 aprobación**.
- Una rama por change: `feature/<id-change>-<nombre>`.
- Commits chicos y frecuentes, con mensajes claros. Cada persona commitea con su propio usuario.
- Archivos compartidos (`build.gradle`, migraciones, configuración) los toca **una sola persona por ola**, para evitar conflictos.
- Antes de pedir el PR: correr los tests y hacer rebase o merge de la rama principal.

---

## 7. Plan de changes por olas

La asignación es **sugerida**: la líder la ajusta según experiencia de cada integrante. El roadmap oficial es `CHANGES.md`; esta tabla es la guía para generarlo.

| Ola | ID | Change | Depende de | Responsable sugerido |
|---|---|---|---|---|
| 0 | C00 | Base del proyecto: Spring Boot + Gradle, PostgreSQL en Docker, Flyway, contexto de tenant, estructura modular, README | nada | Agustina |
| 1 | C01 | Consultorios (tenant) y autenticación con roles | C00 | Lucia |
| 1 | C02 | Catálogo: profesionales y sillones/boxes | C00 | Kevin |
| 1 | C03 | Pacientes (registro mínimo: nombre y contacto, ficticios) | C00 | Lea |
| 1 | C04 | Prestaciones con duración variable | C00 | Gero |
| 2 | C05 | **Crear turno sin solapamientos por profesional y por sillón/box** (change del ciclo OPSX completo) | C01 a C04 | Agustina |
| 3 | C06 | Cancelar turno y liberar el horario | C05 | Lucia |
| 3 | C07 | Reprogramar turno | C05 | Kevin |
| 3 | C08 | Consulta de agenda diaria y semanal | C05 | Lea |
| 3 | C09 | Frontend mínimo en TypeScript vanilla sobre la API | contrato de API de C05 a C08 | Gero |
| 4 | C10 | Despliegue (sección 9) | MVP verificado en local | Agustina + 1 integrante |

**Puertas de paralelismo:**
- Ola 0 es el camino crítico: hasta que C00 se mergea, nadie empieza.
- Ola 1: C01 a C04 son independientes entre sí. Cada uno define su **interfaz pública** en el spec y los demás trabajan contra stubs.
- C05 empieza cuando las interfaces de la ola 1 estén acordadas (no hace falta esperar la implementación completa).
- Ola 3: C06 a C09 son independientes entre sí.

**Cada change en `CHANGES.md` debe indicar:** dependencias, ola, módulos y archivos que toca, responsable, tamaño estimado y riesgos. Si un change es grande, partirlo.

---

## 8. Fases de ejecución y criterios de salida

| Fase | Qué se hace | Se pasa a la siguiente cuando |
|---|---|---|
| A. Ajustar fundación | Actualizar KB (sección 3). Generar `CHANGES.md` con este plan. Skills, registro de skills, `AGENTS.md` y `CLAUDE.md` | La KB refleja este plan, el roadmap coincide con el MVP y las reglas fueron revisadas una por una |
| B. Base | C00 en local | Levanta con un comando, tests en verde, README reproducible |
| C. Ola 1 | C01 a C04 en paralelo, cada uno con ciclo OPSX | Specs aprobados (≥3 escenarios), tests en verde, PR aprobados y mergeados |
| D. Change principal | C05 con ciclo OPSX completo | Los 3 escenarios mínimos (feliz, error de negocio, borde) con tests en verde y change archivado |
| E. Ola 3 | C06 a C09 | Funciona en local de punta a punta y con tests de aislamiento entre tenants en verde |
| F. MVP en local | Verificación integral | Se puede crear un consultorio, usuarios, profesionales, boxes, pacientes y turnos sin solapamientos |
| G. Despliegue | C10 | Sección 9 completa |
| H. Cierre | Engram, informe de Discovery, video y reflexión | Entregables de la sección 11 listos |

El ciclo OPSX de cada change es: explore → propose → apply → verify → archive. En Apply no se inventan decisiones fuera del spec: si falta algo, se vuelve a Propose.

---

## 9. Despliegue (solo después de terminar el MVP en local)

**Antes de desplegar:** verificar en las páginas oficiales de Vercel, Render y Neon los límites vigentes de los planes gratuitos. Cambian con frecuencia y no deben asumirse.

**Pendientes a tener en cuenta:**
- Los planes gratuitos suelen tener **arranque en frío** (el servicio se duerme por inactividad y tarda en responder la primera vez) y límites de recursos. Eso es aceptable para validar, no para producción real.
- Verificar si el plan gratuito de cada servicio admite el tipo de uso previsto (por ejemplo, restricciones de uso comercial).

**Checklist:**
1. **Neon:** crear el proyecto y la base PostgreSQL; guardar la cadena de conexión solo en variables de entorno.
2. **Render:** crear el servicio web del backend (con Docker o con el build de Gradle); variables de entorno para la conexión a Neon, el secreto del token y el dominio permitido por CORS; configurar un endpoint de health check.
3. **Migraciones:** aplicar las de Flyway sobre Neon.
4. **Vercel:** publicar el frontend estático apuntando a la URL del backend mediante configuración, no hardcodeada.
5. **CORS:** permitir únicamente el dominio del frontend.
6. **Prueba de humo en la nube** con datos ficticios.
7. **Sin secretos en el repo:** `.env` en `.gitignore`, solo un `.env.example` sin valores reales.

---

## 10. Reglas de dominio para `AGENTS.md` (revisar cada una antes de confirmar)

- Nunca almacenar datos reales de pacientes en el repo, en ejemplos, tests ni capturas.
- Todo acceso a datos de negocio filtra por `tenant_id` del usuario autenticado; nunca se acepta el tenant desde el cliente.
- Ningún change se implementa sin spec aprobado con al menos 3 escenarios (feliz, error de negocio y borde).
- Los turnos no pueden solaparse por profesional ni por sillón/box dentro de un mismo tenant. Un turno que empieza justo cuando termina otro es válido.
- No hay secretos ni credenciales en el repositorio.
- No hay merge a la rama principal sin tests en verde y revisión.
- Mientras el sistema esté en planes gratuitos, no se cargan datos reales de pacientes (datos de salud: Ley 25.326). Hacerlo requiere una revisión previa de seguridad y cumplimiento.

---

## 11. Entregables del trabajo (referencia)

Repositorio reproducible con README, historial de commits por persona, informe de Discovery en PDF con verificación de fuentes, video de defensa de 8 a 12 minutos con todos los integrantes, reflexión escrita de 1 a 2 páginas y evidencia de Engram.

---

## 12. Preguntas abiertas para la KB

- Alcance exacto del multi-tenant dentro de la nota del trabajo (¿es requisito de la cátedra o decisión propia del equipo?).
- Estrategia final de autenticación (token propio o proveedor externo).
- Cumplimiento para datos reales de pacientes antes de salir de la etapa de validación.
- Límites reales de los planes gratuitos de Vercel, Render y Neon al momento del despliegue.
- Si la cátedra espera un solo change por el ciclo OPSX completo o uno por integrante.

---

## 13. Riesgos

| Riesgo | Mitigación |
|---|---|
| Multi-tenant agranda el alcance y compromete el change principal | Tenant mínimo (`tenant_id` + aislamiento + tests); lo demás queda como etapa posterior |
| Un change bloquea a los demás | Contratos en los specs, stubs y ola 0 corta |
| Conflictos de archivos entre 5 personas | Módulos separados y un dueño por archivo compartido |
| Diferencias entre local y nube | PostgreSQL en ambos y migraciones versionadas |
| Arranque en frío en los planes gratuitos | Aceptarlo para validación; documentarlo en el README |
| Se pierde contexto entre sesiones | Registrar decisiones en Engram y en `knowledge-base/decisiones` |

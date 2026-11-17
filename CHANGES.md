# CHANGES — Índice de roadmap de changes

> **Fuente autoritativa:** `docs/plan-ejecucion.md` (§4, §5, §6, §7, §8, §9, §12, §13). **Fecha:** 2026-11-17.
> Este archivo reemplaza al roadmap anterior (generado con el criterio viejo: un solo consultorio, monolito que servía el frontend y sin despliegue). Leer el plan de ejecución completo antes de proponer cualquier change.

## Contexto del proyecto

- **Qué es:** SaaS **multi-tenant** de gestión de turnos para consultorios odontológicos. Varios consultorios aislados entre sí (`tenant_id` en todas las tablas de negocio, esquema compartido con PostgreSQL).
- **MVP:** agenda + turnos + registro **mínimo** de pacientes + catálogo (profesionales, sillones/boxes, prestaciones con duración) + tenancy mínimo (alta de consultorio y usuarios). **Sin historia clínica, sin cobros** (post-MVP, RN-EX-01).
- **Datos:** siempre **ficticios** — nunca datos reales de pacientes en el repo, tests, ejemplos ni capturas (Ley 25.326; plan §10).
- **Stack:** backend **Spring Boot + Gradle** (monolito modular: módulos `tenancy`, `identidad`, `catalogo`, `pacientes`, `turnos`) + **PostgreSQL** (Docker en local, Neon en la nube, Flyway versionado) + frontend **TypeScript vanilla separado** (estático en Vercel; no lo sirve el backend). Despliegue final: Vercel (frontend) / Render (backend) / Neon (BD), planes gratuitos.
- **Equipo (5):** Agustina (líder), Lucia, Kevin, Lea, Gero. Ciclo OPSX por change: explore → propose → apply → verify → archive.

---

## Árbol de dependencias

```
C00  Base del proyecto (Spring Boot + Gradle + PostgreSQL Docker + Flyway + tenancy + modularidad)
 │   [Agustina — Ola 0, bloquea todo]
 │
 ├── C01  Consultorios (tenant) y autenticación con roles ......... [Lucia]   ─┐
 ├── C02  Catálogo: profesionales y sillones/boxes ................. [Kevin]   ─┤ Ola 1:
 ├── C03  Pacientes (registro mínimo, ficticios) .................. [Lea]     ─┤ en paralelo,
 ├── C04  Prestaciones con duración variable ...................... [Gero]    ─┘ con stubs
 │
 └── C05  Crear turno SIN solapamientos por profesional Y sillón/box  [Agustina]  ← Ola 2
     │        (depende de las INTERFACES acordadas de C01–C04, no de su implementación completa)
     │        ← CHANGE PRINCIPAL DEL CICLO OPSX COMPLETO →
     │
     ├── C06  Cancelar turno y liberar el horario ......... [Lucia]   ─┐
     ├── C07  Reprogramar turno ......................... [Kevin]   ─┤ Ola 3:
     ├── C08  Consulta de agenda diaria y semanal ......... [Lea]     ─┤ en paralelo
     └── C09  Frontend mínimo TS vanilla (contrato API de C05–C08) [Gero] ─┘
     │
     └── C10  Despliegue (Neon → Render → Flyway → Vercel → CORS → humo)  [Agustina + 1]
              ← Ola 4: requiere MVP verificado en local (fase F) →
```

---

## Olas

| Ola | Changes | Responsables | Arranque / sincronización |
|---|---|---|---|
| **0** | C00 | **[Agustina]** | Camino crítico: nadie arranca hasta que C00 se mergea. |
| **1** | C01, C02, C03, C04 | **[Lucia]**, **[Kevin]**, **[Lea]**, **[Gero]** | Independientes entre sí. Cada uno define su **interfaz pública en el spec**; los demás trabajan contra **stubs**. |
| **2** | C05 | **[Agustina]** | Arranca cuando las **interfaces** de la ola 1 estén acordadas — **no** hace falta esperar la implementación completa. |
| **3** | C06, C07, C08, C09 | **[Lucia]**, **[Kevin]**, **[Lea]**, **[Gero]** | C06–C08 dependen de C05; C09 depende del **contrato de API** de C05–C08. Independientes entre sí. |
| **4** | C10 | **[Agustina] + 1 integrante** | Solo con el MVP verificado en local (fase F) y la sección 9 del plan. |

*La asignación es **sugerida**: la líder la ajusta según experiencia de cada integrante (plan §7).*

---

## Puertas de paralelismo (plan §7)

1. **Ola 0 es el camino crítico:** hasta que C00 se mergea, nadie empieza.
2. **Ola 1 en paralelo con stubs:** C01–C04 son independientes; cada spec define la interfaz pública que consumen los demás (nadie espera al compañero).
3. **C05 necesita interfaces, no implementaciones:** arranca con las interfaces de ola 1 acordadas; la implementación de los otros módulos puede seguir avanzando en paralelo.
4. **Ola 3 independiente entre sí:** C06–C09 no dependen unos de otros (todos cuelgan del contrato de C05 / de la API resultante).
5. **Archivos compartidos:** `build.gradle`, migraciones (`db/migration`) y configuración los toca **una sola persona por ola** (designada por la líder) — un dueño por archivo compartido por ola (plan §6).

---

## Path crítico (camino crítico)

**C00 → (C01 / C02 / C03 / C04) → C05 → (C06 / C07 / C08 / C09) → C10**

- **C00** es bloqueo total (ola 0).
- La **ola 1** está en el path crítico como conjunto: C05 no puede validar solapamientos reales sin los módulos que lo alimentan (aunque arranque con interfaces).
- **C05** es el change más pesado y el único con ciclo OPSX completo obligatorio (fase D) — retrasos acá retrasan toda la ola 3.
- **C10** cierra: nada se despliega hasta la verificación integral (fase F).

---

## Changes

### C00 — Base del proyecto
- **Ola:** 0 · **Depende de:** nada.
- **Responsable sugerido:** Agustina.
- **Tamaño:** 🔴 **grande** — *si crece, partirlo* (plan §7): ejemplo de split = `C00a` esqueleto Spring Boot + Gradle + README / `C00b` PostgreSQL Docker + Flyway + contexto de tenant + estructura modular.
- **Módulos y archivos que toca:** `backend/` completo (esqueleto Gradle, `build.gradle`, `settings.gradle`), `backend/src/main/resources/db/migration/` (migración inicial), `config/` (seguridad mínima, CORS local, seeds base), estructura de paquetes `tenancy`, `identidad`, `catalogo`, `pacientes`, `turnos`, `config/`, contexto de tenant (filtro de persistencia), README reproducible, `docker-compose.yml`.
- **Alcance:** que el proyecto **levante con un comando**, PostgreSQL (siempre PostgreSQL, nunca H2), Flyway corriendo, tests en verde, estructura modular con límites de módulo (cada módulo expone interfaz, no toca tablas de otro).
- **Riesgos:** es el **camino crítico** — si se alarga bloquea a los 4 integrantes; Docker puede fallar en algunas máquinas (mitigación: PostgreSQL directo, plan §4); peor arranque en frío de contexto (los demás arrancan contra el esqueleto).

### C01 — Consultorios (tenant) y autenticación con roles
- **Ola:** 1 · **Depende de:** C00.
- **Responsable sugerido:** Lucia.
- **Tamaño:** mediano.
- **Módulos y archivos que toca:** `tenancy` (entidad `Consultorio`, alta vía seed/script de `SUPERADMIN` — RN-TEN-04), `identidad` (usuarios, login, roles `ADMIN_CONSULTORIO`/`ODONTOLOGO`/`RECEPCION`/`SUPERADMIN`, tenant resuelto **desde el token** — RN-TEN-01), migración Flyway de `consultorio` + `usuario`/`rol`, config de seguridad. Interfaz pública a exponer: **usuario autenticado + rol + `tenantId`**.
- **Riesgos:** **IN-03** — el plan §5.2 no define rol `PACIENTE` (la auto-reserva US-001 queda cuestionada): no inventar, preguntar a la líder; estrategia de auth aún abierta (token propio vs proveedor externo, plan §12); archivo compartido de config/migraciones → coordinar dueño de ola.

### C02 — Catálogo: profesionales y sillones/boxes
- **Ola:** 1 · **Depende de:** C00.
- **Responsable sugerido:** Kevin.
- **Tamaño:** mediano.
- **Módulos y archivos que toca:** `catalogo` (entidades `Profesional`, `SillonBox`; restricciones únicas **con `tenant_id`**: (`tenantId`,`nombre`), (`tenantId`,`email`) — RN-TEN-03), migración Flyway de esas tablas, endpoints CRUD dentro del tenant. Interfaz pública: catálogo del consultorio (profesionales y sillones/boxes activos).
- **Riesgos:** solapamiento de archivos con C01/C03/C04 en `build.gradle`/migraciones/config (un dueño por ola); definir en el spec si `Profesional` se vincula a `Usuario` ODONTOLOGO (1:1 opcional) para no acoplar con C01.

### C03 — Pacientes (registro mínimo)
- **Ola:** 1 · **Depende de:** C00.
- **Responsable sugerido:** Lea.
- **Tamaño:** chico.
- **Módulos y archivos que toca:** `pacientes` (entidad `Paciente`: nombre + al menos un contacto obligatorio — RN-PAC-01; búsqueda básica — RN-PAC-02; único compuesto con `tenantId`), migración Flyway de `paciente`, endpoints de alta/búsqueda. Interfaz pública: pacientes del tenant.
- **Riesgos:** **datos siempre ficticios** (regla dura, plan §10); tentación de meter historia clínica → fuera de alcance (RN-EX-01); conflictos de migración compartida.

### C04 — Prestaciones con duración variable
- **Ola:** 1 · **Depende de:** C00.
- **Responsable sugerido:** Gero.
- **Tamaño:** chico.
- **Módulos y archivos que toca:** `catalogo` (entidad `Prestacion` con `duracionMin` > 0; única compuesta (`tenantId`,`nombre`)), migración Flyway de `prestacion`, endpoints CRUD. Interfaz pública: catálogo de prestaciones con duración (define `horaFin = horaInicio + duración` en C05 — RN-AG-07).
- **Riesgos:** **comparte el módulo `catalogo` con C02** → coordinar dueño de archivos dentro de la ola (los dos tocan `catalogo`; separar bien entidades/migraciones); definir en el spec la interfaz exacta que consumirá C05.

### C05 — Crear turno sin solapamientos por profesional Y sillón/box
- **Ola:** 2 · **Depende de:** interfaces acordadas de C01 (auth + tenant), C02 (profesional y sillón/box), C03 (paciente), C04 (prestación/duración) — **no** de su implementación completa (plan §7).
- **Responsable sugerido:** Agustina (líder).
- **Tamaño:** 🔴 **grande** — *si crece, partirlo* (plan §7): posible split = `C05a` modelo de `Turno` + `AgendaSlot` + creación con validación / `C05b` bordes (paciente solapado, turnos contiguos, slots). Partir **no** baja la exigencia de escenarios.
- **Módulos y archivos que toca:** `turnos` (entidades `Turno`, `AgendaSlot`; estados `RESERVADO`/`CANCELADO`), migración Flyway de `turno`/`agenda_slot` con índices (`tenantId`,`profesionalId`,`fecha`) y (`tenantId`,`sillonBoxId`,`fecha`), endpoints de creación de turno, consumo de interfaces de `identidad`/`tenancy`/`catalogo`/`pacientes`. Nunca toca tablas de otros módulos.
- **Alcance / reglas duras:** crear turno **sin solapamientos por profesional Y por sillón/box dentro del tenant** (RN-AG-02). Validación **transaccional en servidor** (nunca solo en frontend): la verificación de solapamiento y la inserción corren de forma atómica para que dos reservas simultáneas no pasen juntas. Un turno que empieza **justo cuando termina** otro es **válido** (RN-AG-06). Duración según prestación (RN-AG-07). Todo dentro de slots activos (RN-AG-05). `tenant_id` **desde el token**, nunca del cliente (RN-TEN-01). Tests de aislamiento entre tenants obligatorios (RN-TEN-02).
- **Ciclo OPSX completo:** es **el change del ciclo OPSX completo** (explore → propose → apply → verify → archive, plan §7/§8-D). Spec aprobado con **mínimo 3 escenarios**: **feliz**, **error de negocio** (solapamiento por profesional o por sillón/box → rechazo), **borde** (turnos contiguos válidos, límite de horario). Salida de fase D: los 3 escenarios con tests en verde y change archivado.
- **Riesgos:** es el mayor del proyecto (multi-tenant agranda el alcance — plan §13: mantener tenant mínimo, `tenant_id` + aislamiento + tests); condiciones de carrera en la validación (validación transaccional); depende de 4 interfaces — si una cambia, afecta al spec (cerrar interfaces antes de aplicar); **IN-03** (quién crea turnos: RECEPCION/ODONTOLOGO vs rol paciente).

### C06 — Cancelar turno y liberar el horario
- **Ola:** 3 · **Depende de:** C05.
- **Responsable sugerido:** Lucia.
- **Tamaño:** mediano.
- **Módulos y archivos que toca:** `turnos` (estado `CANCELADO`, el horario vuelve a estar disponible — US-002), posible endpoint/estado en migración si falta columna de estado, autorización por rol (solo dueño de agenda / recepción del mismo tenant — RN-AG-03).
- **Riesgos:** depende de cómo C05 modeló estados (interfaz acordada); conflictos con C07/C08 en el módulo `turnos` dentro de la misma ola → separar archivos o coordinar dueño por ola.

### C07 — Reprogramar turno
- **Ola:** 3 · **Depende de:** C05.
- **Responsable sugerido:** Kevin.
- **Tamaño:** mediano.
- **Módulos y archivos que toca:** `turnos` (mover horario/fecha revalidando **todas** las reglas de solapamiento sobre el nuevo rango — RN-AG-01/02/06, transaccional), `identidad` para autorización (RN-AG-03).
- **Riesgos:** misma validación que C05 pero sobre un turno existente (riesgo de duplicar lógica — reusar la interfaz de validación de C05, no copiarla); conflictos de archivo con C06/C08 en `turnos`.

### C08 — Consulta de agenda diaria y semanal
- **Ola:** 3 · **Depende de:** C05.
- **Responsable sugerido:** Lea.
- **Tamaño:** mediano.
- **Módulos y archivos que toca:** `turnos` (lectura de agenda por rango: día/semana, por profesional; recepción ve la agenda general del consultorio, cada odontólogo solo la suya — RN-AG-03), índices de lectura (`tenantId`,`profesionalId`,`fecha`), endpoints de consulta. **Contrato de API** que consumirá C09.
- **Riesgos:** filtrado por tenant debe ser automático (no a mano) — test de aislamiento obligatorio; cambios de contrato después de que C09 arranque → congelar contrato en el spec.

### C09 — Frontend mínimo en TypeScript vanilla
- **Ola:** 3 · **Depende de:** contrato de API de C05–C08 (y C01 para login) — **fuera del primer change** (plan §2: frontend mínimo, después del backend).
- **Responsable sugerido:** Gero.
- **Tamaño:** mediano — mínimo viable: consumir la API, no reescribir lógica de negocio en el navegador.
- **Módulos y archivos que toca:** `frontend/` (`src/features/` por funcionalidad: auth, agenda, pacientes; `src/shared/` fetch client + tipos; `src/pages/`), CSS responsivo. **No toca** el backend salvo ajustes de CORS local (config) si hace falta. Validaciones de solapamiento **siempre en servidor**; el frontend solo UX.
- **Riesgos:** riesgo de scope (pantallas de más — MVP es lo mínimo para operar el flujo); consumir un contrato que aún cambia (trabajar contra el contrato congelado de los specs); CORS (en local el origen del frontend local, en nube solo su dominio).

### C10 — Despliegue (Vercel / Render / Neon)
- **Ola:** 4 · **Depende de:** MVP verificado en local (fase F: se puede crear consultorio, usuarios, profesionales, boxes, pacientes y turnos sin solapamientos).
- **Responsable sugerido:** Agustina + 1 integrante.
- **Tamaño:** mediano.
- **Módulos y archivos que toca:** config de producción (`config/`, variables de entorno), `.env.example`, `.gitignore`, README (arranque en frío documentado), CI/servicio en Render, proyecto Neon, publicación en Vercel. Código de negocio: solo lo mínimo para hacerlo configurable.
- **Checklist (plan §9):**
  1. **Neon:** crear proyecto y base PostgreSQL; cadena de conexión **solo en variables de entorno**.
  2. **Render:** servicio web del backend (Docker o build de Gradle); env vars (BD Neon, secreto del token, dominio permitido por CORS); endpoint de health check.
  3. **Migraciones:** aplicar Flyway sobre Neon (mismas migraciones que local).
  4. **Vercel:** publicar frontend apuntando a la URL del backend **por configuración, no hardcodeada**.
  5. **CORS:** permitir **únicamente** el dominio del frontend.
  6. **Prueba de humo en la nube** con **datos ficticios**.
  7. **Sin secretos en el repo:** `.env` en `.gitignore`, solo `.env.example` sin valores reales.
- **Antes de desplegar:** verificar en las páginas oficiales de Vercel, Render y Neon los **límites vigentes de los planes gratuitos** (cambian seguido; no asumirlos).
- **Riesgos:** arranque en frío (aceptable para validar, no para producción real — documentar en README); límites de planes gratuitos por verificar; diferencias local/nube (mitigación: PostgreSQL en ambos + migraciones versionadas).

---

## Resumen por change

| ID | Change | Responsable | Tamaño | Ola |
|---|---|---|---|---|
| C00 | Base del proyecto | Agustina | 🔴 grande (partir si crece) | 0 |
| C01 | Consultorios y auth con roles | Lucia | mediano | 1 |
| C02 | Catálogo: profesionales y sillones/boxes | Kevin | mediano | 1 |
| C03 | Pacientes (registro mínimo) | Lea | chico | 1 |
| C04 | Prestaciones con duración variable | Gero | chico | 1 |
| C05 | Crear turno sin solapamientos (OPSX completo) | Agustina | 🔴 grande (partir si crece) | 2 |
| C06 | Cancelar turno y liberar horario | Lucia | mediano | 3 |
| C07 | Reprogramar turno | Kevin | mediano | 3 |
| C08 | Agenda diaria y semanal | Lea | mediano | 3 |
| C09 | Frontend mínimo TS vanilla | Gero | mediano | 3 |
| C10 | Despliegue | Agustina + 1 | mediano | 4 |

---

## Riesgos del roadmap (plan §13 + específicos)

| Riesgo | Alcance | Mitigación |
|---|---|---|
| Multi-tenant agranda el alcance y compromete el change principal (C05) | proyecto | Tenant mínimo: `tenant_id` + aislamiento + tests; lo demás queda como etapa posterior |
| Un change bloquea a los demás | dependencias | Contratos en los specs, stubs y ola 0 corta (C00 lo más chico posible) |
| Conflictos de archivos entre 5 personas | todas las olas | Módulos separados y **un dueño por archivo compartido por ola** (`build.gradle`, migraciones, config) |
| Diferencias entre local y nube | C10 | PostgreSQL en ambos y migraciones Flyway versionadas en el repo |
| Arranque en frío de los planes gratuitos | C10 | Aceptarlo para validación; documentarlo en el README |
| Se pierde contexto entre sesiones | proyecto | Registrar decisiones en Engram y en `knowledge-base/decisiones` |
| **IN-03:** rol `PACIENTE` sin definir en plan §5.2 (¿auto-reserva o solo creación por recepción?) | C01, C05 | No inventar: preguntar a la líder antes de cerrar specs de turnos |
| Estrategia de autenticación sin definir (token propio vs proveedor) | C01 | Pregunta abierta plan §12; decidir en spec de C01 |
| Límites de planes gratuitos de Vercel/Render/Neon por verificar | C10 | Verificar en páginas oficiales antes de desplegar (plan §9) |
| C05 grande y en el path crítico | C05 → ola 3 | Ciclo OPSX completo desde el inicio; partir el change si crece, sin bajar la exigencia de 3 escenarios |

---

## Interfaces, stubs y reglas del workflow (plan §6 y §7)

**Interfaces y stubs:**
- Cada spec de la **ola 1 (C01–C04)** define su **interfaz pública** (endpoints, DTOs, contratos de servicio). Los demás cambios programan **contra stubs** de esas interfaces sin esperar la implementación del compañero.
- **C05** arranca con las interfaces de ola 1 **acordadas** (no implementadas al 100%).
- **C09** trabaja sobre el **contrato de API** congelado de C05–C08 (los specs de ola 3 lo mantienen estable).

**Workflow en GitHub (plan §6):**
- Rama principal protegida: **solo por Pull Request con ≥ 1 aprobación**.
- Una rama por change: **`feature/<id-change>-<nombre>`** (p. ej. `feature-C05-crear-turno-sin-solapamiento`).
- **Tests en verde + rebase (o merge) de la rama principal antes de pedir el PR.**
- Commits chicos y frecuentes, cada quien con su propio usuario.
- **Archivos compartidos** (`build.gradle`, migraciones, configuración): **una sola persona por ola** los toca.
- Ciclo OPSX por change: **explore → propose → apply → verify → archive**; en Apply no se inventan decisiones fuera del spec — si falta algo, se vuelve a Propose.
- Ningún change sin **spec aprobado con ≥ 3 escenarios** (feliz, error de negocio, borde).

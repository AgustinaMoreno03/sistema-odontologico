# Cambio de stack: instrucciones para OpenCode

> Guardar en el repo como `docs/cambio-de-stack.md`. Leer completo antes de tocar cualquier archivo.
> Este documento **modifica** las decisiones de tecnología de `docs/plan-ejecucion.md` y de la knowledge-base. **No** cambia el alcance del MVP.

---

## 0. Reglas para el agente

1. **No edites nada todavía.** Primero ejecutá la Fase 0 (análisis de impacto, solo lectura) y mostrame el resultado.
2. Después de la Fase 0 preguntá **Continuar / Ajustar / Parar acá** y esperá la respuesta de la líder. No avances por tu cuenta.
3. **No inventes.** Si algo no está claro o no está respaldado, anotalo en `knowledge-base/preguntas-abiertas` como "No evidenciado".
4. Si algo de este documento contradice la KB, `CHANGES.md`, `AGENTS.md` o lo ya implementado, **avisalo** y proponé cómo resolverlo. No lo resuelvas en silencio.
5. Datos ficticios siempre. Nunca datos reales de pacientes.
6. No hagas commit ni push sin que se pida explícitamente.

---

## 1. Decisiones nuevas de tecnología

| Tema | Antes | Ahora |
|---|---|---|
| Backend | Spring Boot con Gradle | **Node.js con Express 5, en JavaScript** |
| Arquitectura | Monolito modular | Monolito modular **por capas**: rutas HTTP → servicios → dominio → repositorios con SQL |
| Base de datos | PostgreSQL | **PostgreSQL 18**, sin depender de un proveedor (SQL estándar, conexión por `DATABASE_URL`) |
| Migraciones | Flyway | **Scripts SQL numerados** en el repo, que solo avanzan |
| Frontend | TypeScript vanilla | **React 19 con Vite** |
| Tests | JUnit / Spring | Tests automatizados en Node (`npm test`), uno por escenario del spec |

**Sin cambio:** multi-tenant con aislamiento por consultorio, todo en local hasta terminar el MVP y despliegue posterior en Vercel (frontend), Render (backend) y Neon (PostgreSQL) en planes gratuitos, equipo de 5 con la líder conduciendo, ciclo OPSX, reglas de `AGENTS.md` del grupo A.

---

## 2. Alcance: lo que NO cambia

- El MVP sigue siendo **agenda + turnos con registro mínimo de paciente**.
- **Fuera del MVP:** historia clínica, cobros y contabilidad, sucursales (multi-sede).
- El change principal sigue siendo **crear un turno sin solapamientos** por profesional y por sillón/box.
- Las reglas de este documento sobre dinero e historia clínica (3.7 y 3.8) se registran como **convenciones para cuando se agreguen esos módulos**. **No se implementan ahora.**

---

## 3. Convenciones técnicas

### 3.1 Capas y módulos
- Separar en archivos distintos: **rutas** (HTTP), **servicios** (casos de uso), **dominio** (reglas de negocio) y **repositorios** (consultas SQL). Nada de lógica ni SQL dentro de las rutas.
- Un módulo por área (`auth`, `consultorios`, `catalogo`, `pacientes`, `turnos`). Un módulo **no toca las tablas de otro**: se comunican por la interfaz del módulo.

### 3.2 Multi-tenant
- Columna **`consultorio_id`** en **todas** las tablas de negocio, aunque por ahora haya un solo consultorio.
- **Toda consulta filtra por `consultorio_id`.** El valor sale del usuario autenticado (token), **nunca** de un parámetro del cliente.
- Claves únicas e índices incluyen `consultorio_id`.
- Tests de aislamiento: un usuario del consultorio A no ve ni modifica datos del B.
- No crear `sucursal_id` en el MVP. Dejar "sucursales" como pregunta abierta.

### 3.3 Migraciones SQL numeradas
- Carpeta `db/migrations/` con archivos `001_pacientes.sql`, `002_turnos.sql`, etc.
- **Solo avanzan:** nunca se edita una migración ya mergeada; los cambios van en una migración nueva.
- Nadie crea ni modifica tablas a mano en la base. Cualquiera levanta la base igual con un comando.
- Proponer en la Fase 1 un runner simple de migraciones SQL (puede ser una librería liviana o un script propio) y justificar la elección.
- **Riesgo con 5 personas en paralelo:** dos changes pueden crear el mismo número. Mitigación: `CHANGES.md` reserva un **rango de numeración por change** (por ejemplo C01: 010 a 019, C02: 020 a 029).
- Evaluar una restricción de exclusión en PostgreSQL para impedir solapamientos de turnos aun con pedidos simultáneos, y decidirlo en el `design.md` del change.

### 3.4 Autenticación aislada
- Todo el login vive en **un solo módulo** (`src/modules/auth/`), separado del resto del código.
- El resto del sistema solo usa una interfaz estable que devuelve `{ usuarioId, consultorioId, rol }`. Así se puede **reemplazar** el login más adelante sin tocar nada más.
- Implementación simple en el MVP.

### 3.5 Roles y permisos (a confirmar con la líder)
- Roles propios del sistema, con los permisos definidos en un solo lugar.
- La lista que se pidió (dueño, admin, técnico, mostrador) parece de otro rubro. Para el consultorio, proponer: **dueño del consultorio, admin, odontólogo, recepción**.
- Registrar la propuesta y esperar confirmación antes de modelar los roles.

### 3.6 Fechas
- Se guardan en **UTC** en la base (`timestamptz`).
- La hora de Argentina (`America/Argentina/Buenos_Aires`) se usa **solo para mostrar**.
- Un turno es un intervalo `[inicio, fin)`: un turno que empieza justo cuando termina otro **no** es un solapamiento (es el caso borde del spec).

### 3.7 Dinero (convención para etapas posteriores)
- Importes en **centavos (entero)** o `NUMERIC`. **Nunca float.**
- Los cobros y el registro contable van en **su propio módulo**, con protección contra doble envío (idempotencia).
- **No se implementa en el MVP.**

### 3.8 Historia clínica (convención para etapas posteriores)
- No se borra ni se pisa: las correcciones se agregan como un **registro nuevo con fecha y autor**.
- Verificar el respaldo legal (Ley 26.529) antes de darlo por cierto y anotarlo en preguntas abiertas.
- **No se implementa en el MVP.**

### 3.9 Secretos
- Contraseñas y claves van en un `.env` que **no se sube al repo**.
- Subir un `.env.example` sin valores reales.

### 3.10 Frontend
- React 19 con Vite, **mínimo y fuera de los primeros changes** (queda para el change del frontend, el primero que se recorta si hay atraso).
- Decidir si usa TypeScript o JavaScript. La regla "sin `any`" solo aplica si es TypeScript.

### 3.11 Tests
- Tests automatizados que cubran **cada escenario** del spec (≥3: feliz, error de negocio y borde).
- La base para tests corre con PostgreSQL en `docker compose` (o instalado localmente si Docker da errores).

---

## 4. Plan de trabajo

### Fase 0: análisis de impacto (SOLO LECTURA, no editar nada)
Revisá y listá qué quedó desactualizado o contradice este documento en:
- `knowledge-base/`: decisiones, arquitectura, modelos de datos, reglas de negocio, actores, features y preguntas abiertas.
- `CHANGES.md`: cada change, en especial C00 (base del proyecto) y los que mencionen Spring Boot, Gradle, JPA o Flyway.
- `docs/plan-ejecucion.md`.
- `AGENTS.md` y `CLAUDE.md`: reglas que dependan del stack anterior (por ejemplo, "correr `./gradlew build`", "Flyway inmutable", "sin `any` en TS").
- Skills instaladas y `.atl/skill-registry.md`: marcá las específicas de Spring Boot (`springboot-patterns`, `jpa-patterns`, `springboot-tdd`, `springboot-security`).

Después **frená y preguntá** Continuar / Ajustar / Parar acá.

### Fase 1: aplicar el cambio (solo si la líder confirma)
1. Actualizar la KB para reflejar este documento.
2. Regenerar `CHANGES.md` conservando las olas, las dependencias y la asignación. Adaptar **C00 (base)**: Express 5, estructura por capas, `docker compose` con PostgreSQL 18, migración `001`, runner de migraciones, módulo `auth` mínimo, `.env.example` y README. Incluir los rangos de numeración de migraciones por change.
3. Actualizar `docs/plan-ejecucion.md` en lo que cambia.
4. Actualizar `AGENTS.md` y `CLAUDE.md`: reemplazar las reglas de Spring/Gradle por sus equivalentes (tests verdes con `npm test` antes de cada PR, migraciones SQL numeradas que no se editan una vez mergeadas) y sumar las de este documento. Cada regla se confirma una por una con la líder.
5. Skills: desinstalar o dejar de usar las de Spring Boot y recomendar (solo recomendar) skills equivalentes para Node/Express, PostgreSQL y React. La líder elige. Regenerar `.atl/skill-registry.md`.

### Fase 2: seguir con el ciclo normal
Continuar con C00 y las olas del roadmap, con el ciclo OPSX completo.

---

## 5. Preguntas abiertas para registrar

- ¿La cátedra confirma el cambio de stack, o el stack Spring Boot / TypeScript vanilla es obligatorio?
- ¿Neon soporta PostgreSQL 18? Si no, usar en local y en la nube **la misma versión**, la más nueva que ambos soporten.
- Sucursales (multi-sede): fuera del MVP.
- Roles definitivos del consultorio.
- Herramienta de migraciones y forma de reservar la numeración entre 5 personas.
- Respaldo legal del registro de historia clínica sin borrado (Ley 26.529).
- Cobros y contabilidad: etapas posteriores.

---

## 6. Criterios de aceptación

- La Fase 0 se entregó como informe, sin ningún archivo modificado.
- Después de la Fase 1, la KB, `CHANGES.md`, `AGENTS.md`, `CLAUDE.md` y el registro de skills no mencionan Spring Boot ni Gradle como stack vigente.
- El MVP sigue siendo agenda y turnos; historia clínica, cobros y sucursales no aparecen como changes del roadmap.
- Todas las consultas del diseño filtran por `consultorio_id` tomado del token.

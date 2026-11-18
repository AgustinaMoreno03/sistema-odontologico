# Sistema de Gestión Odontológica — Base de Conocimiento

Base de conocimiento del sistema de turnos odontológicos, a partir de Discovery y las decisiones aprobadas de la Fase 1.

## Índice de Archivos

| Archivo | Contenido |
|---------|-----------|
| [01_vision_y_objetivos.md](01_vision_y_objetivos.md) | Propósito, objetivos por actor, alcance MVP v1.0 y fuera de alcance |
| [02_descripcion_general.md](02_descripcion_general.md) | Stack (Express 5 y React 19 con Vite en JavaScript, PostgreSQL 18), monolito modular + frontend separado, despliegue Vercel/Render/Neon, integraciones post-MVP, resumen API |
| [03_actores_y_roles.md](03_actores_y_roles.md) | Permisos de administración, odontología y recepción |
| [04_modelo_de_datos.md](04_modelo_de_datos.md) | Multi-tenant (`consultorio_id` en cada tabla), Consultorio, Profesional, SillonBox, Prestacion, Paciente, Turno, ERD, seed data |
| [05_reglas_de_negocio.md](05_reglas_de_negocio.md) | Reglas codificadas RN-* (tenancy, agenda/turnos, pacientes, auth; HC y cobros post-MVP) |
| [06_funcionalidades.md](06_funcionalidades.md) | Historias de usuario, changes asociados y extensiones de agenda |
| [07_flujos_principales.md](07_flujos_principales.md) | Flujos extremo a extremo: auth, reserva, cancelación, agenda, usuarios, pacientes |
| [08_arquitectura_propuesta.md](08_arquitectura_propuesta.md) | Arquitectura objetivo (plan §4), tenant en cada capa, módulos y límites, despliegue, seguridad, variables de entorno |
| [09_decisiones_y_supuestos.md](09_decisiones_y_supuestos.md) | Decisiones DD-01 a DD-15 y supuestos |
| [10_preguntas_abiertas.md](10_preguntas_abiertas.md) | Decisiones pendientes y aclaraciones cerradas |
| [11_devops_local_docker.md](11_devops_local_docker.md) | **Extra**: arranque local, Docker Compose y alternativa local, datos, checklist de onboarding |

## Quick Start para Desarrolladores

1. Entender el dominio → [01](01_vision_y_objetivos.md), [03](03_actores_y_roles.md)
2. Entender los datos → [04](04_modelo_de_datos.md)
3. Entender las reglas → [05](05_reglas_de_negocio.md)
4. Entender la arquitectura → [02](02_descripcion_general.md), [08](08_arquitectura_propuesta.md)
5. Implementar → [07](07_flujos_principales.md), [06](06_funcionalidades.md)
6. Correr en local → [11](11_devops_local_docker.md)
7. Antes de codificar → [09](09_decisiones_y_supuestos.md), [10](10_preguntas_abiertas.md)

## Resumen Ejecutivo

Sistema web **SaaS multi-tenant** (DD-09): consultorios aislados con `consultorio_id` en cada tabla de negocio, resuelto **siempre desde el token autenticado** (nunca desde el cliente). El backend es un **monolito modular en Node.js + Express 5 (JavaScript)** (módulos `consultorios`, `auth`, `catalogo`, `pacientes`, `turnos`; DD-13) que expone una API REST, y el **frontend React 19 con Vite (JavaScript) se sirve por separado** (CORS solo para su dominio; DD-11). Base de datos: **PostgreSQL 18** — Docker en local, Neon en la nube (DD-12). **Local hasta terminar el MVP**; después despliegue a **Vercel (frontend) / Render (backend) / Neon (BD)** en planes gratuitos (DD-10). El **MVP** cubre agenda y turnos (sin doble reserva, por profesional y por sillón/box dentro de cada tenant), pacientes con ficha básica, catálogo mínimo, y las altas mínimas de **consultorio (tenant)** y de **usuarios**; historia clínica, cobros, sucursales e integraciones (WhatsApp/email/pagos) quedan **post-lanzamiento**. Prioridad nº 1: **mantenibilidad** para un equipo de 5 en paralelo. Todo corre en **local** con **datos ficticios**.

# Sistema de Gestión Odontológica — Base de Conocimiento

Base de conocimiento del proyecto C:\Odontologia. Generada en modo interactivo (Mode B) a partir de la fase de Discovery y un Q&A estratégico completado.

## Índice de Archivos

| Archivo | Contenido |
|---------|-----------|
| [01_vision_y_objetivos.md](01_vision_y_objetivos.md) | Propósito, objetivos por actor, alcance MVP v1.0 y fuera de alcance |
| [02_descripcion_general.md](02_descripcion_general.md) | Stack (Spring Boot + Gradle + TS vanilla + PostgreSQL), monolito modular + frontend separado, despliegue Vercel/Render/Neon, integraciones post-MVP, resumen API |
| [03_actores_y_roles.md](03_actores_y_roles.md) | Roles del sistema (§5.2: ADMIN_CONSULTORIO, ODONTOLOGO, RECEPCION, SUPERADMIN), RBAC rol→permisos, matriz de permisos, rutas públicas |
| [04_modelo_de_datos.md](04_modelo_de_datos.md) | Multi-tenant (`tenant_id` en cada tabla), Consultorio, Profesional, SillonBox, Prestacion, Paciente, Turno, ERD, seed data |
| [05_reglas_de_negocio.md](05_reglas_de_negocio.md) | Reglas codificadas RN-* (tenancy, agenda/turnos, pacientes, auth; HC y cobros post-MVP) |
| [06_funcionalidades.md](06_funcionalidades.md) | Épica 0 tenancy mínimo (alta de consultorio y de usuarios) + 11 historias de usuario, con marcado MVP / post-MVP |
| [07_flujos_principales.md](07_flujos_principales.md) | Flujos extremo a extremo: auth, reserva, cancelación, agenda, usuarios, pacientes |
| [08_arquitectura_propuesta.md](08_arquitectura_propuesta.md) | Arquitectura objetivo (plan §4), tenant en cada capa, módulos y límites, despliegue, seguridad, variables de entorno |
| [09_decisiones_y_supuestos.md](09_decisiones_y_supuestos.md) | 13 decisiones documentadas (DD-01..13 — DD-09..13 del plan 2026-11-17) y supuestos (SU-01..04) |
| [10_preguntas_abiertas.md](10_preguntas_abiertas.md) | Inconsistencias (IN-01..03) + preguntas del plan §12 + 8 preguntas abiertas priorizadas |
| [11_devops_local_docker.md](11_devops_local_docker.md) | **Extra**: arranque local, Docker Compose opcional, datos, checklist de onboarding |

## Quick Start para Desarrolladores

1. Entender el dominio → [01](01_vision_y_objetivos.md), [03](03_actores_y_roles.md)
2. Entender los datos → [04](04_modelo_de_datos.md)
3. Entender las reglas → [05](05_reglas_de_negocio.md)
4. Entender la arquitectura → [02](02_descripcion_general.md), [08](08_arquitectura_propuesta.md)
5. Implementar → [07](07_flujos_principales.md), [06](06_funcionalidades.md)
6. Correr en local → [11](11_devops_local_docker.md)
7. Antes de codificar → [09](09_decisiones_y_supuestos.md), [10](10_preguntas_abiertas.md)

## Resumen Ejecutivo

Sistema web **SaaS multi-tenant** (DD-09): consultorios aislados con `tenant_id` en cada tabla de negocio, resuelto **siempre desde el token autenticado** (nunca desde el cliente). El backend es un **monolito modular en Spring Boot + Gradle** (paquetes `tenancy`, `identidad`, `catalogo`, `pacientes`, `turnos`; DD-13) que expone una API REST, y el **frontend TypeScript vanilla se sirve por separado** (CORS solo para su dominio; DD-11). Base de datos: **siempre PostgreSQL** — Docker en local, Neon en la nube (DD-12). **Local hasta terminar el MVP**; después despliegue a **Vercel (frontend) / Render (backend) / Neon (BD)** en planes gratuitos (DD-10). El **MVP** cubre agenda y turnos (sin doble reserva, por profesional y por sillón/box dentro de cada tenant), pacientes con ficha básica, catálogo mínimo, y las altas mínimas de **consultorio (tenant)** y de **usuarios**; historia clínica, cobros e integraciones (WhatsApp/email/pagos) quedan **post-lanzamiento**. Prioridad nº 1: **mantenibilidad** para un equipo de 5 en paralelo. Todo corre en **local** con **datos ficticios**.

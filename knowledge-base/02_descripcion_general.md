# Descripción General

## Stack tecnológico

| Capa | Tecnologías | Notas |
|---|---|---|
| Backend | Node.js con Express 5 (JavaScript) | API REST |
| Build backend | npm | `npm test` cubre cada escenario del spec |
| Frontend | React 19 con Vite y JavaScript | Diseño responsivo |
| Arquitectura backend | Monolito **modular** (módulos `consultorios`, `auth`, `catalogo`, `pacientes`, `turnos`) | DD-13; un solo proyecto y deploy, límites claros por módulo |
| Servido | Frontend estático **servido por separado** (Vercel en nube; servidor estático local) — el backend solo expone API REST | DD-11; **CORS solo para el dominio del frontend** |
| Base de datos | **PostgreSQL 18** — Docker en local, **Neon** en la nube (siempre PostgreSQL) | DD-12; ver `11_devops_local_docker.md` |
| Ejecución | **Local hasta terminar el MVP**; después despliegue: **Vercel** (frontend) / **Render** (backend) / **Neon** (BD), planes gratuitos | DD-10; límites de planes a verificar al desplegar |

## Arquitectura general

Multi-tenant (DD-09), con frontend separado del backend (DD-11):

```
Navegador
   |
   +--> Frontend estático (React 19 con Vite) — Vercel en nube / servidor estático en local
   |        |
   |        |  CORS (solo el dominio del frontend)
   |        v
   +--> API REST: Express 5 (monolito modular)
            |
            v
         PostgreSQL 18 (consultorio_id en tablas de negocio)
         — Docker en local, Neon en la nube —
```

Justificación: con el presupuesto y el plazo acotados, un monolito modular con un solo deploy de backend mantiene la superficie operativa chica, mientras el frontend estático por separado permite desplegarlo en Vercel y restringir el CORS a su dominio. Los módulos (`consultorios`, `auth`, `catalogo`, `pacientes`, `turnos`) exponen interfaces y no tocan las tablas de otro → paralelismo del equipo de 5 sin acoplamiento. El **tenant (`consultorio_id`) está en cada capa**: token autenticado → contexto → SQL de repositorios filtrado por consultorio → índices y constraints.

## Integraciones externas

| Servicio | Propósito | Tipo | Estado |
|---|---|---|---|
| WhatsApp Business API | Confirmaciones y recordatorios | REST | **Post-lanzamiento** (costo a evaluar) |
| Email | Recordatorios alternativos | SMTP/API | **Post-lanzamiento** |
| Pasarelas de pago (Mercado Pago / transferencias / tarjetas) | Cobro de sesiones | REST/SDK | **Post-lanzamiento** (en MVP, cobros ni existen) |

Ninguna integración externa entra en el MVP.

## API REST (MVP)

Resumen de endpoints principales agrupados por recurso (detalle fino al implementar):

- **Auth**: `POST /api/auth/login`, `POST /api/auth/logout` (o expiración de token).
- **Consultorios (tenant)**: alta mínima vía seed o comando interno en el MVP (US-012); sin pantalla.
- **Usuarios / permisos**: `GET/POST/PUT /api/usuarios` (admin **del consultorio**, siempre dentro de su tenant).
- **Pacientes**: `GET /api/pacientes` (búsqueda), `POST /api/pacientes`, `PUT /api/pacientes/{id}` — datos básicos: nombre, contacto.
- **Catálogo**: `GET/POST/PUT /api/profesionales`, `/api/sillon-boxes`, `/api/prestaciones` (prestaciones con duración).
- **Agenda**: `GET /api/agendas` / `GET /api/agendas/{profesionalId}` — agenda por profesional.
- **Turnos**: `GET /api/turnos`, `POST /api/turnos` (reserva sin solapamientos por profesional ni sillón/box), `PUT /api/turnos/{id}/cancelar` y reprogramación según contrato del spec.

Todos los endpoints resuelven el tenant desde el token (RN-TEN-01) — ninguno recibe `consultorioId` del cliente.

Post-MVP (no implementar aún): evoluciones/historia clínica, cobros, contabilidad, sucursales y recordatorios.

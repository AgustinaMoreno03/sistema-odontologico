# Proposal

## Why

El consultorio necesita registrar y encontrar las fichas básicas de sus pacientes para gestionar turnos. C03 proporciona esa información dentro de cada consultorio y expone la interfaz que utilizará C05 al crear turnos.

## What Changes

- Dar de alta pacientes con nombre y al menos un contacto, teléfono o email.
- Representar nombre y apellido mediante los campos previstos en la KB.
- Buscar por nombre y apellido de forma parcial, sin distinguir mayúsculas ni tildes, y por contacto normalizado, con un máximo de 50 resultados.
- Limitar las altas y búsquedas al consultorio del usuario autenticado.
- Normalizar el teléfono y el email. Garantizar en PostgreSQL la unicidad del email por consultorio sin distinguir mayúsculas.
- Publicar prioritariamente el contrato existePaciente({ pacienteId, consultorioId }), con resultado Promise<boolean>, para que C05 prepare su integración.
- Cubrir con pruebas el alta válida, el rechazo por falta de contacto y el aislamiento entre consultorios.

## Capabilities

### New Capabilities

- `pacientes`: registro mínimo y búsqueda de fichas básicas de pacientes, con aislamiento por consultorio.

### Modified Capabilities

## Impact

- Módulo `pacientes`, organizado en rutas HTTP, servicios, dominio y repositorios SQL.
- Endpoints de alta y búsqueda de pacientes.
- Migraciones SQL numeradas dentro del rango 030–039 reservado para C03 en CHANGES.md.
- Dependencia del contexto autenticado definido por C00, con la interfaz `{ usuarioId, consultorioId, rol }`.
- Uso propuesto de `unaccent`, disponible según el catálogo de Neon para PostgreSQL 18, con búsqueda acotada por consultorio y sin índice funcional de unaccent en el MVP.
- Pruebas automatizadas con PostgreSQL y datos ficticios.

El alcance comprende fichas básicas y búsqueda. Historia clínica, cobros y sucursales se mantienen como etapas posteriores.

Este PR entrega la planificación de C03 para revisión de Agustina. Apply requiere su aprobación y C00 integrado en main.
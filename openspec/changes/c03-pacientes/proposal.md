# Proposal

## Why

El consultorio necesita registrar y encontrar las fichas básicas de sus pacientes para gestionar turnos. C03 proporciona esa información dentro de cada consultorio y expone la interfaz que utilizará C05 al crear turnos.

## What Changes

- Dar de alta pacientes con nombre y al menos un contacto, teléfono o email.
- Representar nombre y apellido mediante los campos previstos en la KB.
- Buscar por nombre y apellido de forma parcial, sin distinguir mayúsculas ni tildes, y por teléfono o email.
- Limitar las altas y búsquedas al consultorio del usuario autenticado.
- Aplicar la unicidad del email informado dentro del consultorio, según el modelo de datos.
- Exponer una interfaz del módulo pacientes para que turnos compruebe que el paciente pertenece al consultorio autenticado.
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
- Evaluación de `unaccent` en el diseño para la búsqueda sin distinguir tildes.
- Pruebas automatizadas con PostgreSQL y datos ficticios.

El alcance comprende fichas básicas y búsqueda. Historia clínica, cobros y sucursales se mantienen como etapas posteriores.

Este PR entrega la planificación de C03 para revisión de Agustina. Apply requiere su aprobación y C00 integrado en main.
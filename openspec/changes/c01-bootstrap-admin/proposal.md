# Propuesta: primer administrador del consultorio

## Why

El comando operativo de C01 crea un consultorio sin usuarios. Como `POST /usuarios` requiere un `ADMIN_CONSULTORIO` autenticado, hoy no hay una vía operativa para crear la primera cuenta administradora del nuevo consultorio.

## What Changes

- Extender `npm run crear-consultorio` para aprovisionar un consultorio nuevo y su primer `ADMIN_CONSULTORIO` como una única operación atómica. Si falla el alta del administrador, el consultorio no queda creado.
- **BREAKING (solo CLI):** el comando ya no crea un consultorio vacío; exige `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` en el entorno. Conserva el mensaje de éxito con el ID del consultorio y usa un mensaje seguro y un código distinto de cero ante fallas.
- Mantener la validación, la unicidad global de email y el hashing del alta de usuarios. El rol es fijo y la cuenta solo pertenece al consultorio que acaba de crear la misma operación.
- Fuera de alcance: incorporar administradores a consultorios existentes, cambiar contratos HTTP o permisos, modificar migraciones, tocar C09 o implementar UI.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `consultorio-user-management`: modificar «Alta interna de consultorios» para que el comando cree también el primer administrador y confirme ambas altas juntas. Se preservan la ausencia de registro público y los requisitos vigentes de gestión HTTP de usuarios.

## Impact

- `scripts/crear-consultorio.js`, servicio de alta de `auth` y puntos de escritura de los repositorios de `consultorios` y `auth`.
- Documentación operativa y pruebas focalizadas del comando con un cliente de base simulado, sin sumar dependencias.
- Gobernanza **CRÍTICA**: el delta y la estrategia de prueba deben recibir aprobación explícita antes de Apply.

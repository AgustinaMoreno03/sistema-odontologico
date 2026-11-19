# Proposal

## Why

El sistema necesita identidad autenticada y administración de usuarios aisladas por consultorio antes de que los módulos de la ola 1 puedan consumir un contrato estable. C01 completa el contrato mínimo iniciado por C00 con autenticación segura, roles y aprovisionamiento interno sin alterar la migración base.

## What Changes

- Incorporar login con JWT firmado, expiración de 8 horas y secreto desde `JWT_SECRET`.
- Validar tokens en `middlewareAutenticacion` y publicar `{ usuarioId, consultorioId, rol }` en `req.auth`.
- Almacenar contraseñas únicamente como hashes y responder con un error genérico ante credenciales inválidas.
- Permitir que solo `ADMIN_CONSULTORIO` cree usuarios de su propio consultorio; rechazar acceso sin credenciales válidas o con rol insuficiente.
- Permitir el alta inicial de consultorios solo mediante seed o script interno; no exponer registro público.
- Extender las tablas base `consultorio` y `usuario` de C00 mediante una migración nueva del rango C01; no modificar `001`.
- Mantener fuera de alcance los permisos de turnos, pacientes y agenda.

## Capabilities

### New Capabilities

- `user-authentication`: login, emisión y validación de JWT, contexto autenticado y comportamiento de errores de autenticación/autorización.
- `consultorio-user-management`: aprovisionamiento interno de consultorios y gestión de usuarios limitada al consultorio autenticado y al rol administrador.

### Modified Capabilities

Ninguna. El inventario actual de OpenSpec no contiene specs existentes.

## Impact

- Código futuro en `src/modules/auth/` y `src/modules/consultorios/`, incluyendo `middlewareAutenticacion` en `src/modules/auth/rutas.js`.
- Configuración de entorno mediante `JWT_SECRET`; documentar el nombre de la variable sin incluir valores reales en `.env.example`.
- Migración SQL nueva dentro del rango reservado a C01 (010–019), compatible con las tablas y UUID creados por C00.
- Contrato público de autenticación `{ usuarioId, consultorioId, rol }`; sin endpoints públicos de registro de consultorios.
- Pruebas automatizadas para expiración, autorización por rol y aislamiento entre consultorios.

# Tasks

## 1. Base de datos y esquema C01

- [x] 1.1 Inspeccionar la migración `001` mergeada de C00 y documentar el esquema real de `consultorio` y `usuario`; verificar los hallazgos contra una base local con C00 aplicado antes de diseñar la migración C01.
- [x] 1.2 Escribir primero tests de migración que fallen para las extensiones requeridas por C01; verificar que fallan sobre el esquema actual de C00 y que no requieren editar `001`.
- [x] 1.3 Implementar la migración SQL nueva en el rango 010–019 reservado en `CHANGES.md`; verificar aplicación desde base vacía y sobre C00 aplicado, repetición segura según runner y ausencia de cambios a `001`.
- [x] 1.4 Escribir primero tests fallidos de repositorios `auth`/`consultorios` para consultas tenant-scoped y aislamiento entre dos consultorios ficticios.
- [x] 1.5 Implementar repositorios con consultas parametrizadas; recibir el tenant del contexto autenticado en el límite del servicio y verificar aislamiento entre dos consultorios ficticios.

## 2. Autenticación y contexto

- [x] 2.1 Escribir primero tests fallidos para login por email, mensaje genérico, JWT emitido con `exp` de ocho horas y credenciales inválidas.
- [x] 2.2 Implementar login con email y contraseña, hash con salt aleatorio, mensaje uniforme `Usuario o contraseña incorrectos` y emisión de JWT con `exp` de ocho horas usando el `jsonwebtoken` ya instalado; verificar los tests escritos en 2.1.
- [x] 2.3 Documentar el contrato de login, token, `req.auth`, códigos 401/403 y configuración requerida; verificar que ejemplos y documentación no contengan secretos ni datos reales. Reutilizar la verificación, middleware y validación de `JWT_SECRET` ≥32 caracteres de C00; no duplicarlos.

## 3. Consultorios y administración de usuarios

- [ ] 3.1 Escribir primero un test fallido que haga `POST /consultorios` sin autenticación y espere HTTP 404.
- [ ] 3.2 Implementar el aprovisionamiento inicial de consultorio mediante seed o script interno sin ruta pública de alta; verificar que el test de `POST /consultorios` devuelve 404 y que el mecanismo interno aprovisiona un tenant.
- [ ] 3.3 Escribir primero tests fallidos para `POST /usuarios` (201), incluyendo que falle si falta email o contraseña; `GET /usuarios` (200 solo del tenant autenticado), `GET /usuarios/:id` (200 propio y 404 ajeno), rol no autorizado (403), email duplicado (409) y `consultorioId` del body ignorado.
- [ ] 3.4 Implementar `POST /usuarios`, `GET /usuarios` y `GET /usuarios/:id`; permitir creación solo a `ADMIN_CONSULTORIO` con cualquiera de los tres roles, derivar el tenant de `req.auth`, responder 404 por ID de otro tenant y 409 por email duplicado. Verificar los tests escritos en 3.3.
- [ ] 3.5 Documentar la interfaz HTTP y el límite de permisos de C01; verificar rutas, códigos HTTP y que no se documenten permisos de turnos, pacientes ni agenda.

## 4. Verificación integrada

- [ ] 4.1 Ejecutar `npm test` y verificar todos los escenarios de los specs: login válido, credenciales inválidas, token ausente/vencido/inválido y contexto autenticado (reutilizando cobertura JWT/middleware/configuración de C00); “Aprovisionamiento operativo”; “Registro público no disponible” (POST `/consultorios`, 404); “Administrador crea usuario en su consultorio”; “Rol sin permiso intenta crear usuario” (ODONTOLOGO y RECEPCION, 403); “Listado limitado al consultorio autenticado”; “Consultar por ID un usuario de otro consultorio” (404); y “Email ya registrado” (409).
- [ ] 4.2 Revisar el diff de C01 y verificar que no modifica `001`, no contiene secretos, no almacena contraseñas en texto plano y mantiene todas las operaciones tenant-scoped.

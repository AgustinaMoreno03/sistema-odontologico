# Tasks

## 1. Base de datos y esquema C01

- [ ] 1.1 Inspeccionar la migración `001` mergeada de C00 y documentar el esquema real de `consultorio` y `usuario`; verificar los hallazgos contra una base local con C00 aplicado.
- [ ] 1.2 Crear una migración SQL nueva en el rango 010–019 reservado en `CHANGES.md`, con solo las extensiones necesarias para C01; verificar aplicación desde base vacía y sobre C00 aplicado, repetición segura según runner y ausencia de cambios a `001`.
- [ ] 1.3 Implementar repositorios de `auth`/`consultorios` con consultas parametrizadas y ámbito por `consultorio_id`; verificar con tests que cada consulta deriva el tenant del contexto y no filtra datos entre dos consultorios ficticios.

## 2. Autenticación y contexto

- [ ] 2.1 Configurar `JWT_SECRET` como requisito sin valor por defecto y documentarlo en `.env.example` sin secreto real; verificar que autenticación no inicia con secreto ausente y que el archivo de ejemplo no contiene credenciales.
- [ ] 2.2 Implementar almacenamiento y verificación de contraseñas con hash y salt aleatorio; verificar que el valor almacenado no es la contraseña y que login correcto/incorrecto se comporta según el spec.
- [ ] 2.3 Implementar emisión de JWT firmado con `exp` de ocho horas y autenticación en `src/modules/auth/rutas.js` mediante `middlewareAutenticacion`; verificar firma, expiración, `req.auth` `{ usuarioId, consultorioId, rol }` y respuesta 401 para ausencia, vencimiento o token inválido.
- [ ] 2.4 Implementar login con email y contraseña y mensaje uniforme `Usuario o contraseña incorrectos`; verificar el mismo mensaje para email desconocido y contraseña incorrecta, sin filtrar la causa.
- [ ] 2.5 Documentar el contrato de login, token, `req.auth`, códigos 401/403 y configuración requerida; verificar que ejemplos y documentación no contengan secretos ni datos reales.

## 3. Consultorios y administración de usuarios

- [ ] 3.1 Implementar el aprovisionamiento inicial de consultorio mediante seed o script interno, sin ruta pública de registro; verificar que se puede aprovisionar un tenant y que la API no expone alta pública.
- [ ] 3.2 Implementar alta de usuarios solo por `ADMIN_CONSULTORIO`, permitiéndole asignar cualquiera de los tres roles; verificar que `ODONTOLOGO` y `RECEPCION` reciben 403.
- [ ] 3.3 Implementar unicidad de email y errores HTTP correspondientes; verificar que email duplicado responde 409.
- [ ] 3.4 Implementar listado y consulta por ID tenant-scoped y derivar siempre el consultorio de `req.auth`; verificar que el listado solo incluye el tenant autenticado, que un `consultorioId` distinto enviado en body se ignora y que consultar por ID un usuario de otro tenant responde 404.
- [ ] 3.5 Documentar la interfaz de administración de usuarios y el límite de permisos de C01; verificar que no se documenten permisos de turnos, pacientes ni agenda.

## 4. Verificación integrada

- [ ] 4.1 Ejecutar `npm test` con los escenarios de ambos specs y verificar los casos feliz, error genérico, 401, 403, expiración y aislamiento tenant.
- [ ] 4.2 Revisar el diff de C01 y verificar que no modifica `001`, no contiene secretos, no almacena contraseñas en texto plano y mantiene todas las operaciones tenant-scoped.

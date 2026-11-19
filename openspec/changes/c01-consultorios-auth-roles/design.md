# Design

## Context

Ver `proposal.md` para la motivación y `specs/` para el contrato observable. El checkout no contiene todavía los módulos ni la migración base de C00; C01 depende de que C00 se integre. Los acuerdos de C00 establecen tablas `consultorio` y `usuario` con IDs UUID en `001`; esa migración es inmutable y C01 usa una nueva versión de su rango reservado.

## Goals / Non-Goals

**Goals:**
- Completar identidad JWT y contexto autenticado consumible por otros módulos de la ola 1.
- Asegurar contraseñas hasheadas, autorización por rol y aislamiento por consultorio.
- Mantener C01 compatible con la base entregada por C00 sin acoplarse a cambios en `001`.

**Non-Goals:**
- Definir permisos de turnos, pacientes, catálogo o agenda.
- Exponer registro público de consultorios.
- Implementar interfaz frontend ni alterar la migración `001`.

## Decisions

- **JWT firmado con `exp` de ocho horas.** Configurar la expiración al emitir cada token y validar firma y vencimiento en las rutas protegidas. Alternativas consideradas: sesiones con estado en servidor, que agregan almacenamiento/gestión de sesión, o tokens sin expiración, que no satisfacen el límite acordado.
- **Secreto exclusivamente desde `JWT_SECRET`.** No usar secreto por defecto; el arranque de autenticación falla de forma segura si falta. El `.env.example` documenta solo el nombre, sin valor real.
- **Hash de contraseñas con `crypto.scrypt` y salt aleatorio por usuario.** Evita conservar contraseñas reversibles y no requiere un paquete de hashing adicional. Nunca registrar la contraseña recibida ni incluirla en respuestas.
- **Contexto autenticado confiable.** `middlewareAutenticacion`, ubicado en `src/modules/auth/rutas.js`, valida JWT y carga `req.auth` exclusivamente con `usuarioId`, `consultorioId` y `rol` firmados. Los módulos consumidores no aceptan `consultorioId` de entrada para seleccionar tenant. Responder 401 si falta o falla el token; responder 403 si el token es válido pero el rol no está autorizado.
- **Login con email único y respuesta indistinguible ante falla.** Buscar por email y contrastar la contraseña con su hash; email desconocido y contraseña incorrecta comparten el mensaje `Usuario o contraseña incorrectos`.
- **Autorización mínima C01.** Solo `ADMIN_CONSULTORIO` administra usuarios y puede asignar cualquiera de los tres roles. El tenant se toma de `req.auth`; un `consultorioId` del body se ignora. Listados filtran por ese tenant y la consulta por ID ajeno responde 404. Emails duplicados responden 409. No se agrega autorización para turnos, pacientes ni agenda.
- **Migración hacia adelante.** `CHANGES.md` reserva 010–019 para C01. Crear una migración SQL nueva en ese rango después de revisar el esquema real de C00. Añadir únicamente lo que falte para soportar el contrato C01; no recrear tablas, cambiar UUIDs ni editar `001`. Mantener propiedad de tablas de cada módulo y evitar operaciones sobre tablas ajenas.
- **Alta de consultorio fuera de la API pública.** Un seed o script operativo crea el tenant inicial; alta de usuarios se realiza dentro de su consultorio por administración.

## Risks / Trade-offs

- [C00 aún no está integrado y el esquema exacto de sus tablas no está disponible en este checkout] → Aplicar C01 solo después de inspeccionar la versión mergeada de `001`; ajustar la migración C01 sin modificar la base.
- [Pérdida o exposición de `JWT_SECRET` permitiría emitir tokens falsos] → Mantenerlo fuera del repositorio, validar configuración al iniciar y documentar rotación como operación controlada.
- [Tokens vigentes no se revocan individualmente antes de sus ocho horas] → Aceptar esta limitación para el MVP; no implementar lista de revocación ni sesiones en este change.
- [La administración de usuarios y autenticación concentran datos sensibles] → No devolver hashes, aplicar consultas tenant-scoped y probar intentos cruzados con dos consultorios ficticios.
- [Una contraseña débil eleva el riesgo de fuerza bruta offline aun con hash] → Usar salt aleatorio y parámetros de scrypt apropiados; limitar intentos de login queda fuera del contrato actual y puede evaluarse aparte.

## Migration Plan

1. Esperar a que C00 esté integrado y revisar tablas `consultorio`/`usuario`, tipos UUID, columnas, restricciones, runner y convenciones de migración realmente existentes.
2. Implementar migración C01 nueva dentro del rango 010–019 reservado en `CHANGES.md`, probándola sobre una base vacía con la secuencia completa y sobre una base que ya tenga C00 aplicado.
3. Configurar `JWT_SECRET` fuera del repositorio y añadir a `.env.example` únicamente la clave vacía/placeholder no secreto.
4. Probar login, expiración, autorización por rol y aislamiento entre dos consultorios ficticios.
5. Rollback local: revertir el despliegue de código y usar la estrategia soportada por el runner para migración nueva solo si no destruye datos. No modificar ni revertir manualmente `001`; preferir migración correctiva hacia adelante si C01 ya fue compartido.

## UI Mockups

- Decision: no (no UI)

# Design

## Context

Ver `proposal.md` para la motivación y `specs/` para el contrato observable. C00 ya está integrado en esta rama. Su migración `001` crea `consultorio(id UUID)` y `usuario(id UUID, consultorio_id UUID, rol TEXT)` con FK y CHECK de roles. La migración es inmutable; C01 agrega solo lo que falta mediante una migración nueva del rango reservado.

## Goals / Non-Goals

**Goals:**
- Completar el login con emisión de JWT y expiración de ocho horas, consumiendo la verificación y el contexto autenticado ya entregados por C00.
- Asegurar contraseñas hasheadas, autorización por rol y aislamiento por consultorio.
- Mantener C01 compatible con la base entregada por C00 sin acoplarse a cambios en `001`.

**Non-Goals:**
- Definir permisos de turnos, pacientes, catálogo o agenda.
- Exponer registro público de consultorios.
- Implementar interfaz frontend ni alterar la migración `001`.

## Decisions

- **JWT firmado con `exp` de ocho horas.** Configurar la expiración al emitir cada token y validar firma y vencimiento en las rutas protegidas. Alternativas consideradas: sesiones con estado en servidor, que agregan almacenamiento/gestión de sesión, o tokens sin expiración, que no satisfacen el límite acordado.
- **JWT y verificación provistos por C00.** C00 ya incluye `jsonwebtoken`, verifica JWT con algoritmo HS256, valida expiración, claims y roles, implementa `middlewareAutenticacion` en `src/modules/auth/rutas.js` y deja `{ usuarioId, consultorioId, rol }` en `req.auth`. C01 reutiliza esos componentes; no agrega otra librería ni duplica el middleware.
- **Secreto provisto por C00.** C00 exige `JWT_SECRET` de al menos 32 caracteres al iniciar, sin valor por defecto. C01 reutiliza esta validación; no la duplica. `.env.example` no contiene secretos reales.
- **Hash de contraseñas con `crypto.scrypt` y salt aleatorio por usuario.** Evita conservar contraseñas reversibles y no requiere un paquete de hashing adicional. Nunca registrar la contraseña recibida ni incluirla en respuestas.
- **Email y hash nullable en la base.** `email` y `password_hash` quedan nullable para no romper inserts existentes de C00, que crean usuarios sin esos campos. El servicio de alta de usuarios de C01 sí exige siempre email y contraseña y nunca crea por la API una cuenta sin ambos; la nulabilidad es únicamente una compatibilidad de esquema, no una regla de negocio.
- **Contexto autenticado confiable (C00).** Las rutas C01 reutilizan el `req.auth` validado por C00. Los módulos no aceptan `consultorioId` de entrada para seleccionar tenant. Responder 401 ante token ausente/inválido y 403 si el rol autenticado no está autorizado.
- **Login con email único y respuesta indistinguible ante falla.** Buscar por email y contrastar la contraseña con su hash; email desconocido y contraseña incorrecta comparten el mensaje `Usuario o contraseña incorrectos`.
- **Autorización mínima C01.** Solo `ADMIN_CONSULTORIO` administra usuarios y puede asignar cualquiera de los tres roles. El tenant se toma de `req.auth`; un `consultorioId` del body se ignora. Listados filtran por ese tenant y la consulta por ID ajeno responde 404. Emails duplicados responden 409. No se agrega autorización para turnos, pacientes ni agenda.
- **Migración hacia adelante.** `CHANGES.md` reserva 010–019 para C01. Crear una migración SQL nueva en ese rango que agregue a `usuario` email único y hash de contraseña. No recrear tablas, cambiar UUIDs ni editar `001`. Mantener propiedad de tablas de cada módulo.
- **Alta de consultorio fuera de la API pública.** Un seed o script operativo crea el tenant inicial; alta de usuarios se realiza dentro de su consultorio por administración.
- **Contrato HTTP C01.** `POST /auth/login` responde 200 con el token firmado por `jsonwebtoken` y `exp` de ocho horas; `POST /usuarios` responde 201; `GET /usuarios` responde 200 con solo usuarios del consultorio autenticado; `GET /usuarios/:id` responde 200 para un usuario propio y 404 si pertenece a otro consultorio. `POST /consultorios` responde 404.

## Risks / Trade-offs

- [La base local fue verificada contra `001` con la salida provista por la usuaria] → Mantener email/hash en una migración hacia adelante y conservar `001` intacta.
- [Pérdida o exposición de `JWT_SECRET` permitiría emitir tokens falsos] → Mantenerlo fuera del repositorio, validar configuración al iniciar y documentar rotación como operación controlada.
- [Tokens vigentes no se revocan individualmente antes de sus ocho horas] → Aceptar esta limitación para el MVP; no implementar lista de revocación ni sesiones en este change.
- [La administración de usuarios y autenticación concentran datos sensibles] → No devolver hashes, aplicar consultas tenant-scoped y probar intentos cruzados con dos consultorios ficticios.
- [Una contraseña débil eleva el riesgo de fuerza bruta offline aun con hash] → Usar salt aleatorio y parámetros de scrypt apropiados; limitar intentos de login queda fuera del contrato actual y puede evaluarse aparte.

## Migration Plan

1. Revisar `001` y contrastar tablas `consultorio`/`usuario`, tipos UUID y restricciones con la base local con C00 aplicado.
2. Implementar migración C01 nueva dentro del rango 010–019 reservado en `CHANGES.md`, probándola sobre una base vacía con la secuencia completa y sobre una base que ya tenga C00 aplicado.
3. Configurar `JWT_SECRET` fuera del repositorio y añadir a `.env.example` únicamente la clave vacía/placeholder no secreto.
4. Probar login, expiración, autorización por rol y aislamiento entre dos consultorios ficticios.
5. Rollback local: revertir el despliegue de código y usar la estrategia soportada por el runner para migración nueva solo si no destruye datos. No modificar ni revertir manualmente `001`; preferir migración correctiva hacia adelante si C01 ya fue compartido.

## UI Mockups

- Decision: no (no UI)

# auth Specification

## Purpose
Verifica la identidad del token JWT y publica el contexto estable `{ usuarioId, consultorioId, rol }` para toda la API; el consultorio y el rol salen únicamente del token firmado, nunca del cliente (DD-18, regla dura 2). En C00 cubre el middleware de verificación; el helper de tokens es soporte de implementación de la suite (sin requisito propio en este spec) y login y usuarios los agrega C01.

## Requirements

### Requirement: Middleware que adjunta el triple desde un token válido
En cada ruta protegida el sistema SHALL verificar que el JWT del encabezado `Authorization: Bearer` esté firmado con **HS256** usando el secreto de `.env` (algoritmo fijo: `alg: 'none'` o cualquier otro algoritmo → 401) y, cuando es válido, adjuntar a la request `{ usuarioId, consultorioId, rol }` extraídos exclusivamente del token.

#### Scenario: Token válido adjunta el triple exacto
- **GIVEN** un token firmado correctamente con `usuarioId`, `consultorioId` y `rol: "RECEPCION"`
- **WHEN** la request llega a una ruta protegida
- **THEN** el handler recibe exactamente ese triple y cada valor proviene del token, no de la query, el body ni headers

#### Scenario: Token forjado o con firma inválida
- **GIVEN** un token con claims alterados o firmado con un secreto distinto
- **WHEN** la request llega a una ruta protegida
- **THEN** responde 401 con mensaje genérico seguro (sin detalles de la falla ni stack traces) y no se adjunta ningún contexto

#### Scenario: Token correcto pero expirado
- **GIVEN** un token firmado correctamente cuyo `exp` ya pasó
- **WHEN** la request llega a una ruta protegida
- **THEN** responde 401; la caducidad se verifica desde el inicio aunque la política de expiración la defina C01

#### Scenario: Algoritmo no permitido en el token
- **GIVEN** un token cuyo header declara `alg: "none"` o cualquier algoritmo distinto del permitido (HS256)
- **WHEN** la request llega a una ruta protegida
- **THEN** responde 401 con mensaje genérico seguro y sin contexto adjunto; el token no se acepta aunque su payload parezca válido

#### Scenario: Claims requeridos faltantes
- **GIVEN** un token firmado correctamente pero sin `usuarioId`, sin `consultorioId` o sin `rol` (o con alguno de ellos vacío, ausente o cuyo valor no sea texto)
- **WHEN** la request llega a una ruta protegida
- **THEN** responde 401 con el mismo mensaje genérico seguro que los demás casos de rechazo, sin contexto adjunto

### Requirement: Token ausente o malformado rechazado con 401 seguro
Toda ruta protegida SHALL rechazar con 401 y mensaje seguro las requests sin token, con esquema de autorización equivocado o con contenido que no sea un JWT; `GET /health` queda exento de autenticación.

#### Scenario: Ruta protegida sin Authorization
- **GIVEN** una ruta protegida de la API
- **WHEN** se la invoca sin el encabezado `Authorization`
- **THEN** responde 401 con la forma de error JSON consistente de la API y sin contexto adjunto

#### Scenario: Contenido que no es un JWT
- **GIVEN** un encabezado `Authorization: Bearer` con texto que no tiene estructura de JWT
- **WHEN** la request llega a la ruta protegida
- **THEN** responde 401 sin revelar si el problema fue firma, estructura o caducidad

#### Scenario: Health exento de autenticación
- **GIVEN** la API en marcha
- **WHEN** se solicita `GET /health` sin token
- **THEN** responde 200 (o 503 si la base está caída), nunca 401

### Requirement: Conjunto cerrado de roles válidos (DD-17)
El sistema SHALL aceptar únicamente los roles `ADMIN_CONSULTORIO`, `ODONTOLOGO` y `RECEPCION` dentro del token; cualquier otro valor SHALL rechazarse (DD-16: no existe rol de paciente ni cuenta de paciente en el MVP).

#### Scenario: Los tres roles vigentes son aceptados
- **GIVEN** tokens firmados válidos con cada uno de los tres roles
- **WHEN** cada token llega a una ruta protegida
- **THEN** los tres son aceptados y su rol queda disponible en el contexto para la autorización futura

#### Scenario: Rol de paciente rechazado
- **GIVEN** un token firmado correctamente con `rol: "PACIENTE"`
- **WHEN** la request llega a una ruta protegida
- **THEN** responde 401, porque el paciente no es un rol del sistema (DD-16)

#### Scenario: Variantes fuera del conjunto exacto
- **GIVEN** un token con `rol: "admin"` o con cualquier valor que no sea exactamente uno de los tres roles
- **WHEN** la request llega a una ruta protegida
- **THEN** responde 401; el conjunto es cerrado y no se normaliza implícitamente

### Requirement: consultorioId y rol siempre desde el token, nunca del cliente (regla dura 2)
El contexto `consultorioId` y `rol` SHALL determinarse solo desde el token; cualquier valor enviado por el cliente en query, body o headers (por ejemplo `x-tenant-*`) SHALL descartarse sin influir en el contexto.

#### Scenario: Valores de consultorio enviados por el cliente ignorados
- **GIVEN** un token firmado del consultorio A
- **WHEN** la request incluye `?consultorioId=B`, un body con `consultorioId: "B"` o headers `x-tenant-id: B`
- **THEN** todos esos valores del cliente se descartan por completo y el contexto queda con el consultorio A

#### Scenario: Token de un consultorio no puede operar como otro
- **GIVEN** un token firmado del consultorio A cuyo emisor intenta operar como consultorio B enviando B en cualquier parte de la request
- **WHEN** la request llega a una ruta protegida
- **THEN** el contexto de trabajo es siempre A; el intento de suplantar el consultorio B no tiene ningún efecto observable

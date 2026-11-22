# user-authentication Specification

## Purpose

Define cómo los usuarios obtienen una identidad autenticada y cómo la API valida dicha identidad para proteger las operaciones del sistema dentro de un consultorio.

## Requirements

### Requirement: Login con email y contraseña y token de duración limitada
El sistema MUST autenticar usuarios mediante email único y contraseña almacenada de forma segura, y emitir JWT firmado con expiración de ocho horas. Ante credenciales inválidas, MUST responder con el mensaje genérico `Usuario o contraseña incorrectos`, sin indicar qué dato falló.

#### Scenario: Login válido produce token y contexto autenticado
- **GIVEN** un usuario con email único y contraseña válida almacenada como hash
- **WHEN** inicia sesión con su email y contraseña correctos
- **THEN** recibe un JWT firmado cuya expiración (`exp`) es ocho horas posterior a su emisión
- **AND** las solicitudes autenticadas exponen `req.auth` con `{ usuarioId, consultorioId, rol }`

#### Scenario: Credenciales inválidas usan mensaje genérico
- **GIVEN** que el email no corresponde a un usuario o la contraseña no coincide
- **WHEN** se intenta iniciar sesión
- **THEN** la respuesta informa `Usuario o contraseña incorrectos` sin distinguir la causa

### Requirement: Protección de solicitudes mediante token
El sistema MUST rechazar solicitudes protegidas que no presenten un token válido y vigente, y MUST proporcionar a las rutas el contexto de identidad autenticado.

#### Scenario: Solicitud sin token
- **GIVEN** una ruta protegida
- **WHEN** la solicitud no incluye un token
- **THEN** la respuesta es HTTP 401

#### Scenario: Token vencido o inválido
- **GIVEN** una ruta protegida
- **WHEN** la solicitud incluye un token vencido, malformado o con firma inválida
- **THEN** la respuesta es HTTP 401

#### Scenario: Token válido proporciona identidad
- **GIVEN** un JWT firmado y vigente emitido para un usuario
- **WHEN** se procesa una solicitud protegida
- **THEN** `req.auth` contiene `{ usuarioId, consultorioId, rol }` derivados de la identidad validada

### Requirement: Secreto de firma fuera del repositorio
El sistema MUST obtener el secreto de firma desde `JWT_SECRET` y MUST NOT incluir secretos reales en archivos versionados.

#### Scenario: Configuración sin secreto
- **GIVEN** que `JWT_SECRET` no está configurado
- **WHEN** el sistema intenta iniciar el componente de autenticación
- **THEN** falla de forma segura sin emitir tokens ni usar un secreto por defecto

# Design

## Context

La motivación y el alcance están en proposal.md. El comportamiento esperado está en specs/pacientes/spec.md.

C03 depende de C00 para el arranque, la conexión a PostgreSQL, el runner de migraciones y el middleware de autenticación. Agustina confirmó el contrato de C00 y comunicó que está implementado y probado en su copia, con la rama todavía pendiente de publicación. El login y la emisión de tokens corresponden a C01.

Las tablas usan nombres en singular e identificadores UUID. La tabla consultorio existe desde la migración 001 de C00.

## Goals / Non-Goals

El diseño organiza el módulo por capas, define una ficha mínima y permite integrar pacientes con turnos mediante una interfaz pública acotada al consultorio autenticado.

La entrega de C03 comprende el backend y sus pruebas. Las funciones clínicas, de cobros y de sucursales corresponden a etapas posteriores.

## Decisions

### 1. Capas del módulo pacientes

Organizar src/modules/pacientes/ en archivos separados para rutas HTTP, servicios, dominio y repositorios SQL.

Las rutas reciben la petición y traducen el resultado a HTTP. Los servicios coordinan permisos y operaciones. El dominio valida los datos básicos. Los repositorios ejecutan SQL parametrizado sobre paciente.

Esta división sigue la arquitectura acordada y permite que turnos utilice una interfaz pública del módulo.

### 2. Autenticación y permisos

Cada ruta de pacientes incorpora middlewareAutenticacion, importado desde src/modules/auth/rutas.js. C00 no lo monta globalmente.

El middleware entrega req.auth = { usuarioId, consultorioId, rol }. Pacientes utiliza exclusivamente ese consultorio para operar.

C00 valida JWT HS256 y los tres campos obligatorios. Ante token ausente o inválido responde 401 con el cuerpo acordado:

```json
{
  "error": {
    "code": "TOKEN_INVALIDO",
    "message": "No autorizado"
  }
}
```

Pacientes conserva ese comportamiento y aplica sus permisos después de autenticar.

- ADMIN_CONSULTORIO y RECEPCION pueden dar de alta pacientes.
- ADMIN_CONSULTORIO, RECEPCION y ODONTOLOGO pueden buscar fichas básicas.
- Una identidad válida sin permiso para la operación recibe 403.

El middleware elimina encabezados x-tenant-* e ignora la selección de consultorio del cliente. Los repositorios reciben consultorioId desde el contexto validado y lo incluyen en cada consulta.

### 3. Tabla paciente y datos mínimos

Proponer los siguientes campos para la migración de C03:

| Campo SQL | Tipo y regla |
|---|---|
| id | UUID, clave primaria |
| consultorio_id | UUID obligatorio, referencia consultorio(id) |
| nombre | Texto obligatorio |
| apellido | Texto opcional |
| telefono | Texto opcional |
| email | Texto opcional |
| activo | Booleano, inicialmente verdadero |
| creado_en | timestamptz, instante de creación |

Separar nombre y apellido facilita la búsqueda por ambos campos que pidió Agustina. El apellido queda opcional porque el alta mínima exige nombre y contacto.

Recortar espacios exteriores. Convertir los contactos vacíos a NULL y rechazar nombres vacíos. Exigir teléfono o email tanto en la validación del dominio como en las restricciones de la tabla.

Generar el UUID del paciente en el servicio con la función estándar de Node.js. Las referencias a consultorio utilizan el UUID autenticado.

### 4. Email único por consultorio

Aplicar una restricción única sobre (consultorio_id, email). Mantener email en NULL cuando no se informa permite múltiples pacientes con teléfono como único contacto.

Para esta propuesta, la comparación de unicidad usa el email almacenado después de recortar espacios exteriores. El spec actual no exige equivalencia entre distintas mayúsculas del email.

La base resuelve también los intentos concurrentes con el mismo email. Traducir la violación de esa restricción a un conflicto 409 con un mensaje comprensible.

### 5. Contrato HTTP propuesto

POST /api/pacientes recibe nombre, apellido opcional, telefono y email. Devuelve 201 con la ficha básica creada.

GET /api/pacientes?q=texto busca fichas básicas dentro del consultorio autenticado y devuelve 200 con una lista.

Proponer estas respuestas adicionales para revisión:

- 422 para datos obligatorios ausentes, tipos inválidos o búsqueda vacía.
- 409 para email duplicado dentro del consultorio.
- 403 para una operación que el rol autenticado no permite.
- 401 según el contrato de C00.

El cuerpo de alta admite únicamente los campos de la ficha indicados. Un identificador de consultorio enviado en el cuerpo se rechaza como campo ajeno al contrato. Los valores de query o encabezados jamás determinan el consultorio de operación.

### 6. Búsqueda con unaccent

Utilizar unaccent e ILIKE para comparar nombres y apellidos por coincidencia parcial, conservando su escritura original en la tabla y la respuesta.

La documentación de Neon consultada durante Explore indica unaccent 1.1 disponible en PostgreSQL 18. Comprobar su funcionamiento en PostgreSQL local y en el entorno de verificación antes de cerrar Apply.

La búsqueda por teléfono o email compara el valor completo después de recortar espacios exteriores. Esta propuesta garantiza los casos exactos del spec y deja documentada la semántica para revisión.

Todas las condiciones de búsqueda se agrupan bajo el filtro obligatorio consultorio_id. Parametrizar las consultas y escapar los comodines de búsqueda para interpretar el texto del usuario de forma literal.

Ordenar los resultados por apellido, nombre e id para obtener un orden estable. Para el volumen inicial se propone búsqueda directa. Evaluar paginación e índices especializados si aumenta el volumen.

Fuente consultada el 18/11/2026.
https://neon.com/docs/extensions/pg-extensions

### 7. Interfaz pública para turnos

Exponer una operación del módulo pacientes que reciba el identificador del paciente y el contexto autenticado de consultorio, y compruebe si existe dentro de ese consultorio.

La consulta utiliza id y consultorio_id. Un identificador inexistente y uno perteneciente a otro consultorio producen el mismo resultado negativo.

C05 consume esta interfaz y mantiene la propiedad de las consultas sobre paciente dentro del módulo pacientes.

### 8. Pruebas

Cubrir cada escenario del spec mediante npm test y PostgreSQL con datos ficticios de dos consultorios.

Probar alta válida, validación de nombre y contacto, email duplicado, búsqueda parcial con tildes y mayúsculas, búsqueda por contacto, permisos y aislamiento.

C00 proporciona tests/helpers/tokens.js, que exporta crearToken({ ... }). Permite indicar usuarioId, consultorioId y rol para representar diferentes usuarios y consultorios. Su rol predeterminado es RECEPCION.

Para comprobar rechazos, el helper permite expirado: true, omitir claims, cambiar el secreto o seleccionar otro algoritmo. El secreto de pruebas lo inyecta tests/setup/setup.js.

Usar tests/helpers/appProtegida.js como referencia para conectar middlewareAutenticacion. Las pruebas HTTP de pacientes deben ejercer sus propias rutas con el middleware real.

La suite de C00 crea la base de test desde cero y aplica la migración 001. C03 aporta su migración en el rango reservado. Antes de ejecutar los escenarios, comprobar que la preparación de tests descubre y aplica también esa migración y habilita unaccent. Si el setup aplica únicamente 001, coordinar su ampliación con Agustina.

Comprobar además que dos altas simultáneas con el mismo email y consultorio produzcan una sola ficha.

## Risks / Trade-offs

- Contrato de C00 confirmado pero rama todavía sin publicar. Contrastar imports, conexión y helper de tests con su versión integrada antes de Apply.
- Disponibilidad local de unaccent. Verificar su creación mediante el runner y una búsqueda con datos ficticios.
- Diferencias de mayúsculas en email. La propuesta actual conserva la comparación documentada y Agustina revisará si necesita otra regla.
- Consultas parciales costosas con crecimiento de datos. Mantener el alcance inicial y evaluar paginación e índices cuando se conozca el volumen.
- Cruce de consultorios por una condición OR mal agrupada. Verificar aislamiento buscando por cada campo y por identificador.
- Migraciones de changes paralelos. Coordinar con la líder el orden de integración y respetar el rango reservado.

## Migration Plan

1. Después de la aprobación del spec y de C00 integrado en main, contrastar este diseño con el código y las convenciones reales de C00.
2. Crear una migración SQL en el rango 030–039 de C03. Coordinar la habilitación de unaccent para que tenga un único responsable.
3. Crear paciente, sus restricciones y los índices de negocio que incluyan consultorio_id.
4. Aplicar mediante el runner acordado y verificar tanto una base vacía con todas las migraciones como una base existente de desarrollo.
5. Ejecutar las pruebas y comprobar el comportamiento de alta y búsqueda.
6. Si una migración ya integrada requiere corrección, agregar una migración posterior preservando la anterior y los datos.

## UI Mockups

Decision: no (no UI)
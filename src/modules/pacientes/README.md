# Módulo pacientes

Registra y busca fichas básicas dentro del consultorio autenticado.

## Permisos

Fuente de permisos: knowledge-base/03_actores_y_roles.md.

| Operación | ADMIN_CONSULTORIO | RECEPCION | ODONTOLOGO |
|---|---|---|---|
| Alta | Sí | Sí | No |
| Búsqueda | Sí | Sí | Sí |

Cada ruta monta middlewareAutenticacion de C00. Requiere Authorization con un token Bearer válido. El consultorio sale de req.auth.consultorioId.

El alta rechaza campos adicionales, incluido consultorioId en el body. Query y encabezados del cliente no seleccionan el consultorio.

## Alta de pacientes

POST /api/pacientes

Admite nombre, apellido, telefono y email. Requiere nombre y al menos un contacto.

Ejemplo ficticio:

```json
{
  "nombre": "Ana",
  "apellido": "Pérez",
  "telefono": "+54 (11) 0000-0000",
  "email": " ANA@EXAMPLE.COM "
}
```

Respuesta 201 con la ficha creada. Este ejemplo contiene identificadores y fecha ficticios:

```json
{
  "id": "00000000-0000-4000-8000-000000000010",
  "consultorioId": "00000000-0000-4000-8000-000000000020",
  "nombre": "Ana",
  "apellido": "Pérez",
  "telefono": "+541100000000",
  "email": "ana@example.com",
  "creadoEn": "2026-11-21T00:00:00.000Z"
}
```

El servicio genera el UUID y la base registra la fecha UTC. Apellido y contactos ausentes se devuelven como null.

### Normalización

- Nombre y apellido pierden espacios exteriores y conservan tildes y mayúsculas.
- Email pierde espacios exteriores y se guarda en minúsculas.
- Teléfono pierde espacios, guiones y paréntesis. Conserva los dígitos y un único + inicial cuando fue informado.
- Un teléfono compuesto solo por separadores, como "()", se convierte en null. El alta requiere entonces un email.
- Los números locales conservan sus dígitos. El sistema no infiere país ni área.
- Los campos informados deben ser texto. Los valores vacíos se tratan como ausentes.

La base impide emails repetidos dentro del consultorio mediante el índice único sobre consultorio_id y lower(btrim(email)). El mismo email puede existir en otro consultorio.

## Búsqueda

GET /api/pacientes?q=texto

q debe ser un único texto no vacío. Devuelve 200 con una lista de fichas básicas con los mismos campos del alta.

- Nombre y apellido se buscan parcialmente, sin distinguir mayúsculas ni tildes. ALVAR encuentra Álvarez y conserva la escritura original.
- Teléfono se compara completo después de normalizarlo. "+54 (11) 0000-0000" encuentra +541100000000.
- +541100000000 y 1100000000 se consideran diferentes.
- Email se compara completo con lower(btrim()), igual que el índice.
- Sin coincidencias, devuelve [].
- El máximo es fijo de 50 resultados.
- Orden por apellido ascendente con nulos al final, después nombre e id.
- Los caracteres %, _ y barra invertida se interpretan literalmente.
- Todas las alternativas están acotadas al consultorio autenticado.

Construir la URL con URLSearchParams o una herramienta equivalente para codificar el signo + y los demás caracteres de q.

## Interfaz pública para C05

Exportada desde src/modules/pacientes/index.js:

```javascript
existePaciente({ pacienteId, consultorioId })
```

Ambos parámetros son UUID en texto. El consumidor obtiene pacienteId de la operación y consultorioId del contexto autenticado.

| Resultado | Significado |
|---|---|
| Promise que resuelve true | El paciente pertenece al consultorio. |
| Promise que resuelve false | El paciente no existe o pertenece a otro consultorio. |
| Rechazo con ApiError 400 VALIDACION | Algún identificador es inválido. |
| Rechazo con error técnico | Falló el acceso a la base. El error se propaga al consumidor. |

C05 consume esta exportación. La consulta sobre paciente permanece dentro del módulo pacientes.

## Errores HTTP

Se utiliza el formato de C00:

```json
{
  "error": {
    "code": "DATOS_INVALIDOS",
    "message": "Se requiere teléfono o email"
  }
}
```

| Estado | Código | Caso |
|---|---|---|
| 400 | VALIDACION | UUID inválido. |
| 401 | TOKEN_INVALIDO | Autenticación ausente o inválida. |
| 403 | PROHIBIDO | Rol sin permiso. |
| 409 | EMAIL_DUPLICADO | Email repetido en el consultorio. |
| 422 | DATOS_INVALIDOS | Ficha o búsqueda inválida. |
| 500 | ERROR_INTERNO | Fallo inesperado tratado por C00. |

## Migración

030_pacientes.sql crea la tabla paciente y habilita unaccent. El runner común aplica las migraciones de db/migrations/.

La tabla usa UUID y consultorio_id referencia consultorio(id). Sus restricciones exigen nombre, al menos un contacto y contenido distinto de espacios en cada contacto informado.

Las consultas están parametrizadas. Existen un índice único para email normalizado por consultorio y un índice por consultorio y teléfono. La búsqueda parcial aplica unaccent en la consulta, sin envoltorio IMMUTABLE.

La disponibilidad de unaccent 1.1 para PostgreSQL 18 en Neon se verificó en la documentación oficial. Su ejecución en Neon queda pendiente del primer despliegue.

https://neon.com/docs/extensions/pg-extensions

## Pruebas

Desde la raíz del proyecto:

```powershell
npm.cmd test
```

Archivos de C03:

- tests/pacientes-migracion.test.js
- tests/pacientes-existencia.test.js
- tests/pacientes-alta.test.js
- tests/pacientes-busqueda.test.js
- tests/pacientes-actualizacion.test.js

Las pruebas usan PostgreSQL real y datos ficticios. El setup de C00 recrea odontologia_test y aplica todas las migraciones.

Los tests de pacientes usan consultorios propios y limpian únicamente sus datos mediante filtros o rollback. La planificación está en openspec/changes/c03-pacientes/.

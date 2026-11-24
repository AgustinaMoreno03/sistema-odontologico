# Agenda C08

Contrato aprobado en PR #22. Implementación completada por tres tandas RED/GREEN el 24/11/2026: 47 tests propios y suite completa de 505/505 en 54 archivos. Requiere revisión del PR de implementación antes de integrar; no está archivado todavía.

## Consulta HTTP

`GET /api/agenda`, con `Authorization: Bearer <JWT>` válido.

| Parámetro | Obligatorio | Formato |
|---|---|---|
| desde | Sí | ISO 8601 con zona explícita, incluido Z o desplazamiento. |
| hasta | Sí | ISO 8601 con zona explícita; posterior a desde y como máximo 168 horas después. |
| profesionalId | No | UUID; para odontólogo solo puede ser su ficha vinculada. |
| limite | No | Entero 1–200, por defecto 100. |
| offset | No | Entero 0–10000, por defecto 0. |

No se admiten otros parámetros, arrays ni parámetros repetidos. C09 construye la query con URLSearchParams. Un día local: desde `2026-12-01T00:00:00-03:00` hasta `2026-12-02T00:00:00-03:00`; una semana: lunes `2026-11-30T00:00:00-03:00` hasta lunes `2026-12-07T00:00:00-03:00`.

La selección usa intersección `[desde, hasta)`: un turno que termina exactamente en desde o comienza exactamente en hasta no aparece; uno que cruza medianoche sí aparece en los días que intersecta. Se incluyen CANCELADO y los demás estados almacenados. Consultar no modifica turnos.

## Respuesta

```json
{
  "desde": "2026-12-01T03:00:00.000Z",
  "hasta": "2026-12-02T03:00:00.000Z",
  "zonaHoraria": "America/Argentina/Buenos_Aires",
  "turnos": [],
  "hayMas": false,
  "siguienteOffset": null
}
```

Cada turno es plano: `id`, `pacienteId`, `pacienteNombre`, `pacienteApellido`, `profesionalId`, `sillonBoxId`, `prestacionId`, `inicio`, `fin`, `duracionMin`, `estado`. `pacienteApellido` es null cuando falta. Los instantes son UTC; C09 presenta la zona indicada y resuelve los nombres de catálogo mediante sus endpoints existentes. No se exponen contactos, consultorioId ni historia clínica.

Orden: inicio ASC, id ASC. Continuar con siguienteOffset mientras hayMas sea true. No se ofrece un snapshot entre páginas: si se modifican turnos mientras se navega, refrescar la agenda. Si se alcanza el máximo de offset, reducir el rango o filtrar profesional.

## Permisos y errores

Fuente: KB 03, RN-AU-02 y RN-AG-03. Recepción y administración ven todas las agendas de su consultorio y pueden filtrar profesional. El odontólogo ve solo su ficha vinculada mediante `profesionalDeUsuario({ usuarioId, consultorioId })` de catálogo. La ficha inactiva conserva acceso a su historial. Sin vínculo o al pedir otra ficha, 403. El contexto de identidad proviene exclusivamente de req.auth; query, body y headers no seleccionan consultorio.

| HTTP | code | Motivo |
|---|---|---|
| 400 | VALIDACION | Parámetros o rango inválidos. |
| 401 | TOKEN_INVALIDO | Token ausente, inválido o vencido; mensaje No autorizado. |
| 403 | SIN_PERMISO | Agenda no autorizada o profesional sin vínculo. |
| 404 | PROFESIONAL_NO_ENCONTRADO | Filtro administrativo de profesional inexistente o ajeno, sin distinguir los casos. |
| 500 | ERROR_INTERNO | Fallo inesperado, sin datos parciales ni detalles de base. |

Forma común: `{ "error": { "code": "...", "message": "..." } }`.

## Interfaz de pacientes

```js
import { obtenerNombresPacientes } from '../pacientes/index.js';
await obtenerNombresPacientes({ pacienteIds, consultorioId });
// Array de { id, nombre, apellido }; apellido puede ser null.
```

Máximo 200 IDs por llamada; UUID inválido o entrada incorrecta produce 400 VALIDACION. Deduplica; un array vacío devuelve []; omite IDs ajenos o inexistentes. Solo pacientes accede a la tabla paciente. Agenda obtiene los nombres de la página autorizada por lote, sin N+1 ni JOIN a tablas de otros módulos.

## Verificación

Las pruebas usan PostgreSQL real y fixtures ficticios propios. Los helpers compartidos se importan sin editarse. Evidencia cruda en docs/evidencias/c08: RED y GREEN por tanda y suite completa al cerrar. El RED inicial de aislamiento esperaba 200 y recibió 404; su test se conserva sin cambios.

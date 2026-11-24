import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errores.js';
import {
  calcularFin,
  errorEstadoInvalido,
  errorSolapamiento,
  errorTurnoNoEncontrado,
  traducirViolacionExclusion,
  validarInicio,
  validarUuid,
  validarSolicitadoPor,
  errorTurnoYaCancelado,
  errorTurnoPasado,
} from '../src/modules/turnos/dominio.js';

/**
 * C05 task 3.1 — dominio de turnos (design.md D6): helpers puros sin I/O.
 *
 * - `validarUuid` → 400 `VALIDACION` (spec: UUID malformado responde 400
 *   `VALIDACION`, a diferencia del `DATOS_INVALIDOS` de catálogo).
 * - `validarInicio` → ISO 8601 SOLO con timezone explícita o UTC; sin
 *   timezone → 400 `VALIDACION` (spec, Requirement "Alta de turno").
 * - `calcularFin` → `fin = inicio + duracionMin` con la duración guardada
 *   al crearse (RN-AG-07); `duracionMin = 0` daría `fin = inicio` (rango
 *   vacío) y se rechaza.
 * - `traducirViolacionExclusion` → `23P01` → `ApiError(409,
 *   'SOLAPAMIENTO', mensaje seguro)` (design D1, precedente
 *   `traducirViolacionUnica` de catalogo para `23505`).
 * - `errorSolapamiento` → el mensaje DETALLADO por recurso del pre-check
 *   (design D1: "el pre-check SELECT da mensajes detallados").
 */

const UUID = '11111111-2222-4333-8444-555555555555';

describe('dominio de turnos: validarUuid', () => {
  it.each([
    ['pacienteId', UUID],
    ['profesionalId', UUID],
    ['sillonBoxId', UUID],
    ['prestacionId', UUID],
    ['id', UUID],
  ])('acepta un UUID bien formado en %s', (campo, valor) => {
    expect(validarUuid(valor, campo)).toBe(valor);
  });

  it.each([
    ['malformado', 'no-es-uuid'],
    ['sin guiones', '11111111222243338444555555555555'],
    ['con menos dígitos', '11111111-2222-4333-8444-5555555555'],
    ['vacío', ''],
    ['no string', 123],
    ['null', null],
    ['undefined', undefined],
  ])('rechaza un identificador %s con 400 VALIDACION', (_caso, valor) => {
    expect(() => validarUuid(valor, 'pacienteId')).toThrowError(
      expect.objectContaining({ statusCode: 400, code: 'VALIDACION' })
    );
  });

  it('el mensaje de validación identifica el campo inválido', () => {
    expect(() => validarUuid('malo', 'sillonBoxId')).toThrowError(
      expect.objectContaining({ message: expect.stringContaining('sillonBoxId') })
    );
  });
});

describe('dominio de cancelación C06', () => {
  it.each(['PACIENTE', 'CONSULTORIO'])('acepta solicitadoPor %s', (valor) => {
    expect(validarSolicitadoPor(valor)).toBe(valor);
  });

  it.each([undefined, null, '', 'OTRO'])('rechaza solicitadoPor inválido: %s', (valor) => {
    expect(() => validarSolicitadoPor(valor)).toThrow(
      expect.objectContaining({ statusCode: 400, code: 'VALIDACION' })
    );
  });

  it('expone errores 409 estables para repetición y turno pasado', () => {
    expect(errorTurnoYaCancelado()).toMatchObject({
      statusCode: 409,
      code: 'TURNO_YA_CANCELADO',
    });
    expect(errorTurnoPasado()).toMatchObject({ statusCode: 409, code: 'TURNO_PASADO' });
  });
});

describe('dominio de turnos: validarInicio (ISO 8601 con timezone)', () => {
  it.each([
    ['UTC con Z', '2030-01-15T10:00:00Z', Date.parse('2030-01-15T10:00:00Z')],
    ['offset negativo', '2030-01-15T10:00:00-03:00', Date.parse('2030-01-15T10:00:00-03:00')],
    ['offset +00:00', '2030-01-15T10:00:00+00:00', Date.parse('2030-01-15T10:00:00+00:00')],
    ['con milisegundos', '2030-01-15T10:00:00.000Z', Date.parse('2030-01-15T10:00:00.000Z')],
    ['segundos con offset', '2030-01-15T10:00:30-03:00', Date.parse('2030-01-15T10:00:30-03:00')],
  ])('acepta %s y devuelve el instante correcto', (_caso, valor, esperado) => {
    const resultado = validarInicio(valor);
    expect(resultado).toBeInstanceOf(Date);
    expect(resultado.getTime()).toBe(esperado);
  });

  it.each([
    ['sin timezone', '2030-01-15T10:00:00'],
    ['solo fecha', '2030-01-15'],
    ['fecha y hora con espacio', '2030-01-15 10:00:00'],
    ['no fecha', 'ayer'],
    ['fecha imposible', '2030-13-45T10:00:00Z'],
    ['vacío', ''],
    ['no string', 123],
    ['null', null],
    ['Date object', new Date()],
  ])('rechaza %s con 400 VALIDACION', (_caso, valor) => {
    expect(() => validarInicio(valor)).toThrowError(
      expect.objectContaining({ statusCode: 400, code: 'VALIDACION' })
    );
  });
});

describe('dominio de turnos: calcularFin (RN-AG-07)', () => {
  it('calcula fin = inicio + 30 min con la duración guardada al crearse', () => {
    const fin = calcularFin('2030-01-15T10:00:00Z', 30);
    expect(fin).toBeInstanceOf(Date);
    expect(fin.toISOString()).toBe('2030-01-15T10:30:00.000Z');
  });

  it('acepta un Date como inicio y suma la duración en minutos exactos', () => {
    const inicio = new Date('2030-01-15T10:00:00Z');
    expect(calcularFin(inicio, 1).toISOString()).toBe('2030-01-15T10:01:00.000Z');
    expect(calcularFin(inicio, 480).toISOString()).toBe('2030-01-15T18:00:00.000Z');
  });

  it('rechaza duracionMin = 0: produciría fin = inicio (rango vacío, RN-AG-06)', () => {
    expect(() => calcularFin('2030-01-15T10:00:00Z', 0)).toThrowError(
      expect.objectContaining({ statusCode: 400, code: 'VALIDACION' })
    );
  });

  it.each([
    ['negativa', -30],
    ['fraccionaria', 3.5],
    ['string', '30'],
    ['null', null],
    ['undefined', undefined],
    ['NaN', NaN],
  ])('rechaza duracionMin %s con 400 VALIDACION', (_caso, duracionMin) => {
    expect(() => calcularFin('2030-01-15T10:00:00Z', duracionMin)).toThrowError(
      expect.objectContaining({ statusCode: 400, code: 'VALIDACION' })
    );
  });

  it('rechaza un inicio sin timezone aunque la duración sea válida', () => {
    expect(() => calcularFin('2030-01-15T10:00:00', 30)).toThrowError(
      expect.objectContaining({ statusCode: 400, code: 'VALIDACION' })
    );
  });
});

describe('dominio de turnos: traducirViolacionExclusion (design D1)', () => {
  it('23P01 → ApiError 409 SOLAPAMIENTO con mensaje seguro', () => {
    const traducido = traducirViolacionExclusion({
      code: '23P01',
      constraint: 'turno_profesional_sin_solape',
    });

    expect(traducido).toBeInstanceOf(ApiError);
    expect(traducido).toMatchObject({ statusCode: 409, code: 'SOLAPAMIENTO' });
    expect(typeof traducido.message).toBe('string');
    expect(traducido.message.length).toBeGreaterThan(0);
  });

  it('devuelve cualquier otro error tal cual (no lo traduce)', () => {
    const otro = { code: '23505' };
    expect(traducirViolacionExclusion(otro)).toBe(otro);

    const sinCodigo = new Error('algo falló');
    expect(traducirViolacionExclusion(sinCodigo)).toBe(sinCodigo);

    expect(traducirViolacionExclusion(undefined)).toBeUndefined();
  });
});

describe('dominio de turnos: errorSolapamiento (mensaje detallado del pre-check)', () => {
  it.each([
    ['profesional', /profesional/i],
    ['sillonBox', /sill/i],
    ['paciente', /paciente/i],
  ])('devuelve un ApiError 409 SOLAPAMIENTO que nombra al recurso %s', (recurso, esperado) => {
    const error = errorSolapamiento(recurso);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ statusCode: 409, code: 'SOLAPAMIENTO' });
    expect(error.message).toMatch(esperado);
  });

  it('los tres mensajes son distintos (detalle por recurso)', () => {
    const mensajes = ['profesional', 'sillonBox', 'paciente'].map(
      (recurso) => errorSolapamiento(recurso).message
    );
    expect(new Set(mensajes).size).toBe(3);
  });

  it('recurso desconocido → mensaje genérico igualmente seguro', () => {
    const error = errorSolapamiento(undefined);
    expect(error).toMatchObject({ statusCode: 409, code: 'SOLAPAMIENTO' });
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);
  });
});

/**
 * C07 task 3.1 — constructores nuevos de la reprogramación (design D4/D6):
 * 404 TURNO_NO_ENCONTRADO (inexistente o de OTRO consultorio: mensaje
 * seguro, sin exponer datos ajenos) y 409 ESTADO_INVALIDO (estado ≠
 * PENDIENTE, RN-AG-10). Los validadores de forma siguen respondiendo
 * 400 VALIDACION (spec S5).
 */
describe('dominio de turnos: errorTurnoNoEncontrado (C07, design D4)', () => {
  it('devuelve ApiError 404 con code TURNO_NO_ENCONTRADO', () => {
    const error = errorTurnoNoEncontrado();
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ statusCode: 404, code: 'TURNO_NO_ENCONTRADO' });
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('no expone datos de otros consultorios en el mensaje (aislamiento)', () => {
    const mensaje = errorTurnoNoEncontrado().message;
    // Mensaje seguro: no contiene identificadores UUID ni nombres de recursos.
    expect(mensaje).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(mensaje).not.toMatch(/paciente|profesional|sill/i);
  });
});

describe('dominio de turnos: errorEstadoInvalido (C07, design D4)', () => {
  it('devuelve ApiError 409 con code ESTADO_INVALIDO', () => {
    const error = errorEstadoInvalido();
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ statusCode: 409, code: 'ESTADO_INVALIDO' });
    expect(typeof error.message).toBe('string');
    expect(error.message.length).toBeGreaterThan(0);
  });

  it('los cuatro estados distintos de PENDIENTE comparten el mismo mensaje seguro', () => {
    // RN-AG-10: CONFIRMADO/ATENDIDO/AUSENTE/CANCELADO → igual 409.
    const mensajes = ['CONFIRMADO', 'ATENDIDO', 'AUSENTE', 'CANCELADO'].map(
      () => errorEstadoInvalido().message
    );
    expect(new Set(mensajes).size).toBe(1);
    expect(mensajes[0]).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});

describe('dominio de turnos: los validadores de forma siguen en 400 VALIDACION (spec S5)', () => {
  it('UUID malformado → 400 VALIDACION (incluye el :id del PATCH)', () => {
    expect(() => validarUuid('no-es-un-uuid', 'id')).toThrowError(
      expect.objectContaining({ statusCode: 400, code: 'VALIDACION' })
    );
  });

  it('inicio sin timezone → 400 VALIDACION', () => {
    expect(() => validarInicio('2026-12-01T15:00:00')).toThrowError(
      expect.objectContaining({ statusCode: 400, code: 'VALIDACION' })
    );
  });
});

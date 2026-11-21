import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/errores.js';
import {
  esBooleano,
  esTexto,
  normalizarEmail,
  normalizarTexto,
  validarCuerpo,
  validarUuid,
} from '../src/modules/catalogo/dominio.js';

/**
 * C02 — helpers puros compartidos del módulo `catalogo` (`dominio.js`):
 * normalización de textos y validación de UUID. Sin I/O (ni HTTP ni base):
 * reglas puras de dominio (DD-13). Escenarios del spec: "Nombre con espacios
 * y email con mayúsculas" y "Identificador malformado".
 */
describe('dominio compartido del catálogo: normalización', () => {
  it('normalizarTexto recorta nombre, matricula y descripcion conservando el interior', () => {
    for (const campo of ['nombre', 'matricula', 'descripcion']) {
      expect(normalizarTexto('  Dra. Ana Ruiz  '), campo).toBe('Dra. Ana Ruiz');
    }
  });

  it('normalizarTexto devuelve NULL para vacío o compuesto solo por espacios (opcionales → NULL)', () => {
    expect(normalizarTexto('')).toBeNull();
    expect(normalizarTexto('   ')).toBeNull();
  });

  it('normalizarEmail recorta y pasa a minúsculas', () => {
    expect(normalizarEmail(' ANA@EXAMPLE.COM ')).toBe('ana@example.com');
    expect(normalizarEmail('ana@example.com')).toBe('ana@example.com');
  });

  it('normalizarEmail devuelve NULL para vacío o solo espacios', () => {
    expect(normalizarEmail('')).toBeNull();
    expect(normalizarEmail('   ')).toBeNull();
  });
});

describe('dominio compartido del catálogo: validación de UUID', () => {
  it('validarUuid devuelve el identificador cuando es un UUID válido', () => {
    const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(validarUuid(uuid, 'profesionalId')).toBe(uuid);
  });

  it('validarUuid lanza ApiError 400 DATOS_INVALIDOS ante identificadores malformados', () => {
    for (const malformado of ['no-es-uuid', '', '123', 'zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz']) {
      let error;
      try {
        validarUuid(malformado, 'profesionalId');
      } catch (err) {
        error = err;
      }
      expect(error, `debe rechazar ${JSON.stringify(malformado)}`).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('DATOS_INVALIDOS');
    }
  });
});

describe('dominio compartido del catálogo: predicados y validarCuerpo (capa de rutas)', () => {
  it('esTexto y esBooleano distinguen los tipos JSON correctos', () => {
    expect(esTexto('hola')).toBe(true);
    expect(esTexto(123)).toBe(false);
    expect(esTexto(true)).toBe(false);
    expect(esBooleano(false)).toBe(true);
    expect(esBooleano('no')).toBe(false);
    expect(esBooleano(0)).toBe(false);
  });

  it('validarCuerpo devuelve solo los campos presentes y válidos del esquema', () => {
    const esquema = {
      nombre: { tipo: 'texto', requerido: true },
      activo: { tipo: 'booleano' },
    };
    expect(validarCuerpo({ nombre: 'Dra. Ana Ruiz', activo: false }, esquema)).toEqual({
      nombre: 'Dra. Ana Ruiz',
      activo: false,
    });
    expect(validarCuerpo({ nombre: 'Dra. Ana Ruiz' }, esquema)).toEqual({ nombre: 'Dra. Ana Ruiz' });
  });

  it('validarCuerpo lanza 422 DATOS_INVALIDOS por desconocidos, tipos inválidos y requeridos ausentes', () => {
    const esquema = {
      nombre: { tipo: 'texto', requerido: true },
      activo: { tipo: 'booleano' },
    };
    for (const cuerpo of [
      { nombre: 'X', consultorioId: 'uuid-ajeno' }, // regla dura 2
      { nombre: 'X', usuarioId: 'uuid' }, // vínculo solo por interfaz de módulo
      { nombre: 123 },
      { nombre: 'X', activo: 'no' },
      { activo: true }, // falta el requerido
    ]) {
      let error;
      try {
        validarCuerpo(cuerpo, esquema);
      } catch (err) {
        error = err;
      }
      expect(error, JSON.stringify(cuerpo)).toBeInstanceOf(ApiError);
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('DATOS_INVALIDOS');
    }
  });
});

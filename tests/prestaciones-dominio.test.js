import { describe, expect, it } from 'vitest';
import { validarPrestacion } from '../src/modules/catalogo/prestaciones/dominio.js';

describe('dominio de prestaciones', () => {
  it.each([1, 480])('acepta duracionMin en el limite %s', (duracionMin) => {
    expect(() => validarPrestacion({ nombre: 'Consulta', duracionMin })).not.toThrow();
  });

  it.each([0, -1, 481, 45.5, '45', null])('rechaza duracionMin invalido: %s', (duracionMin) => {
    expect(() => validarPrestacion({ nombre: 'Consulta', duracionMin })).toThrowError(
      expect.objectContaining({ statusCode: 400, code: 'DATOS_INVALIDOS' })
    );
  });

  it('acepta nombre de hasta 100 caracteres', () => {
    expect(() => validarPrestacion({ nombre: 'x'.repeat(100), duracionMin: 30 })).not.toThrow();
  });

  it.each(['', 'x'.repeat(101), null, 123])('rechaza nombre invalido: %s', (nombre) => {
    expect(() => validarPrestacion({ nombre, duracionMin: 30 })).toThrowError(
      expect.objectContaining({ statusCode: 400, code: 'DATOS_INVALIDOS' })
    );
  });
});

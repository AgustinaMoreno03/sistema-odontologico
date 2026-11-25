import { describe, expect, it } from 'vitest';
import { formatearInstante, hoyBA, rangoDiario, rangoSemanal } from './fechas.js';

describe('helpers de fecha sin librerías', () => {
  it('construye el rango diario con desplazamiento -03:00', () => {
    expect(rangoDiario('2026-12-01')).toEqual({
      desde: '2026-12-01T00:00:00-03:00',
      hasta: '2026-12-02T00:00:00-03:00',
    });
  });

  it('construye la semana desde el lunes hasta lunes+7 con -03:00', () => {
    // 2026-12-02 es miércoles; el lunes de esa semana es 2026-11-30.
    expect(rangoSemanal('2026-12-02')).toEqual({
      desde: '2026-11-30T00:00:00-03:00',
      hasta: '2026-12-07T00:00:00-03:00',
    });
    // Un lunes ya es el inicio de su propia semana.
    expect(rangoSemanal('2026-11-30').desde).toBe('2026-11-30T00:00:00-03:00');
    // Un domingo pertenece a la semana que empezó el lunes anterior.
    expect(rangoSemanal('2026-12-06').desde).toBe('2026-11-30T00:00:00-03:00');
  });

  it('presenta instantes UTC en America/Argentina/Buenos_Aires', () => {
    expect(formatearInstante('2026-12-01T13:00:00.000Z')).toContain('10:00');
    expect(formatearInstante('2026-12-01T13:00:00.000Z')).toContain('01/12/2026');
    expect(formatearInstante('2026-12-02T02:30:00.000Z')).toContain('23:30');
  });

  it('devuelve la fecha de hoy según la zona de Buenos Aires', () => {
    expect(hoyBA(new Date('2026-12-01T13:00:00.000Z'))).toBe('2026-12-01');
    expect(hoyBA(new Date('2026-12-02T02:00:00.000Z'))).toBe('2026-12-01');
    expect(hoyBA(new Date('2026-12-02T04:00:00.000Z'))).toBe('2026-12-02');
  });
});

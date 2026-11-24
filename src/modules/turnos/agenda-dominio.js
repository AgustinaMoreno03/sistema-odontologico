import { ApiError } from '../../errores.js';
import { validarUuid } from './dominio.js';

const CAMPOS = new Set(['desde', 'hasta', 'profesionalId', 'limite', 'offset']);
const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;
const invalidos = () => new ApiError(400, 'VALIDACION', 'Parámetros de agenda inválidos');

function instante(valor) {
  if (typeof valor !== 'string') throw invalidos();
  const partes = ISO.exec(valor);
  if (!partes) throw invalidos();
  const [, anio, mes, dia, hora, minuto, segundo = '0', zona] = partes;
  const y = Number(anio), m = Number(mes), d = Number(dia);
  const bisiesto = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const dias = [31, bisiesto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (y < 1 || m < 1 || m > 12 || d < 1 || d > dias[m - 1] ||
      Number(hora) > 23 || Number(minuto) > 59 || Number(segundo) > 59) throw invalidos();
  if (zona !== 'Z') {
    const desplazamiento = zona.slice(1).replace(':', '');
    if (Number(desplazamiento.slice(0, 2)) > 23 || Number(desplazamiento.slice(2)) > 59) throw invalidos();
  }
  const fecha = new Date(valor);
  if (!Number.isFinite(fecha.getTime())) throw invalidos();
  return fecha;
}

function entero(valor, defecto, minimo, maximo) {
  if (valor === undefined) return defecto;
  if (typeof valor !== 'string' || !/^\d+$/.test(valor)) throw invalidos();
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < minimo || numero > maximo) throw invalidos();
  return numero;
}

export function validarParametrosAgenda(query) {
  if (Object.keys(query).some((campo) => !CAMPOS.has(campo))) throw invalidos();
  const desde = instante(query.desde);
  const hasta = instante(query.hasta);
  const duracion = hasta.getTime() - desde.getTime();
  if (duracion <= 0 || duracion > 168 * 60 * 60 * 1000) throw invalidos();
  let profesionalId;
  if (query.profesionalId !== undefined) profesionalId = validarUuid(query.profesionalId, 'profesionalId');
  return {
    desde, hasta, profesionalId,
    limite: entero(query.limite, 100, 1, 200),
    offset: entero(query.offset, 0, 0, 10000),
  };
}

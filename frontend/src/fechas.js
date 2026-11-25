// Helpers de fecha SIN librerías (restricción de C09): rangos ISO con
// desplazamiento fijo -03:00 (America/Argentina/Buenos_Aires no aplica DST)
// y presentación de instantes UTC en la zona de Buenos Aires.
export const ZONA_BA = 'America/Argentina/Buenos_Aires';

const ISO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

function sumarDias(fecha, dias) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const timestamp = Date.UTC(anio, mes - 1, dia + dias);
  const resultado = new Date(timestamp);
  const yyyy = String(resultado.getUTCFullYear()).padStart(4, '0');
  const mm = String(resultado.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(resultado.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function diaDeLaSemana(fecha) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  // 0 = domingo … 6 = sábado, en UTC para no depender de la zona del runtime.
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

/** Rango local de un día: [00:00, 00:00 del día siguiente) con -03:00. */
export function rangoDiario(fecha) {
  if (!ISO_DIA.test(fecha)) throw new Error('Fecha inválida');
  return {
    desde: `${fecha}T00:00:00-03:00`,
    hasta: `${sumarDias(fecha, 1)}T00:00:00-03:00`,
  };
}

/** Rango semanal: lunes de la semana de `fecha` hasta lunes+7, con -03:00. */
export function rangoSemanal(fecha) {
  if (!ISO_DIA.test(fecha)) throw new Error('Fecha inválida');
  const dow = diaDeLaSemana(fecha);
  const offsetLunes = dow === 0 ? -6 : 1 - dow;
  const lunes = sumarDias(fecha, offsetLunes);
  return {
    desde: `${lunes}T00:00:00-03:00`,
    hasta: `${sumarDias(lunes, 7)}T00:00:00-03:00`,
  };
}

const formateador = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_BA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** Presenta un instante UTC (ISO) en America/Argentina/Buenos_Aires. */
export function formatearInstante(iso) {
  return formateador.format(new Date(iso));
}

/** Fecha local (YYYY-MM-DD) de hoy según Buenos Aires. */
export function hoyBA(momento = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_BA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(momento);
  const obtener = (tipo) => partes.find((parte) => parte.type === tipo).value;
  return `${obtener('year')}-${obtener('month')}-${obtener('day')}`;
}

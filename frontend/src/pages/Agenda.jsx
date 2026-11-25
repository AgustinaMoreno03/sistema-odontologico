import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/http.js';
import { formatearInstante, hoyBA, rangoDiario, rangoSemanal } from '../fechas.js';

const LIMITE = 200;

// Agenda real contra GET /api/agenda (spec "Agenda real diaria y semanal"):
// sin datos mock, sin reprogramación y sin control de cancelación.
export function Agenda({ navegar = () => {} }) {
  const [rango, setRango] = useState('dia');
  const [fecha, setFecha] = useState(() => hoyBA());
  const [profesionalId, setProfesionalId] = useState('');
  const [turnos, setTurnos] = useState([]);
  const [hayMas, setHayMas] = useState(false);
  const [siguienteOffset, setSiguienteOffset] = useState(null);
  const [error, setError] = useState(null);
  const [profesionales, setProfesionales] = useState([]);
  const [sillonBoxes, setSillonBoxes] = useState([]);
  const [prestaciones, setPrestaciones] = useState([]);
  const secuencia = useRef(0);

  // Catálogo para resolver profesional / sillón-box / prestación por ID.
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const [catalogo, listaPrestaciones] = await Promise.all([
          apiFetch('/api/catalogo', { protected: true }),
          apiFetch('/api/prestaciones?activo=true', { protected: true }),
        ]);
        if (!vigente) return;
        setProfesionales(catalogo?.profesionales ?? []);
        setSillonBoxes(catalogo?.sillonBoxes ?? []);
        setPrestaciones(Array.isArray(listaPrestaciones) ? listaPrestaciones : []);
      } catch {
        // Los errores de catálogo no bloquean la agenda: los IDs se muestran crudos.
      }
    })();
    return () => {
      vigente = false;
    };
  }, []);

  const consultar = useCallback(
    async ({ offset, reemplazar }) => {
      const actual = ++secuencia.current;
      const { desde, hasta } = rango === 'semana' ? rangoSemanal(fecha) : rangoDiario(fecha);
      const parametros = new URLSearchParams();
      parametros.set('desde', desde);
      parametros.set('hasta', hasta);
      if (profesionalId) parametros.set('profesionalId', profesionalId);
      parametros.set('limite', String(LIMITE));
      parametros.set('offset', String(offset));
      try {
        const datos = await apiFetch(`/api/agenda?${parametros}`, { protected: true });
        if (actual !== secuencia.current) return;
        setTurnos((previos) => {
          if (reemplazar) return datos.turnos;
          const vistos = new Set(previos.map((turno) => turno.id));
          return [...previos, ...datos.turnos.filter((turno) => !vistos.has(turno.id))];
        });
        setHayMas(Boolean(datos.hayMas));
        setSiguienteOffset(datos.siguienteOffset ?? null);
        setError(null);
      } catch (errorAgenda) {
        if (actual !== secuencia.current) return;
        if (reemplazar) setTurnos([]);
        setError(errorAgenda);
      }
    },
    [fecha, profesionalId, rango],
  );

  // Reset a offset=0 (y descarte de páginas acumuladas) ante cualquier
  // cambio de rango/profesional/fecha: deduplicar no reemplaza el reset.
  useEffect(() => {
    consultar({ offset: 0, reemplazar: true });
  }, [consultar]);

  const porProfesional = new Map(profesionales.map((profesional) => [profesional.id, profesional.nombre]));
  const porSillon = new Map(sillonBoxes.map((sillon) => [sillon.id, sillon.nombre]));
  const porPrestacion = new Map(prestaciones.map((prestacion) => [prestacion.id, prestacion.nombre]));

  return (
    <main className="page">
      <section className="card">
        <div className="eyebrow">Consultorio</div>
        <h1>Agenda</h1>
        <nav>
          <a href="/inicio" onClick={(evento) => { evento.preventDefault(); navegar('/inicio'); }}>
            Inicio
          </a>
          {' · '}
          <a href="/turnos/nuevo" onClick={(evento) => { evento.preventDefault(); navegar('/turnos/nuevo'); }}>
            Nuevo turno
          </a>
        </nav>

        <div className="field">
          <label htmlFor="rango">Rango</label>
          <select id="rango" value={rango} onChange={(evento) => setRango(evento.target.value)}>
            <option value="dia">Día</option>
            <option value="semana">Semana</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="fecha">Fecha</label>
          <input
            id="fecha"
            type="date"
            value={fecha}
            onChange={(evento) => setFecha(evento.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="profesional-filtro">Profesional</label>
          <select
            id="profesional-filtro"
            value={profesionalId}
            onChange={(evento) => setProfesionalId(evento.target.value)}
          >
            <option value="">Todos</option>
            {profesionales.map((profesional) => (
              <option key={profesional.id} value={profesional.id}>
                {profesional.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <button
            className="button"
            type="button"
            onClick={() => consultar({ offset: 0, reemplazar: true })}
          >
            Recargar
          </button>
          {hayMas && (
            <button
              className="button button-primary"
              type="button"
              onClick={() => consultar({ offset: siguienteOffset, reemplazar: false })}
            >
              Siguiente
            </button>
          )}
        </div>

        {error && (
          <div className="error" role="alert">
            {error.status} {error.code}: {error.message}
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th scope="col">Paciente</th>
              <th scope="col">Profesional</th>
              <th scope="col">Sillón / box</th>
              <th scope="col">Prestación</th>
              <th scope="col">Inicio</th>
              <th scope="col">Fin</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((turno) => (
              <tr key={turno.id}>
                <td>
                  {turno.pacienteNombre} {turno.pacienteApellido ?? ''}
                </td>
                <td>{porProfesional.get(turno.profesionalId) ?? turno.profesionalId}</td>
                <td>{porSillon.get(turno.sillonBoxId) ?? turno.sillonBoxId}</td>
                <td>{porPrestacion.get(turno.prestacionId) ?? turno.prestacionId}</td>
                <td>{formatearInstante(turno.inicio)}</td>
                <td>{formatearInstante(turno.fin)}</td>
                <td>{turno.estado}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!error && turnos.length === 0 && (
          <p className="caption">No hay turnos en el rango seleccionado.</p>
        )}
      </section>
    </main>
  );
}

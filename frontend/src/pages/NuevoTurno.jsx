import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../api/http.js';
import { formatearInstante } from '../fechas.js';

// El backend hoy no envía `field` en el JSON de error; el contrato de C05
// lo indica dentro del mensaje de REFERENCIA_INVALIDA ('pacienteId', etc.).
// Si la respuesta llegara con `field` explícito, se usa directamente.
function campoDeError(error) {
  if (!error || error.code !== 'REFERENCIA_INVALIDA') return null;
  if (error.field) return error.field;
  const coincidencia = /'(\w+Id)'/.exec(error.message ?? '');
  return coincidencia ? coincidencia[1] : null;
}

const MAPA_CAMPOS = {
  pacienteId: 'buscar-paciente',
  profesionalId: 'profesional',
  sillonBoxId: 'sillon-box',
  prestacionId: 'prestacion',
};

// Búsqueda de paciente y listas desplegables de recursos (spec "Seleccion
// de recursos para alta"). Mínimo UX de 2 caracteres antes de consultar.
export function NuevoTurno({ navegar = () => {} }) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [paciente, setPaciente] = useState(null);
  const [profesionales, setProfesionales] = useState([]);
  const [sillonBoxes, setSillonBoxes] = useState([]);
  const [prestaciones, setPrestaciones] = useState([]);
  const [profesionalId, setProfesionalId] = useState('');
  const [sillonBoxId, setSillonBoxId] = useState('');
  const [prestacionId, setPrestacionId] = useState('');
  const [inicio, setInicio] = useState('');
  const [error, setError] = useState(null);
  const [turnoCreado, setTurnoCreado] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const secuencia = useRef(0);

  useEffect(() => {
    let vigente = true;
    async function cargarCatalogo() {
      try {
        const [catalogo, listaPrestaciones] = await Promise.all([
          apiFetch('/api/catalogo', { protected: true }),
          apiFetch('/api/prestaciones?activo=true', { protected: true }),
        ]);
        if (!vigente) return;
        setProfesionales(catalogo?.profesionales ?? []);
        setSillonBoxes(catalogo?.sillonBoxes ?? []);
        setPrestaciones(Array.isArray(listaPrestaciones) ? listaPrestaciones : []);
      } catch (catalogoError) {
        if (vigente) setError(catalogoError);
      }
    }
    cargarCatalogo();
    return () => {
      vigente = false;
    };
  }, []);

  useEffect(() => {
    const texto = busqueda.trim();
    if (texto.length < 2) {
      setResultados([]);
      return undefined;
    }
    const actual = ++secuencia.current;
    let vigente = true;
    (async () => {
      try {
        const datos = await apiFetch(`/api/pacientes?${new URLSearchParams({ q: texto })}`, {
          protected: true,
        });
        if (!vigente || actual !== secuencia.current) return;
        setResultados(Array.isArray(datos) ? datos : []);
        setError(null);
      } catch (busquedaError) {
        if (!vigente || actual !== secuencia.current) return;
        setResultados([]);
        setError(busquedaError);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [busqueda]);

  function seleccionarPaciente(pacienteSeleccionado) {
    setPaciente(pacienteSeleccionado);
    setBusqueda('');
    setResultados([]);
  }

  async function crearTurno(evento) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const turno = await apiFetch('/api/turnos', {
        method: 'POST',
        protected: true,
        body: {
          pacienteId: paciente.id,
          profesionalId,
          sillonBoxId,
          prestacionId,
          inicio: `${inicio}:00-03:00`,
        },
      });
      setTurnoCreado(turno);
    } catch (errorAlta) {
      setError(errorAlta);
    } finally {
      setEnviando(false);
    }
  }

  const campoError = campoDeError(error);
  const idCampoError = campoError ? MAPA_CAMPOS[campoError] : null;
  const textoCorto = busqueda.trim().length > 0 && busqueda.trim().length < 2;

  // Cancelación SOLO del turno recién creado (spec "Cancelacion solo del
  // turno recien creado"): nunca desde /agenda.
  async function cancelarTurno() {
    setCancelando(true);
    setError(null);
    try {
      const turno = await apiFetch(`/api/turnos/${turnoCreado.id}/cancelar`, {
        method: 'PATCH',
        protected: true,
        body: { solicitadoPor: 'CONSULTORIO' },
      });
      setTurnoCreado(turno);
    } catch (errorCancelacion) {
      setError(errorCancelacion);
    } finally {
      setCancelando(false);
    }
  }

  return (
    <main className="page">
      <section className="card">
        <div className="eyebrow">Turnos</div>
        <h1>Nuevo turno</h1>
        <nav>
          <a href="/inicio" onClick={(evento) => { evento.preventDefault(); navegar('/inicio'); }}>
            Inicio
          </a>
          {' · '}
          <a href="/agenda" onClick={(evento) => { evento.preventDefault(); navegar('/agenda'); }}>
            Agenda
          </a>
        </nav>

        <form onSubmit={crearTurno}>
          <div className="field">
            <label htmlFor="buscar-paciente">Buscar paciente</label>
            <input
              id="buscar-paciente"
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Nombre o apellido"
              aria-invalid={idCampoError === 'buscar-paciente' ? 'true' : undefined}
            />
            {textoCorto && <p className="caption">Búsqueda con mínimo 2 caracteres</p>}
            {paciente && (
              <p className="caption" data-testid="paciente-seleccionado">
                Paciente seleccionado: {paciente.nombre} {paciente.apellido ?? ''}
              </p>
            )}
            {resultados.length > 0 && (
              <ul aria-label="Resultados de búsqueda">
                {resultados.map((resultado) => (
                  <li key={resultado.id}>
                    <button type="button" onClick={() => seleccionarPaciente(resultado)}>
                      {resultado.nombre} {resultado.apellido ?? ''}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="field">
            <label htmlFor="profesional">Profesional</label>
            <select
              id="profesional"
              value={profesionalId}
              onChange={(evento) => setProfesionalId(evento.target.value)}
              aria-invalid={idCampoError === 'profesional' ? 'true' : undefined}
            >
              <option value="">Seleccionar profesional</option>
              {profesionales.map((profesional) => (
                <option key={profesional.id} value={profesional.id}>
                  {profesional.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="sillon-box">Sillón / box</label>
            <select
              id="sillon-box"
              value={sillonBoxId}
              onChange={(evento) => setSillonBoxId(evento.target.value)}
              aria-invalid={idCampoError === 'sillonBoxId' ? 'true' : undefined}
            >
              <option value="">Seleccionar sillón o box</option>
              {sillonBoxes.map((sillon) => (
                <option key={sillon.id} value={sillon.id}>
                  {sillon.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="prestacion">Prestación</label>
            <select
              id="prestacion"
              value={prestacionId}
              onChange={(evento) => setPrestacionId(evento.target.value)}
              aria-invalid={idCampoError === 'prestacion' ? 'true' : undefined}
            >
              <option value="">Seleccionar prestación</option>
              {prestaciones.map((prestacion) => (
                <option key={prestacion.id} value={prestacion.id}>
                  {prestacion.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="inicio">Inicio</label>
            <input
              id="inicio"
              type="datetime-local"
              value={inicio}
              onChange={(evento) => setInicio(evento.target.value)}
              aria-invalid={idCampoError === 'inicio' ? 'true' : undefined}
            />
          </div>

          {error && (
            <div className="error" role="alert">
              {error.status} {error.code}: {error.message}
            </div>
          )}

          <button
            className="button button-primary"
            type="submit"
            disabled={enviando || !paciente || !profesionalId || !sillonBoxId || !prestacionId || !inicio}
          >
            {enviando ? 'Creando...' : 'Crear turno'}
          </button>
        </form>

        {turnoCreado && (
          <section aria-label="Turno creado" data-testid="turno-creado">
            <div className="eyebrow">Turno creado</div>
            <p>Estado: {turnoCreado.estado}</p>
            <p>
              Inicio: {formatearInstante(turnoCreado.inicio)} — Fin: {formatearInstante(turnoCreado.fin)}
            </p>
            {turnoCreado.canceladoEn && (
              <p className="caption">
                Cancelado el {formatearInstante(turnoCreado.canceladoEn)} — Solicitado por:{' '}
                {turnoCreado.solicitadoPor}
              </p>
            )}
            {turnoCreado.estado !== 'CANCELADO' && (
              <button
                className="button"
                type="button"
                onClick={cancelarTurno}
                disabled={cancelando}
              >
                {cancelando ? 'Cancelando...' : 'Cancelar turno'}
              </button>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

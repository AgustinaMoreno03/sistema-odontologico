import { useEffect, useState } from 'react';
const BRAND_NAME = 'Sistema de Gestión Odontológica';
import { ApiError, apiFetch, setToken, getToken } from './api/http.js';
import { Agenda } from './pages/Agenda.jsx';
import { NuevoTurno } from './pages/NuevoTurno.jsx';
import './styles.css';

function Login({ onAuthenticated }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      const token = data?.token;
      if (typeof token !== 'string' || token.trim() === '') {
        throw new ApiError({
          status: 200,
          code: 'TOKEN_INVALIDO',
          message: 'La respuesta del servidor no incluyó un token válido',
        });
      }
      setToken(token);
      onAuthenticated();
    } catch (requestError) {
      setError(requestError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page login-page">
      <section className="card login-card" aria-labelledby="login-title">
        <div className="eyebrow">Acceso al consultorio</div>
        <h1 id="login-title">Ingresar</h1>
        <p className="intro" data-brand-name>{BRAND_NAME}</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </div>
          {error && <div className="error" role="alert">{error.status} {error.code}: {error.message}</div>}
          <button className="button button-primary" type="submit" disabled={submitting}>
            {submitting ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </section>
    </main>
  );
}

function ProtectedHome({ navegar }) {
  return (
    <main className="page">
      <section className="card">
        <div className="eyebrow">Sesión</div>
        <h1>Sesión iniciada</h1>
        <p className="caption">La sesión autenticada está disponible para las funcionalidades protegidas.</p>
        <nav>
          <a href="/agenda" onClick={(evento) => { evento.preventDefault(); navegar('/agenda'); }}>
            Agenda
          </a>
          {' · '}
          <a href="/turnos/nuevo" onClick={(evento) => { evento.preventDefault(); navegar('/turnos/nuevo'); }}>
            Nuevo turno
          </a>
        </nav>
      </section>
    </main>
  );
}

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [hasSession, setHasSession] = useState(Boolean(getToken()));

  useEffect(() => {
    const previousOnPopState = window.onpopstate;
    window.onpopstate = function handlePopState() {
      setPath(window.location.pathname);
      setHasSession(Boolean(getToken()));
    };
    return () => {
      window.onpopstate = previousOnPopState;
    };
  }, []);

  useEffect(() => {
    if (path !== '/login' && !hasSession) {
      window.history.replaceState({}, '', '/login');
      setPath('/login');
    }
  }, [path, hasSession]);

  function handleAuthenticated() {
    window.history.pushState({}, '', '/inicio');
    setHasSession(true);
    setPath('/inicio');
  }

  function navegar(destino) {
    window.history.pushState({}, '', destino);
    setPath(destino);
  }

  if (path === '/login' || !hasSession) return <Login onAuthenticated={handleAuthenticated} />;
  if (path === '/turnos/nuevo') return <NuevoTurno navegar={navegar} />;
  if (path === '/agenda') return <Agenda navegar={navegar} />;
  return <ProtectedHome navegar={navegar} />;
}

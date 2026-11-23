import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { conFixtureTurnos } from './helpers/turnos-fixtures.js';
import { obtenerUrlAdmin, obtenerUrlBaseTest } from './setup/urls.js';

/**
 * C05 — verificación de la migración `050_turno.sql` (tasks 2.1 y 2.2).
 *
 * Parte A: el runner OFICIAL (`npm run migrate`, node-pg-migrate +
 * migrations.config.js) aplica la secuencia completa `001 → 010 → 020 → 030
 * → 040 → 050` sobre base VACÍA y sobre base EXISTENTE (solo previas ya
 * aplicadas), y una re-ejecución sin pendientes sale con código 0 — patrón
 * `tests/catalogo-migracion-runner.test.js`, con base scratch propia
 * (`odontologia_c05_runner_test`), nunca la base de la suite ni
 * `db/migrations/`.
 *
 * Parte B: contra la base de test, INSERTs solapados por cada recurso
 * fallan con SQLSTATE `23P01` (opclass `uuid` de btree_gist, design D1),
 * dos turnos contiguos `[)` insertan sin error, `fin = inicio` y un estado
 * fuera de RN-AG-10 chocan con `23514`, y un turno `CANCELADO` no bloquea
 * (WHERE parcial del constraint).
 *
 * Datos SIEMPRE ficticios (regla dura 1), con UUIDs por test y limpieza
 * filtrada por el helper `tests/helpers/turnos-fixtures.js`.
 */

const raiz = process.cwd();
const bin = path.join(raiz, 'node_modules', 'node-pg-migrate', 'bin', 'node-pg-migrate.js');
const NOMBRE_SCRATCH = 'odontologia_c05_runner_test';
const dirTemporal = path.join(os.tmpdir(), 'opencode', 'odontologia-c05-runner');

const migracionesEsperadas = fs
  .readdirSync(path.join(raiz, 'db', 'migrations'))
  .filter((archivo) => /^\d+_.+\.sql$/.test(archivo))
  .map((archivo) => path.basename(archivo, '.sql'))
  .sort();

function urlScratch() {
  const url = new URL(obtenerUrlBaseTest());
  url.pathname = `/${NOMBRE_SCRATCH}`;
  return url.toString();
}

async function crearBaseScratchVacia() {
  const admin = new pg.Client({ connectionString: obtenerUrlAdmin() });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${NOMBRE_SCRATCH}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${NOMBRE_SCRATCH}"`);
  } finally {
    await admin.end().catch(() => {});
  }
}

/** Ejecuta el runner tal cual `npm run migrate` (mismo bin y config real). */
function ejecutarRunnerTodasLasMigraciones(url = urlScratch()) {
  return spawnSync(
    process.execPath,
    [bin, 'up', '--config-file', 'migrations.config.js', '--advisory-lock-mode', 'wait'],
    {
      cwd: raiz,
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, DATABASE_URL: url },
    }
  );
}

/** Ejecuta el runner sobre un directorio puntual (para las migraciones previas). */
function ejecutarRunnerConDir(dir) {
  return spawnSync(
    process.execPath,
    [bin, 'up', '--migrations-dir', dir, '--advisory-lock-mode', 'wait'],
    {
      cwd: raiz,
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, DATABASE_URL: urlScratch() },
    }
  );
}

async function consultas(url, sql) {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    return (await cliente.query(sql)).rows;
  } finally {
    await cliente.end().catch(() => {});
  }
}

const historial = (url) =>
  consultas(url, 'SELECT name FROM pgmigrations ORDER BY run_on, id').then((f) =>
    f.map((x) => x.name)
  );
const tablas = (url) =>
  consultas(
    url,
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
  ).then((f) => f.map((x) => x.table_name));

describe('050_turno aplicada por el runner oficial (schema-migrations)', () => {
  it('base vacía + runner con todas las migraciones → secuencia completa con la 050, extensión, tabla e índices', async () => {
    await crearBaseScratchVacia();

    const res = ejecutarRunnerTodasLasMigraciones();

    expect(res.status, `${res.stdout ?? ''}${res.stderr ?? ''}`).toBe(0);
    const trazas = await historial(urlScratch());
    // Secuencia ascendente completa: 001 → 010 → 020 → 030 → 040 → 050 → 070.
    expect(trazas).toEqual(migracionesEsperadas);
    expect(trazas).toContain('050_turno');
    expect(trazas.indexOf('050_turno')).toBeGreaterThan(trazas.indexOf('040_prestaciones'));
    // C07 (task 2.2): la 070 entra por readdir dinámico y corre DESPUÉS de la 050.
    expect(trazas).toContain('070_reprogramar_turno');
    expect(trazas.indexOf('070_reprogramar_turno')).toBeGreaterThan(trazas.indexOf('050_turno'));

    expect(await tablas(urlScratch())).toContain('turno');

    // La 050 es la dueña de btree_gist (cabecera del archivo, precedente unaccent/C03).
    const extensiones = await consultas(
      urlScratch(),
      "SELECT extname FROM pg_extension WHERE extname = 'btree_gist'"
    );
    expect(extensiones).toHaveLength(1);

    // Columnas de design.md D2: cinco recursos + intervalo + duración + estado + timestamps.
    // C07 (070): más la auditoría de reprogramación (reprogramado_en/por).
    const columnas = await consultas(
      urlScratch(),
      "SELECT column_name FROM information_schema.columns " +
        "WHERE table_schema = 'public' AND table_name = 'turno'"
    ).then((f) => f.map((x) => x.column_name));
    expect(columnas.sort()).toEqual(
      [
        'id',
        'consultorio_id',
        'paciente_id',
        'profesional_id',
        'sillon_box_id',
        'prestacion_id',
        'inicio',
        'fin',
        'duracion_min',
        'estado',
        'creado_en',
        'cancelado_en',
        'reprogramado_en',
        'reprogramado_por',
      ].sort()
    );

    // Índices de knowledge-base/04_modelo_de_datos.md:112.
    const indices = await consultas(
      urlScratch(),
      "SELECT indexname FROM pg_indexes WHERE tablename = 'turno'"
    ).then((f) => f.map((x) => x.indexname));
    for (const esperado of [
      'turno_consultorio_profesional_inicio_idx',
      'turno_consultorio_sillon_box_inicio_idx',
      'turno_consultorio_paciente_inicio_idx',
      'turno_consultorio_idx',
    ]) {
      expect(indices, `índice ${esperado}`).toContain(esperado);
    }

    // Las tres restricciones de exclusión parciales (design D1) y los CHECKs.
    const restricciones = await consultas(
      urlScratch(),
      "SELECT conname, contype FROM pg_constraint WHERE conrelid = 'turno'::regclass"
    );
    const exclusiones = restricciones.filter((r) => r.contype === 'x').map((r) => r.conname);
    expect(exclusiones.sort()).toEqual(
      [
        'turno_paciente_sin_solape',
        'turno_profesional_sin_solape',
        'turno_sillon_box_sin_solape',
      ].sort()
    );
    const checks = restricciones.filter((r) => r.contype === 'c').map((r) => r.conname);
    expect(checks).toContain('turno_intervalo_valido');
    expect(checks).toContain('turno_estado_valido');
  }, 60_000);

  it('base existente solo con las migraciones previas → el runner aplica la 050 sin renumerar nada', async () => {
    await crearBaseScratchVacia();

    // Simula una base de dev que ya venía con 001…040 aplicadas: SOLO las
    // migraciones numeradas ANTERIORES a la 050. Con la 070 presente (C07),
    // copiarla acá haría fallar el runner (`turno` todavía no existe).
    const previas = fs
      .readdirSync(path.join(raiz, 'db', 'migrations'))
      .filter((archivo) => {
        const numero = archivo.match(/^(\d+)_.+\.sql$/);
        return numero !== null && Number(numero[1]) < 50;
      });
    const dirPrevias = path.join(dirTemporal, 'solo-previas');
    fs.rmSync(dirPrevias, { recursive: true, force: true });
    fs.mkdirSync(dirPrevias, { recursive: true });
    for (const archivo of previas) {
      fs.copyFileSync(path.join(raiz, 'db', 'migrations', archivo), path.join(dirPrevias, archivo));
    }

    const primera = ejecutarRunnerConDir(dirPrevias);
    expect(primera.status, `${primera.stdout ?? ''}${primera.stderr ?? ''}`).toBe(0);
    expect(await tablas(urlScratch())).not.toContain('turno');
    expect(await historial(urlScratch())).toEqual(previas.map((a) => path.basename(a, '.sql')).sort());

    const segunda = ejecutarRunnerTodasLasMigraciones();
    expect(segunda.status, `${segunda.stdout ?? ''}${segunda.stderr ?? ''}`).toBe(0);
    expect(await tablas(urlScratch())).toContain('turno');
    expect(await historial(urlScratch())).toEqual(migracionesEsperadas);
  }, 60_000);

  it('re-ejecución sin pendientes → exit 0, historial sin duplicados y los datos previos intactos', async () => {
    await crearBaseScratchVacia();
    const primera = ejecutarRunnerTodasLasMigraciones();
    expect(primera.status, `${primera.stdout ?? ''}${primera.stderr ?? ''}`).toBe(0);

    // Dato ficticio previo que el re-run no debe tocar (regla dura 1).
    await consultas(
      urlScratch(),
      "INSERT INTO consultorio (id) VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc')"
    );

    const segunda = ejecutarRunnerTodasLasMigraciones();
    const salida = `${segunda.stdout ?? ''}${segunda.stderr ?? ''}`;

    expect(segunda.status, salida).toBe(0);
    expect(salida).toContain('No migrations to run');
    expect(await historial(urlScratch())).toEqual(migracionesEsperadas); // sin duplicados
    const datos = await consultas(
      urlScratch(),
      "SELECT 1 FROM consultorio WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'"
    );
    expect(datos).toHaveLength(1);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Parte B: restricciones de exclusión y CHECKs contra la base de test real.
// ---------------------------------------------------------------------------

/** Recursos ficticios adicionales para aislar QUÉ restricción dispara. */
async function crearRecursosExtras(fixture) {
  const paciente2 = randomUUID();
  const profesional2 = randomUUID();
  const sillon2 = randomUUID();
  await fixture.consultar(
    'INSERT INTO paciente (id, consultorio_id, nombre, telefono) VALUES ($1, $2, $3, $4)',
    [paciente2, fixture.consultorioId, 'Paciente Ficticio 2 C05', '11-5555-0001']
  );
  await fixture.consultar(
    'INSERT INTO profesional (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
    [profesional2, fixture.consultorioId, 'Profesional Ficticio 2 C05']
  );
  await fixture.consultar(
    'INSERT INTO sillon_box (id, consultorio_id, nombre) VALUES ($1, $2, $3)',
    [sillon2, fixture.consultorioId, 'Box Ficticio 2 C05']
  );
  return { paciente2, profesional2, sillon2 };
}

/** INSERT directo de un turno ficticio (columna `estado` opcional). */
function insertarTurno(
  fixture,
  { pacienteId, profesionalId, sillonBoxId, inicio, fin, duracionMin = 30, estado }
) {
  const columnas = [
    'consultorio_id',
    'paciente_id',
    'profesional_id',
    'sillon_box_id',
    'prestacion_id',
    'inicio',
    'fin',
    'duracion_min',
  ];
  const valores = [
    fixture.consultorioId,
    pacienteId,
    profesionalId,
    sillonBoxId,
    fixture.prestacionId,
    inicio,
    fin,
    duracionMin,
  ];
  if (estado !== undefined) {
    columnas.push('estado');
    valores.push(estado);
  }
  const parametros = valores.map((_, i) => `$${i + 1}`).join(', ');
  return fixture.consultar(
    `INSERT INTO turno (${columnas.join(', ')}) VALUES (${parametros}) RETURNING id`,
    valores
  );
}

const H = '2030-01-15T'; // horario ficticio fijo por test (futuro, regla dura 1)

describe('restricciones de la 050 contra la base de test (design D1)', () => {
  it('btree_gist instalado y opclass uuid disponible para gist', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const extensiones = await fixture.consultar(
        "SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist'"
      );
      expect(extensiones.rows).toHaveLength(1);
      expect(extensiones.rows[0].extversion).toEqual(expect.any(String));

      const opclasses = await fixture.consultar(
        "SELECT opcname FROM pg_opclass " +
          "WHERE opcintype = 'uuid'::regtype " +
          "AND opcmethod = (SELECT oid FROM pg_am WHERE amname = 'gist')"
      );
      expect(opclasses.rows.length).toBeGreaterThan(0);
    });
  });

  it('INSERT solapado por paciente → 23P01 de turno_paciente_sin_solape', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const { paciente2, profesional2, sillon2 } = await crearRecursosExtras(fixture);
      await insertarTurno(fixture, {
        pacienteId: fixture.pacienteId,
        profesionalId: fixture.profesionalId,
        sillonBoxId: fixture.sillonBoxId,
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
      });

      // Mismo paciente, profesional y sillón DISTINTOS: solo puede chocar
      // la restricción de paciente (RN-AG-01).
      await expect(
        insertarTurno(fixture, {
          pacienteId: fixture.pacienteId,
          profesionalId: profesional2,
          sillonBoxId: sillon2,
          inicio: `${H}10:15:00.000Z`,
          fin: `${H}10:45:00.000Z`,
        })
      ).rejects.toMatchObject({ code: '23P01', constraint: 'turno_paciente_sin_solape' });
    });
  });

  it('INSERT solapado por profesional → 23P01 de turno_profesional_sin_solape', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const { paciente2, sillon2 } = await crearRecursosExtras(fixture);
      await insertarTurno(fixture, {
        pacienteId: fixture.pacienteId,
        profesionalId: fixture.profesionalId,
        sillonBoxId: fixture.sillonBoxId,
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
      });

      // Mismo profesional, paciente y sillón DISTINTOS (RN-AG-02).
      await expect(
        insertarTurno(fixture, {
          pacienteId: paciente2,
          profesionalId: fixture.profesionalId,
          sillonBoxId: sillon2,
          inicio: `${H}10:15:00.000Z`,
          fin: `${H}10:45:00.000Z`,
        })
      ).rejects.toMatchObject({ code: '23P01', constraint: 'turno_profesional_sin_solape' });
    });
  });

  it('INSERT solapado por sillón/box → 23P01 de turno_sillon_box_sin_solape', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const { paciente2, profesional2 } = await crearRecursosExtras(fixture);
      await insertarTurno(fixture, {
        pacienteId: fixture.pacienteId,
        profesionalId: fixture.profesionalId,
        sillonBoxId: fixture.sillonBoxId,
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
      });

      // Mismo sillón, paciente y profesional DISTINTOS (RN-AG-02).
      await expect(
        insertarTurno(fixture, {
          pacienteId: paciente2,
          profesionalId: profesional2,
          sillonBoxId: fixture.sillonBoxId,
          inicio: `${H}10:15:00.000Z`,
          fin: `${H}10:45:00.000Z`,
        })
      ).rejects.toMatchObject({ code: '23P01', constraint: 'turno_sillon_box_sin_solape' });
    });
  });

  it('dos turnos contiguos [) del mismo recurso coexisten sin conflicto (RN-AG-06)', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const recursos = {
        pacienteId: fixture.pacienteId,
        profesionalId: fixture.profesionalId,
        sillonBoxId: fixture.sillonBoxId,
      };
      await insertarTurno(fixture, {
        ...recursos,
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
      });
      // El segundo empieza EXACTAMENTE cuando termina el primero.
      await insertarTurno(fixture, {
        ...recursos,
        inicio: `${H}10:30:00.000Z`,
        fin: `${H}11:00:00.000Z`,
      });

      const { rows } = await fixture.consultar(
        'SELECT count(*)::int AS total FROM turno WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].total).toBe(2);
    });
  });

  it('fin = inicio (rango vacío) → CHECK 23514 de turno_intervalo_valido', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      await expect(
        insertarTurno(fixture, {
          pacienteId: fixture.pacienteId,
          profesionalId: fixture.profesionalId,
          sillonBoxId: fixture.sillonBoxId,
          inicio: `${H}10:00:00.000Z`,
          fin: `${H}10:00:00.000Z`,
        })
      ).rejects.toMatchObject({ code: '23514', constraint: 'turno_intervalo_valido' });
    });
  });

  it('estado fuera de los cinco valores de RN-AG-10 → 23514; sin estado nace PENDIENTE', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const recursos = {
        pacienteId: fixture.pacienteId,
        profesionalId: fixture.profesionalId,
        sillonBoxId: fixture.sillonBoxId,
      };

      await expect(
        insertarTurno(fixture, {
          ...recursos,
          inicio: `${H}10:00:00.000Z`,
          fin: `${H}10:30:00.000Z`,
          estado: 'BAJA',
        })
      ).rejects.toMatchObject({ code: '23514', constraint: 'turno_estado_valido' });

      const { rows } = await insertarTurno(fixture, {
        ...recursos,
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
      });
      expect(rows).toHaveLength(1);

      const { rows: estado } = await fixture.consultar(
        'SELECT estado FROM turno WHERE id = $1',
        [rows[0].id]
      );
      expect(estado[0].estado).toBe('PENDIENTE');
    });
  });

  it('un turno CANCELADO no bloquea reservas solapadas (WHERE parcial, RN-AG-08)', async () => {
    await conFixtureTurnos(async ({ fixture }) => {
      const recursos = {
        pacienteId: fixture.pacienteId,
        profesionalId: fixture.profesionalId,
        sillonBoxId: fixture.sillonBoxId,
      };
      await insertarTurno(fixture, {
        ...recursos,
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
        estado: 'CANCELADO',
      });

      // Un turno PENDIENTE solapado debe entrar igual (el CANCELADO libera).
      await insertarTurno(fixture, {
        ...recursos,
        inicio: `${H}10:00:00.000Z`,
        fin: `${H}10:30:00.000Z`,
      });

      const { rows } = await fixture.consultar(
        'SELECT count(*)::int AS total FROM turno WHERE consultorio_id = $1',
        [fixture.consultorioId]
      );
      expect(rows[0].total).toBe(2);
    });
  });
});

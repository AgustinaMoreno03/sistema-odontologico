# Sistema de Gestión Odontológica — API

API REST del sistema de gestión odontológica (multi-consultorio). Monolito
modular **por capas** en Node.js con **Express 5** (JavaScript plano, sin
TypeScript) y **PostgreSQL 18**.

> Estado: C00 — base del proyecto. Este README es la guía completa de
> arranque en frío: desde un checkout vacío hasta la suite en verde.

## Requisitos

- **Node.js 24 o superior** (rango `>=24 <27` en `engines` de
  `package.json`; LTS vigente: 26).
- **Docker con Compose** para PostgreSQL 18 (ver `compose.yaml`).
- Variables de entorno: copiar `.env.example` a `.env` y completar los
  valores. **`.env` nunca se sube al repo** (regla dura 5); `.env.example`
  no contiene valores.

## Arranque en frío (clon → suite en verde)

Secuencia completa desde un checkout vacío. Los comandos están ordenados tal
cual se ejecutan; cada paso falla de forma visible si el anterior no se hizo.

```bash
# 1. Clonar e instalar
git clone https://github.com/AgustinaMoreno03/sistema-odontologico.git
cd sistema-odontologico
npm install

# 2. Configuración local (PowerShell: Copy-Item .env.example .env)
cp .env.example .env
#    → editar .env y completar las 5 claves (ver tabla siguiente)

# 3. PostgreSQL 18 en Docker (esperar a que quede "healthy")
docker compose up -d
docker compose ps

# 4. Migraciones sobre la base de desarrollo
npm run migrate

# 5. Levantar la API (puerto 3000 por defecto)
npm start

# 6. En OTRA terminal: verificar salud y correr la puerta de integración
curl http://localhost:3000/health
npm test
```

### Completar `.env`

| Clave | Qué poner |
|---|---|
| `POSTGRES_USER` | Usuario local ficticio que creará Compose |
| `POSTGRES_PASSWORD` | Contraseña local ficticia (nunca una real) |
| `POSTGRES_DB` | Nombre de la base de desarrollo (p. ej. `odontologia`) |
| `DATABASE_URL` | `postgresql://<USUARIO>:<CONTRASENA>@localhost:5432/<BASE>` apuntando a las `POSTGRES_*` de arriba (local: puerto 5432) |
| `JWT_SECRET` | ≥32 caracteres. Generarlo con el comando de la sección [Advertencia: `JWT_SECRET` corto](#advertencia-jwt_secret-corto) |

Los datos siempre son **ficticios** (regla dura 1): nunca pongas datos
reales de pacientes ni credenciales reales en ningún archivo.

### Verificar la salud

- `GET /health` es la **única ruta pública** y está exenta de
  autenticación (spec `auth` R2). Sin token nunca devuelve 401.
- **200** con la base arriba; **503** con JSON seguro si la base cae — la
  API sigue viva y, cuando la base vuelve, un nuevo `GET /health` responde
  200 sin reiniciar la API.
- PowerShell en lugar de curl: `Invoke-RestMethod http://localhost:3000/health`

### `npm test` — la única puerta de integración

- Corre la suite completa contra PostgreSQL real en una **base separada
  `odontologia_test`** que el setup **crea desde cero (drop + create) y
  migra en cada corrida**; solo dropea bases terminadas en `_test` (nunca
  la de desarrollo).
- Verde con código 0 = condición para integrar (regla dura 6).
- Necesita Docker/PostgreSQL arriba; si la base de test es inaccesible,
  la suite **falla con código ≠ 0** (sin falso verde).
- ⚠️ Señal real: el **código de salida y los contadores**
  (`Tests  43 passed (43)`). Si el setup global falla, Vitest puede
  imprimir un confuso *"No test files found"* — eso **no** es el resultado:
  mirá el exit code.

## Puertos y servicios

| Servicio | Puerto | Dónde está definido |
|---|---|---|
| API Express | **3000** (default; se overridea con la env `PORT`) | `src/server.js` → `const PORT = Number(process.env.PORT) || 3000;` |
| PostgreSQL 18 | **5432** (host ↔ contenedor) | `compose.yaml` → `ports: - "5432:5432"` |

Servicios del Compose: **`postgres`** (único servicio, `postgres:18` con
tag fijo, healthcheck `pg_isready`, volumen nombrado `odontologia_pgdata`).
La API corre en el host con `npm start`, no dentro de Compose.

## Migraciones: rangos en orden ascendente (D1)

Las migraciones viven en `db/migrations/` como SQL numerado y
**forward-only** (`001_*.sql` es la primera). `npm run migrate`
(`node-pg-migrate` v9, config en `migrations.config.js`) las aplica
**siempre en orden ascendente numérico** y registra cada versión en su
tabla de historial. Re-ejecutar sin pendientes es un no-op con código 0.

### (a) El error "rango inferior pendiente tras uno superior"

Si una migración de rango **bajo** sigue pendiente después de que ya se
aplicó una de rango **alto** — p. ej. una rama paralela mergeó un `010`
antes de que llegara su `002` — el runner **falla con código distinto de
cero** y nombra visiblemente la migración pendiente (formato real de
`node-pg-migrate`):

```
Not run migration 002_pendiente is preceding already run migration 010_ok
```

No la aplica fuera de orden ni la ignora en silencio: es un fallo visible
a propósito (spec `schema-migrations`, escenario "Versión inferior pendiente
tras una superior aplicada"). El reintegro del rango faltante es un proceso
humano — ver (b) y la sección de recuperación.

### (b) Orden de merge esperado entre rangos de changes

Cada change tiene un rango reservado (ver `CHANGES.md`):

| Change | Rango |
|---|---|
| **C00** (este) | **001–009** |
| **C01** | **010–019** |
| … | … |

Aunque el desarrollo corra en paralelo, **integrar y aplicar siempre el
rango bajo antes que el alto**: mergeá y migrá C00 (001–009) antes de
aplicar C01 (010–019). Regla dura 9: **una migración mergeada nunca se
edita** — si algo falla después, se corrige con un archivo nuevo dentro
del rango del change (fix-forward).

### (c) Recuperación ante ese error

Si el error aparece en tu base local y el rango bajo ya se mergeó, recreá
la base local y volvé a migrar — es seguro porque **los datos siempre son
ficticios** (regla dura 1) y esto es entorno local (DD-10): ver la sección
[Recuperación](#recuperación-recrear-la-base-local).

## Recuperación: recrear la base local

> ⚠️⚠️ **`docker compose down -v` DESTRUYE el volumen
> `odontologia_pgdata` con TODOS los datos locales** — la base de
> desarrollo y la `odontologia_test`. Es la única destrucción real
> posible y **solo** se usa como paso de recuperación documentado. Sin
> `-v`, `docker compose down` **conserva** los datos.

```bash
docker compose down -v      # destruye el volumen (¡datos fuera!)
docker compose up -d        # recrea la base desde cero
docker compose ps           # esperar a que "postgres" esté "healthy"
npm run migrate             # reaplica todo el esquema en orden ascendente
npm start                   # reiniciar la API si estaba corriendo
npm test                    # la puerta debe volver a quedar en verde
```

**Cuándo usarlo:** recuperarse del error de rango fuera de orden (sección
anterior), base local corrupta o arranque desde cero. Válido **porque los
datos son ficticios** (regla dura 1) — en un entorno con datos reales esto
exigiría respaldo previo (regla dura 7).

## Respaldo: PostgreSQL 18 directo si Docker falla

Si Docker no inicia o el puerto 5432 ya está ocupado por otro proceso, el
fallo se reporta de forma visible con la causa. Respaldo **sin degradar de
motor**:

1. Instalar **PostgreSQL 18** directamente (misma versión exacta que
   `compose.yaml`, nunca otra).
2. Crear usuario y base con los mismos valores de tus `POSTGRES_*` y
   apuntar `DATABASE_URL` a `localhost:5432`.
3. Seguir con `npm run migrate` → `npm start` → `npm test`, idéntico al
   arranque en frío.

## Advertencia: `JWT_SECRET` corto

Un `.env` **heredado** (copiado de otro equipo o anterior al mínimo de 32
caracteres — task 4.8) hace que la API **NO arrance**: el proceso termina
con código distinto de cero e imprime **sin stack y sin el valor del
secreto**:

```
Error de configuración: la variable de entorno requerida JWT_SECRET falta, está vacía o tiene menos de 32 caracteres (mínimo 32). Generá un secreto de al menos 32 caracteres y completalo en .env (a partir de .env.example) antes de iniciar la API.
```

**Corrección** — generar un secreto nuevo de ≥32 caracteres:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Y reemplazar el valor de `JWT_SECRET` en tu `.env` local con la salida.
Nunca imprimas, compartas ni commitees el valor: ni en chats, PRs, issues,
docs ni capturas (regla dura 5). `.env` está en `.gitignore`.

## Cómo proteger una ruta

El middleware de autenticación real del proyecto se exporta desde
`src/modules/auth/rutas.js`:

```js
export function middlewareAutenticacion(req, res, next) {
```

Uso real en el código existente (`tests/helpers/appProtegida.js`):

```js
import { middlewareAutenticacion } from '../../src/modules/auth/rutas.js';
// ...
app.get('/protegido', middlewareAutenticacion, responder);
app.post('/protegido', middlewareAutenticacion, responder);
```

Dentro de `src/` el mismo import relativo es
`'./modules/auth/rutas.js'`. C01 monta `rutasAuth` bajo `/auth`; el login se
solicita con `POST /auth/login` y un cuerpo `{ "email": "...", "password":
"..." }`. Ante email desconocido o contraseña incorrecta devuelve HTTP 401
con el mismo mensaje `Usuario o contraseña incorrectos`. Un login válido
devuelve `{ "token": "<JWT>" }`, firmado con HS256 y con expiración de ocho
horas. El middleware existente de C00 verifica la firma y vigencia y publica
en rutas protegidas `req.auth = { usuarioId, consultorioId, rol }`.

Qué hace al colocarlo como tercer argumento de la ruta:

- Borra SIEMPRE los headers `x-tenant-*` del cliente **antes** de cualquier
  otra cosa: el tenant sale solo del token (regla dura 2).
- Exige `Authorization: Bearer <JWT>` y verifica con **HS256**; éxito →
  `req.auth = { usuarioId, consultorioId, rol }` (solo del token).
- Cualquier fallo → **401** vía el manejador centralizado, mensaje único
  y seguro (sin distinguir causa ni filtrar stack).
- `/health` queda **exenta** (montada sin el middleware en `src/app.js`).

Las rutas siguen la capa `rutas → servicios → dominio → repositorios`
(DD-13): la capa de rutas solo parsea HTTP; la validación de negocio vive
en `servicios`.

## Scripts

| Comando | Definición exacta (`package.json`) | Qué hace |
|---|---|---|
| `npm start` | `node --env-file=.env src/server.js` | Levanta la API (fail-fast sin `DATABASE_URL`/`JWT_SECRET` válidos) |
| `npm run migrate` | `node --env-file=.env ./node_modules/node-pg-migrate/bin/node-pg-migrate.js up --config-file migrations.config.js` | Aplica las migraciones SQL de `db/migrations/` en orden ascendente |
| `npm test` | `node --env-file=.env ./node_modules/vitest/vitest.mjs run` | Corre la suite completa (única puerta de integración) |

## Estructura por capas (DD-13)

Cada módulo vive en `src/modules/<modulo>/` con las **mismas cuatro capas**,
y las llamadas siempre bajan en este orden:

```
src/
├── app.js                  # Instancia de Express 5 (montaje de rutas)
├── server.js               # Fail-fast de config + escucha HTTP
└── modules/
    ├── auth/               # Módulo de ejemplo COMPLETO (C00)
    │   ├── rutas.js        # HTTP: parseo/validación de entrada, nada más
    │   ├── servicios.js    # Casos de uso (orchestra dominio + repositorios)
    │   ├── dominio.js      # Reglas de negocio puras, sin I/O
    │   └── repositorios.js # SQL parametrizado sobre las tablas del módulo
    ├── consultorios/.gitkeep   # Vacíos: cada módulo arranca en la ola 1
    ├── catalogo/.gitkeep
    ├── pacientes/.gitkeep
    └── turnos/.gitkeep
```

Reglas que aplica la estructura:

1. **`rutas → servicios → dominio → repositorios`.** Las rutas solo hacen
   HTTP; nunca llevan lógica de negocio ni SQL. Los repositorios, solo SQL
   parametrizado; nunca reglas de negocio.
2. **Un módulo no toca las tablas de otro** (regla dura 10): se comunica
   únicamente vía la interfaz pública del módulo destino.
3. **El consultorio (tenant) y el rol salen siempre del token JWT**, nunca
   del cliente (regla dura 2); el token se verifica con algoritmo HS256.
4. `auth` es el módulo de referencia: los otros cuatro se crean siguiendo
   exactamente el mismo patrón de carpetas.

## Base de datos

- PostgreSQL 18 vía `compose.yaml` (tag fijo, healthcheck `pg_isready`,
  volumen nombrado para los datos).
- Migraciones SQL numeradas y **forward-only** en `db/migrations/`
  (`001_*.sql` es la primera; rango reservado de C00: 001–009). Una
  migración mergeada nunca se edita (regla dura 9).
- Integración de rangos entre changes: ver
  [Migraciones: rangos en orden ascendente](#migraciones-rangos-en-orden-ascendente-d1).

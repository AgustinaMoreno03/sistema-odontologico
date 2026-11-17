# 11 — DevOps Local y Docker

Extra de la KB (complementa `08_arquitectura_propuesta.md`). Cubre cómo correr el sistema en local y la instalación opcional de Docker.

## Objetivo

- Correr el sistema **en local** sin costo y sin dependencias externas, **hasta terminar el MVP** (DD-10; el despliegue a Vercel/Render/Neon es una fase posterior, plan §9).
- **Siempre PostgreSQL**: en Docker (`docker compose`) o instalado directo si Docker falla (DD-12). Sin H2 ni MySQL.
- Docker **solo si no complica** (decisión DD-05); si causa problemas en el entorno del equipo, se usa PostgreSQL directo (ver PA-08 en `10_preguntas_abiertas.md`).

## Requisitos mínimos (sin Docker)

| Componente | Requisito |
|---|---|
| JDK | JDK 17+ (LTS) |
| Gradle | via wrapper (`./gradlew`) — no requiere instalación global |
| Node.js | LTS (solo para compilar el frontend TS vanilla; el build se sirve **por separado**, DD-11) |
| Base de datos | **PostgreSQL** local (instalado directo o en Docker) — siempre PostgreSQL |

## Arranque típico (sin Docker)

```bash
# 1. Compilar/servir el frontend (TypeScript vanilla) — servido por separado del backend
cd frontend && npm install && npm run dev   # p. ej. servidor estático en :5173

# 2. Levantar el backend (API REST sola; el frontend NO la sirve)
cd ../backend && ./gradlew bootRun

# 3. Abrir el frontend en http://localhost:5173 (el API queda en :8080)
```

- **CORS**: el backend permite **solo el origen del frontend local** (p. ej. `http://localhost:5173`) — DD-11, variable `CORS_ALLOWED_ORIGINS`.
- Seed automático: consultorio (tenant) + SUPERADMIN + roles + admin inicial + datos ficticios (opción `seed=true` o perfil `dev`).

## Arranque con Docker (opcional)

### Opción A — Docker Compose con PostgreSQL contenedorizado (recomendada si se usa)

`docker-compose.yml` (referencia):

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: odontologia
      POSTGRES_USER: odontologia
      POSTGRES_PASSWORD: devlocal   # solo local, datos ficticios
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  app:
    build: ./backend            # Dockerfile del backend (el frontend se sirve por separado)
    environment:
      DB_URL: jdbc:postgresql://db:5432/odontologia
      DB_USER: odontologia
      DB_PASSWORD: devlocal
      APP_PORT: "8080"
      CORS_ALLOWED_ORIGINS: http://localhost:5173
    ports:
      - "8080:8080"
    depends_on:
      - db

volumes:
  pgdata:
```

```bash
docker compose up --build       # levanta PostgreSQL + backend
# Frontend en local: cd frontend && npm run dev → http://localhost:5173
docker compose down             # para (los datos persisten en el volumen)
```

### Opción B — PostgreSQL directo (sin Docker)
Si Docker solo complica, instalar **PostgreSQL** en la máquina y correr `./gradlew bootRun` apuntando a `jdbc:postgresql://localhost:5432/odontologia`. Es el camino de respaldo del plan §4 — **siempre PostgreSQL** (sin H2).

## Estrategia de datos

- **Datos ficticios siempre** en esta fase (SU-01).
- Migraciones de esquema: **Flyway** versionadas en el repo (decisión del plan de ejecución §4/§9): mismas migraciones en local y en Neon.
- Backups: **no aplica aún** (datos ficticios); cuando entren datos reales/historia clínica → definir política (PA-03).

## Variables de entorno

Ver tabla en `08_arquitectura_propuesta.md` (`DB_URL`, `DB_USER`, `DB_PASSWORD`, `APP_PORT`, `ADMIN_INIT_PASSWORD`). En Docker Compose se inyectan en `environment:`; sin Docker, en un `.env` local o `application-local.properties` (no commitear credenciales reales cuando las haya).

## Decisiones de CI/CD

- **Durante el MVP**: sin pipeline; todo corre local (frontend + Spring Boot + PostgreSQL). Mínimo recomendado cuando exista repo remoto: `./gradlew build` + `npm run build` en CI para que los 5 desarrolladores no rompan la main.
- **Después del MVP** (fase G / change C10, DD-10): despliegue a **Vercel** (frontend), **Render** (backend) y **Neon** (PostgreSQL); verificar los límites vigentes de los planes gratuitos antes de desplegar.

## Checklist de arranque para un dev nuevo

1. Instalar JDK 17+, Node LTS y **PostgreSQL** (o Docker, si funciona en su máquina).
2. `cd frontend && npm install && npm run dev` (frontend local).
3. `cd ../backend && ./gradlew bootRun` — o `docker compose up --build` si Docker funciona OK en su máquina.
4. Abrir `http://localhost:<puerto-frontend>`, loguearse con el admin seed.
5. Leer `01_vision_y_objetivos.md` y `05_reglas_de_negocio.md` antes de tocar código.

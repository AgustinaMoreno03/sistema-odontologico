# Spec Delta

## Purpose

Permite a cualquier integrante del equipo levantar el entorno local completo (PostgreSQL 18 en Docker Compose + API Express 5 + migraciones) desde un checkout vacío con comandos reproducibles del README, y usar `npm test` como única puerta de integración con datos siempre ficticios.

## ADDED Requirements

### Requirement: Arranque reproducible desde un checkout vacío con salud verificable
El sistema SHALL permitir levantar el entorno local completo siguiendo el README: `.env` derivado de `.env.example`, PostgreSQL 18 con `docker compose`, migraciones aplicadas y API iniciada, con la salud verificable sin autenticación en `GET /health`.

#### Scenario: Arranque limpio con Docker disponible
- **GIVEN** un checkout vacío, `.env` preparado desde `.env.example` y Docker disponible
- **WHEN** se ejecutan en orden los comandos documentados en el README (levantar Compose, aplicar migraciones, iniciar la API)
- **THEN** PostgreSQL 18 queda sano (healthcheck en verde), el esquema migrado está presente en la base y la API responde 200 en `GET /health`

#### Scenario: Docker o el puerto de la base no disponibles
- **GIVEN** que Docker no inicia o el puerto 5432 ya está ocupado por otro proceso
- **WHEN** se intenta levantar el entorno
- **THEN** el fallo se reporta de forma visible con la causa y el README documenta el respaldo de PostgreSQL 18 instalado directamente (misma versión), sin degradar a otro motor de base de datos

#### Scenario: Base inaccesible con recuperación sin reinicio
- **GIVEN** que la conexión con la base de datos está caída
- **WHEN** se solicita `GET /health`
- **THEN** responde 503 con JSON seguro (sin credenciales ni stack traces), la API sigue viva y, cuando la base vuelve, un nuevo `GET /health` responde 200 sin reiniciar la API

### Requirement: Configuración sin secretos en el repositorio
La configuración SHALL cargarse únicamente desde variables de entorno; el repositorio SHALL contener solo `.env.example` sin valores reales, con `.env` ignorado por git (regla dura 5). Si falta una variable requerida, el proceso SHALL terminar con código distinto de cero sin arrancar a medias ni usar valores por defecto.

#### Scenario: Variable de entorno requerida ausente
- **GIVEN** que `DATABASE_URL` no está definida en el entorno
- **WHEN** se intenta iniciar la API
- **THEN** el proceso termina con código distinto de cero y un mensaje seguro que nombra la variable faltante, sin arrancar a medias ni exponer stack traces

#### Scenario: Ningún secreto trackeado en el repo
- **GIVEN** el repositorio en cualquier punto de la historia
- **WHEN** se verifica que `.env` no está versionado y que `.env.example` no contiene valores reales
- **THEN** no existe ningún archivo `.env` trackeado ni credenciales escritas en la plantilla

#### Scenario: Secreto del JWT ausente o vacío
- **GIVEN** que el secreto del token no está definido o está vacío en el entorno
- **WHEN** se inicia la API
- **THEN** el proceso falla de forma segura con un error claro, sin caer a un secreto por defecto ni arrancar sin secreto

#### Scenario: Secreto del JWT demasiado corto
- **GIVEN** que `JWT_SECRET` está definido pero tiene menos de 32 caracteres
- **WHEN** se intenta iniciar la API
- **THEN** el proceso termina con código distinto de cero, con un error claro que menciona el mínimo de 32 caracteres sin imprimir el valor del secreto

### Requirement: Puerta de integración npm test
`npm test` SHALL ejecutar la suite completa contra una instancia real de PostgreSQL 18 con datos siempre ficticios (regla dura 1) y ser verde como condición para integrar (regla dura 6).

#### Scenario: Suite en verde contra la base real
- **GIVEN** una base de test disponible con el esquema aplicado
- **WHEN** se ejecuta `npm test`
- **THEN** todos los tests pasan y el comando sale con código 0

#### Scenario: Base de test inaccesible
- **GIVEN** que la base de test no es alcanzable
- **WHEN** se ejecuta `npm test`
- **THEN** la suite falla con código distinto de cero y un mensaje claro, nunca un falso verde

#### Scenario: Repetible, aislada y con datos ficticios
- **GIVEN** la suite corriendo sobre una base de test recién creada desde cero
- **WHEN** se ejecuta `npm test` dos veces seguidas
- **THEN** ambas corridas quedan en verde de forma determinista, sin estado compartido entre tests, y todos los fixtures usan datos ficticios (nunca datos reales de pacientes)

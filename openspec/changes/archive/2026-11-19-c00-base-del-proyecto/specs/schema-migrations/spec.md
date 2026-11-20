# Spec Delta

## Purpose

Garantiza que el esquema de PostgreSQL 18 avance solo mediante archivos SQL numerados y forward-only en `db/migrations/`, aplicados en orden ascendente por un runner verificado para funcionar igual en local (Docker) que en nube (Neon), con fallos visibles y sin estados parciales.

## ADDED Requirements

### Requirement: Migraciones SQL numeradas aplicadas en orden ascendente sobre base vacía
El esquema SHALL avanzar solo con archivos SQL numerados y correlativos en `db/migrations/` (primera `001_*.sql`; rango reservado de C00: 001–009) aplicados en orden ascendente; una migración ya mergeada no se edita (regla dura 9). Cada archivo se aplica en una transacción: un fallo revoca sin esquema parcial y termina con código distinto de cero. Re-ejecutar sin pendientes SHALL ser un no-op exitoso que no altera el esquema ni duplica el historial.

#### Scenario: Aplicación sobre base vacía
- **GIVEN** una base PostgreSQL 18 recién creada y vacía
- **WHEN** se ejecuta el comando de migración documentado en el README
- **THEN** se aplica `001` en orden ascendente, la base queda con el esquema inicial definido por esa migración y el runner registra la versión como aplicada

#### Scenario: SQL inválido dentro de una migración
- **GIVEN** un archivo de migración que contiene SQL con errores
- **WHEN** el runner intenta aplicarlo sobre la base
- **THEN** la ejecución termina con código distinto de cero, la transacción se revoca sin dejar objetos a medias y la migración no queda registrada como aplicada

#### Scenario: Versión inferior pendiente tras una superior aplicada
- **GIVEN** las migraciones `001` y `010` ya aplicadas y un archivo nuevo `002` proveniente de una rama paralela
- **WHEN** se vuelve a ejecutar el comando de migración
- **THEN** el proceso termina con código distinto de cero y reporta visiblemente `002` como pendiente fuera de orden: no la aplica fuera de orden ni la ignora en silencio (el reintegro del rango en orden ascendente es un proceso documentado en el README)

#### Scenario: Re-ejecución sin pendientes
- **GIVEN** una base con todas las migraciones ya aplicadas
- **WHEN** se ejecuta el comando de migración por segunda vez
- **THEN** el runner informa que no hay pendientes, sale con código 0, el esquema no cambia y el historial contiene exactamente una entrada por versión

### Requirement: Compatibilidad con cadena de conexión estilo Neon
El runner y la API SHALL leer la conexión únicamente de `DATABASE_URL` y aceptar el formato de Neon (`postgresql://user:pass@host:5432/db?sslmode=require`) sin código específico por entorno (DD-12: misma secuencia de migraciones en local y en nube).

#### Scenario: Cadena de conexión local
- **GIVEN** una `DATABASE_URL` apuntando a la base de Docker Compose en local
- **WHEN** se ejecutan el comando de migración y se inicia la API
- **THEN** ambas conectan correctamente sin configuración adicional por entorno

#### Scenario: Cadena malformada o credenciales inválidas
- **GIVEN** una `DATABASE_URL` malformada o con credenciales incorrectas
- **WHEN** se ejecuta el comando de migración
- **THEN** termina con código distinto de cero y un mensaje seguro que no incluya la contraseña ni la cadena completa

#### Scenario: Parámetros de consulta estilo Neon
- **GIVEN** una `DATABASE_URL` con parámetros de query propios de Neon (por ejemplo `sslmode=require`)
- **WHEN** el runner y la API procesan la cadena
- **THEN** la interpretan sin rechazarla ni requerir variables adicionales por entorno

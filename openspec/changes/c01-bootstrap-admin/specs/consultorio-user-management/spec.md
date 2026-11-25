# Delta: gestión de consultorios y usuarios

## MODIFIED Requirements

### Requirement: Alta interna de consultorios

El sistema MUST permitir aprovisionar por el comando operativo interno un consultorio nuevo y su primer `ADMIN_CONSULTORIO` de forma atómica. El comando MUST obtener las credenciales únicamente de `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` y aplicar las reglas vigentes de alta de usuarios. El sistema MUST NOT ofrecer un endpoint público de registro de consultorios.

#### Scenario: Aprovisionamiento operativo
- **GIVEN** una operación interna autorizada, una base configurada y migrada, y credenciales válidas con un email no registrado
- **WHEN** se ejecuta `npm run crear-consultorio`
- **THEN** quedan confirmados un consultorio nuevo y un único usuario inicial con rol `ADMIN_CONSULTORIO`, asociado al ID de ese consultorio y con la contraseña almacenada como hash compatible con el login vigente
- **AND** el comando no toma el rol ni el consultorio de la entrada, no modifica consultorios existentes y solo informa éxito con el ID del consultorio después de confirmar ambas altas
- **AND** no emite tokens ni imprime el email, la contraseña o su hash

#### Scenario: Email del administrador ya registrado
- **GIVEN** que el email del entorno ya está registrado en otro consultorio
- **WHEN** se ejecuta el comando de aprovisionamiento
- **THEN** falla con un código distinto de cero y un mensaje seguro, sin crear el consultorio nuevo ni otro usuario
- **AND** el usuario preexistente y su consultorio quedan intactos

#### Scenario: Credenciales ausentes o inválidas según las reglas vigentes
- **GIVEN** que falta alguna variable de credenciales, el email está vacío o solo tiene espacios, o la contraseña está vacía
- **WHEN** se ejecuta el comando de aprovisionamiento
- **THEN** falla con un código distinto de cero y un mensaje seguro, sin crear el consultorio ni el administrador y sin usar valores por defecto o argumentos como alternativa

#### Scenario: Falla la escritura del administrador
- **GIVEN** que se inició el alta del consultorio y ocurre un error inesperado al guardar al administrador
- **WHEN** el comando finaliza con error
- **THEN** no queda persistido el consultorio ni el administrador de esa ejecución
- **AND** el comando sale con código distinto de cero y solo informa un mensaje seguro, sin imprimir credenciales, hashes, tokens, URLs de conexión ni detalles internos del error

#### Scenario: Conexión a la base no configurada
- **GIVEN** que `DATABASE_URL` no está configurada o está vacía
- **WHEN** se ejecuta el comando de aprovisionamiento
- **THEN** falla con un código distinto de cero y un mensaje seguro, sin intentar conectarse a una base por defecto ni crear registros

#### Scenario: Registro público no disponible
- **GIVEN** un cliente sin autenticación
- **WHEN** envía un POST a /consultorios
- **THEN** la respuesta es HTTP 404

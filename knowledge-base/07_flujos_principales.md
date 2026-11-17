# Flujos Principales

Cada flujo se documenta extremo a extremo, mostrando interacciones entre componentes.

## Flujo 1: Autenticación y autorización por rol
**Disparador**: usuario abre la aplicación
**Actor**: cualquiera de los roles del sistema (`ADMIN_CONSULTORIO`, `ODONTOLOGO`, `RECEPCION`; `SUPERADMIN` es interno)

**Pasos**:
1. Frontend muestra la página de login (ruta pública).
2. Frontend → API: `POST /api/auth/login` con credenciales.
3. API valida credenciales y resuelve el rol del usuario.
4. API devuelve sesión/token + rol (+ `tenant_id` resuelto del usuario, RN-TEN-01); Frontend muestra solo las vistas permitidas para ese rol.
5. Cada request posterior a recursos pasa por el filtro de autorización (rol → permisos) **y por el filtro de tenant** (RN-TEN-02).

**Casos de error**:
- Credenciales inválidas → 401 + mensaje genérico.
- Sesión expirada → 401 → redirect a login.
- Rol insuficiente para el endpoint → 403.

## Flujo 2: Reserva de turno (paciente)
**Disparador**: paciente quiere sacar turno
**Actor**: Paciente

**Pasos**:
1. Frontend → API: `GET` de slots disponibles del odontólogo/fecha.
2. Paciente elige un slot; Frontend → API: `POST /api/turnos`.
3. API (transaccional): valida RN-AG-01 (sin solapamiento del paciente), RN-AG-02 (sin solapamiento del odontólogo), RN-AG-04 (son sus turnos), RN-AG-05 (slot activo).
4. Si todo OK: persiste el turno con estado RESERVADO y responde confirmación.
5. Frontend muestra confirmación con fecha/hora/odontólogo.

**Casos de error**:
- Solapamiento detectado → 409 + "el horario ya no está disponible".
- Slot inexistente/inactivo → 422.
- No autenticado → 401.

```
Paciente → Frontend → API ─valida─→ DB (no solapa) → OK → turno creado
```

## Flujo 3: Cancelación de turno
**Disparador**: paciente o recepción cancela
**Actor**: Paciente (los suyos) / Recepción (cualquiera)

**Pasos**:
1. Frontend → API: `PUT /api/turnos/{id}/cancelar`.
2. API valida propiedad (RN-AG-04 para paciente; RN-AG-03 para odontólogo/recepción).
3. Estado → CANCELADO; el slot vuelve a estar disponible.
4. Agenda del odontólogo refleja la cancelación.

**Casos de error**:
- Turno ajeno → 403.
- Turno ya cancelado/atendido → 409/422.

## Flujo 4: Ver agenda del día
**Disparador**: odontólogo inicia sesión / abre agenda
**Actor**: Odontólogo/a (o Recepción con vista general)

**Pasos**:
1. Frontend → API: `GET /api/turnos?fecha=hoy` (filtrado por odontólogo en sesión; recepción puede filtrar por odontólogo).
2. API aplica autorización: cada odontólogo solo ve la suya; recepción ve todas.
3. Frontend renderiza la agenda ordenada por hora, con estado y paciente.

**Casos de error**:
- Sin turnos → vista vacía con mensaje.

## Flujo 5: Gestión de usuarios del consultorio (posterior en prioridad, parte del MVP)
**Disparador**: admin del consultorio necesita crear/acceder usuarios
**Actor**: `ADMIN_CONSULTORIO`

**Pasos**:
1. Admin abre gestión de usuarios.
2. Frontend → API: `POST /api/usuarios` (nombre, credenciales, rol) — el usuario queda **dentro del consultorio del admin** (tenant, RN-TEN-01/02).
3. API crea usuario con hash de contraseña y rol asignado (RN-AU-03).
4. Usuario nuevo puede loguearse y accede solo a sus vistas (RN-AU-02).

**Casos de error**:
- Usuario duplicado → 409.
- Rol inválido → 422.
- No es admin → 403.

## Flujo 6: Alta de paciente
**Disparador**: recepción registra un paciente nuevo
**Actor**: Recepción/Administración

**Pasos**:
1. Frontend → API: `POST /api/pacientes` con nombre + contacto.
2. API valida RN-PAC-01 y persiste.
3. Paciente queda disponible para asignarle turnos (Flujo 2).

**Casos de error**:
- Sin nombre o sin contacto → 422.

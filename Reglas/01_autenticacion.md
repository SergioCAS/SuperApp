# Autenticación y Control de Acceso

## Registro de usuario

- El registro requiere: correo electrónico, contraseña (mínimo 6 caracteres) y nombre de usuario.
- Al registrarse exitosamente se crea un documento en `users/{uid}` con los campos:
  - `uid`, `email`, `displayName`, `role: "member"`, `approved: false`, `createdAt`
- Si el documento ya existe (usuario que ya se registró antes), no se sobreescribe.
- El `displayName` se toma del campo del formulario; si está vacío se usa el displayName de Auth, o la parte local del correo, o "Usuario".

## Flujo de acceso

1. Sin sesión activa → redirige automáticamente a `/auth`.
2. Con sesión pero `approved = false` → redirige a `/pending` (pantalla de aprobación pendiente).
3. Con sesión y `approved = true` → accede a la app principal (`/`).
4. La aprobación se detecta en tiempo real mediante un listener de Firestore (`onSnapshot`). Cuando un admin aprueba al usuario, la app redirige automáticamente sin necesidad de recargar.

## Cierre de sesión

- Disponible desde la pantalla de autenticación y desde la pantalla de pendiente de aprobación.
- Al cerrar sesión se redirige a `/auth`.

## Errores de autenticación (mensajes amigables)

| Código Firebase            | Mensaje mostrado al usuario                              |
|----------------------------|----------------------------------------------------------|
| `auth/invalid-credential`  | Correo o contraseña incorrectos.                         |
| `auth/email-already-in-use`| Ese correo ya está registrado.                           |
| `auth/invalid-email`       | Correo no válido.                                        |
| `auth/weak-password`       | La contraseña debe tener al menos 6 caracteres.          |
| `auth/too-many-requests`   | Demasiados intentos. Espera un momento y vuelve a intentar. |
| `auth/operation-not-allowed`| El proveedor Email/Password no está habilitado en Firebase Auth. |

## Colección Firestore: `users/{uid}`

| Campo        | Tipo      | Descripción                              |
|--------------|-----------|------------------------------------------|
| `uid`        | string    | UID de Firebase Auth                     |
| `email`      | string    | Correo electrónico                       |
| `displayName`| string    | Nombre visible del usuario               |
| `role`       | string    | `"admin"` o `"member"`                   |
| `approved`   | boolean   | Si el usuario puede acceder a la app     |
| `householdId`| string    | ID del hogar al que pertenece            |
| `createdAt`  | Timestamp | Fecha de creación del perfil             |

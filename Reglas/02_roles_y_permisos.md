# Roles y Permisos

## Roles disponibles

| Rol      | Descripción                                      |
|----------|--------------------------------------------------|
| `member` | Rol por defecto al registrarse. Acceso limitado. |
| `admin`  | Acceso completo. Requiere además `approved=true`. |

## Condición de administrador

Un usuario es considerado **admin activo** solo si cumple AMBAS condiciones:
- `role === "admin"`
- `approved === true`

## Tabla de permisos por módulo

| Acción                                  | member | admin |
|-----------------------------------------|:------:|:-----:|
| Ver lista de artículos pendientes       |   SI   |  SI   |
| Agregar artículos a la lista            |   SI   |  SI   |
| Editar artículos en la lista            |   SI   |  SI   |
| Eliminar (quitar) artículos de la lista |   SI   |  SI   |
| Surtir (marcar como comprado) artículos |   SI   |  SI   |
| Ver tiendas del catálogo                |   SI   |  SI   |
| Agregar tiendas al catálogo             |   SI   |  SI   |
| Editar nombre de tiendas                |   NO   |  SI   |
| Eliminar tiendas                        |   NO   |  SI   |
| Ver épocas                              |   SI   |  SI   |
| Crear épocas                            |   NO   |  SI   |
| Activar/Desactivar épocas               |   NO   |  SI   |
| Eliminar épocas                         |   NO   |  SI   |
| Ver pantalla de administración de usuarios | NO  |  SI   |
| Crear hogares                           |   NO   |  SI   |
| Asignar householdId a usuarios          |   NO   |  SI   |
| Aprobar/Revocar usuarios                |   NO   |  SI   |
| Cambiar rol de usuarios                 |   NO   |  SI   |
| Eliminar perfil de otros usuarios       |   NO   |  SI   |

## Restricciones adicionales

- Un admin **no puede eliminar su propio perfil** desde la pantalla de administración.
- Eliminar un usuario desde la app solo borra el documento en Firestore (`users/{uid}`). La cuenta de Firebase Auth **no se elimina** desde la app; debe hacerse desde la consola de Firebase.
- Los miembros sin `householdId` asignado no pueden ver ni gestionar ningún dato (lista, tiendas, épocas).

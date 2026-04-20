# Hogares (Households)

## Concepto

Un **hogar** es la unidad de organización central de la app. Todos los datos operativos (lista de compras, tiendas, épocas, compras) pertenecen a un hogar y son compartidos entre sus miembros.

## Reglas

- Solo un admin puede crear hogares.
- Solo un admin puede asignar un `householdId` a un usuario.
- Un usuario sin `householdId` no puede ver ni gestionar ningún dato (lista, tiendas, épocas).
- Un usuario solo pertenece a un hogar a la vez (campo `householdId` en su perfil).
- El ID del hogar es un string arbitrario definido por el admin al crearlo (ej. `"casa-sergio"`).

## Creación de hogar

Campos requeridos:
- **ID del hogar**: identificador único (ej. `casa-sergio`). Se usa como clave del documento en Firestore.
- **Nombre del hogar**: nombre descriptivo (ej. `Casa Sergio`).

Al crear se guarda: `name`, `createdByUid`, `createdAt`.

## Colección Firestore: `households/{householdId}`

| Campo          | Tipo      | Descripción                    |
|----------------|-----------|--------------------------------|
| `name`         | string    | Nombre descriptivo del hogar   |
| `createdByUid` | string    | UID del admin que lo creó      |
| `createdAt`    | Timestamp | Fecha de creación              |

## Subcolecciones del hogar

```
households/{householdId}/
  seasons/          -> Épocas recurrentes
  stores_catalog/   -> Catálogo de tiendas
  list_items/       -> Artículos pendientes de compra
  purchases/        -> Historial de compras realizadas
  activity/         -> Registro de actividad reciente
```
